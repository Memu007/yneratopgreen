import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

import {
  CUENTA_INCOMPLETA, CUENTA_LENTA, CUENTA_RECHAZA, DETALLE_CRUDO, SECRETO_DE_ACCESO,
  SECRETO_DE_REFRESCO, firmaDeAviso, levantarDoble,
} from './lib/mp-doble.mjs';
import { queryCount, queryRows, querySql, sqlLiteral } from './lib/sql.mjs';

const API_URL = process.env.SMOKE_API_URL || 'http://localhost:8000/api';
const FRONTEND_URL = process.env.SMOKE_FRONTEND_URL || 'http://localhost:5173';
const forcedFailure = process.argv
  .find((argument) => argument.startsWith('--force-failure='))
  ?.split('=', 2)[1];

if (forcedFailure && forcedFailure !== 'health') {
  console.error(`Fallo forzado desconocido: ${forcedFailure}`);
  console.error('Valor permitido: --force-failure=health');
  process.exit(2);
}

const state = {};
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Carga un contenido de .env con el MISMO Settings de la aplicación. Corre
// donde vive Settings, igual que querySql corre donde vive la base. El archivo
// se escribe adentro a propósito: una clave de más sólo se rechaza cuando
// viene de un archivo, no cuando llega como variable de entorno.
const CARGAR_CON_SETTINGS = `
import os, sys, tempfile
from app.core.config import Settings

contenido = sys.stdin.read()

# Las claves que declara el contenido se SACAN del entorno del proceso antes de
# leerlo. En pydantic-settings el entorno le gana a \`_env_file\`, y adentro del
# contenedor toda clave de \`backend/.env\` llega como variable de entorno —por
# \`env_file:\`— mas las que agrega \`environment:\`. Sin esto, este ayudante no
# mide el contenido que recibe: mide el entorno, y una plantilla peligrosa
# "carga bien" porque su valor nunca se leyo. Medido: con UPLOAD_DIR y
# MP_NOTIFICACION_URL en el entorno, los casos 86 y 110 daban CARGA_OK.
claves = []
for linea in contenido.splitlines():
    linea = linea.strip()
    if not linea or linea.startswith("#") or "=" not in linea:
        continue
    claves.append(linea.split("=", 1)[0].strip())

# Y que el contenido no declare la misma clave dos veces: cual gana no esta
# definido y una prueba no puede apoyarse en eso.
repetidas = sorted({c for c in claves if claves.count(c) > 1})
if repetidas:
    raise SystemExit("CLAVES_REPETIDAS " + ",".join(repetidas))

for clave in claves:
    os.environ.pop(clave, None)

ruta = os.path.join(tempfile.mkdtemp(), "plantilla.env")
with open(ruta, "w", encoding="utf-8") as archivo:
    archivo.write(contenido)
Settings(_env_file=ruta)
print("CARGA_OK")
`;

function cargarConSettings(contenido) {
  try {
    return execFileSync(
      'docker',
      ['exec', '-i', 'topgreen-api', 'python', '-c', CARGAR_CON_SETTINGS],
      { encoding: 'utf8', input: contenido, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (error) {
    // Del traceback interesa el motivo y la clave culpable, no las capas de
    // Pydantic: si el fallo no dice qué clave sobra, la prueba no sirve.
    // «Value error» entra en la lista porque es la forma que toma un rechazo
    // escrito a mano en un validador; sin ella, esos motivos se perdían
    // enteros y la prueba sólo podía afirmar «no cargó», no por qué.
    const salida = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    const motivo = salida
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => /validation error|Extra inputs|Field required|Value error|CLAVES_REPETIDAS|^[A-Z][A-Z0-9_]*$/.test(linea))
      .join(' | ');
    return motivo || salida;
  }
}

// Corre el seed donde vive la aplicación, igual que `cargarConSettings` corre
// Settings ahí y `querySql` habla con la base ahí.
function correrSeed() {
  try {
    return execFileSync(
      'docker',
      ['exec', '-i', 'topgreen-api', 'python', '-m', 'app.seed'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
}

// El transporte de correo de desarrollo escribe cada mensaje como un .eml en
// backend/outbox. La suite lee de ahí el mismo enlace que recibiría la
// persona, en vez de pedirle al backend un endpoint que devuelva el token: ese
// endpoint sería un agujero permanente para no tener que leer un archivo.
const CARPETA_OUTBOX = 'backend/outbox';

function ultimoCorreo() {
  let archivos = [];
  try {
    archivos = readdirSync(CARPETA_OUTBOX).filter((nombre) => nombre.endsWith('.eml'));
  } catch {
    throw new Error(`no existe la carpeta de outbox (${CARPETA_OUTBOX})`);
  }
  assert(archivos.length > 0, 'el outbox no tiene ningún mensaje');
  // Por fecha de modificación y no por nombre: dos mensajes del mismo segundo
  // se ordenarían por el sufijo al azar y el "último" sería cualquiera.
  const reciente = archivos
    .map((nombre) => ({ nombre, cuando: statSync(`${CARPETA_OUTBOX}/${nombre}`).mtimeMs }))
    .sort((a, b) => a.cuando - b.cuando)
    .at(-1);
  return readFileSync(`${CARPETA_OUTBOX}/${reciente.nombre}`, 'utf8');
}

function enlaceDeVerificacion() {
  const cuerpo = ultimoCorreo();
  const enlace = cuerpo.match(/https?:\/\/\S*verificar-correo#token=[A-Za-z0-9_-]+/);
  assert(enlace, `el último correo no trae enlace:\n${cuerpo.slice(0, 400)}`);
  return enlace[0];
}

function tokenDeVerificacion() {
  return enlaceDeVerificacion().split('token=')[1];
}

function contarCorreos() {
  try {
    return readdirSync(CARPETA_OUTBOX).filter((nombre) => nombre.endsWith('.eml')).length;
  } catch {
    return 0;
  }
}

// El alta ya no abre sesión, así que casi todos los casos necesitan además
// confirmar el correo antes de poder ingresar.
async function registrarYVerificar(body) {
  const alta = await apiRequest('/auth/register', { method: 'POST', body });
  await apiRequest('/auth/verify-email', {
    method: 'POST',
    body: { token: tokenDeVerificacion() },
  });
  return alta;
}

// Llama al endpoint real de reenvío con el transporte de correo roto, en el
// mismo proceso de la aplicación. Se hace así y no rompiendo la carpeta del
// outbox porque bajo Docker esa carpeta es un montaje del host y cambiarla
// afuera no rompe nada adentro. Tampoco se agrega ningún interruptor de fallo
// al producto: eso sería una puerta trasera permanente.
function reenviosConTransporteRoto(correos) {
  const script = `
import json, sys
from fastapi.testclient import TestClient
from app.services.correo import ErrorDeCorreo
import app.services.verificacion as verificacion

class TransporteRoto:
    def enviar(self, **kwargs):
        raise ErrorDeCorreo("transporte caido a proposito")

verificacion.obtener_transporte = lambda: TransporteRoto()

from app.main import app as aplicacion
cliente = TestClient(aplicacion)
salida = []
for correo in json.loads(sys.stdin.read()):
    r = cliente.post("/api/auth/resend-verification", json={"email": correo})
    salida.append({"status": r.status_code, "cuerpo": r.text})
print(json.dumps(salida))
`;
  const crudo = execFileSync(
    'docker',
    ['exec', '-i', 'topgreen-api', 'python', '-c', script],
    { encoding: 'utf8', input: JSON.stringify(correos), stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const ultima = crudo.trim().split(/\r?\n/).at(-1);
  return JSON.parse(ultima);
}

// Ejecuta un script de Python donde vive la aplicación, para poder emitir un
// token de sesión a mano. Es el único modo de reproducir "un token emitido
// antes de confirmar": por la API ya no se consigue ninguno.
function emitirTokensDeSesion(email) {
  const script = `
import sys
from app.db.base import SessionLocal
from app.models.user import User
from app.core.security import create_access_token, create_refresh_token
correo = sys.stdin.read().strip()
db = SessionLocal()
u = db.query(User).filter(User.email == correo).first()
if u is None:
    raise SystemExit("no existe " + correo)
print(create_access_token(data={"sub": u.id}))
print(create_refresh_token(data={"sub": u.id}))
`;
  const salida = execFileSync(
    'docker',
    ['exec', '-i', 'topgreen-api', 'python', '-c', script],
    { encoding: 'utf8', input: email, stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim().split(/\r?\n/);
  assert(salida.length === 2, `no se pudieron emitir tokens para ${email}: ${salida.join(' ')}`);
  return { acceso: salida[0], refresco: salida[1] };
}

// Escribe una fila de carrito donde vive la aplicación, con sus modelos. Es el
// único modo de reproducir «un carrito armado antes de que existiera la regla»:
// por la API ya no se puede meter una publicación propia, que es justamente lo
// que hace falta poder reproducir. No se agrega ningún interruptor al producto.
function inyectarEnElCarrito(email, productId, cantidad) {
  const script = `
import json, sys
from app.db.base import SessionLocal
from app.models.cart import Cart, CartItem, CartStatus
from app.models.product import Product
from app.models.user import User

datos = json.loads(sys.stdin.read())
db = SessionLocal()
try:
    usuario = db.query(User).filter(User.email == datos["email"]).first()
    if usuario is None:
        raise SystemExit("no existe " + datos["email"])
    carrito = db.query(Cart).filter(
        Cart.user_id == usuario.id, Cart.status == CartStatus.ACTIVE
    ).first()
    if carrito is None:
        carrito = Cart(user_id=usuario.id, status=CartStatus.ACTIVE)
        db.add(carrito)
        db.flush()
    producto = db.query(Product).filter(Product.id == datos["product_id"]).first()
    if producto is None:
        raise SystemExit("no existe el producto " + datos["product_id"])
    db.add(CartItem(
        cart_id=carrito.id,
        product_id=producto.id,
        quantity=datos["cantidad"],
        unit_price_snapshot=producto.price,
    ))
    db.commit()
    print("INYECTADO")
finally:
    db.close()
`;
  const salida = execFileSync(
    'docker',
    ['exec', '-i', 'topgreen-api', 'python', '-c', script],
    {
      encoding: 'utf8',
      input: JSON.stringify({ email, product_id: productId, cantidad }),
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  assert(salida.includes('INYECTADO'), `no se pudo inyectar el carrito heredado: ${salida}`);
}

// Deja una cuenta sin ningún carrito, que es como estaba antes de la prueba.
// Va por los modelos de la aplicación, igual que `inyectarEnElCarrito`: el
// acceso SQL de las puertas es de lectura de contraste y no fabrica escenarios.
function vaciarCarritosDe(email) {
  const script = `
import sys
from app.db.base import SessionLocal
from app.models.cart import Cart, CartItem
from app.models.user import User

correo = sys.stdin.read().strip()
db = SessionLocal()
try:
    usuario = db.query(User).filter(User.email == correo).first()
    if usuario is None:
        raise SystemExit("no existe " + correo)
    carritos = db.query(Cart).filter(Cart.user_id == usuario.id).all()
    for carrito in carritos:
        db.query(CartItem).filter(CartItem.cart_id == carrito.id).delete()
        db.delete(carrito)
    db.commit()
    print("VACIADO")
finally:
    db.close()
`;
  const salida = execFileSync(
    'docker',
    ['exec', '-i', 'topgreen-api', 'python', '-c', script],
    { encoding: 'utf8', input: email, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  assert(salida.includes('VACIADO'), `no se pudieron vaciar los carritos de ${email}: ${salida}`);
}

// La dependencia opcional no la usa hoy ningún endpoint, así que no tiene
// superficie HTTP donde medirla. Se la llama donde vive, con peticiones armadas
// a mano, que es la única forma honesta de comprobar que no elige identidad.
const PROBAR_OPCIONAL = `
import asyncio, json, sys
from starlette.requests import Request
from app.core.dependencies import get_current_user_optional, security
from app.db.base import SessionLocal

datos = json.loads(sys.stdin.read())

def peticion(cookie=None, header=None):
    encabezados = []
    if cookie:
        encabezados.append((b"cookie", f"access_token={cookie}".encode()))
    if header:
        encabezados.append((b"authorization", f"Bearer {header}".encode()))
    return Request({
        "type": "http", "http_version": "1.1", "method": "GET", "scheme": "http",
        "path": "/", "raw_path": b"/", "query_string": b"", "root_path": "",
        "headers": encabezados, "client": ("127.0.0.1", 0), "server": ("127.0.0.1", 8000),
    })

def quien(cookie=None, header=None):
    pedido = peticion(cookie, header)
    credenciales = asyncio.run(security(pedido))
    db = SessionLocal()
    try:
        usuario = get_current_user_optional(pedido, credenciales, db)
        return usuario.email if usuario else None
    finally:
        db.close()

print(json.dumps({
    "solo_cookie": quien(cookie=datos["a"]),
    "solo_header": quien(header=datos["a"]),
    "iguales": quien(cookie=datos["a"], header=datos["a"]),
    "conflicto": quien(cookie=datos["a"], header=datos["b"]),
    "conflicto_invertido": quien(cookie=datos["b"], header=datos["a"]),
}))
`;

// Una clave de cifrado no vacía pero inválida no es una clave. Antes
// `hay_clave()` sólo miraba que la variable estuviera escrita, así que la
// integración se ofrecía como configurada y la renovación terminaba en 500 al
// intentar descifrar. Se vincula con la clave buena, se rompe la clave, y se
// mira que las tres puertas fallen cerradas y accionables.
const MP_CLAVE_INVALIDA = `
import json
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

# Sin esto un 500 llegaría como excepción y no como respuesta: lo que se
# quiere medir es justamente que no haya 500.
cliente = TestClient(app, base_url="https://testserver", raise_server_exceptions=False)
# La cookie ya no autentica rutas protegidas: la credencial va en la cabecera.
# La cookie sigue guardada en el cliente, que es lo que necesita el callback.
cliente.headers["Authorization"] = "Bearer " + cliente.post(
    "/api/auth/login",
    json={"email": "vendedor@ejemplo.com", "password": "vendedor123"},
).json()["access_token"]

inicio = cliente.post("/api/mp-oauth/auth-url", json={})
state = parse_qs(urlparse(inicio.json()["auth_url"]).query)["state"][0]
cliente.get("/api/mp-oauth/callback", params={"code": "ok:900001", "state": state},
            follow_redirects=False)
antes = cliente.get("/api/mp-oauth/status").json().get("estado")

settings.MP_TOKEN_KEY = "esto-no-es-una-clave-fernet"

estado = cliente.get("/api/mp-oauth/status")
vincular = cliente.post("/api/mp-oauth/auth-url", json={})
renovacion = cliente.post("/api/mp-oauth/refresh", json={})
catalogo = cliente.get("/api/catalog/categories")

print("RESULTADO " + json.dumps({
    "antes": antes,
    "status": estado.status_code,
    "estado": estado.json().get("estado"),
    "auth_url": vincular.status_code,
    "refresh_status": renovacion.status_code,
    "refresh_estado": renovacion.json().get("estado"),
    "motivo": renovacion.json().get("motivo"),
    "catalogo": catalogo.status_code,
    "cuerpos": estado.text + vincular.text + renovacion.text,
}))
`;

// Rotar MP_TOKEN_KEY sin migrar lo guardado deja credenciales que ya no abren.
// Es un escenario real —una rotación a medias, un backup restaurado en otro
// entorno— y el contrato dice que tiene que fallar cerrado y accionable, no
// con un 500. Se prueba adentro de la aplicación porque la rotación es un
// cambio de configuración del proceso, no algo que se pida por HTTP.
const MP_CLAVE_ROTADA = `
import json
from urllib.parse import parse_qs, urlparse

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

cliente = TestClient(app, base_url="https://testserver")
# La cookie ya no autentica rutas protegidas: la credencial va en la cabecera.
# La cookie sigue guardada en el cliente, que es lo que necesita el callback.
cliente.headers["Authorization"] = "Bearer " + cliente.post(
    "/api/auth/login",
    json={"email": "vendedor@ejemplo.com", "password": "vendedor123"},
).json()["access_token"]

inicio = cliente.post("/api/mp-oauth/auth-url", json={})
state = parse_qs(urlparse(inicio.json()["auth_url"]).query)["state"][0]
cliente.get("/api/mp-oauth/callback", params={"code": "ok:900001", "state": state},
            follow_redirects=False)
antes = cliente.get("/api/mp-oauth/status").json()

settings.MP_TOKEN_KEY = Fernet.generate_key().decode()

estado = cliente.get("/api/mp-oauth/status")
renovacion = cliente.post("/api/mp-oauth/refresh", json={})

print("RESULTADO " + json.dumps({
    "antes": antes.get("estado"),
    "status": estado.status_code,
    "estado": estado.json().get("estado"),
    "cuenta": estado.json().get("mp_user_id"),
    "refresh_status": renovacion.status_code,
    "refresh_estado": renovacion.json().get("estado"),
    "motivo": renovacion.json().get("motivo"),
    "cuerpos": estado.text + renovacion.text,
}))
`;

// Con la configuración de Mercado Pago vacía, el vínculo tiene que apagarse
// solo y el resto del marketplace seguir andando. Se prueba dentro de la
// aplicación, con su propio grafo de dependencias: levantar una segunda API en
// otro puerto probaría otra cosa.
const MP_SIN_CONFIGURAR = `
import json
from fastapi.testclient import TestClient
from app.core.config import settings

for clave in ("MP_APP_ID", "MP_CLIENT_SECRET", "MP_REDIRECT_URI", "MP_TOKEN_KEY"):
    setattr(settings, clave, "")

from app.main import app

cliente = TestClient(app, base_url="https://testserver")
# La cookie ya no autentica rutas protegidas: la credencial va en la cabecera.
# La cookie sigue guardada en el cliente, que es lo que necesita el callback.
cliente.headers["Authorization"] = "Bearer " + cliente.post(
    "/api/auth/login",
    json={"email": "vendedor@ejemplo.com", "password": "vendedor123"},
).json()["access_token"]

estado = cliente.get("/api/mp-oauth/status")
vincular = cliente.post("/api/mp-oauth/auth-url", json={})
catalogo = cliente.get("/api/catalog/categories")
productos = cliente.get("/api/catalog/products")

print("RESULTADO " + json.dumps({
    "status": estado.status_code,
    "estado": estado.json().get("estado"),
    "auth_url": vincular.status_code,
    "detalle": str(vincular.json().get("detail", "")),
    "catalogo": catalogo.status_code,
    "productos": productos.status_code,
}))
`;

// Lo que se registra cuando algo sale mal es donde más fácil se escapa un
// secreto: el cuerpo del error de Mercado Pago trae el motivo del rechazo del
// client_secret. Se capta el log de la aplicación mientras pasan las dos cosas
// que más tientan a loguear de más.
//
// El state vencido se fabrica moviendo la constante de la propia aplicación:
// es la única forma de probar el vencimiento sin esperar quince minutos y sin
// escribir filas por afuera del producto.
const MP_LOGS_SIN_SECRETOS = `
import io, json, logging
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from app.main import app
from app.services import mp_vinculo

memoria = io.StringIO()
manejador = logging.StreamHandler(memoria)
manejador.setFormatter(logging.Formatter("%(name)s %(levelname)s %(message)s"))

# Se capta TODO lo que registra la aplicacion -incluidos los rastreos, que es
# donde mas facil se escapa un secreto- y nada de lo que registra el arnes. El
# cliente de pruebas escribe cada URL que pide, con el state adentro; eso es
# ruido de la prueba y no dice nada sobre lo que hace el producto.
ajenos = []

class SoloLaAplicacion(logging.Filter):
    def filter(self, registro):
        if registro.name.split(".")[0] == "app":
            return True
        ajenos.append(registro.name)
        return False

manejador.addFilter(SoloLaAplicacion())
raiz = logging.getLogger()
raiz.addHandler(manejador)
raiz.setLevel(logging.DEBUG)

cliente = TestClient(app, base_url="https://testserver")
# La cookie ya no autentica rutas protegidas: la credencial va en la cabecera.
# La cookie sigue guardada en el cliente, que es lo que necesita el callback.
cliente.headers["Authorization"] = "Bearer " + cliente.post(
    "/api/auth/login",
    json={"email": "vendedor@ejemplo.com", "password": "vendedor123"},
).json()["access_token"]
respuestas = []

def state_nuevo():
    inicio = cliente.post("/api/mp-oauth/auth-url", json={})
    respuestas.append(inicio.text)
    url = inicio.json()["auth_url"]
    return parse_qs(urlparse(url).query)["state"][0]

def motivo(state, code):
    vuelta = cliente.get(
        "/api/mp-oauth/callback", params={"code": code, "state": state},
        follow_redirects=False)
    destino = vuelta.headers.get("location", "")
    respuestas.append(destino)
    return parse_qs(urlparse(destino).query).get("mp_error", [""])[0]

mp_vinculo.MINUTOS_DE_ESTADO = -1
vencido = motivo(state_nuevo(), "ok:900001")

mp_vinculo.MINUTOS_DE_ESTADO = 15
state = state_nuevo()
rechazo = motivo(state, "rechazo")

raiz.removeHandler(manejador)
registro = memoria.getvalue()

print("RESULTADO " + json.dumps({
    "vencido": vencido,
    "rechazo": rechazo,
    "log": registro,
    "lineas": len([l for l in registro.splitlines() if l.strip()]),
    "ajenos": len(ajenos),
    "respuestas": chr(10).join(respuestas),
    "state": state,
}))
`;

// Igual que `correrEnLaApi`, pero sin bloquear el hilo de Node.
//
// Hace falta cuando el caso además levanta el doble de Mercado Pago, porque el
// doble vive en ESTE proceso: con `execFileSync` el hilo se queda esperando al
// guion, el doble no llega a atender la conexión que el guion le abre, y el
// pedido muere por tiempo. El síntoma es «Mercado Pago no respondió» en una
// prueba donde el doble estaba corriendo.
function correrEnLaApiSinBloquear(script, entrada = '') {
  return new Promise((resolver, rechazar) => {
    const hijo = spawn('docker', ['exec', '-i', 'topgreen-api', 'python', '-c', script]);
    let salida = '';
    let error = '';
    hijo.stdout.on('data', (trozo) => { salida += trozo; });
    hijo.stderr.on('data', (trozo) => { error += trozo; });
    hijo.on('error', rechazar);
    hijo.on('close', (codigo) => {
      if (codigo === 0) resolver(salida);
      else rechazar(new Error(`el guion terminó en ${codigo}: ${error.slice(-400)}`));
    });
    hijo.stdin.end(entrada);
  });
}

function correrEnLaApi(script, entrada) {
  return execFileSync(
    'docker',
    ['exec', '-i', 'topgreen-api', 'python', '-c', script],
    { encoding: 'utf8', input: entrada, stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}

// Cada futura orden necesita decir cómo se traslada. En los casos que no
// miran logística la decisión es siempre la misma —el comprador coordina—,
// pero tiene que estar: el checkout ya no acepta un pedido sin resolver.
function trasladoPropio(usuario = state.buyerId) {
  return queryRows(`
    SELECT DISTINCT p.seller_id
    FROM cart_items ci
    JOIN carts c ON c.id = ci.cart_id
    JOIN products p ON p.id = ci.product_id
    WHERE c.user_id = ${sqlLiteral(usuario)} AND c.status = 'ACTIVE'
  `).map(([vendedor]) => ({ seller_id: vendedor, mode: 'self' }));
}

// El destino de un envío dejó de ser texto libre: ahora es una localidad del
// padrón oficial, y de ahí salen la ciudad y la provincia que se muestran.
let localidadDeEnvioCache = null;
function localidadDeEnvio() {
  if (!localidadDeEnvioCache) {
    const [fila] = queryRows(`
      SELECT id FROM localities
      WHERE name = 'Pergamino' AND province_name = 'Buenos Aires'
      LIMIT 1
    `);
    assert(fila, 'el padrón no tiene Pergamino, Buenos Aires');
    [localidadDeEnvioCache] = fila;
  }
  return localidadDeEnvioCache;
}

// El destino del checkout son dos selectores encadenados del padrón: primero
// la provincia, y recién con ella cargada aparece la localidad.
async function elegirDestino(page, localidad, provincia = '06') {
  await page.locator('#checkout-provincia').selectOption(provincia);
  const localidades = page.locator('#checkout-localidad option');
  await page.waitForFunction(
    () => document.querySelectorAll('#checkout-localidad option').length > 1,
    null,
    { timeout: 15_000 },
  );
  await page.locator('#checkout-localidad').selectOption({ label: localidad });
  await localidades.first().waitFor({ state: 'attached' });
}

// Una petición con control fino de dónde va la credencial. `apiRequest` manda
// siempre el header; acá hace falta poder mandar la cookie, las dos, o las dos
// con tokens distintos.
async function pedirCrudo(path, { method = 'GET', header, cookie, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (header) headers.Authorization = `Bearer ${header}`;
  if (cookie) headers.Cookie = cookie;

  // Mismo reintento acotado a errores de socket que usa `apiRequest`: la
  // suite reutiliza conexiones y el servidor cierra alguna cuando pasa un
  // rato entre pedido y pedido. Cualquier HTTP pasa derecho.
  const respuesta = await pedirConReintento(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const crudo = await respuesta.text();
  let datos = null;
  if (crudo) {
    try {
      datos = JSON.parse(crudo);
    } catch {
      datos = crudo;
    }
  }
  return {
    status: respuesta.status,
    datos,
    galletas: respuesta.headers.getSetCookie(),
  };
}

// El checkout ya no avanza hasta que cada pedido diga cómo se traslada. Los
// casos que no miran logística lo resuelven igual que una persona apurada:
// coordino por mi cuenta, uno por uno.
async function resolverTrasladoPropio(page) {
  const propias = page
    .locator('[class*="_fletes_"]')
    .getByRole('radio', { name: /Coordino el traslado por mi cuenta/ });
  await propias.first().waitFor({ state: 'visible', timeout: 20_000 });
  const cuantas = await propias.count();
  for (let i = 0; i < cuantas; i += 1) await propias.nth(i).check();
  return cuantas;
}

/**
 * Elige transferencia en todos los grupos del paso de pago.
 *
 * Ahora hay un medio por vendedor, así que un carrito de dos vendedores tiene
 * dos radios de transferencia. Marcarlos uno por uno es lo que hace el
 * comprador, y deja la decisión explícita incluso cuando es la única posible.
 */
async function elegirTransferencia(page) {
  await page.getByRole('heading', { name: /Medio de pago/i }).waitFor({ timeout: 20_000 });
  const radios = page.locator('input[value="transfer"]');
  await radios.first().waitFor({ state: 'visible', timeout: 20_000 });
  const cuantos = await radios.count();
  for (let i = 0; i < cuantos; i += 1) await radios.nth(i).check();
  return cuantos;
}

// La suite reutiliza conexiones. Si el servidor cierra una justo cuando el
// cliente la iba a usar, el error es de socket y no de la API: no hubo
// respuesta, no hubo status, no hubo nada. Se reintenta UNA vez y sólo en ese
// caso; cualquier HTTP —incluido un 500— pasa derecho, porque eso sí es una
// respuesta y la prueba tiene que verla.
const ERRORES_DE_SOCKET = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'UND_ERR_SOCKET',
]);

function esCorteDeConexion(error) {
  const causa = error?.cause;
  return ERRORES_DE_SOCKET.has(causa?.code) || ERRORES_DE_SOCKET.has(error?.code);
}

async function pedirConReintento(url, opciones) {
  try {
    return await fetch(url, opciones);
  } catch (error) {
    if (!esCorteDeConexion(error)) throw error;
    await new Promise((listo) => setTimeout(listo, 250));
    return fetch(url, opciones);
  }
}

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await pedirConReintento(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const rawBody = await response.text();
  let data = null;
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = rawBody;
    }
  }

  if (!response.ok) {
    const rawDetail =
      typeof data === 'object' && data !== null && 'detail' in data
        ? data.detail
        : rawBody || response.statusText;
    const detail =
      typeof rawDetail === 'string' ? rawDetail : JSON.stringify(rawDetail);
    throw new Error(`${method} ${path} respondió HTTP ${response.status}: ${detail}`);
  }

  return { status: response.status, data };
}

async function apiUpload(path, { token, filename, content, contentType }) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: contentType }), filename);
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const rawBody = await response.text();
  const data = rawBody ? JSON.parse(rawBody) : null;
  if (!response.ok) {
    throw new Error(`POST ${path} respondió HTTP ${response.status}: ${data?.detail || rawBody}`);
  }
  return { status: response.status, data };
}

/**
 * Una carga multipart con la credencial que se le indique, sin ayudarla.
 *
 * `apiUpload` manda siempre la cabecera; acá hace falta poder mandar SÓLO la
 * cookie, que es exactamente lo que hace un sitio ajeno: multipart es un tipo
 * de contenido «simple», así que el navegador lo manda sin verificación previa
 * y con la cookie puesta.
 */
async function subirCrudo(path, { header, cookie, campos = {}, archivo } = {}) {
  const form = new FormData();
  for (const [clave, valor] of Object.entries(campos)) form.append(clave, valor);
  if (archivo) {
    form.append(archivo.campo, new Blob([archivo.contenido], { type: archivo.tipo }),
      archivo.nombre);
  }
  const headers = {};
  if (header) headers.Authorization = `Bearer ${header}`;
  if (cookie) headers.Cookie = cookie;
  // Un origen que no es el nuestro, como el del ataque que reprodujimos.
  headers.Origin = 'https://sitio-atacante.example';

  const respuesta = await pedirConReintento(`${API_URL}${path}`, {
    method: 'POST', headers, body: form,
  });
  const crudo = await respuesta.text();
  let datos = null;
  if (crudo) { try { datos = JSON.parse(crudo); } catch { datos = crudo; } }
  return { status: respuesta.status, datos, galletas: respuesta.headers.getSetCookie() };
}

async function expectApiError(expectedStatus, callback) {
  try {
    await callback();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(`HTTP ${expectedStatus}`), `error inesperado: ${message}`);
    return message;
  }
  throw new Error(`la API no respondió HTTP ${expectedStatus}`);
}

// Correr un subconjunto mientras se desarrolla un caso nuevo. La corrida que
// vale es siempre la completa, así que una corrida filtrada lo dice en el
// resumen y **nunca** puede confundirse con una verde de verdad.
const CASOS_PEDIDOS = (process.env.SMOKE_CASOS || '')
  .split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n) && n > 0);

async function runCase(number, name, callback) {
  if (CASOS_PEDIDOS.length && !CASOS_PEDIDOS.includes(number)) return;
  const startedAt = Date.now();

  try {
    const observation = await callback();
    const elapsed = Date.now() - startedAt;
    results.push({ number, name, passed: true, observation, elapsed });
    console.log(`[PASS] ${String(number).padStart(2, '0')} ${name} — ${observation} (${elapsed} ms)`);
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    // Con SMOKE_STACK=1 se imprime la traza y la causa. El mensaje suelto de
    // un `fetch failed` no dice contra qué falló, y adivinarlo es perder una
    // corrida entera por vez.
    if (process.env.SMOKE_STACK) {
      console.log(error?.stack || error);
      if (error?.cause) console.log('causa:', error.cause);
    }
    results.push({ number, name, passed: false, observation: message, elapsed });
    console.log(`[FAIL] ${String(number).padStart(2, '0')} ${name} — ${message} (${elapsed} ms)`);
  }
}

/**
 * El botón de compra DE ESA publicación.
 *
 * Antes alcanzaba con el primer «Agregar» de la página. Ya no: el activo de
 * alto valor dice «Agregar al carrito», el servicio con precio dice
 * «Contratar», y en la grilla hay una acción por tarjeta. Se busca el título
 * y se baja al botón de su propia tarjeta.
 *
 * Sin sesión el rótulo es otro —«Ingresar para continuar»—, porque la acción
 * también es otra: se ofrece entrar en vez de agregar en silencio.
 */
function accionDeLaTarjeta(page, nombre) {
  const titulo = page.getByRole('heading', { name: nombre, exact: true, level: 3 });
  const tarjeta = titulo.locator('xpath=ancestor::*[contains(@class,"card")]');
  return tarjeta.getByRole('button', { name: /Agregar|Agregar al carrito|Contratar/ }).first();
}

await runCase(1, 'Salud del servicio', async () => {
  const path = forcedFailure === 'health' ? '/health__forced_failure' : '/health';
  const { status, data } = await apiRequest(path);
  assert(data?.status === 'ok', `status inesperado: ${JSON.stringify(data)}`);
  return `HTTP ${status}, status=ok`;
});

await runCase(2, 'Registro de usuario', async () => {
  const credentials = {
    email: 'smoke.comprador@example.com',
    password: 'smoke123',
    full_name: 'Comprador Smoke',
    phone: '+54 11 5555 0101',
    role: 'user',
  };
  const { status, data } = await apiRequest('/auth/register', {
    method: 'POST',
    body: credentials,
  });

  // El alta ya no devuelve sesión: deja la cuenta pendiente de confirmación.
  assert(data?.email === credentials.email, 'el alta no confirma a qué correo escribió');
  assert(data?.verification_required === true, 'el alta no se declara pendiente');
  assert(!data?.access_token && !data?.refresh_token, 'el alta devolvió tokens de sesión');

  await apiRequest('/auth/verify-email', {
    method: 'POST',
    body: { token: tokenDeVerificacion() },
  });

  const [fila] = queryRows(`
    SELECT id, is_verified::text FROM users WHERE email = ${sqlLiteral(credentials.email)}
  `);
  assert(fila, 'el usuario no quedó en la base');
  assert(fila[1] === 'true', 'el usuario no quedó verificado después de confirmar');

  state.buyerCredentials = credentials;
  state.buyerId = fila[0];
  return `HTTP ${status} sin sesión, confirmado por enlace, user_id=${fila[0]}`;
});

await runCase(3, 'Ingreso y obtención del token', async () => {
  assert(state.buyerCredentials, 'caso 2 no dejó credenciales para ingresar');
  const { status, data } = await apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: state.buyerCredentials.email,
      password: state.buyerCredentials.password,
    },
  });

  assert(data?.access_token, 'el login no devolvió access_token');
  assert(data?.refresh_token, 'el login no devolvió refresh_token');
  state.buyerToken = data.access_token;
  state.buyerRefreshToken = data.refresh_token;
  return `HTTP ${status}, JWT recibido`;
});

await runCase(4, 'Catálogo con categoría y precio', async () => {
  const [selection] = queryRows(`
    SELECT category_id::text, MIN(price)::text
    FROM products
    WHERE status = 'ACTIVE'
    GROUP BY category_id
    ORDER BY COUNT(*) DESC, category_id
    LIMIT 1
  `);
  assert(selection, 'la base no tiene productos activos para probar el catálogo');

  const [categoryId, maxPrice] = selection;
  const sqlTotal = queryCount(`
    SELECT COUNT(*)
    FROM products
    WHERE status = 'ACTIVE'
      AND category_id = ${sqlLiteral(categoryId)}
      AND price >= 0
      AND price <= ${Number(maxPrice)}
  `);
  const params = new URLSearchParams({
    category: categoryId,
    min_price: '0',
    max_price: maxPrice,
    page_size: '100',
  });
  const { status, data } = await apiRequest(`/catalog/products?${params}`);

  assert(data.total === sqlTotal, `API=${data.total}, SQL=${sqlTotal}`);
  assert(sqlTotal > 0, 'la combinación elegida no devuelve productos');
  assert(
    data.items.every(
      (item) => item.category_id === categoryId && Number(item.price) <= Number(maxPrice),
    ),
    'la API devolvió un producto fuera de categoría o precio',
  );
  state.catalogCategoryId = categoryId;
  return `HTTP ${status}, API=${data.total}, SQL=${sqlTotal}, max_price=${maxPrice}`;
});

await runCase(5, 'Catálogo con provincia y localidad', async () => {
  const [province] = queryRows(`
    SELECT l.province_id, l.province_name, COUNT(*)::text
    FROM products p
    JOIN localities l ON l.id = p.locality_id
    WHERE p.status = 'ACTIVE'
    GROUP BY l.province_id, l.province_name
    ORDER BY COUNT(*) DESC, l.province_name
    LIMIT 1
  `);
  assert(province, 'la base no tiene productos con provincia');

  const [provinceId, provinceName, provinceSqlTotalRaw] = province;
  const provinceSqlTotal = Number(provinceSqlTotalRaw);
  const provinceParams = new URLSearchParams({ province: provinceName, page_size: '100' });
  const provinceResponse = await apiRequest(`/catalog/products?${provinceParams}`);
  assert(
    provinceResponse.data.total === provinceSqlTotal,
    `provincia API=${provinceResponse.data.total}, SQL=${provinceSqlTotal}`,
  );

  const [locality] = queryRows(`
    SELECT l.id, l.name, COUNT(*)::text
    FROM products p
    JOIN localities l ON l.id = p.locality_id
    WHERE p.status = 'ACTIVE'
      AND l.province_id = ${sqlLiteral(provinceId)}
    GROUP BY l.id, l.name
    ORDER BY COUNT(*) DESC, l.name
    LIMIT 1
  `);
  assert(locality, `no hay localidades con productos en ${provinceName}`);

  const [localityId, localityName, localitySqlTotalRaw] = locality;
  const localitySqlTotal = Number(localitySqlTotalRaw);
  const localityParams = new URLSearchParams({
    province: provinceName,
    locality_id: localityId,
    page_size: '100',
  });
  const localityResponse = await apiRequest(`/catalog/products?${localityParams}`);
  assert(
    localityResponse.data.total === localitySqlTotal,
    `localidad API=${localityResponse.data.total}, SQL=${localitySqlTotal}`,
  );

  state.location = { provinceId, provinceName, localityId, localityName };
  return [
    `provincia HTTP ${provinceResponse.status}, API=${provinceResponse.data.total}, SQL=${provinceSqlTotal}`,
    `localidad HTTP ${localityResponse.status}, API=${localityResponse.data.total}, SQL=${localitySqlTotal}`,
  ].join('; ');
});

await runCase(6, 'Detalle de producto', async () => {
  const sellerLogin = await apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: 'vendedor@ejemplo.com',
      password: 'vendedor123',
    },
  });
  state.sellerToken = sellerLogin.data.access_token;
  state.sellerRefreshToken = sellerLogin.data.refresh_token;
  state.sellerId = sellerLogin.data.user.id;

  const params = new URLSearchParams({
    seller_id: state.sellerId,
    in_stock: 'true',
    page_size: '100',
  });
  const catalog = await apiRequest(`/catalog/products?${params}`);
  const product = catalog.data.items.find(
    (item) => !item.is_service && Number(item.stock) > 0,
  );
  assert(product, 'el vendedor demo no tiene un producto activo con stock');

  const detail = await apiRequest(`/catalog/products/${product.id}`);
  assert(detail.data.id === product.id, 'el detalle no corresponde al producto pedido');
  state.product = product;
  return `HTTP ${detail.status}, product_id=${product.id}, "${product.name}"`;
});

await runCase(7, 'Agregar al carrito y verlo', async () => {
  assert(state.buyerToken, 'caso 3 no dejó token de comprador');
  assert(state.product, 'caso 6 no dejó producto para el carrito');

  const added = await apiRequest('/cart/items', {
    method: 'POST',
    token: state.buyerToken,
    body: { product_id: state.product.id, quantity: 1 },
  });
  const cart = await apiRequest('/cart', { token: state.buyerToken });
  const item = cart.data.items.find((candidate) => candidate.product_id === state.product.id);

  assert(item, 'el producto agregado no aparece en el carrito');
  assert(item.quantity === 1, `cantidad inesperada: ${item.quantity}`);
  state.cartId = cart.data.id;
  return `POST ${added.status}, GET ${cart.status}, total_items=${cart.data.total_items}`;
});

await runCase(8, 'Crear orden desde el carrito', async () => {
  assert(state.buyerToken, 'no hay token de comprador');
  const order = await apiRequest('/orders/checkout', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: 'Av. Smoke 123',
      shipping_locality_id: localidadDeEnvio(),
      shipping_postal_code: '7620',
      notes: 'Orden automatizada sin pago',
      shipping_decisions: trasladoPropio(),
      payment_decisions: [{ seller_id: state.sellerId, method: 'transfer' }],
    },
  });

  // El checkout devuelve TODAS las órdenes del carrito, incluso cuando es una.
  assert(Array.isArray(order.data?.orders), 'checkout no devolvió la lista de órdenes');
  assert(order.data.orders.length === 1,
    `esperaba una orden, devolvió ${order.data.orders.length}`);
  const [creada] = order.data.orders;
  assert(creada.order_id, 'la orden creada no trae identificador');
  assert(creada.payment_method === 'transfer',
    `la orden quedó con medio ${creada.payment_method}`);
  state.orderId = creada.order_id;

  // Y los ítems del carrito quedaron en la orden: se comprueba contra el
  // detalle, no contra la respuesta del checkout, que ya no los repite.
  const detalle = await apiRequest(`/orders/${creada.order_id}`, { token: state.buyerToken });
  assert(detalle.data.items?.length === 1, 'la orden no conserva el ítem del carrito');
  return `HTTP ${order.status}, order_id=${creada.order_id}, status=${creada.status}, `
    + `medio=${creada.payment_method}`;
});

await runCase(9, 'Publicar producto como vendedor desde la interfaz', async () => {
  assert(state.sellerToken, 'caso 6 no dejó token de vendedor');
  assert(state.product?.category_name, 'no hay categoría para completar el formulario');
  assert(state.location, 'caso 5 no dejó provincia/localidad');

  const productName = `Producto Smoke UI ${Date.now()}`;
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const applicationConsoleErrors = [];

  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.sellerToken,
        refreshToken: state.sellerRefreshToken,
      },
    );

    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error'
        && /Error al|Uncaught|TypeError|ReferenceError/i.test(message.text())
      ) {
        applicationConsoleErrors.push(message.text());
      }
    });

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    const sellButton = page.getByRole('button', { name: /Vender/i }).first();
    await sellButton.waitFor({ state: 'visible', timeout: 15_000 });
    await sellButton.click();

    await page
      .getByRole('heading', { name: /Publicar un producto/i })
      .waitFor({ state: 'visible' });
    await page.locator('#name').fill(productName);

    const categoryOption = page
      .locator('#category option')
      .filter({ hasText: state.product.category_name })
      .first();
    await categoryOption.waitFor({ state: 'attached', timeout: 10_000 });
    await page.locator('#category').selectOption({ label: state.product.category_name });

    await page
      .locator('#description')
      .fill('Producto creado por la suite integral de smoke tests de TopGreen.');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'smoke-product.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.locator('#price').fill('12345');
    await page.locator('#stock').fill('3');
    await page.locator('#province').selectOption(state.location.provinceId);
    await page.locator('#locality').selectOption(state.location.localityId);
    await page.locator('form button[type="submit"]').click();
    await page
      .getByText(/publicado exitosamente!/i)
      .waitFor({ state: 'visible', timeout: 20_000 });

    assert(pageErrors.length === 0, `errores JS: ${pageErrors.join(' | ')}`);
    assert(
      applicationConsoleErrors.length === 0,
      `errores de consola: ${applicationConsoleErrors.join(' | ')}`,
    );

    const myProducts = await apiRequest('/products/my', { token: state.sellerToken });
    const published = myProducts.data.products?.find(
      (product) => product.name === productName,
    );
    assert(published, 'la API del vendedor no devuelve el producto publicado por UI');

    const [databaseProduct] = queryRows(`
      SELECT p.id::text, COUNT(pi.id)::text
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.name = ${sqlLiteral(productName)}
        AND p.seller_id = ${sqlLiteral(state.sellerId)}
        AND p.locality_id = ${sqlLiteral(state.location.localityId)}
      GROUP BY p.id
    `);
    assert(databaseProduct, 'la publicación de UI no quedó en la base');
    assert(
      Number(databaseProduct[1]) === 1,
      `la publicación quedó con ${databaseProduct[1]} imágenes en vez de 1`,
    );

    state.publishedProductId = databaseProduct[0];
    return `UI + API + DB, product_id=${databaseProduct[0]}, imágenes=1`;
  } finally {
    await browser.close();
  }
});

await runCase(10, 'Fallo de imagen visible sin perder la publicación', async () => {
  assert(state.sellerToken, 'caso 6 no dejó token de vendedor');
  assert(state.product?.category_name, 'no hay categoría para completar el formulario');
  assert(state.location, 'caso 5 no dejó provincia/localidad');

  const productName = `Producto Smoke Imagen Fallida ${Date.now()}`;
  const failureReason = 'Archivo demasiado grande (prueba controlada)';
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const applicationConsoleErrors = [];
  let uploadIntercepted = false;

  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.sellerToken,
        refreshToken: state.sellerRefreshToken,
      },
    );

    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error'
        && /Error al|Uncaught|TypeError|ReferenceError/i.test(message.text())
      ) {
        applicationConsoleErrors.push(message.text());
      }
    });
    await page.route('**/api/products/*/images', async (route) => {
      uploadIntercepted = true;
      await route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({ detail: failureReason }),
      });
    });

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    const sellButton = page.getByRole('button', { name: /Vender/i }).first();
    await sellButton.waitFor({ state: 'visible', timeout: 15_000 });
    await sellButton.click();

    await page
      .getByRole('heading', { name: /Publicar un producto/i })
      .waitFor({ state: 'visible' });
    await page.locator('#name').fill(productName);
    await page.locator('#category').selectOption({ label: state.product.category_name });
    await page
      .locator('#description')
      .fill('Producto publicado aunque falle la carga de su imagen.');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'smoke-upload-failure.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.locator('#price').fill('23456');
    await page.locator('#stock').fill('2');
    await page.locator('#province').selectOption(state.location.provinceId);
    await page.locator('#locality').selectOption(state.location.localityId);
    await page.locator('form button[type="submit"]').click();

    const warning = page.getByText(/publicado, pero no se pudo subir la imagen/i);
    await warning.waitFor({ state: 'visible', timeout: 20_000 });
    const warningText = await warning.textContent();
    assert(
      warningText?.includes(failureReason),
      `el aviso no incluye el motivo: ${warningText}`,
    );
    await page.getByText(productName, { exact: true }).first().waitFor({
      state: 'visible',
      timeout: 20_000,
    });

    assert(uploadIntercepted, 'Playwright no interceptó la petición de imagen');
    assert(pageErrors.length === 0, `errores JS: ${pageErrors.join(' | ')}`);
    assert(
      applicationConsoleErrors.length === 0,
      `errores de consola: ${applicationConsoleErrors.join(' | ')}`,
    );

    const [databaseProduct] = queryRows(`
      SELECT p.id::text, COUNT(pi.id)::text
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.name = ${sqlLiteral(productName)}
        AND p.seller_id = ${sqlLiteral(state.sellerId)}
      GROUP BY p.id
    `);
    assert(databaseProduct, 'el producto sin imagen no quedó en la base');
    assert(
      Number(databaseProduct[1]) === 0,
      `la subida interceptada dejó ${databaseProduct[1]} imágenes`,
    );

    return `UI + DB, producto visible, aviso="${failureReason}", imágenes=0`;
  } finally {
    await browser.close();
  }
});

await runCase(11, 'Ver mis compras y mis ventas', async () => {
  assert(state.orderId, 'caso 8 no dejó una orden');
  const purchases = await apiRequest('/orders/my?as_role=buyer', {
    token: state.buyerToken,
  });
  const sales = await apiRequest('/orders/my?as_role=seller', {
    token: state.sellerToken,
  });

  assert(
    purchases.data.some((order) => order.id === state.orderId),
    'la orden creada no aparece en mis compras',
  );
  assert(
    sales.data.some((order) => order.id === state.orderId),
    'la orden creada no aparece en mis ventas',
  );
  return `compras HTTP ${purchases.status} (${purchases.data.length}), ventas HTTP ${sales.status} (${sales.data.length})`;
});

await runCase(12, 'Administración: usuarios, productos y órdenes', async () => {
  const adminLogin = await apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@topgreen.com',
      password: 'admin123',
    },
  });
  const adminToken = adminLogin.data.access_token;
  const [users, products, orders] = await Promise.all([
    apiRequest('/admin/users?page_size=100', { token: adminToken }),
    apiRequest('/admin/products?page_size=100', { token: adminToken }),
    apiRequest('/admin/orders?page_size=100', { token: adminToken }),
  ]);

  const sqlUsers = queryCount('SELECT COUNT(*) FROM users');
  const sqlProducts = queryCount('SELECT COUNT(*) FROM products');
  const sqlOrders = queryCount('SELECT COUNT(*) FROM orders');

  assert(users.data.total === sqlUsers, `usuarios API=${users.data.total}, SQL=${sqlUsers}`);
  assert(
    products.data.total === sqlProducts,
    `productos API=${products.data.total}, SQL=${sqlProducts}`,
  );
  assert(orders.data.total === sqlOrders, `órdenes API=${orders.data.total}, SQL=${sqlOrders}`);
  return [
    `usuarios HTTP ${users.status}, API=SQL=${sqlUsers}`,
    `productos HTTP ${products.status}, API=SQL=${sqlProducts}`,
    `órdenes HTTP ${orders.status}, API=SQL=${sqlOrders}`,
  ].join('; ');
});

await runCase(13, 'Desde el seed, los dos vendedores ya cobran por transferencia', async () => {
  // Parte del seed limpio: no hay ningun PATCH previo de datos bancarios en la
  // suite. Si el seed no los cargara, este caso falla y esa es su razon de ser.
  assert(state.buyerToken, 'caso 3 no dejó token de comprador');
  const adminLogin = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'admin@topgreen.com', password: 'admin123' },
  });
  const adminId = adminLogin.data.user.id;
  assert(adminId !== state.sellerId, 'el admin y el vendedor demo son el mismo usuario');

  // La publicacion MAS CARA de cada vendedor, a proposito: la del admin es el
  // campo de $950.000.000 y antes hacia estallar el carrito con un 500. Elegir
  // la mas cara es lo que prueba que el techo de cien millones ya no existe.
  const publicacionDe = async (sellerId) => {
    const params = new URLSearchParams({
      seller_id: sellerId,
      in_stock: 'true',
      page_size: '100',
    });
    const catalogo = await apiRequest(`/catalog/products?${params}`);
    const item = catalogo.data.items
      .filter((candidate) => !candidate.is_service && Number(candidate.stock) > 0)
      .sort((a, b) => Number(b.price) - Number(a.price))[0];
    assert(item, `el vendedor ${sellerId} no tiene publicacion activa con stock`);
    return item;
  };
  const delVendedor = await publicacionDe(state.sellerId);
  const delAdmin = await publicacionDe(adminId);
  assert(
    Number(delAdmin.price) > 100000000,
    `la publicacion mas cara del admin deberia superar los cien millones, es ${delAdmin.price}`,
  );
  state.publicacionCara = delAdmin;

  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  for (const producto of [delVendedor, delAdmin]) {
    await apiRequest('/cart/items', {
      method: 'POST',
      token: state.buyerToken,
      body: { product_id: producto.id, quantity: 1 },
    });
  }

  const opciones = await apiRequest('/orders/payment-options', { token: state.buyerToken });
  const detalles = [];
  for (const [etiqueta, sellerId] of [['vendedor', state.sellerId], ['admin', adminId]]) {
    const opcion = opciones.data.find((candidate) => candidate.seller_id === sellerId);
    assert(opcion, `la API no ofrecio transferencia para el ${etiqueta}`);
    assert(opcion.methods.includes('transfer'),
      `el ${etiqueta} no tiene transferencia entre sus medios: ${JSON.stringify(opcion.methods)}`);
    assert(opcion.cbu, `el ${etiqueta} salio del seed sin CBU`);
    assert(opcion.alias_bancario, `el ${etiqueta} salio del seed sin alias`);

    const [banco] = queryRows(`
      SELECT cbu, alias_bancario
      FROM users
      WHERE id = ${sqlLiteral(sellerId)}
    `);
    assert(opcion.cbu === banco[0], `${etiqueta}: CBU de API distinto del de SQL`);
    assert(
      opcion.alias_bancario === banco[1],
      `${etiqueta}: alias de API distinto del de SQL`,
    );
    detalles.push(`${etiqueta} CBU=${opcion.cbu} alias=${opcion.alias_bancario} API=SQL`);
  }

  // el carrito queda vacio para que los casos siguientes armen el suyo
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  return `HTTP ${opciones.status}, sin PATCH previo; `
    + `la mas cara del admin es "${delAdmin.name}" a $${delAdmin.price} y entra al carrito; `
    + detalles.join('; ');
});

await runCase(14, 'Sin CBU ni alias, la transferencia no se ofrece ni se acepta', async () => {
  // El caso crea su propio estado faltante y lo restaura: ya no depende de que
  // el seed venga incompleto, porque desde el caso 13 el seed viene completo.
  const [previo] = queryRows(`
    SELECT coalesce(cbu, ''), coalesce(alias_bancario, '')
    FROM users
    WHERE id = ${sqlLiteral(state.sellerId)}
  `);
  assert(previo[0] || previo[1], 'el vendedor ya venía sin datos bancarios: el seed no cargó');

  await apiRequest('/auth/me', {
    method: 'PATCH',
    token: state.sellerToken,
    body: { cbu: '', alias_bancario: '' },
  });
  try {
    await apiRequest('/cart/items', {
      method: 'POST',
      token: state.buyerToken,
      body: { product_id: state.product.id, quantity: 1 },
    });
    // El medio deja de ofrecerse, y el resto del carrito sigue siendo
    // consultable: un vendedor sin datos bancarios ya no voltea la consulta
    // entera, porque no tener CBU dejó de significar no poder cobrar.
    const opciones = await apiRequest('/orders/payment-options', { token: state.buyerToken });
    const opcion = opciones.data.find((o) => o.seller_id === state.sellerId);
    assert(opcion, 'payment-options no trajo al vendedor del carrito');
    assert(!opcion.methods.includes('transfer'),
      `se ofreció transferencia sin datos bancarios: ${JSON.stringify(opcion.methods)}`);
    assert(!opcion.cbu && !opcion.alias_bancario,
      'se devolvieron datos bancarios que no existen');
    if (opcion.methods.length === 0) {
      assert(/no configuró CBU ni alias/i.test(opcion.reason || ''),
        `motivo inesperado: ${opcion.reason}`);
    }

    // Y el servidor lo rechaza igual si el cliente insiste: lo que no se
    // ofrece tampoco se acepta.
    const error = await expectApiError(400, () =>
      apiRequest('/orders/checkout/transfer', {
        method: 'POST',
        token: state.buyerToken,
        body: {
          shipping_address: 'Av. Smoke 123',
          shipping_locality_id: localidadDeEnvio(),
          shipping_postal_code: '7620',
          shipping_decisions: trasladoPropio(),
        },
      }),
    );
    assert(/no puede recibir pagos por ese medio/i.test(error),
      `motivo inesperado: ${error}`);
  } finally {
    // se restaura pase lo que pase, para no dejar la base peor que como estaba
    await apiRequest('/auth/me', {
      method: 'PATCH',
      token: state.sellerToken,
      body: { cbu: previo[0], alias_bancario: previo[1] },
    });
  }
  const [restaurado] = queryRows(`
    SELECT coalesce(cbu, ''), coalesce(alias_bancario, '')
    FROM users
    WHERE id = ${sqlLiteral(state.sellerId)}
  `);
  assert(restaurado[0] === previo[0], 'no se restauró el CBU del vendedor');
  assert(restaurado[1] === previo[1], 'no se restauró el alias del vendedor');
  return 'sin CBU ni alias: el medio no aparece en payment-options y el checkout '
    + 'lo rechaza con HTTP 400; estado bancario vaciado y restaurado por la prueba';
});

await runCase(15, 'Datos bancarios correctos y orden esperando comprobante', async () => {
  const bankData = {
    cbu: '2850590940090418135201',
    alias_bancario: 'topgreen.smoke',
  };
  await apiRequest('/auth/me', {
    method: 'PATCH',
    token: state.sellerToken,
    body: bankData,
  });
  const options = await apiRequest('/orders/payment-options', {
    token: state.buyerToken,
  });
  const [databaseBank] = queryRows(`
    SELECT cbu, alias_bancario
    FROM users
    WHERE id = ${sqlLiteral(state.sellerId)}
  `);
  const sellerOption = options.data.find((option) => option.seller_id === state.sellerId);
  assert(sellerOption, 'la API no devolvió el vendedor del carrito');
  assert(sellerOption.cbu === databaseBank[0], 'el CBU de API no coincide con SQL');
  assert(
    sellerOption.alias_bancario === databaseBank[1],
    'el alias de API no coincide con SQL',
  );

  const checkout = await apiRequest('/orders/checkout/transfer', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: 'Av. Transferencia 123',
      shipping_locality_id: localidadDeEnvio(),
      shipping_postal_code: '2000',
      notes: 'Orden smoke por transferencia',
      shipping_decisions: trasladoPropio(),
    },
  });
  const [order] = checkout.data.orders;
  assert(order?.status === 'awaiting_transfer_receipt', `estado inesperado: ${order?.status}`);
  assert(order.cbu === databaseBank[0], 'la orden no devolvió el CBU correcto');
  state.transferOrderId = order.order_id;

  await apiRequest('/auth/me', {
    method: 'PATCH',
    token: state.sellerToken,
    body: {
      cbu: '0000003100098765432101',
      alias_bancario: 'topgreen.cambio',
    },
  });
  const buyerOrders = await apiRequest('/orders/my?as_role=buyer', {
    token: state.buyerToken,
  });
  const savedOrder = buyerOrders.data.find((candidate) => candidate.id === order.order_id);
  const [databaseSnapshot] = queryRows(`
    SELECT transfer_cbu, transfer_alias_bancario, transfer_account_holder
    FROM orders
    WHERE id = ${sqlLiteral(order.order_id)}
  `);
  assert(savedOrder?.seller_cbu === bankData.cbu, 'la orden cambió su CBU junto con el perfil');
  assert(
    savedOrder?.seller_alias_bancario === bankData.alias_bancario,
    'la orden cambió su alias junto con el perfil',
  );
  assert(databaseSnapshot[0] === bankData.cbu, 'SQL no conservó el CBU original');
  assert(databaseSnapshot[1] === bankData.alias_bancario, 'SQL no conservó el alias original');
  assert(databaseSnapshot[2] === order.seller_name, 'SQL no conservó el titular original');
  return `HTTP ${checkout.status}, order_id=${order.order_id}, snapshot API=SQL intacto tras cambiar el perfil`;
});

await runCase(16, 'Comprobante fallido visible y comprobante válido asociado', async () => {
  const failure = await expectApiError(400, () =>
    apiUpload(`/orders/${state.transferOrderId}/transfer-receipt`, {
      token: state.buyerToken,
      filename: 'comprobante.txt',
      content: 'archivo inválido',
      contentType: 'text/plain',
    }),
  );
  assert(/Formato de archivo no permitido/i.test(failure), `motivo inesperado: ${failure}`);

  const statusAfterFailure = querySql(`
    SELECT status::text
    FROM orders
    WHERE id = ${sqlLiteral(state.transferOrderId)}
  `);
  const receiptsAfterFailure = queryCount(`
    SELECT COUNT(*)
    FROM orders
    WHERE id = ${sqlLiteral(state.transferOrderId)}
      AND transfer_receipt_url IS NOT NULL
  `);
  assert(statusAfterFailure === 'AWAITING_TRANSFER_RECEIPT', `estado tras fallo: ${statusAfterFailure}`);
  assert(receiptsAfterFailure === 0, 'el fallo dejó un comprobante asociado');

  const uploaded = await apiUpload(`/orders/${state.transferOrderId}/transfer-receipt`, {
    token: state.buyerToken,
    filename: 'comprobante.png',
    content: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
    contentType: 'image/png',
  });
  const [databaseReceipt] = queryRows(`
    SELECT status::text, transfer_receipt_url
    FROM orders
    WHERE id = ${sqlLiteral(state.transferOrderId)}
  `);
  assert(databaseReceipt[0] === 'TRANSFER_RECEIPT_SUBMITTED', `estado: ${databaseReceipt[0]}`);
  assert(databaseReceipt[1] === uploaded.data.transfer_receipt_url, 'URL API y SQL no coinciden');
  const stored = await fetch(`${new URL(API_URL).origin}${databaseReceipt[1]}`);
  assert(stored.status === 200, `el archivo guardado respondió HTTP ${stored.status}`);
  return `fallo HTTP 400 sin cambiar orden; archivo HTTP 200; URL API=SQL`;
});

await runCase(17, 'Sólo el vendedor correcto valida el comprobante', async () => {
  await registrarYVerificar({
    email: 'otro.vendedor.smoke@example.com',
    password: 'smoke123',
    full_name: 'Otro Vendedor Smoke',
    role: 'user',
  });
  const otherSeller = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'otro.vendedor.smoke@example.com', password: 'smoke123' },
  });
  await expectApiError(403, () =>
    apiRequest(`/orders/${state.transferOrderId}/transfer-receipt`, {
      method: 'PATCH',
      token: otherSeller.data.access_token,
      body: { decision: 'approve' },
    }),
  );
  const approved = await apiRequest(`/orders/${state.transferOrderId}/transfer-receipt`, {
    method: 'PATCH',
    token: state.sellerToken,
    body: { decision: 'approve' },
  });
  assert(approved.data.status === 'paid', `estado tras aprobar: ${approved.data.status}`);
  const databaseStatus = querySql(`
    SELECT status::text FROM orders WHERE id = ${sqlLiteral(state.transferOrderId)}
  `);
  assert(databaseStatus === 'PAID', `estado SQL tras aprobar: ${databaseStatus}`);
  state.otherSellerToken = otherSeller.data.access_token;
  return 'otro vendedor HTTP 403; vendedor correcto dejó API=paid y SQL=PAID';
});

await runCase(18, 'Rechazo de comprobante guarda el motivo', async () => {
  await apiRequest('/cart/items', {
    method: 'POST',
    token: state.buyerToken,
    body: { product_id: state.product.id, quantity: 1 },
  });
  const checkout = await apiRequest('/orders/checkout/transfer', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: 'Av. Rechazo 456',
      shipping_locality_id: localidadDeEnvio(),
      shipping_postal_code: '2000',
      shipping_decisions: trasladoPropio(),
    },
  });
  const rejectedOrder = checkout.data.orders[0];
  await apiUpload(`/orders/${rejectedOrder.order_id}/transfer-receipt`, {
    token: state.buyerToken,
    filename: 'comprobante-rechazo.png',
    content: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
    contentType: 'image/png',
  });
  const reason = 'El monto del comprobante no coincide';
  const rejected = await apiRequest(`/orders/${rejectedOrder.order_id}/transfer-receipt`, {
    method: 'PATCH',
    token: state.sellerToken,
    body: { decision: 'reject', reason },
  });
  assert(rejected.data.status === 'rejected', `estado API: ${rejected.data.status}`);
  const [databaseRejection] = queryRows(`
    SELECT status::text, cancellation_reason
    FROM orders
    WHERE id = ${sqlLiteral(rejectedOrder.order_id)}
  `);
  assert(databaseRejection[0] === 'REJECTED', `estado SQL: ${databaseRejection[0]}`);
  assert(databaseRejection[1] === reason, 'el motivo API no quedó guardado');
  return `API=rejected, SQL=REJECTED, motivo guardado="${reason}"`;
});

await runCase(19, 'Transferencia completa desde la interfaz', async () => {
  const [databaseBank] = queryRows(`
    SELECT cbu, alias_bancario
    FROM users
    WHERE id = ${sqlLiteral(state.sellerId)}
  `);
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];

  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.buyerToken,
        refreshToken: state.buyerRefreshToken,
      },
    );
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForFunction(
      () => document.querySelectorAll('#catalog-category option').length > 1,
    );
    await page.locator('#catalog-type').selectOption('productos');
    await page.getByRole('button', { name: /Agregar|Agregar al carrito|Contratar/ }).first().click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();

    await page.getByRole('heading', { name: /Datos de env/i }).waitFor();
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
    await elegirDestino(page, 'Pergamino');
    await page
      .getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B')
      .fill('Av. Transferencia UI 789');
    await page.getByPlaceholder('2000').fill('2000');
    await resolverTrasladoPropio(page);
    await page.locator('form:has(h2) button[type="submit"]').click();

    await elegirTransferencia(page);
    await page
      .getByText(/TopGreen no recibe ni retiene el dinero/)
      .waitFor({ state: 'visible' });
    await page.getByText(new RegExp(databaseBank[1])).waitFor({ state: 'visible' });
    const bankDetails = await page.locator('form:has(h2)').textContent();
    assert(bankDetails?.includes(databaseBank[0]), 'la UI no muestra el CBU guardado en SQL');
    assert(bankDetails?.includes(databaseBank[1]), 'la UI no muestra el alias guardado en SQL');
    await page.getByRole('button', { name: /Confirmar y crear las órdenes/ }).click();

    await page.getByRole('heading', { name: /Tus órdenes/ }).waitFor();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'comprobante-ui.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.getByRole('button', { name: 'Adjuntar comprobante' }).click();
    await page
      .getByText(/Comprobante enviado\. Esperando la validación del vendedor/)
      .waitFor({ state: 'visible', timeout: 15_000 });

    assert(pageErrors.length === 0, `errores JS: ${pageErrors.join(' | ')}`);
    const [databaseOrder] = queryRows(`
      SELECT status::text, transfer_receipt_url, order_number
      FROM orders
      WHERE buyer_id = ${sqlLiteral(state.buyerId)}
        AND seller_id = ${sqlLiteral(state.sellerId)}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    assert(databaseOrder[0] === 'TRANSFER_RECEIPT_SUBMITTED', `estado SQL: ${databaseOrder[0]}`);
    assert(databaseOrder[1], 'la orden creada por UI no guardó el comprobante');

    const transferPanel = (await page.locator('body').textContent()) || '';
    assert(
      transferPanel.includes(databaseOrder[2]),
      `la UI no muestra ${databaseOrder[2]} como referencia de pago`,
    );
    assert(
      /como concepto de la transferencia/i.test(transferPanel),
      'la UI no instruye a usar la referencia como concepto del pago',
    );

    const sellerContext = await browser.newContext();
    try {
      await sellerContext.addInitScript(
        ({ accessToken, refreshToken }) => {
          window.localStorage.setItem('access_token', accessToken);
          window.localStorage.setItem('refresh_token', refreshToken);
        },
        {
          accessToken: state.sellerToken,
          refreshToken: state.sellerRefreshToken,
        },
      );
      const sellerPage = await sellerContext.newPage();
      await sellerPage.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await sellerPage.getByRole('button', { name: 'Mi cuenta' }).first().click();
      await sellerPage.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
      await sellerPage.getByRole('button', { name: 'Mis Ventas' }).click();
      const saleHeading = sellerPage.getByRole('heading', {
        name: `Venta #${databaseOrder[2]}`,
      });
      await saleHeading.waitFor({ state: 'visible' });
      const saleCard = saleHeading.locator('xpath=../../..');
      const warning = saleCard.getByText(/Verificá el dinero en tu cuenta bancaria/);
      await warning.waitFor({ state: 'visible' });
      const warningPrecedesButtons = await saleCard.evaluate((card) => {
        const warningElement = [...card.querySelectorAll('p')].find((element) =>
          element.textContent?.includes('Verificá el dinero en tu cuenta bancaria')
        );
        const approveButton = [...card.querySelectorAll('button')].find((element) =>
          element.textContent?.includes('Aprobar comprobante')
        );
        return Boolean(
          warningElement
          && approveButton
          && warningElement.compareDocumentPosition(approveButton)
            & Node.DOCUMENT_POSITION_FOLLOWING
        );
      });
      assert(warningPrecedesButtons, 'el aviso del vendedor no está antes de aprobar/rechazar');
    } finally {
      await sellerContext.close();
    }

    return 'UI + API + DB, avisos visibles al comprador y vendedor antes de aprobar';
  } finally {
    await browser.close();
  }
});

await runCase(20, 'Las rutas financieras heredadas no están expuestas', async () => {
  await expectApiError(404, () => apiRequest('/payments/public-key'));
  await expectApiError(404, () => apiRequest('/payments/simulate-payment/inexistente', {
    method: 'POST',
    token: state.buyerToken,
  }));

  // El vínculo OAuth sí está montado, y es lo único de Mercado Pago que
  // existe: conectar la cuenta donde cobra un vendedor no mueve un peso.
  // Hasta la pieza MP-A esta ruta también daba 404, y esperar eso hoy sería
  // exigir que la parte aceptada no exista. El inventario completo de su
  // superficie —y que la de cobro sigue cerrada— está en el caso 67.
  const { status, data } = await apiRequest('/mp-oauth/status', {
    token: state.sellerToken,
  });
  assert(status === 200 && typeof data?.estado === 'string',
    `/mp-oauth/status respondió ${status}: ${JSON.stringify(data)}`);
  assert(!JSON.stringify(data).includes('token'),
    `el estado del vínculo menciona un token: ${JSON.stringify(data)}`);

  return 'payments y simulate-payment en HTTP 404; el vínculo OAuth contesta su '
    + `estado ("${data.estado}") sin exponer credenciales`;
});

await runCase(21, 'Una foto de relleno no se pide, y una rota no rompe el recorrido', async () => {
  // Este caso probaba que una URL rota se reemplazara por un respaldo. La
  // propiedad ahora es más fuerte: las URLs de relleno del seed —`picsum`
  // devuelve una foto AL AZAR— ni siquiera se piden, porque no fallan nunca y
  // esperar su error era esperar algo que no iba a pasar. El interceptor sigue
  // acá, pero para comprobar que no se dispara.
  const browser = await chromium.launch({ headless: true });
  let pedidosDeRelleno = 0;
  const blockSeedImages = (page) =>
    page.route('https://picsum.photos/**', (route) => {
      pedidosDeRelleno += 1;
      return route.fulfill({ status: 404, body: 'imagen rota por smoke' });
    });
  // Dos rótulos distintos, que es lo nuevo: antes los dos caminos —sin foto
  // y foto rota— caían en el mismo cartel, así que el caso no podía notar
  // si el respaldo estaba diciendo la verdad sobre cuál de las dos pasó.
  const sinFoto = (raiz) =>
    raiz.getByRole('img', { name: /^Sin registro fotográfico\./ }).first();
  // Y que la placa esté efectivamente pintada: si el activo no cargara, el
  // nombre accesible seguiría diciendo la verdad sobre un rectángulo vacío.
  const placaPintada = async (nodo) => {
    const fondo = await nodo.evaluate((n) => getComputedStyle(n).backgroundImage);
    return /estados\/no-photo\.svg/.test(fondo);
  };
  const fotoRota = (raiz) => raiz.getByText('No pudimos cargar la imagen').first();

  try {
    const buyerContext = await browser.newContext();
    await buyerContext.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.buyerToken,
        refreshToken: state.buyerRefreshToken,
      },
    );
    const buyerPage = await buyerContext.newPage();
    await blockSeedImages(buyerPage);
    await buyerPage.goto(`${FRONTEND_URL}/?section=marketplace`, {
      waitUntil: 'domcontentloaded',
    });
    await buyerPage.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    await buyerPage.waitForFunction(
      () => document.querySelectorAll('#catalog-category option').length > 1,
    );
    await buyerPage.locator('#catalog-type').selectOption('productos');
    const productName = state.product.name;
    await buyerPage
      .getByLabel('Buscar en el mercado')
      .fill(productName);
    await buyerPage
      .getByLabel('Buscar en el mercado')
      .press('Enter');
    const productHeading = buyerPage.getByRole('heading', {
      name: productName,
      exact: true,
      level: 3,
    });
    await productHeading.waitFor({ state: 'visible' });
    const productCard = productHeading.locator('xpath=ancestor::*[contains(@class,\"card\")]');
    const addButton = productCard.getByRole('button', { name: /Agregar/ });

    await productHeading.click();
    const detailHeading = buyerPage.getByRole('heading', {
      name: productName,
      exact: true,
      level: 2,
    });
    await detailHeading.waitFor({ state: 'visible' });
    const detailModal = detailHeading.locator('xpath=ancestor::div[contains(@class,\"modal\")]');
    await sinFoto(detailModal).waitFor();
    await detailModal.getByRole('button', { name: 'Cerrar' }).click();

    await addButton.click();
    await buyerPage.getByRole('button', { name: /Carrito/ }).click();
    const cartHeading = buyerPage.getByRole('heading', { name: /Mi carrito/i });
    await cartHeading.waitFor();
    const cartModal = cartHeading.locator('xpath=ancestor::div[contains(@class,\"modal\")]');
    await sinFoto(cartModal).waitFor();
    await cartModal.getByRole('button', { name: 'Continuar compra' }).click();
    const shippingHeading = buyerPage.getByRole('heading', { name: /Datos de env/i });
    const checkoutModal = shippingHeading.locator('xpath=ancestor::div[contains(@class,\"modal\")]');
    await sinFoto(checkoutModal).waitFor();
    await buyerContext.close();

    const sellerContext = await browser.newContext();
    await sellerContext.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.sellerToken,
        refreshToken: state.sellerRefreshToken,
      },
    );
    const sellerPage = await sellerContext.newPage();
    await blockSeedImages(sellerPage);
    await sellerPage.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await sellerPage.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await sellerPage.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
    await sellerPage.getByRole('button', { name: 'Mis publicaciones' }).click();
    await sellerPage.getByRole('heading', { name: 'Mis publicaciones' }).waitFor();
    await sinFoto(sellerPage).waitFor();
    await sellerContext.close();

    const adminLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@topgreen.com', password: 'admin123' },
    });
    const adminContext = await browser.newContext();
    await adminContext.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: adminLogin.data.access_token,
        refreshToken: adminLogin.data.refresh_token,
      },
    );
    const adminPage = await adminContext.newPage();
    await blockSeedImages(adminPage);
    await adminPage.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await adminPage.getByRole('button', { name: 'Admin' }).click();
    await adminPage.getByRole('heading', { name: 'Panel de Administración' }).waitFor();
    await adminPage.getByRole('button', { name: 'Productos' }).click();
    const table = adminPage.locator('table');
    await table.waitFor();
    await sinFoto(table).waitFor();
    assert(await placaPintada(sinFoto(table)),
      'el respaldo de «sin registro» no está pintando la placa del sistema');
    await adminContext.close();

    assert(pedidosDeRelleno === 0,
      `el navegador pidió ${pedidosDeRelleno} imágenes a picsum.photos: una foto al azar `
      + 'puede terminar al lado de un precio y un vendedor reales');

    // Y la propiedad vieja, que sigue importando: una foto de verdad que se
    // rompe no puede dejar el recorrido sin imagen. Se rompe una nuestra.
    const rotaContext = await browser.newContext();
    const rotaPage = await rotaContext.newPage();
    let rotasForzadas = 0;
    await rotaPage.route('**/uploads/**', (route) => {
      rotasForzadas += 1;
      return route.fulfill({ status: 404, body: 'imagen rota por smoke' });
    });
    await rotaPage.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await rotaPage.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    await fotoRota(rotaPage).waitFor();
    await rotaContext.close();

    return 'ninguna imagen de relleno se pidió en los cinco recorridos, y en su lugar '
      + 'dice «Sin registro fotográfico»; una imagen propia rota cae en el otro respaldo, que '
      + 'dice «No pudimos cargar la imagen» y no la confunde con una que nunca hubo';
  } finally {
    await browser.close();
  }
});

await runCase(22, 'Registro de transportista desde la interfaz, con los tres datos del vehículo', async () => {
  assert(state.location, 'caso 5 no dejó provincia/localidad');
  await expectApiError(422, () => apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: 'transportista.incompleto@example.com',
      password: 'smoke123',
      full_name: 'Transportista Incompleto',
      is_carrier: true,
    },
  }));

  const email = 'transportista.smoke@example.com';
  const password = 'smoke123';
  const transport = 'Camión habilitado dominio SM0 KE21';
  const capacity = 'Hasta 40 toneladas de semillas';
  const declaracion = 'RUTA, cargas generales, N.° SMOKE-22';
  const radius = 125.5;
  // Los tres opcionales, escritos como los escribiría una persona apurada:
  // con espacios de más, para que la normalización tenga algo que hacer.
  const modelo = '  Scania   R450  ';
  const dominio = ' SM0   KE21 ';
  const detalleDeOtra = '  Bidones de 200 litros  ';
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByText('Regístrate aquí').click();
    await page.getByRole('heading', { name: 'Crear Cuenta' }).waitFor();

    await page.locator('input[name="name"]').fill('Transportista Smoke');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="phone"]').fill('+54 11 5555 2121');
    await page.getByLabel('Quiero registrarme como transportista').check();
    await page.getByLabel('Provincia base').selectOption(state.location.provinceId);
    await page.getByLabel('Localidad base').selectOption(state.location.localityId);
    await page.locator('input[name="carrierTransport"]').fill(transport);
    await page.locator('#registro-modelo').fill(modelo);
    await page.locator('#registro-dominio').fill(dominio);
    // Se tildan al revés del catálogo —«Otra» primero— porque lo que se guarda
    // tiene que salir en el orden del catálogo y no en el orden en que tildó.
    await page.getByRole('group', { name: 'Cargas que transportás' })
      .getByRole('checkbox', { name: 'Otra', exact: true }).check();
    await page.getByRole('group', { name: 'Cargas que transportás' })
      .getByRole('checkbox', { name: 'Granos a granel' }).check();
    await page.locator('#registro-carga-otra').fill(detalleDeOtra);
    await page.getByLabel('Declaro que el transporte está habilitado').check();
    await page.locator('input[name="carrierCertificationDetail"]').fill(declaracion);
    await page.locator('input[name="carrierCoverageRadiusKm"]').fill(String(radius));
    await page.locator('input[name="carrierCapacity"]').fill(capacity);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form input[type="password"]').nth(1).fill(password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    // El alta ya no da la bienvenida: deja el aviso de correo pendiente.
    const avisoPendiente = page.locator('[role="status"]').first();
    await avisoPendiente.waitFor({ state: 'visible', timeout: 15_000 });
    const textoPendiente = (await avisoPendiente.textContent()) || '';
    assert(
      textoPendiente.includes(email),
      `el aviso de registro no nombra el correo: "${textoPendiente}"`,
    );

    await apiRequest('/auth/verify-email', {
      method: 'POST',
      body: { token: tokenDeVerificacion() },
    });

    const login = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert(login.data.user.role === 'user', 'el transportista recibió un rol nuevo');
    assert(login.data.user.is_carrier === true, 'la API no marca al transportista');
    assert(
      login.data.user.carrier_base_locality_id === state.location.localityId,
      'la API no conserva la localidad base',
    );

    const [databaseCarrier] = queryRows(`
      SELECT
        u.role::text,
        u.is_carrier::text,
        u.carrier_base_locality_id,
        u.carrier_transport,
        u.carrier_transport_certified::text,
        COALESCE(u.carrier_certification_detail, ''),
        (u.carrier_certification_declared_at IS NOT NULL)::text,
        u.carrier_coverage_radius_km::text,
        COALESCE(u.carrier_capacity, ''),
        l.name,
        COALESCE(u.carrier_vehicle_model, ''),
        COALESCE(u.carrier_plate, ''),
        COALESCE(u.carrier_cargo_types::text, ''),
        COALESCE(u.carrier_cargo_other, ''),
        'fin'
      FROM users u
      JOIN localities l ON l.id = u.carrier_base_locality_id
      WHERE u.email = ${sqlLiteral(email)}
    `);
    assert(databaseCarrier, 'el transportista registrado por UI no quedó en la base');
    assert(databaseCarrier[0] === 'USER', `rol SQL inesperado: ${databaseCarrier[0]}`);
    assert(databaseCarrier[1] === 'true', 'is_carrier SQL no quedó activo');
    assert(databaseCarrier[2] === state.location.localityId, 'localidad base SQL incorrecta');
    assert(databaseCarrier[3] === transport, 'transporte SQL incorrecto');
    assert(databaseCarrier[4] === 'true', 'habilitación SQL no quedó activa');
    assert(databaseCarrier[5] === declaracion, `declaración SQL incorrecta: ${databaseCarrier[5]}`);
    assert(databaseCarrier[6] === 'true', 'la fecha de la declaración no la puso el servidor');
    assert(Number(databaseCarrier[7]) === radius, `radio SQL inesperado: ${databaseCarrier[7]}`);
    assert(databaseCarrier[8] === capacity, 'capacidad SQL incorrecta');

    // Los tres opcionales del alta: llegan normalizados y el dominio, que en
    // el directorio no existe, en el perfil de su titular sí está.
    assert(databaseCarrier[10] === 'Scania R450',
      `marca y modelo SQL sin normalizar: «${databaseCarrier[10]}»`);
    assert(databaseCarrier[11] === 'SM0 KE21',
      `dominio SQL sin normalizar: «${databaseCarrier[11]}»`);
    const declaradasEnBase = JSON.parse(databaseCarrier[12] || 'null');
    assert(
      JSON.stringify(declaradasEnBase) === JSON.stringify(['granos_a_granel', 'otra']),
      `cargas SQL en otro orden o con otro contenido: ${databaseCarrier[12]}`,
    );
    assert(databaseCarrier[13] === 'Bidones de 200 litros',
      `detalle de «Otra» SQL sin normalizar: «${databaseCarrier[13]}»`);
    assert(login.data.user.carrier_plate === 'SM0 KE21',
      'el propio perfil no devuelve el dominio de su titular');

    return `UI + API + DB, localidad=${databaseCarrier[9]}, radio=${databaseCarrier[7]} km, `
      + `declaración con fecha del servidor; del alta salieron «${databaseCarrier[10]}», `
      + `dominio «${databaseCarrier[11]}» y ${declaradasEnBase.length} cargas en orden `
      + 'de catálogo aunque se tildaron al revés';
  } finally {
    await browser.close();
  }
});

// --- Órdenes de transferencia que no se pueden abandonar -------------------

async function crearOrdenTransferencia(calle) {
  await apiRequest('/cart/items', {
    method: 'POST',
    token: state.buyerToken,
    body: { product_id: state.product.id, quantity: 1 },
  });
  const checkout = await apiRequest('/orders/checkout/transfer', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: calle,
      shipping_locality_id: localidadDeEnvio(),
      shipping_postal_code: '2000',
      shipping_decisions: trasladoPropio(),
    },
  });
  const [order] = checkout.data.orders;
  assert(order?.status === 'awaiting_transfer_receipt', `estado inicial: ${order?.status}`);
  return order;
}

function estadoDeOrden(orderId) {
  return querySql(`SELECT status::text FROM orders WHERE id = ${sqlLiteral(orderId)}`);
}

function stockDeProducto(productId) {
  return queryCount(`SELECT stock FROM products WHERE id = ${sqlLiteral(productId)}`);
}

const RECIBO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function adjuntarComprobante(orderId, nombre) {
  await apiUpload(`/orders/${orderId}/transfer-receipt`, {
    token: state.buyerToken,
    filename: nombre,
    content: RECIBO_PNG,
    contentType: 'image/png',
  });
  const estado = estadoDeOrden(orderId);
  assert(estado === 'TRANSFER_RECEIPT_SUBMITTED', `estado tras adjuntar: ${estado}`);
}

await runCase(23, 'Sin comprobante, comprador y vendedor pueden cancelar', async () => {
  const stockInicial = stockDeProducto(state.product.id);

  const ordenComprador = await crearOrdenTransferencia('Av. Abandono 100');
  await expectApiError(403, () =>
    apiRequest(`/orders/${ordenComprador.order_id}/cancel`, {
      method: 'POST',
      token: state.otherSellerToken,
      body: { reason: 'no es mi orden' },
    }),
  );
  assert(
    estadoDeOrden(ordenComprador.order_id) === 'AWAITING_TRANSFER_RECEIPT',
    'un usuario ajeno movió la orden',
  );

  await apiRequest(`/orders/${ordenComprador.order_id}/cancel`, {
    method: 'POST',
    token: state.buyerToken,
    body: { reason: 'me arrepentí antes de transferir' },
  });
  const estadoComprador = estadoDeOrden(ordenComprador.order_id);
  assert(estadoComprador === 'CANCELLED', `el comprador dejó la orden en ${estadoComprador}`);

  const ordenVendedor = await crearOrdenTransferencia('Av. Abandono 200');
  await apiRequest(`/orders/${ordenVendedor.order_id}/cancel`, {
    method: 'POST',
    token: state.sellerToken,
    body: { reason: 'nunca llegó la transferencia' },
  });
  const estadoVendedor = estadoDeOrden(ordenVendedor.order_id);
  assert(estadoVendedor === 'REJECTED', `el vendedor dejó la orden en ${estadoVendedor}`);

  const stockFinal = stockDeProducto(state.product.id);
  assert(
    stockFinal === stockInicial,
    `cancelar sin aprobar movió el stock: ${stockInicial} -> ${stockFinal}`,
  );

  return `ajeno 403; comprador=CANCELLED, vendedor=REJECTED, stock intacto en ${stockFinal}`;
});

await runCase(24, 'Sin comprobante, el vendedor igual aprueba o rechaza', async () => {
  const stockInicial = stockDeProducto(state.product.id);

  const ordenRechazo = await crearOrdenTransferencia('Av. Sin Comprobante 300');
  await expectApiError(400, () =>
    apiRequest(`/orders/${ordenRechazo.order_id}/transfer-receipt`, {
      method: 'PATCH',
      token: state.sellerToken,
      body: { decision: 'reject' },
    }),
  );
  const motivo = 'No veo la transferencia en mi cuenta';
  await apiRequest(`/orders/${ordenRechazo.order_id}/transfer-receipt`, {
    method: 'PATCH',
    token: state.sellerToken,
    body: { decision: 'reject', reason: motivo },
  });
  const [rechazada] = queryRows(`
    SELECT status::text, cancellation_reason
    FROM orders
    WHERE id = ${sqlLiteral(ordenRechazo.order_id)}
  `);
  assert(rechazada[0] === 'REJECTED', `estado SQL: ${rechazada[0]}`);
  assert(rechazada[1] === motivo, 'no se guardó el motivo del rechazo');
  // Se cuenta en una consulta aparte: querySql recorta el resultado y un
  // último campo NULL desaparecería de la fila.
  const comprobantesRechazo = queryCount(`
    SELECT COUNT(*)
    FROM orders
    WHERE id = ${sqlLiteral(ordenRechazo.order_id)}
      AND transfer_receipt_url IS NOT NULL
  `);
  assert(comprobantesRechazo === 0, 'quedó un comprobante donde nunca se adjuntó uno');

  const ordenAprobada = await crearOrdenTransferencia('Av. Sin Comprobante 400');
  const aprobada = await apiRequest(`/orders/${ordenAprobada.order_id}/transfer-receipt`, {
    method: 'PATCH',
    token: state.sellerToken,
    body: { decision: 'approve' },
  });
  assert(aprobada.data.status === 'paid', `estado API: ${aprobada.data.status}`);
  assert(
    estadoDeOrden(ordenAprobada.order_id) === 'PAID',
    'la aprobación sin comprobante no llegó a la base',
  );

  const stockFinal = stockDeProducto(state.product.id);
  assert(
    stockFinal === stockInicial - 1,
    `stock esperado ${stockInicial - 1}, obtenido ${stockFinal}`,
  );

  return `rechazo sin motivo HTTP 400; rechazo con motivo=REJECTED; aprobación sin comprobante=PAID, stock ${stockInicial} -> ${stockFinal}`;
});

await runCase(25, 'Con comprobante enviado, sólo el vendedor puede cancelar', async () => {
  const stockInicial = stockDeProducto(state.product.id);
  const orden = await crearOrdenTransferencia('Av. Comprobante Enviado 500');
  await adjuntarComprobante(orden.order_id, 'comprobante-cancelacion.png');

  const bloqueo = await expectApiError(400, () =>
    apiRequest(`/orders/${orden.order_id}/cancel`, {
      method: 'POST',
      token: state.buyerToken,
      body: { reason: 'quiero retirarme igual' },
    }),
  );
  assert(/vendedor/i.test(bloqueo), `el motivo no explica quién puede cancelar: ${bloqueo}`);
  assert(
    estadoDeOrden(orden.order_id) === 'TRANSFER_RECEIPT_SUBMITTED',
    'el intento del comprador movió la orden',
  );

  await apiRequest(`/orders/${orden.order_id}/cancel`, {
    method: 'POST',
    token: state.sellerToken,
    body: { reason: 'el comprobante no corresponde a esta operación' },
  });
  const estadoFinal = estadoDeOrden(orden.order_id);
  assert(estadoFinal === 'REJECTED', `estado tras cancelar el vendedor: ${estadoFinal}`);

  const stockFinal = stockDeProducto(state.product.id);
  assert(stockFinal === stockInicial, `el stock cambió: ${stockInicial} -> ${stockFinal}`);

  return `comprador HTTP 400 con motivo; vendedor dejó REJECTED; stock intacto en ${stockFinal}`;
});

await runCase(26, 'Dos aprobaciones simultáneas descuentan stock una sola vez', async () => {
  const stockInicial = stockDeProducto(state.product.id);
  const orden = await crearOrdenTransferencia('Av. Concurrencia 600');
  await adjuntarComprobante(orden.order_id, 'comprobante-concurrente.png');

  const aprobar = () =>
    apiRequest(`/orders/${orden.order_id}/transfer-receipt`, {
      method: 'PATCH',
      token: state.sellerToken,
      body: { decision: 'approve' },
    }).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, message: String(error.message) }),
    );

  const [primera, segunda] = await Promise.all([aprobar(), aprobar()]);
  const exitosas = [primera, segunda].filter((resultado) => resultado.ok).length;
  assert(exitosas === 1, `aprobaciones aceptadas: ${exitosas} (se esperaba exactamente 1)`);

  const rechazada = [primera, segunda].find((resultado) => !resultado.ok);
  assert(
    /HTTP 400/.test(rechazada.message),
    `la segunda no fue rechazada con 400: ${rechazada.message}`,
  );

  const estadoFinal = estadoDeOrden(orden.order_id);
  assert(estadoFinal === 'PAID', `estado final: ${estadoFinal}`);

  const stockFinal = stockDeProducto(state.product.id);
  assert(
    stockFinal === stockInicial - 1,
    `descuento doble: ${stockInicial} -> ${stockFinal}, se esperaba ${stockInicial - 1}`,
  );

  return `1 de 2 aceptada, la otra HTTP 400; stock ${stockInicial} -> ${stockFinal}`;
});
await runCase(27, 'Una orden por transferencia de más de cien millones', async () => {
  // El caso que antes era imposible: el campo de $950.000.000 devolvia 500 al
  // entrar al carrito porque el snapshot era NUMERIC(10,2).
  assert(state.publicacionCara, 'el caso 13 no dejó la publicación cara');
  const caro = state.publicacionCara;
  assert(Number(caro.price) > 100000000, `esperaba más de cien millones, es ${caro.price}`);

  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/items', {
    method: 'POST',
    token: state.buyerToken,
    body: { product_id: caro.id, quantity: 1 },
  });

  const checkout = await apiRequest('/orders/checkout/transfer', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: 'Ruta 8 km 220',
      shipping_locality_id: localidadDeEnvio(),
      shipping_postal_code: '2700',
      notes: 'Orden cara por transferencia',
      shipping_decisions: trasladoPropio(),
    },
  });
  const [orden] = checkout.data.orders;
  assert(orden?.status === 'awaiting_transfer_receipt', `estado inesperado: ${orden?.status}`);

  const [fila] = queryRows(`
    SELECT o.subtotal, o.total_amount, oi.unit_price_snapshot, oi.total_price
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = ${sqlLiteral(orden.order_id)}
  `);
  const esperado = Number(caro.price).toFixed(2);
  assert(fila[0] === esperado, `subtotal SQL=${fila[0]}, esperaba ${esperado}`);
  assert(fila[1] === esperado, `total SQL=${fila[1]}, esperaba ${esperado}`);
  assert(fila[2] === esperado, `snapshot unitario SQL=${fila[2]}, esperaba ${esperado}`);
  assert(fila[3] === esperado, `total del ítem SQL=${fila[3]}, esperaba ${esperado}`);
  assert(
    Number(orden.total_amount ?? orden.total ?? esperado).toFixed(2) === esperado,
    'el total de la API no coincide con SQL',
  );
  return `HTTP ${checkout.status}, "${caro.name}" a $${esperado}, API=SQL en subtotal, total y snapshots`;
});

await runCase(28, 'Un total fuera del contrato se rechaza sin escribir nada', async () => {
  // Techo declarado: NUMERIC(14,2), 999.999.999.999,99. Se comprueban TODOS los
  // caminos publicos que pueden meter un monto imposible, no solo el checkout.
  assert(state.sellerToken, 'no hay token de vendedor');
  assert(state.buyerId, 'no hay id de comprador');
  assert(state.location, 'caso 5 no dejó localidad');

  const [categoria] = queryRows(`
    SELECT id FROM categories
    WHERE is_active = true AND is_service = false
    ORDER BY name LIMIT 1
  `);
  const contarCarrito = () => queryCount(`
    SELECT COUNT(*) FROM cart_items ci
    JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${sqlLiteral(state.buyerId)} AND c.status = 'ACTIVE'
  `);

  // 1. publicar por encima del maximo unitario: 400
  const alPublicar = await expectApiError(400, () =>
    apiRequest('/products', {
      method: 'POST',
      token: state.sellerToken,
      body: {
        name: `Smoke precio imposible ${Date.now()}`,
        description: 'Publicación de prueba con un precio fuera del contrato monetario.',
        category_id: categoria[0],
        price: 99999999999.99,
        stock: 1,
        unit: 'unidad',
        locality_id: state.location.localityId,
        publication_type: 'producto',
      },
    }),
  );
  assert(/supera el máximo admitido/i.test(alPublicar), `publicar: motivo inesperado: ${alPublicar}`);

  // 2. un producto al maximo publicable, con stock para pasarse en el TOTAL:
  //    9.999.999.999,99 x 200 = 1.999.999.999.998
  const creado = await apiRequest('/products', {
    method: 'POST',
    token: state.sellerToken,
    body: {
      name: `Smoke tope monetario ${Date.now()}`,
      description: 'Publicación de prueba al máximo precio unitario admitido.',
      category_id: categoria[0],
      price: 9999999999.99,
      stock: 200,
      unit: 'unidad',
      locality_id: state.location.localityId,
      publication_type: 'producto',
    },
  });
  const topeId = creado.data.id;

  const ordenesAntes = queryCount('SELECT COUNT(*) FROM orders');
  const itemsAntes = queryCount('SELECT COUNT(*) FROM order_items');
  try {
    // 3. editar el precio tampoco puede saltear el contrato
    const precioAntes = queryRows(`
      SELECT price FROM products WHERE id = ${sqlLiteral(topeId)}
    `)[0][0];
    const alEditar = await expectApiError(400, () =>
      apiRequest(`/products/${topeId}`, {
        method: 'PATCH',
        token: state.sellerToken,
        body: { price: 99999999999.99 },
      }),
    );
    assert(/supera el máximo admitido/i.test(alEditar), `editar: motivo inesperado: ${alEditar}`);
    const precioDespues = queryRows(`
      SELECT price FROM products WHERE id = ${sqlLiteral(topeId)}
    `)[0][0];
    assert(precioDespues === precioAntes, `el precio cambió: ${precioAntes} → ${precioDespues}`);

    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });

    // 4. el carrito no puede guardar un estado que el checkout va a rechazar
    const carritoAntes = contarCarrito();
    const alAgregar = await expectApiError(400, () =>
      apiRequest('/cart/items', {
        method: 'POST',
        token: state.buyerToken,
        body: { product_id: topeId, quantity: 200 },
      }),
    );
    assert(/supera el máximo admitido/i.test(alAgregar), `POST: motivo inesperado: ${alAgregar}`);
    assert(/999\.999\.999\.999,99/.test(alAgregar), `POST: falta el techo: ${alAgregar}`);
    assert(contarCarrito() === carritoAntes, 'POST rechazado igual escribió en el carrito');

    // 5. con una cantidad que si entra, subirla por PUT y por PATCH tampoco
    const agregado = await apiRequest('/cart/items', {
      method: 'POST',
      token: state.buyerToken,
      body: { product_id: topeId, quantity: 1 },
    });
    const itemId = agregado.data.id;
    const cantidadAntes = queryRows(`
      SELECT quantity FROM cart_items WHERE id = ${sqlLiteral(itemId)}
    `)[0][0];
    const itemsCarritoAntes = contarCarrito();

    const alPut = await expectApiError(400, () =>
      apiRequest(`/cart/items/${topeId}`, {
        method: 'PUT',
        token: state.buyerToken,
        body: { quantity: 200 },
      }),
    );
    assert(/supera el máximo admitido/i.test(alPut), `PUT: motivo inesperado: ${alPut}`);
    assert(/999\.999\.999\.999,99/.test(alPut), `PUT: falta el techo: ${alPut}`);

    const alPatch = await expectApiError(400, () =>
      apiRequest(`/cart/items/${itemId}`, {
        method: 'PATCH',
        token: state.buyerToken,
        body: { quantity: 200 },
      }),
    );
    assert(/supera el máximo admitido/i.test(alPatch), `PATCH: motivo inesperado: ${alPatch}`);
    assert(/999\.999\.999\.999,99/.test(alPatch), `PATCH: falta el techo: ${alPatch}`);

    const cantidadDespues = queryRows(`
      SELECT quantity FROM cart_items WHERE id = ${sqlLiteral(itemId)}
    `)[0][0];
    assert(
      cantidadDespues === cantidadAntes,
      `la cantidad cambió pese al rechazo: ${cantidadAntes} → ${cantidadDespues}`,
    );
    assert(contarCarrito() === itemsCarritoAntes, 'el carrito cambió de tamaño tras los rechazos');

    // 6. /cart/sync reemplaza el carrito entero. Dos lineas del MISMO vendedor,
    //    cada una dentro del techo, que juntas se pasan: 60 + 60 = 120 unidades
    //    a 9.999.999.999,99 son 1.199.999.999.998,80, por encima del maximo.
    //    Antes esto entraba, porque sync borraba el carrito y validaba cada
    //    linea contra una coleccion ya vacia.
    const segundo = await apiRequest('/products', {
      method: 'POST',
      token: state.sellerToken,
      body: {
        name: `Smoke tope monetario B ${Date.now()}`,
        description: 'Segunda publicación del mismo vendedor, para el total agregado.',
        category_id: categoria[0],
        price: 9999999999.99,
        stock: 200,
        unit: 'unidad',
        locality_id: state.location.localityId,
        publication_type: 'producto',
      },
    });
    const segundoId = segundo.data.id;
    try {
      const filasAntes = queryRows(`
        SELECT ci.product_id, ci.quantity
        FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
        WHERE c.user_id = ${sqlLiteral(state.buyerId)} AND c.status = 'ACTIVE'
        ORDER BY ci.product_id
      `);
      const alSincronizar = await expectApiError(400, () =>
        apiRequest('/cart/sync', {
          method: 'POST',
          token: state.buyerToken,
          body: {
            items: [
              { product_id: topeId, quantity: 60 },
              { product_id: segundoId, quantity: 60 },
            ],
          },
        }),
      );
      assert(/supera el máximo admitido/i.test(alSincronizar), `sync: motivo inesperado: ${alSincronizar}`);
      assert(/999\.999\.999\.999,99/.test(alSincronizar), `sync: falta el techo: ${alSincronizar}`);
      const filasDespues = queryRows(`
        SELECT ci.product_id, ci.quantity
        FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
        WHERE c.user_id = ${sqlLiteral(state.buyerId)} AND c.status = 'ACTIVE'
        ORDER BY ci.product_id
      `);
      assert(
        JSON.stringify(filasDespues) === JSON.stringify(filasAntes),
        `sync rechazado igual cambió el carrito: ${JSON.stringify(filasAntes)} → ${JSON.stringify(filasDespues)}`,
      );

      // y cada linea por separado si entra, para que el rechazo anterior sea
      // por el total agregado y no por la linea
      const valido = await apiRequest('/cart/sync', {
        method: 'POST',
        token: state.buyerToken,
        body: { items: [{ product_id: topeId, quantity: 60 }] },
      });
      assert(valido.data.total_items === 1, 'el sync válido no dejó una sola línea');
    } finally {
      await apiRequest(`/products/${segundoId}`, { method: 'DELETE', token: state.sellerToken });
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
      await apiRequest('/cart/items', {
        method: 'POST',
        token: state.buyerToken,
        body: { product_id: topeId, quantity: 1 },
      });
    }

    // 7. el checkout conserva su defensa. Ya no se puede llegar por la API, asi
    //    que el estado imposible se fuerza por SQL: es el unico camino que queda.
    // por producto y comprador, no por el id de la fila: el paso 6 reemplaza
    // el carrito entero y aquel id ya no existe
    querySql(`UPDATE cart_items ci SET quantity = 200 FROM carts c
      WHERE c.id = ci.cart_id AND c.user_id = ${sqlLiteral(state.buyerId)}
        AND ci.product_id = ${sqlLiteral(topeId)}`);
    const alCerrar = await expectApiError(400, () =>
      apiRequest('/orders/checkout/transfer', {
        method: 'POST',
        token: state.buyerToken,
        body: {
          shipping_address: 'Ruta 8 km 220',
          shipping_locality_id: localidadDeEnvio(),
          shipping_postal_code: '2700',
          notes: 'Orden que se pasa del contrato',
          shipping_decisions: trasladoPropio(),
        },
      }),
    );
    assert(/supera el máximo admitido/i.test(alCerrar), `checkout: motivo inesperado: ${alCerrar}`);

    const ordenesDespues = queryCount('SELECT COUNT(*) FROM orders');
    const itemsDespues = queryCount('SELECT COUNT(*) FROM order_items');
    assert(ordenesDespues === ordenesAntes, `se escribieron ${ordenesDespues - ordenesAntes} órdenes`);
    assert(itemsDespues === itemsAntes, `se escribieron ${itemsDespues - itemsAntes} ítems`);
    return 'publicar y editar a $99.999.999.999,99 HTTP 400 con precio intacto; '
      + 'carrito POST/PUT/PATCH HTTP 400 con el techo en el mensaje y sin cambiar el carrito; '
      + 'sync con dos lineas del mismo vendedor HTTP 400 sin tocar el carrito previo; '
      + `checkout HTTP 400; órdenes ${ordenesAntes}→${ordenesDespues} sin escritura parcial`;
  } finally {
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    await apiRequest(`/products/${topeId}`, { method: 'DELETE', token: state.sellerToken });
  }
});

await runCase(29, 'Sincronizar no descarta ni recorta en silencio', async () => {
  // Antes, /cart/sync salteaba productos inexistentes o inactivos y recortaba
  // la cantidad al stock. El comprador podia terminar con una orden mas chica
  // que su carrito sin enterarse. Ahora cada caso es un 400 con motivo propio.
  assert(state.sellerToken && state.buyerToken, 'faltan tokens');
  const [categoria] = queryRows(`
    SELECT id FROM categories
    WHERE is_active = true AND is_service = false
    ORDER BY name LIMIT 1
  `);
  const filas = () => queryRows(`
    SELECT ci.product_id, ci.quantity
    FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${sqlLiteral(state.buyerId)} AND c.status = 'ACTIVE'
    ORDER BY ci.product_id
  `);
  const publicar = async (nombre, stock) => {
    const r = await apiRequest('/products', {
      method: 'POST',
      token: state.sellerToken,
      body: {
        name: `Smoke sync ${nombre} ${Date.now()}`,
        description: 'Publicación de prueba para el contrato de sincronización.',
        category_id: categoria[0],
        price: 1000,
        stock,
        unit: 'unidad',
        locality_id: state.location.localityId,
        publication_type: 'producto',
      },
    });
    return r.data.id;
  };

  const sano = await publicar('sano', 10);
  const inactivo = await publicar('inactivo', 10);
  const sinStock = await publicar('sin stock', 5);
  try {
    await apiRequest(`/products/${inactivo}`, {
      method: 'PATCH', token: state.sellerToken, body: { status: 'paused' },
    });
    querySql(`UPDATE products SET stock = 0 WHERE id = ${sqlLiteral(sinStock)}`);

    // carrito previo con una sola fila: es lo que tiene que quedar intacto
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    await apiRequest('/cart/items', {
      method: 'POST', token: state.buyerToken, body: { product_id: sano, quantity: 2 },
    });
    const antes = filas();
    assert(antes.length === 1 && antes[0][1] === '2', `carrito previo inesperado: ${JSON.stringify(antes)}`);

    const escenarios = [
      ['inexistente', [{ product_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }], /ya no existe/i],
      ['inactivo', [{ product_id: inactivo, quantity: 1 }], /ya no está disponible/i],
      ['sin stock', [{ product_id: sinStock, quantity: 1 }], /sin stock/i],
      ['cantidad mayor al stock', [{ product_id: sano, quantity: 99 }], /pediste 99 y quedan 10/i],
      // duplicado: 6 + 6 = 12 sobre un stock de 10. Cada linea entraria sola.
      ['duplicado que suma de más',
       [{ product_id: sano, quantity: 6 }, { product_id: sano, quantity: 6 }],
       /pediste 12 y quedan 10/i],
    ];
    const vistos = [];
    for (const [etiqueta, items, esperado] of escenarios) {
      const error = await expectApiError(400, () =>
        apiRequest('/cart/sync', { method: 'POST', token: state.buyerToken, body: { items } }),
      );
      assert(esperado.test(error), `${etiqueta}: motivo inesperado: ${error}`);
      const despues = filas();
      assert(
        JSON.stringify(despues) === JSON.stringify(antes),
        `${etiqueta}: el carrito previo cambió: ${JSON.stringify(antes)} → ${JSON.stringify(despues)}`,
      );
      vistos.push(etiqueta);
    }

    // cantidad no positiva: la rechaza el esquema de entrada
    await expectApiError(422, () =>
      apiRequest('/cart/sync', {
        method: 'POST', token: state.buyerToken,
        body: { items: [{ product_id: sano, quantity: 0 }] },
      }),
    );
    assert(
      JSON.stringify(filas()) === JSON.stringify(antes),
      'la cantidad cero igual tocó el carrito',
    );

    // y el caso valido sigue funcionando
    const valido = await apiRequest('/cart/sync', {
      method: 'POST', token: state.buyerToken,
      body: { items: [{ product_id: sano, quantity: 3 }] },
    });
    assert(valido.data.total_items === 1, 'el sync válido no dejó una sola línea');
    return `${vistos.length} motivos distintos con HTTP 400 (${vistos.join(', ')}), `
      + 'cantidad 0 con HTTP 422, carrito previo intacto en todos, y el sync válido en 200';
  } finally {
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    for (const id of [sano, inactivo, sinStock]) {
      await apiRequest(`/products/${id}`, { method: 'DELETE', token: state.sellerToken });
    }
  }
});

await runCase(30, 'El motivo real de la sincronización llega al comprador', async () => {
  // El checkout tenia un respaldo que, ante un fallo de /cart/sync, reintentaba
  // POST y PUT por producto y podia terminar mostrando "Producto no encontrado
  // en el carrito" en vez del motivo verdadero.
  const [categoria] = queryRows(`
    SELECT id FROM categories
    WHERE is_active = true AND is_service = false
    ORDER BY name LIMIT 1
  `);
  const creado = await apiRequest('/products', {
    method: 'POST',
    token: state.sellerToken,
    body: {
      name: `Smoke motivo real ${Date.now()}`,
      description: 'Publicación que se desactiva con el producto ya en el carrito.',
      category_id: categoria[0],
      price: 1500,
      stock: 5,
      unit: 'unidad',
      locality_id: state.location.localityId,
      publication_type: 'producto',
    },
  });
  const productoId = creado.data.id;
  const nombre = creado.data.name;
  const ordenesAntes = queryCount('SELECT COUNT(*) FROM orders');
  const browser = await chromium.launch({ headless: true });
  const respaldo = [];

  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      { accessToken: state.buyerToken, refreshToken: state.buyerRefreshToken },
    );
    const page = await context.newPage();
    // cualquier intento del respaldo viejo queda registrado
    page.on('request', (request) => {
      const url = request.url();
      const metodo = request.method();
      if (url.includes('/cart/items') && (metodo === 'POST' || metodo === 'PUT')) {
        respaldo.push(`${metodo} ${url}`);
      }
    });

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByLabel('Buscar en el mercado').fill(nombre);
    await page.getByLabel('Buscar en el mercado').press('Enter');
    const tarjeta = page.getByRole('heading', { name: nombre, exact: true, level: 3 });
    await tarjeta.waitFor({ state: 'visible', timeout: 15_000 });
    await accionDeLaTarjeta(page, nombre).click();

    // recién ahora se desactiva: el carrito local ya lo tiene
    await apiRequest(`/products/${productoId}`, {
      method: 'PATCH', token: state.sellerToken, body: { status: 'paused' },
    });

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor();
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
    await elegirDestino(page, 'Pergamino');
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');

    // La sincronización falla, así que el checkout no puede ni armar los
    // pedidos ni dejar resolver su traslado: el motivo real aparece acá, antes
    // del pago, y es el de la API.
    const aviso = page.locator('[role="alert"]');
    await aviso.waitFor({ state: 'visible', timeout: 20_000 });
    const texto = (await aviso.textContent()) || '';
    assert(
      /ya no está disponible/i.test(texto),
      `no se ve el motivo real de la API, se ve: "${texto.trim()}"`,
    );
    assert(texto.includes(nombre), `el aviso no nombra la publicación: "${texto.trim()}"`);
    assert(
      !/Producto no encontrado en el carrito/i.test(texto),
      'sigue apareciendo el mensaje del respaldo viejo',
    );
    assert(respaldo.length === 0, `el checkout usó el respaldo: ${respaldo.join(', ')}`);

    // Y no avanza: se queda en datos de envío y no se creó ninguna orden.
    await page.locator('form:has(h2) button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ state: 'visible' });
    const ordenesDespues = queryCount('SELECT COUNT(*) FROM orders');
    assert(ordenesDespues === ordenesAntes, `se creó una orden pese al error`);
    return `aviso visible con role="alert": "${texto.trim().slice(0, 80)}"; `
      + `0 llamadas de respaldo; órdenes ${ordenesAntes}→${ordenesDespues}`;
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    await apiRequest(`/products/${productoId}`, { method: 'DELETE', token: state.sellerToken });
  }
});

await runCase(31, 'Sin datos bancarios, el comprador ve el motivo del vendedor', async () => {
  // El motivo tiene que venir de /orders/payment-options y no del carrito.
  const [previo] = queryRows(`
    SELECT coalesce(cbu, ''), coalesce(alias_bancario, '')
    FROM users WHERE id = ${sqlLiteral(state.sellerId)}
  `);
  assert(previo[0] || previo[1], 'el vendedor ya venía sin datos bancarios');
  const browser = await chromium.launch({ headless: true });
  try {
    await apiRequest('/auth/me', {
      method: 'PATCH', token: state.sellerToken, body: { cbu: '', alias_bancario: '' },
    });

    const context = await browser.newContext();
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      { accessToken: state.buyerToken, refreshToken: state.buyerRefreshToken },
    );
    const page = await context.newPage();
    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByLabel('Buscar en el mercado').fill(state.product.name);
    await page.getByLabel('Buscar en el mercado').press('Enter');
    await page
      .getByRole('heading', { name: state.product.name, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await accionDeLaTarjeta(page, state.product.name).click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor();
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
    await elegirDestino(page, 'Pergamino');
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');
    await resolverTrasladoPropio(page);
    await page.locator('form:has(h2) button[type="submit"]').click();

    await page.getByRole('heading', { name: /Medio de pago/i }).waitFor();
    // Sin ningún medio disponible no hay radio que marcar: lo que tiene que
    // aparecer es el motivo, y en el grupo de ESE vendedor.
    const aviso = page.locator('[role="alert"]');
    await aviso.waitFor({ state: 'visible', timeout: 15_000 });
    const texto = (await aviso.textContent()) || '';
    assert(
      /no configuró CBU ni alias/i.test(texto),
      `no se ve el motivo de payment-options, se ve: "${texto.trim()}"`,
    );
    return `aviso visible: "${texto.trim().slice(0, 90)}"`;
  } finally {
    await browser.close();
    await apiRequest('/auth/me', {
      method: 'PATCH', token: state.sellerToken,
      body: { cbu: previo[0], alias_bancario: previo[1] },
    });
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  }
});

await runCase(32, 'Las plantillas de configuración cargan sin retoques', async () => {
  // Settings rechaza toda clave que no declara. Una plantilla con claves de
  // más obliga a borrar líneas a mano antes de poder arrancar, que es lo que
  // pasaba con las seis claves de Docker en backend/.env.example. Acá se
  // comprueba que copiar la plantilla y cambiar sólo sus placeholders alcanza.
  const plantillas = ['backend/.env.example', 'backend/.env.production.example'];
  const PLACEHOLDER = /\b(?:CAMBIAR|GENERAR)_[A-Z0-9_]+/g;
  const resumen = [];

  for (const plantilla of plantillas) {
    const original = readFileSync(plantilla, 'utf8');

    const claves = [];
    for (const rawLine of original.split(/\r?\n/)) {
      const linea = rawLine.trim();
      if (!linea || linea.startsWith('#')) continue;
      const corte = linea.indexOf('=');
      assert(corte > 0, `${plantilla}: línea que no es clave=valor: "${linea}"`);
      claves.push(linea.slice(0, corte));
    }
    assert(claves.length > 0, `${plantilla}: no declara ninguna clave`);

    const repetidas = [...new Set(claves.filter((clave, i) => claves.indexOf(clave) !== i))];
    assert(
      repetidas.length === 0,
      `${plantilla}: claves duplicadas, la última gana en silencio: ${repetidas.join(', ')}`,
    );

    // se sustituyen SÓLO los placeholders documentados; ninguna línea se borra
    const placeholders = original.match(PLACEHOLDER) ?? [];
    assert(
      placeholders.length > 0,
      `${plantilla}: no tiene placeholders con la convención CAMBIAR_/GENERAR_`,
    );
    const sustituida = original.replace(PLACEHOLDER, 'valor_de_prueba_de_mas_de_32_caracteres');
    assert(
      sustituida.split(/\r?\n/).length === original.split(/\r?\n/).length,
      `${plantilla}: la sustitución cambió la cantidad de líneas`,
    );

    const salida = cargarConSettings(sustituida);
    assert(
      salida.trim().endsWith('CARGA_OK'),
      `${plantilla}: Settings no la aceptó tal cual: ${salida.trim().slice(-400)}`,
    );

    resumen.push(
      `${plantilla}: ${claves.length} claves, ${new Set(placeholders).size} placeholders, sin duplicados`,
    );
  }

  return resumen.join('; ');
});

await runCase(33, 'El alta deja la cuenta pendiente y sin sesión', async () => {
  const email = `pendiente.smoke.${Date.now()}@example.com`;
  const password = 'smoke123';
  const correosAntes = contarCorreos();

  const alta = await apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password, full_name: 'Pendiente Smoke', role: 'user' },
  });

  assert(alta.status === 201, `alta HTTP ${alta.status}`);
  assert(!alta.data.access_token && !alta.data.refresh_token, 'el alta devolvió tokens');
  assert(alta.data.verification_required === true, 'el alta no se declara pendiente');
  assert(contarCorreos() === correosAntes + 1, 'el alta no dejó un correo en el outbox');

  const [fila] = queryRows(`
    SELECT u.is_verified::text, t.token_hash, length(t.token_hash)::text,
           (t.expires_at - t.created_at)::text, t.consumed_at IS NULL
    FROM users u
    JOIN email_verification_tokens t ON t.user_id = u.id
    WHERE u.email = ${sqlLiteral(email)}
  `);
  assert(fila, 'no quedó token en la base');
  assert(fila[0] === 'false', 'el usuario nació verificado');
  assert(fila[2] === '64', `el hash no mide 64 caracteres: ${fila[2]}`);
  assert(fila[3] === '1 day', `la vigencia no es de 24 horas: ${fila[3]}`);

  // Lo importante: el token del enlace NO está guardado en ninguna parte.
  const token = tokenDeVerificacion();
  assert(fila[1] !== token, 'la base guardó el token en claro');
  const enBase = queryCount(`
    SELECT COUNT(*) FROM email_verification_tokens WHERE token_hash = ${sqlLiteral(token)}
  `);
  assert(enBase === 0, 'el token en claro aparece en la base');

  const alIngresar = await expectApiError(403, () =>
    apiRequest('/auth/login', { method: 'POST', body: { email, password } }),
  );
  assert(/no está confirmada/i.test(alIngresar), `motivo inesperado: ${alIngresar}`);

  state.pendienteEmail = email;
  state.pendientePassword = password;
  return `HTTP 201 sin tokens, hash de 64 y vigencia de 1 day en base, `
    + `token en claro ausente, login HTTP 403 con el motivo`;
});

await runCase(34, 'El enlace verifica una sola vez, aun con dos intentos a la vez', async () => {
  assert(state.pendienteEmail, 'caso 33 no dejó una cuenta pendiente');
  const email = state.pendienteEmail;
  const token = tokenDeVerificacion();

  // Dos verificaciones en paralelo con el MISMO token: exactamente una gana.
  const [una, otra] = await Promise.all([
    apiRequest('/auth/verify-email', { method: 'POST', body: { token } }).then(
      (r) => ({ ok: true, r }),
      (e) => ({ ok: false, e }),
    ),
    apiRequest('/auth/verify-email', { method: 'POST', body: { token } }).then(
      (r) => ({ ok: true, r }),
      (e) => ({ ok: false, e }),
    ),
  ]);
  const aceptadas = [una, otra].filter((x) => x.ok).length;
  assert(aceptadas === 1, `${aceptadas} verificaciones aceptadas en paralelo, debía ser 1`);

  const consumos = queryCount(`
    SELECT COUNT(*) FROM email_verification_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE u.email = ${sqlLiteral(email)} AND t.consumed_at IS NOT NULL
  `);
  assert(consumos === 1, `${consumos} tokens consumidos, debía ser 1`);

  const [verificado] = queryRows(`
    SELECT is_verified::text FROM users WHERE email = ${sqlLiteral(email)}
  `);
  assert(verificado[0] === 'true', 'el usuario no quedó verificado');

  const ingreso = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password: state.pendientePassword },
  });
  assert(ingreso.data.access_token, 'después de confirmar, el login no dio token');

  const alRepetir = await expectApiError(400, () =>
    apiRequest('/auth/verify-email', { method: 'POST', body: { token } }),
  );
  assert(/ya se usó/i.test(alRepetir), `reutilización: motivo inesperado: ${alRepetir}`);

  return `1 de 2 verificaciones simultáneas aceptada, 1 consumo en base, `
    + `login HTTP 200 y reutilización HTTP 400`;
});

await runCase(35, 'Vencido a las 24 h, y el reenvío invalida el anterior', async () => {
  const email = `vencido.smoke.${Date.now()}@example.com`;
  const password = 'smoke123';
  await apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password, full_name: 'Vencido Smoke', role: 'user' },
  });
  const tokenViejo = tokenDeVerificacion();

  // Se envejece el token un segundo más allá de su vigencia.
  querySql(`
    UPDATE email_verification_tokens
    SET created_at = created_at - interval '24 hours 1 second',
        expires_at = expires_at - interval '24 hours 1 second'
    WHERE user_id = (SELECT id FROM users WHERE email = ${sqlLiteral(email)})
  `);
  const alVencer = await expectApiError(400, () =>
    apiRequest('/auth/verify-email', { method: 'POST', body: { token: tokenViejo } }),
  );
  assert(/venció/i.test(alVencer), `vencido: motivo inesperado: ${alVencer}`);

  const usuariosAntes = queryCount(
    `SELECT COUNT(*) FROM users WHERE email = ${sqlLiteral(email)}`,
  );
  const reenvio = await apiRequest('/auth/resend-verification', {
    method: 'POST',
    body: { email },
  });
  const tokenNuevo = tokenDeVerificacion();
  assert(tokenNuevo !== tokenViejo, 'el reenvío mandó el mismo token');
  assert(
    queryCount(`SELECT COUNT(*) FROM users WHERE email = ${sqlLiteral(email)}`) === usuariosAntes,
    'el reenvío duplicó el usuario',
  );

  const alUsarElViejo = await expectApiError(400, () =>
    apiRequest('/auth/verify-email', { method: 'POST', body: { token: tokenViejo } }),
  );
  assert(/no es válido/i.test(alUsarElViejo), `el viejo: motivo inesperado: ${alUsarElViejo}`);

  const conElNuevo = await apiRequest('/auth/verify-email', {
    method: 'POST',
    body: { token: tokenNuevo },
  });
  assert(conElNuevo.status === 200, `el token nuevo no verificó: HTTP ${conElNuevo.status}`);

  // La respuesta del reenvío no puede delatar qué cuentas existen.
  const correosAntes = contarCorreos();
  const desconocido = await apiRequest('/auth/resend-verification', {
    method: 'POST',
    body: { email: `no.existe.${Date.now()}@example.com` },
  });
  const yaVerificado = await apiRequest('/auth/resend-verification', {
    method: 'POST',
    body: { email },
  });
  assert(
    desconocido.data.message === reenvio.data.message
      && yaVerificado.data.message === reenvio.data.message,
    'la respuesta del reenvío cambia según la cuenta y delata cuáles existen',
  );
  assert(
    contarCorreos() === correosAntes,
    'se envió correo a una cuenta inexistente o ya verificada',
  );

  // Y con el transporte caído tampoco puede cambiar: si el reenvío diera 503
  // sólo cuando la cuenta existe y está pendiente, el código de estado sería
  // un delator de cuentas cada vez que el correo se cae.
  const pendiente = `pendiente.roto.${Date.now()}@example.com`;
  await apiRequest('/auth/register', {
    method: 'POST',
    body: { email: pendiente, password: 'smoke123', full_name: 'Pendiente Roto', role: 'user' },
  });
  const [inexistente, sinConfirmar, confirmado] = reenviosConTransporteRoto([
    `no.existe.roto.${Date.now()}@example.com`,
    pendiente,
    email,
  ]);
  assert(
    inexistente.status === sinConfirmar.status && sinConfirmar.status === confirmado.status,
    `con el transporte caído los estados difieren: ${inexistente.status}, `
      + `${sinConfirmar.status}, ${confirmado.status}`,
  );
  assert(
    inexistente.cuerpo === sinConfirmar.cuerpo && sinConfirmar.cuerpo === confirmado.cuerpo,
    'con el transporte caído los cuerpos difieren y delatan qué cuenta existe',
  );
  assert(sinConfirmar.status === 200, `el reenvío con transporte caído dio ${sinConfirmar.status}`);

  return `vencido HTTP 400; reenvío con 1 usuario, token viejo HTTP 400 y nuevo HTTP 200; `
    + `respuesta idéntica para desconocido y verificado; con el transporte caído los tres `
    + `siguen en HTTP ${inexistente.status} con el mismo cuerpo`;
});

await runCase(36, 'Un token de sesión anterior no sirve sin confirmar', async () => {
  const email = `tokenviejo.smoke.${Date.now()}@example.com`;
  await apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password: 'smoke123', full_name: 'Token Viejo Smoke', role: 'user' },
  });

  const { acceso, refresco } = emitirTokensDeSesion(email);

  const enMe = await expectApiError(403, () => apiRequest('/auth/me', { token: acceso }));
  assert(/no está confirmada/i.test(enMe), `/auth/me: motivo inesperado: ${enMe}`);

  const enProtegida = await expectApiError(403, () =>
    apiRequest('/products/my', { token: acceso }),
  );
  assert(/no está confirmada/i.test(enProtegida), `/products/my: motivo inesperado: ${enProtegida}`);

  const enRefresh = await expectApiError(403, () =>
    apiRequest('/auth/refresh', { method: 'POST', token: refresco }),
  );
  assert(/no está confirmada/i.test(enRefresh), `/auth/refresh: motivo inesperado: ${enRefresh}`);

  // Y después de confirmar, el mismo token de acceso ya sirve.
  await apiRequest('/auth/verify-email', {
    method: 'POST',
    body: { token: tokenDeVerificacion() },
  });
  const despues = await apiRequest('/auth/me', { token: acceso });
  assert(despues.data.email === email, 'tras confirmar, el token anterior sigue sin servir');

  return `/auth/me, /products/my y /auth/refresh en HTTP 403 con el motivo; `
    + `el mismo token funciona una vez confirmada la cuenta`;
});

await runCase(37, 'Registro, correo y confirmación desde el navegador', async () => {
  const email = `nav.smoke.${Date.now()}@example.com`;
  const password = 'smoke123';
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    // Toda petición que lleve el token, sea en la URL o en Referer, queda
    // anotada. Con el token en el fragmento no puede llevarlo NINGUNA, ni
    // siquiera la del propio documento: el navegador no manda el fragmento.
    const fugas = [];
    let tokenVigilado = null;
    page.on('request', (peticion) => {
      if (!tokenVigilado) return;
      const enUrl = peticion.url().includes(tokenVigilado);
      const enReferer = (peticion.headers().referer || '').includes(tokenVigilado);
      if (enUrl || enReferer) {
        fugas.push({ url: peticion.url(), enReferer });
      }
    });

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByText('Regístrate aquí').click();
    await page.getByRole('heading', { name: 'Crear Cuenta' }).waitFor();
    await page.locator('input[name="name"]').fill('Nav Smoke');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form input[type="password"]').nth(1).fill(password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    const aviso = page.locator('[role="status"]').first();
    await aviso.waitFor({ state: 'visible', timeout: 15_000 });
    const textoAviso = (await aviso.textContent()) || '';
    assert(textoAviso.includes(email), `el aviso no nombra el correo: "${textoAviso}"`);

    // El alta no puede dejar sesión guardada en el navegador.
    const guardado = await page.evaluate(() => ({
      acceso: localStorage.getItem('access_token'),
      refresco: localStorage.getItem('refresh_token'),
    }));
    assert(
      !guardado.acceso && !guardado.refresco,
      `el registro guardó sesión local: ${JSON.stringify(guardado)}`,
    );

    const enlacePrimero = enlaceDeVerificacion();

    // Login bloqueado, con el motivo real y la salida a mano.
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByPlaceholder('tu@email.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(password);
    await page.locator('[class*="_submitButton_"][type="submit"]').click();
    const error = page.locator('[role="alert"]');
    await error.waitFor({ state: 'visible', timeout: 15_000 });
    const textoError = (await error.textContent()) || '';
    assert(/no está confirmada/i.test(textoError), `login: motivo inesperado: "${textoError}"`);

    await page.getByRole('button', { name: /Reenviame el correo/ }).click();
    await page.locator('[role="status"]').first().waitFor({ state: 'visible', timeout: 15_000 });
    const enlaceSegundo = enlaceDeVerificacion();
    assert(enlaceSegundo !== enlacePrimero, 'el reenvío desde el login no cambió el enlace');

    // El enlace viejo quedó invalidado por el reenvío.
    await page.goto(enlacePrimero, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => !/Estamos confirmando/.test(
        document.querySelector('[role="status"]')?.textContent || '',
      ),
      null,
      { timeout: 15_000 },
    );
    const textoViejo = (await page.locator('[role="status"]').first().textContent()) || '';
    assert(
      /no es válido|venció|ya se usó/i.test(textoViejo),
      `el enlace invalidado no fue rechazado: "${textoViejo}"`,
    );

    // Un token vencido, abierto en el navegador: el estado tiene que decirlo y
    // ofrecer el reenvío. Es distinto del invalidado de arriba.
    await apiRequest('/auth/resend-verification', { method: 'POST', body: { email } });
    const enlaceVencido = enlaceDeVerificacion();
    querySql(`
      UPDATE email_verification_tokens
      SET created_at = created_at - interval '24 hours 1 second',
          expires_at = expires_at - interval '24 hours 1 second'
      WHERE user_id = (SELECT id FROM users WHERE email = ${sqlLiteral(email)})
        AND consumed_at IS NULL AND invalidated_at IS NULL
    `);
    await page.goto(enlaceVencido, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => !/Estamos confirmando/.test(
        document.querySelector('[role="status"]')?.textContent || '',
      ),
      null,
      { timeout: 15_000 },
    );
    const textoVencido = (await page.locator('[role="status"]').first().textContent()) || '';
    assert(/venció/i.test(textoVencido), `el vencido no se anuncia como tal: "${textoVencido}"`);
    assert(
      await page.getByRole('button', { name: 'Reenviar el enlace' }).count() > 0,
      'la vista del vencido no ofrece reenviar',
    );

    // El nuevo confirma, y recién ahí hay sesión.
    await apiRequest('/auth/resend-verification', { method: 'POST', body: { email } });
    const enlaceTercero = enlaceDeVerificacion();
    tokenVigilado = enlaceTercero.split('token=')[1];
    await page.goto(enlaceTercero, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Correo confirmado' }).waitFor({ timeout: 15_000 });

    // Ni una sola petición puede llevar el token, ni en la URL ni en Referer.
    assert(
      fugas.length === 0,
      `${fugas.length} peticiones llevaron el token: `
        + fugas.map((f) => `${f.url}${f.enReferer ? ' [en Referer]' : ''}`).join(', '),
    );
    assert(
      !page.url().includes(tokenVigilado),
      `el token quedó en la barra: ${page.url()}`,
    );

    // Recargar no puede reintentar el enlace ya usado.
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert(
      !page.url().includes(tokenVigilado),
      `tras recargar, el token volvió a la barra: ${page.url()}`,
    );

    const [verificado] = queryRows(`
      SELECT is_verified::text FROM users WHERE email = ${sqlLiteral(email)}
    `);
    assert(verificado[0] === 'true', 'la base no marcó la cuenta como verificada');

    await page.goto(enlaceTercero.split('?')[0], { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    assert(
      new URL(page.url()).pathname === '/',
      `al ir al login la URL no volvió a la raíz: ${page.url()}`,
    );
    await page.getByPlaceholder('tu@email.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(password);
    await page.locator('[class*="_submitButton_"][type="submit"]').click();
    await page.waitForFunction(() => Boolean(localStorage.getItem('access_token')), null, {
      timeout: 15_000,
    });

    return `aviso con el correo y sin sesión local; login HTTP 403 con motivo y reenvío; `
      + `enlace invalidado y vencido rechazados con su motivo; 0 peticiones con el `
      + `token, ni la del documento; barra limpia tras confirmar, recargar y salir al login`;
  } finally {
    await browser.close();
  }
});

await runCase(38, 'Un error de validación se lee, no dice [object Object]', async () => {
  // FastAPI devuelve `detail` como cadena para los errores de negocio y como
  // LISTA de objetos para los de validación. El cliente pasaba esa lista tal
  // cual a new Error(...), así que la persona veía "[object Object]".
  // Se comprueban las dos formas por el mismo camino que usa la aplicación.
  const invalido = `prueba.${Date.now()}@dominio-invalido`;

  // La forma estructurada, tal como la devuelve el backend
  const crudo = await expectApiError(422, () =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: { email: invalido, password: 'smoke123', full_name: 'Detalle Estructurado' },
    }),
  );
  assert(/value is not a valid email address/i.test(crudo),
    `el backend no devolvió el 422 esperado: ${crudo}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // --- 1. detalle ESTRUCTURADO: registro con un correo que el backend rechaza
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByText('Regístrate aquí').click();
    await page.getByRole('heading', { name: 'Crear Cuenta' }).waitFor();
    await page.locator('input[name="name"]').fill('Detalle Estructurado');
    await page.locator('input[name="email"]').fill(invalido);
    await page.locator('input[name="password"]').fill('smoke123');
    await page.locator('form input[type="password"]').nth(1).fill('smoke123');
    // el navegador corta un type=email mal formado antes de enviarlo; se
    // afloja para que la petición llegue al backend, que es donde nace el 422
    await page.evaluate(() => {
      document.querySelector('input[name="email"]')?.setAttribute('type', 'text');
    });
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    const errorRegistro = page.locator('[class*="_error_"]');
    await errorRegistro.waitFor({ state: 'visible', timeout: 15_000 });
    const textoRegistro = (await errorRegistro.textContent()) || '';
    assert(!/\[object Object\]/.test(textoRegistro),
      `el registro sigue mostrando el objeto crudo: "${textoRegistro}"`);
    assert(/correo/i.test(textoRegistro) && textoRegistro.trim().length > 10,
      `el mensaje de validación no se entiende: "${textoRegistro}"`);

    // --- 2. detalle de TEXTO: no puede haber cambiado
    // Una cuenta sin confirmar da 403 con `detail` en cadena. Ese mensaje ya
    // estaba bien y la normalización tiene que dejarlo intacto.
    const pendiente = `texto.plano.${Date.now()}@example.com`;
    await apiRequest('/auth/register', {
      method: 'POST',
      body: { email: pendiente, password: 'smoke123', full_name: 'Detalle Texto' },
    });

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByPlaceholder('tu@email.com').fill(pendiente);
    await page.getByPlaceholder('••••••••').fill('smoke123');
    await page.locator('[class*="_submitButton_"][type="submit"]').click();

    const errorLogin = page.locator('[role="alert"]');
    await errorLogin.waitFor({ state: 'visible', timeout: 15_000 });
    const textoLogin = (await errorLogin.textContent()) || '';
    assert(!/\[object Object\]/.test(textoLogin),
      `el login muestra el objeto crudo: "${textoLogin}"`);
    assert(/no está confirmada/i.test(textoLogin),
      `el mensaje de negocio cambió: "${textoLogin}"`);

    return `422 estructurado visible como "${textoRegistro.trim().slice(0, 60)}"; `
      + `detalle de texto intacto en "${textoLogin.trim().slice(0, 45)}"`;
  } finally {
    await browser.close();
  }
});

await runCase(39, 'El transportista edita su perfil y los cambios quedan', async () => {
  assert(state.location, 'caso 5 no dejó provincia/localidad');
  const { provinceId } = state.location;
  const padron = (await apiRequest(
    `/catalog/localities?province_id=${encodeURIComponent(provinceId)}`,
  )).data;
  const inicial = padron.find((l) => l.id === state.location.localityId) || padron[0];
  const destino = padron.find((l) => l.id !== inicial.id);
  assert(destino, `la provincia ${provinceId} tiene una sola localidad`);

  const email = `transportista.perfil.${Date.now()}@example.com`;
  const password = 'smoke123';
  const transporteNuevo = 'Camión con acoplado dominio PE 0R21';
  const capacidadNueva = 'Hasta 40 toneladas de semillas';
  const radioNuevo = 320.5;

  await registrarYVerificar({
    email,
    password,
    full_name: 'Transportista Editable',
    is_carrier: true,
    carrier_base_locality_id: inicial.id,
    carrier_transport: 'Camión chico original',
    carrier_transport_certified: true,
    carrier_certification_detail: 'RUTA, cargas generales, N.° SMOKE-39',
    carrier_coverage_radius_km: 40,
    carrier_capacity: 'Hasta 8 toneladas',
  });
  const primerIngreso = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const token = primerIngreso.data.access_token;

  // La API tiene que resolver el padrón: con el identificador solo no hay
  // nada que mostrar en pantalla ni con qué abrir el selector.
  const antes = (await apiRequest('/auth/me', { token })).data;
  assert(antes.carrier_base_locality_name === inicial.name,
    `/auth/me no resuelve la localidad: ${JSON.stringify(antes.carrier_base_locality_name)}`);
  assert(antes.carrier_base_province_id === provinceId, 'la provincia base no coincide');

  // --- los cinco datos se editan desde el panel, no sólo por API
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: token,
        refreshToken: primerIngreso.data.refresh_token,
      },
    );
    const page = await context.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
    await page.getByRole('heading', { name: 'Datos de transportista' }).waitFor();

    const perfil = page.locator('[class*="_profileForm_"]');
    const lectura = (await perfil.textContent()) || '';
    assert(lectura.includes(inicial.name),
      `el panel no muestra la localidad base: "${lectura.replace(/\s+/g, ' ').slice(-200)}"`);

    await page.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Provincia base').selectOption(provinceId);
    await page.getByLabel('Localidad base').selectOption(destino.id);
    await page.getByLabel('Transporte habilitado').fill(transporteNuevo);
    await page.getByLabel('Radio de cobertura (km)').fill(String(radioNuevo));
    await page.getByLabel('Capacidad de carga').fill(capacidadNueva);
    // La declaración se destilda y se vuelve a tildar: es uno de los cinco
    // datos editables y tiene que poder tocarse sin romper el perfil.
    const declaracion = page.getByLabel('Declaro que el transporte está habilitado');
    await declaracion.uncheck();
    await declaracion.check();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByText('Perfil actualizado exitosamente').waitFor({ timeout: 15_000 });

    // Recargar tiene que mostrar lo guardado, no lo que quedó en memoria.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
    const recargado = ((await perfil.textContent()) || '').replace(/\s+/g, ' ');
    for (const esperado of [destino.name, transporteNuevo, `${radioNuevo} km`, capacidadNueva]) {
      assert(recargado.includes(esperado),
        `tras recargar falta "${esperado}" en "${recargado.slice(-260)}"`);
    }
  } finally {
    await browser.close();
  }

  // --- volver a entrar devuelve lo mismo que la base
  const segundoIngreso = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const tokenNuevo = segundoIngreso.data.access_token;
  const despues = (await apiRequest('/auth/me', { token: tokenNuevo })).data;
  assert(despues.carrier_base_locality_id === destino.id, 'la localidad base no se guardó');
  assert(despues.carrier_base_locality_name === destino.name, 'el nombre de localidad no coincide');
  assert(despues.carrier_transport === transporteNuevo, 'el transporte no se guardó');
  assert(despues.carrier_transport_certified === true, 'la habilitación no quedó declarada');
  assert(Number(despues.carrier_coverage_radius_km) === radioNuevo, 'el radio no se guardó');
  assert(despues.carrier_capacity === capacidadNueva, 'la capacidad no se guardó');
  assert(despues.is_carrier === true, 'la edición cambió la condición de transportista');

  const [enBase] = queryRows(`
    SELECT
      u.carrier_base_locality_id,
      u.carrier_transport,
      u.carrier_transport_certified::text,
      u.carrier_coverage_radius_km::text,
      COALESCE(u.carrier_capacity, ''),
      l.name
    FROM users u
    JOIN localities l ON l.id = u.carrier_base_locality_id
    WHERE u.email = ${sqlLiteral(email)}
  `);
  assert(enBase, 'el transportista editado no quedó en la base');
  assert(enBase[0] === destino.id, `localidad SQL inesperada: ${enBase[0]}`);
  assert(enBase[1] === transporteNuevo, 'transporte SQL incorrecto');
  assert(enBase[2] === 'true', 'habilitación SQL no quedó declarada');
  assert(Number(enBase[3]) === radioNuevo, `radio SQL inesperado: ${enBase[3]}`);
  assert(enBase[4] === capacidadNueva, 'capacidad SQL incorrecta');

  // --- lo que el perfil no puede aceptar
  const localidadInexistente = await expectApiError(400, () => apiRequest('/auth/me', {
    method: 'PATCH',
    token: tokenNuevo,
    body: { carrier_base_locality_id: '00000000' },
  }));
  assert(/padr/i.test(localidadInexistente),
    `el rechazo de localidad no explica el motivo: ${localidadInexistente}`);

  // El radio no positivo lo corta el esquema, igual que en el alta.
  await expectApiError(422, () => apiRequest('/auth/me', {
    method: 'PATCH',
    token: tokenNuevo,
    body: { carrier_coverage_radius_km: 0 },
  }));
  await expectApiError(422, () => apiRequest('/auth/me', {
    method: 'PATCH',
    token: tokenNuevo,
    body: { carrier_coverage_radius_km: -15 },
  }));

  // Un envío parcial tampoco puede dejar el perfil en un estado que el alta
  // habría rechazado.
  await expectApiError(400, () => apiRequest('/auth/me', {
    method: 'PATCH',
    token: tokenNuevo,
    body: { carrier_transport: '   ' },
  }));
  await expectApiError(400, () => apiRequest('/auth/me', {
    method: 'PATCH',
    token: tokenNuevo,
    body: { carrier_transport_certified: false },
  }));

  // Quien no es transportista no edita datos de transporte: volverse uno no
  // es una decisión que este endpoint pueda tomar.
  await expectApiError(400, () => apiRequest('/auth/me', {
    method: 'PATCH',
    token: state.buyerToken,
    body: { carrier_transport: 'Camioneta prestada' },
  }));
  const comprador = (await apiRequest('/auth/me', { token: state.buyerToken })).data;
  assert(comprador.is_carrier === false, 'el comprador quedó marcado como transportista');
  assert(comprador.carrier_transport === null, 'el comprador quedó con transporte');

  // Ninguno de los rechazos pudo escribir.
  const [intacto] = queryRows(`
    SELECT u.carrier_base_locality_id, u.carrier_transport, u.carrier_coverage_radius_km::text
    FROM users u WHERE u.email = ${sqlLiteral(email)}
  `);
  assert(intacto[0] === destino.id, 'un rechazo cambió la localidad base');
  assert(intacto[1] === transporteNuevo, 'un rechazo cambió el transporte');
  assert(Number(intacto[2]) === radioNuevo, 'un rechazo cambió el radio');

  return `panel + API + SQL: ${inicial.name} → ${destino.name}, ${radioNuevo} km; `
    + '6 rechazos sin escritura';
});

await runCase(40, 'El perfil no inventa datos y guardar sin cambios no pisa nada', async () => {
  // El formulario arrancaba con constantes de ejemplo —"+54 9 11 5555-4444",
  // "CABA", "Av. Corrientes 1234"— y partía la ubicación en tres para volver a
  // unirla. Abrir y guardar escribía datos falsos sobre una cuenta real y
  // rompía cualquier ubicación que no tuviera exactamente tres partes.
  const INVENTADOS = ['5555-4444', 'CABA', 'Av. Corrientes 1234'];
  const password = 'smoke123';

  // La ubicación tiene DOS partes a propósito: es el caso que se perdía.
  const conDatos = {
    email: `perfil.completo.${Date.now()}@example.com`,
    nombre: 'Perfil Completo',
    phone: '+54 341 555 0101',
    whatsapp: '+54 341 555 0102',
    location: 'Rosario, Santa Fe',
  };
  const sinDatos = {
    email: `perfil.vacio.${Date.now()}@example.com`,
    nombre: 'Perfil Vacio',
  };

  await registrarYVerificar({
    email: conDatos.email,
    password,
    full_name: conDatos.nombre,
    phone: conDatos.phone,
  });
  const ingresoCompleto = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: conDatos.email, password },
  });
  await apiRequest('/auth/me', {
    method: 'PATCH',
    token: ingresoCompleto.data.access_token,
    body: { whatsapp: conDatos.whatsapp, location: conDatos.location },
  });

  await registrarYVerificar({
    email: sinDatos.email,
    password,
    full_name: sinDatos.nombre,
  });
  const ingresoVacio = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: sinDatos.email, password },
  });

  const perfilDe = async (token) => (await apiRequest('/auth/me', { token })).data;

  async function conPanel(tokens, accion) {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      await context.addInitScript(
        ({ a, r }) => {
          window.localStorage.setItem('access_token', a);
          window.localStorage.setItem('refresh_token', r);
        },
        { a: tokens.access_token, r: tokens.refresh_token },
      );
      const page = await context.newPage();
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
      await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
      return await accion(page);
    } finally {
      await browser.close();
    }
  }

  // --- 1. cuenta CON datos: lo que se ve es lo guardado
  await conPanel(ingresoCompleto.data, async (page) => {
    const perfil = page.locator('[class*="_profileForm_"]');
    const lectura = ((await perfil.textContent()) || '').replace(/\s+/g, ' ');
    for (const basura of INVENTADOS) {
      assert(!lectura.includes(basura), `la lectura trae el dato inventado "${basura}"`);
    }
    assert(lectura.includes(conDatos.location), `la lectura no muestra la ubicación: ${lectura}`);

    await page.getByRole('button', { name: 'Editar' }).click();
    await page.locator('#perfil-nombre').waitFor();
    // El correo no puede ser un control que aparente guardar: no hay endpoint.
    assert(await perfil.locator('input[type="email"]').count() === 0,
      'el email sigue siendo editable y el guardado no lo manda');

    for (const [campo, esperado] of [
      ['#perfil-nombre', conDatos.nombre],
      ['#perfil-telefono', conDatos.phone],
      ['#perfil-whatsapp', conDatos.whatsapp],
      ['#perfil-ubicacion', conDatos.location],
    ]) {
      const valor = await page.locator(campo).inputValue();
      assert(valor === esperado, `${campo} abrió con "${valor}" y no con "${esperado}"`);
    }

    // Guardar sin tocar nada no puede cambiar un solo carácter.
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByText('Perfil actualizado exitosamente').waitFor({ timeout: 15_000 });
  });

  const despuesDeGuardarIgual = await perfilDe(ingresoCompleto.data.access_token);
  assert(despuesDeGuardarIgual.full_name === conDatos.nombre, 'guardar sin cambios movió el nombre');
  assert(despuesDeGuardarIgual.phone === conDatos.phone, 'guardar sin cambios movió el teléfono');
  assert(despuesDeGuardarIgual.whatsapp === conDatos.whatsapp, 'guardar sin cambios movió el WhatsApp');
  assert(despuesDeGuardarIgual.location === conDatos.location,
    `la ubicación de dos partes no sobrevivió: ${JSON.stringify(despuesDeGuardarIgual.location)}`);

  // --- 2. cuenta SIN datos: los campos abren vacíos y siguen vacíos
  await conPanel(ingresoVacio.data, async (page) => {
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.locator('#perfil-nombre').waitFor();
    for (const campo of ['#perfil-telefono', '#perfil-whatsapp', '#perfil-ubicacion']) {
      const valor = await page.locator(campo).inputValue();
      assert(valor === '', `${campo} abrió con "${valor}" en una cuenta sin datos`);
    }
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByText('Perfil actualizado exitosamente').waitFor({ timeout: 15_000 });
  });

  const vacioDespues = await perfilDe(ingresoVacio.data.access_token);
  for (const [campo, valor] of Object.entries({
    phone: vacioDespues.phone,
    whatsapp: vacioDespues.whatsapp,
    location: vacioDespues.location,
  })) {
    assert(valor === null, `${campo} pasó de ausente a ${JSON.stringify(valor)}`);
  }
  const [enBaseVacio] = queryRows(`
    SELECT COALESCE(phone, '<null>'), COALESCE(whatsapp, '<null>'), COALESCE(location, '<null>')
    FROM users WHERE email = ${sqlLiteral(sinDatos.email)}
  `);
  assert(enBaseVacio.every((valor) => valor === '<null>'),
    `la base guardó algo en una cuenta sin datos: ${JSON.stringify(enBaseVacio)}`);

  // --- 3. cancelar no puede reaparecer en el guardado siguiente
  const ubicacionNueva = 'Ruta 8 km 220, Pergamino, Buenos Aires';
  await conPanel(ingresoCompleto.data, async (page) => {
    await page.getByRole('button', { name: 'Editar' }).click();
    await page.locator('#perfil-telefono').fill('+54 11 0000 0000');
    await page.locator('#perfil-ubicacion').fill('Ubicación abandonada');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await descartarSiPregunta(page,
      async () => (await page.locator('#perfil-nombre').count()) === 0,
      'cancelar la edición del perfil');

    await page.getByRole('button', { name: 'Editar' }).click();
    const telefono = await page.locator('#perfil-telefono').inputValue();
    const ubicacion = await page.locator('#perfil-ubicacion').inputValue();
    assert(telefono === conDatos.phone, `cancelar dejó el teléfono en "${telefono}"`);
    assert(ubicacion === conDatos.location, `cancelar dejó la ubicación en "${ubicacion}"`);

    // --- 4. y un cambio explícito sí se guarda
    await page.locator('#perfil-ubicacion').fill(ubicacionNueva);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByText('Perfil actualizado exitosamente').waitFor({ timeout: 15_000 });
  });

  const final = await perfilDe(ingresoCompleto.data.access_token);
  assert(final.location === ubicacionNueva, `el cambio explícito no se guardó: ${final.location}`);
  assert(final.phone === conDatos.phone, 'la edición cancelada volvió en el guardado siguiente');

  const [enBase] = queryRows(`
    SELECT location, phone, whatsapp FROM users WHERE email = ${sqlLiteral(conDatos.email)}
  `);
  assert(enBase[0] === ubicacionNueva, `ubicación SQL inesperada: ${enBase[0]}`);
  assert(enBase[1] === conDatos.phone, `teléfono SQL inesperado: ${enBase[1]}`);
  assert(enBase[2] === conDatos.whatsapp, `WhatsApp SQL inesperado: ${enBase[2]}`);

  return `sin constantes de ejemplo; "${conDatos.location}" intacta al guardar sin cambios; `
    + 'cuenta vacía sigue nula en API y SQL; cancelar no reaparece';
});

await runCase(41, 'Repetir el seed no duplica ni altera las cuentas demo', async () => {
  // El seed agrega un transportista demo para que su media pantalla de perfil
  // pueda medirse en una instalación limpia. Volver a correrlo tiene que dejar
  // exactamente una cuenta de cada una y no tocar las tres anteriores.
  const DEMO = [
    'admin@topgreen.com',
    'vendedor@ejemplo.com',
    'cliente@ejemplo.com',
    'transportista@ejemplo.com',
  ];

  const retrato = () => queryRows(`
    SELECT
      u.email,
      u.id,
      u.full_name,
      u.password_hash,
      u.role::text,
      COALESCE(u.phone, ''),
      COALESCE(u.location, ''),
      COALESCE(u.cbu, ''),
      COALESCE(u.alias_bancario, ''),
      u.is_carrier::text,
      COALESCE(u.carrier_base_locality_id, ''),
      COALESCE(u.carrier_transport, ''),
      u.carrier_transport_certified::text,
      COALESCE(u.carrier_coverage_radius_km::text, ''),
      COALESCE(u.carrier_capacity, '')
    FROM users u
    WHERE u.email IN (${DEMO.map(sqlLiteral).join(', ')})
    ORDER BY u.email
  `).map((fila) => fila.join('\u0001'));

  const antes = retrato();
  assert(antes.length === DEMO.length,
    `el seed no dejó las ${DEMO.length} cuentas demo, sino ${antes.length}`);

  // El transportista demo tiene que estar completo: un perfil incompleto es
  // uno que la propia API rechaza al editarlo.
  const [transportista] = queryRows(`
    SELECT
      u.is_carrier::text,
      l.name,
      l.province_name,
      u.carrier_transport,
      u.carrier_transport_certified::text,
      u.carrier_coverage_radius_km::text,
      COALESCE(u.carrier_capacity, ''),
      u.is_verified::text
    FROM users u
    JOIN localities l ON l.id = u.carrier_base_locality_id
    WHERE u.email = 'transportista@ejemplo.com'
  `);
  assert(transportista, 'el transportista demo no tiene una localidad del padrón');
  assert(transportista[0] === 'true', 'el transportista demo no está marcado como tal');
  assert(transportista[3].trim().length > 0, 'el transportista demo no declara transporte');
  assert(transportista[4] === 'true', 'el transportista demo no declara habilitación');
  assert(Number(transportista[5]) > 0, `radio no positivo: ${transportista[5]}`);
  assert(transportista[6].trim().length > 0, 'el transportista demo no declara capacidad');
  assert(transportista[7] === 'true', 'el transportista demo no quedó verificado');

  const salida = correrSeed();
  assert(/Seed completado/i.test(salida), `el seed no terminó bien: ${salida.slice(-200)}`);

  const despues = retrato();
  assert(despues.length === DEMO.length,
    `repetir el seed dejó ${despues.length} cuentas demo en vez de ${DEMO.length}`);
  for (let i = 0; i < antes.length; i += 1) {
    assert(antes[i] === despues[i],
      `repetir el seed cambió una cuenta demo:\n  antes:  ${antes[i]}\n  después: ${despues[i]}`);
  }

  const duplicados = queryCount(`
    SELECT COUNT(*) FROM (
      SELECT email FROM users
      WHERE email IN (${DEMO.map(sqlLiteral).join(', ')})
      GROUP BY email HAVING COUNT(*) > 1
    ) AS repetidos
  `);
  assert(duplicados === 0, `hay ${duplicados} correos demo duplicados`);

  return `${DEMO.length} cuentas demo idénticas tras repetir el seed; `
    + `transportista en ${transportista[1]}, ${transportista[2]}, radio ${transportista[5]} km`;
});

await runCase(42, 'La habilitación es una declaración con detalle y fecha del servidor', async () => {
  assert(state.location, 'caso 5 no dejó provincia/localidad');
  const password = 'smoke123';
  const email = `declaracion.${Date.now()}@example.com`;

  // Sin detalle no hay alta de transportista: el contrato pide declaración,
  // no un booleano suelto.
  const sinDetalle = await expectApiError(422, () => apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: `sin.detalle.${Date.now()}@example.com`,
      password,
      full_name: 'Sin Detalle',
      is_carrier: true,
      carrier_base_locality_id: state.location.localityId,
      carrier_transport: 'Camión sin declaración',
      carrier_transport_certified: true,
      carrier_coverage_radius_km: 100,
    },
  }));
  assert(/habilitaci/i.test(sinDetalle), `el rechazo no explica el motivo: ${sinDetalle}`);

  const detalleInicial = 'RUTA, cargas generales, N.° DECL-1';
  await registrarYVerificar({
    email,
    password,
    full_name: 'Declara Transportista',
    is_carrier: true,
    carrier_base_locality_id: state.location.localityId,
    carrier_transport: 'Camión declarado',
    carrier_transport_certified: true,
    carrier_certification_detail: detalleInicial,
    carrier_coverage_radius_km: 100,
  });
  const ingreso = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
  const token = ingreso.data.access_token;

  const alta = (await apiRequest('/auth/me', { token })).data;
  assert(alta.carrier_certification_detail === detalleInicial, 'no se guardó el detalle');
  assert(alta.carrier_certification_declared_at, 'no quedó fecha de declaración');

  // La fecha no la escribe quien declara: un intento de mandarla se ignora.
  const conFechaFalsa = await apiRequest('/auth/me', {
    method: 'PATCH',
    token,
    body: {
      carrier_certification_detail: detalleInicial,
      carrier_certification_declared_at: '1999-01-01T00:00:00',
    },
  });
  assert(
    conFechaFalsa.data.carrier_certification_declared_at === alta.carrier_certification_declared_at,
    'se pudo retrodatar la declaración desde el pedido',
  );

  // Guardar sin cambiar el detalle no rejuvenece una declaración vieja.
  const sinCambios = await apiRequest('/auth/me', {
    method: 'PATCH', token, body: { carrier_capacity: 'Hasta 12 toneladas' },
  });
  assert(
    sinCambios.data.carrier_certification_declared_at === alta.carrier_certification_declared_at,
    'la fecha se movió sin declarar nada nuevo',
  );

  // Un detalle distinto SÍ es una declaración nueva.
  await new Promise((listo) => setTimeout(listo, 1100));
  const detalleNuevo = 'RUTA, cargas peligrosas, N.° DECL-2';
  const declaradoDeNuevo = await apiRequest('/auth/me', {
    method: 'PATCH', token, body: { carrier_certification_detail: detalleNuevo },
  });
  assert(declaradoDeNuevo.data.carrier_certification_detail === detalleNuevo,
    'no se guardó el detalle nuevo');
  assert(
    declaradoDeNuevo.data.carrier_certification_declared_at > alta.carrier_certification_declared_at,
    'declarar de nuevo no actualizó la fecha',
  );

  // Vaciar el detalle deja el perfil incompleto: se rechaza.
  await expectApiError(400, () => apiRequest('/auth/me', {
    method: 'PATCH', token, body: { carrier_certification_detail: '   ' },
  }));

  const [enBase] = queryRows(`
    SELECT carrier_certification_detail,
           (carrier_certification_declared_at IS NOT NULL)::text
    FROM users WHERE email = ${sqlLiteral(email)}
  `);
  assert(enBase[0] === detalleNuevo, `detalle SQL inesperado: ${enBase[0]}`);
  assert(enBase[1] === 'true', 'la fecha no quedó en base');

  return 'alta sin detalle rechazada; fecha puesta por el servidor, no retrodatable, '
    + 'inmóvil sin cambios y renovada al volver a declarar';
});

await runCase(43, 'Fletes compatibles por futura orden, con PostGIS y sin contacto', async () => {
  // Dos vendedores con orígenes distintos, un destino del padrón y candidatos
  // en el límite del radio. La compatibilidad exige cubrir el destino Y CADA
  // origen del grupo.
  const password = 'smoke123';
  const marca = Date.now();
  const localidad = (nombre, provincia) => {
    const [fila] = queryRows(`
      SELECT id FROM localities
      WHERE name = ${sqlLiteral(nombre)} AND province_name = ${sqlLiteral(provincia)}
      LIMIT 1
    `);
    assert(fila, `el padrón no tiene ${nombre}, ${provincia}`);
    return fila[0];
  };
  const destino = localidad('Pergamino', 'Buenos Aires');
  const origenA = localidad('Rosario', 'Santa Fe');
  const origenB = localidad('Córdoba', 'Córdoba');

  const km = (a, b) => Number(queryRows(`
    SELECT ROUND((ST_Distance(x.coordinates, y.coordinates)/1000)::numeric, 1)
    FROM localities x, localities y
    WHERE x.id = ${sqlLiteral(a)} AND y.id = ${sqlLiteral(b)}
  `)[0][0]);
  const aRosario = km(destino, origenA);
  const aCordoba = km(destino, origenB);
  assert(aRosario > 0 && aCordoba > aRosario, 'las distancias del padrón no son las esperadas');

  // Los cuatro candidatos tienen su base en el destino, así que lo que los
  // separa es sólo el radio y el estado de su perfil.
  const candidatos = [
    { etiqueta: 'amplio', radio: Math.ceil(aCordoba) + 10, completo: true },
    { etiqueta: 'unorigen', radio: Math.ceil(aRosario) + 10, completo: true },
    { etiqueta: 'justodentro', radio: Math.ceil(aRosario), completo: true },
    { etiqueta: 'justoafuera', radio: Math.floor(aRosario) - 1, completo: true },
    { etiqueta: 'incompleto', radio: Math.ceil(aCordoba) + 10, completo: false },
  ];
  const correoDe = {};
  for (const candidato of candidatos) {
    const correo = `flete.${candidato.etiqueta}.${marca}@example.com`;
    correoDe[candidato.etiqueta] = correo;
    await registrarYVerificar({
      email: correo,
      password,
      full_name: `Flete ${candidato.etiqueta} ${marca}`,
      is_carrier: true,
      carrier_base_locality_id: destino,
      carrier_transport: `Camión ${candidato.etiqueta}`,
      carrier_transport_certified: true,
      carrier_certification_detail: 'RUTA, cargas generales, prueba',
      carrier_coverage_radius_km: candidato.radio,
      carrier_capacity: '20 toneladas',
    });
    if (!candidato.completo) {
      // Como los perfiles anteriores a la migración: sin declaración. No se
      // inventa una y por eso no puede aparecer como compatible.
      querySql(`
        UPDATE users SET carrier_certification_detail = NULL,
                         carrier_certification_declared_at = NULL
        WHERE email = ${sqlLiteral(correo)}
      `);
    }
  }

  // Dos publicaciones de vendedores distintos, con orígenes distintos. Los
  // servicios quedan afuera: su tarjeta ofrece «Consultar», no «Agregar», y el
  // id es un UUID, así que sin este filtro el tramo de interfaz depende del
  // orden que le tocó al seed.
  const publicaciones = queryRows(`
    SELECT p.id, p.seller_id FROM products p
    WHERE p.status = 'ACTIVE' AND p.stock > 0 AND p.publication_type <> 'servicio'
    ORDER BY p.seller_id, p.id
  `);
  const primeraDeCada = new Map();
  for (const [id, vendedor] of publicaciones) {
    if (!primeraDeCada.has(vendedor)) primeraDeCada.set(vendedor, id);
  }
  const [[vendedorA, productoA], [vendedorB, productoB]] = [...primeraDeCada.entries()].slice(0, 2);
  assert(productoB, 'hace falta más de un vendedor con publicaciones activas');
  const origenPrevioA = queryRows(
    `SELECT COALESCE(locality_id, '') FROM products WHERE id = ${sqlLiteral(productoA)}`)[0][0];
  const origenPrevioB = queryRows(
    `SELECT COALESCE(locality_id, '') FROM products WHERE id = ${sqlLiteral(productoB)}`)[0][0];

  try {
    querySql(`UPDATE products SET locality_id = ${sqlLiteral(origenA)} WHERE id = ${sqlLiteral(productoA)}`);
    querySql(`UPDATE products SET locality_id = ${sqlLiteral(origenB)} WHERE id = ${sqlLiteral(productoB)}`);

    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    for (const producto of [productoA, productoB]) {
      await apiRequest('/cart/items', {
        method: 'POST', token: state.buyerToken, body: { product_id: producto, quantity: 1 },
      });
    }

    const listado = (await apiRequest(
      `/logistics/compatible-carriers?destination_locality_id=${destino}`,
      { token: state.buyerToken },
    )).data;
    assert(listado.groups.length === 2, `esperaba 2 grupos y vinieron ${listado.groups.length}`);

    const nombresDe = (vendedor) => {
      const grupo = listado.groups.find((g) => g.seller_id === vendedor);
      assert(grupo, `falta el grupo del vendedor ${vendedor}`);
      return grupo.carriers.map((c) => c.full_name).filter((n) => n.includes(String(marca)));
    };
    const enRosario = nombresDe(vendedorA);
    const enCordoba = nombresDe(vendedorB);

    // El que sólo cubre un origen queda afuera del grupo lejano.
    assert(enRosario.includes(`Flete unorigen ${marca}`), 'falta el que cubre Rosario');
    assert(!enCordoba.includes(`Flete unorigen ${marca}`),
      'un candidato que falla en un solo origen quedó adentro');
    assert(enCordoba.includes(`Flete amplio ${marca}`), 'falta el que cubre los dos');
    // El límite del radio.
    assert(enRosario.includes(`Flete justodentro ${marca}`), 'el candidato al límite quedó afuera');
    assert(!enRosario.includes(`Flete justoafuera ${marca}`),
      'un candidato fuera del radio quedó adentro');
    // El perfil sin declaración no se lista en ningún grupo.
    for (const lista of [enRosario, enCordoba]) {
      assert(!lista.includes(`Flete incompleto ${marca}`),
        'un perfil sin declaración apareció como compatible');
    }

    // Contraste con PostGIS, grupo por grupo: no se comparan cantidades fijas.
    for (const [vendedor, origenes] of [[vendedorA, [origenA]], [vendedorB, [origenB]]]) {
      const esperados = queryRows(`
        SELECT u.full_name FROM users u
        JOIN localities b ON b.id = u.carrier_base_locality_id
        WHERE u.is_carrier AND u.is_active AND u.is_verified
          AND u.carrier_transport_certified
          AND btrim(COALESCE(u.carrier_certification_detail, '')) <> ''
          AND u.carrier_certification_declared_at IS NOT NULL
          AND COALESCE(u.carrier_coverage_radius_km, 0) > 0
          AND ST_DWithin(b.coordinates,
                (SELECT coordinates FROM localities WHERE id = ${sqlLiteral(destino)}),
                u.carrier_coverage_radius_km::float * 1000)
          AND NOT EXISTS (
            SELECT 1 FROM localities o
            WHERE o.id IN (${origenes.map(sqlLiteral).join(', ')})
              AND NOT ST_DWithin(b.coordinates, o.coordinates,
                    u.carrier_coverage_radius_km::float * 1000))
        ORDER BY u.full_name
      `).map((fila) => fila[0]);
      const grupo = listado.groups.find((g) => g.seller_id === vendedor);
      const deLaApi = grupo.carriers.map((c) => c.full_name).sort();
      assert(JSON.stringify(deLaApi) === JSON.stringify([...esperados].sort()),
        `API y PostGIS no coinciden para ${vendedor}:\n  API: ${deLaApi.join(', ')}`
        + `\n  SQL: ${esperados.join(', ')}`);
    }

    // Ni un dato de contacto en la respuesta.
    const crudo = JSON.stringify(listado).toLowerCase();
    for (const prohibido of ['email', 'phone', 'whatsapp', 'cbu', 'alias', '@example.com']) {
      assert(!crudo.includes(prohibido), `el listado expone «${prohibido}»`);
    }

    // Un producto sin localidad oficial deja al grupo sin poder declarar nada.
    querySql(`UPDATE products SET locality_id = NULL WHERE id = ${sqlLiteral(productoB)}`);
    const conHueco = (await apiRequest(
      `/logistics/compatible-carriers?destination_locality_id=${destino}`,
      { token: state.buyerToken },
    )).data;
    const grupoSinOrigen = conHueco.groups.find((g) => g.seller_id === vendedorB);
    assert(grupoSinOrigen.origin_missing === true, 'el grupo sin origen no se marca');
    assert(grupoSinOrigen.carriers.length === 0, 'un grupo sin origen no puede listar fletes');
    querySql(`UPDATE products SET locality_id = ${sqlLiteral(origenB)} WHERE id = ${sqlLiteral(productoB)}`);

    // Cambiar el destino cambia el resultado.
    const otroDestino = (await apiRequest(
      `/logistics/compatible-carriers?destination_locality_id=${origenB}`,
      { token: state.buyerToken },
    )).data;
    const enOtroDestino = otroDestino.groups
      .find((g) => g.seller_id === vendedorA).carriers
      .map((c) => c.full_name).filter((n) => n.includes(String(marca)));
    assert(!enOtroDestino.includes(`Flete unorigen ${marca}`),
      'cambiar el destino no cambió la compatibilidad');

    // Un destino que no está en el padrón no se calcula.
    await expectApiError(400, () => apiRequest(
      '/logistics/compatible-carriers?destination_locality_id=00000000',
      { token: state.buyerToken },
    ));

    // Y ahora la integración de verdad. El carrito que ve la persona vive en
    // el navegador; el servidor arma los grupos con el suyo. Para que el
    // tramo de pantalla pruebe algo, el carrito del servidor arranca con el
    // producto del vendedor A y la interfaz agrega SÓLO el del vendedor B:
    // el listado tiene que hablar de B y jamás de A.
    const nombreA = queryRows(
      `SELECT name FROM products WHERE id = ${sqlLiteral(productoA)}`)[0][0];
    const nombreB = queryRows(
      `SELECT name FROM products WHERE id = ${sqlLiteral(productoB)}`)[0][0];
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    await apiRequest('/cart/items', {
      method: 'POST', token: state.buyerToken, body: { product_id: productoA, quantity: 1 },
    });

    const navegador = await chromium.launch({ headless: true });
    let visto = '';
    try {
      const contexto = await navegador.newContext();
      await contexto.addInitScript(
        ({ a, r }) => {
          window.localStorage.setItem('access_token', a);
          window.localStorage.setItem('refresh_token', r);
          // El navegador arranca sin carrito propio: lo arma la persona.
          window.localStorage.removeItem('agromarket_cart');
        },
        { a: state.buyerToken, r: state.buyerRefreshToken },
      );
      const page = await contexto.newPage();
      await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
      await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
      const buscador = page.getByLabel('Buscar en el mercado');
      await buscador.fill(nombreB);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: nombreB, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await accionDeLaTarjeta(page, nombreB).click();

      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de env/i }).waitFor();
      await elegirDestino(page, 'Pergamino');

      const seccion = page.locator('[class*="_fletes_"]');
      await seccion.waitFor({ state: 'visible', timeout: 15_000 });
      // El directorio se abre al decir "necesito flete": antes de eso la
      // pantalla sólo pregunta cómo se traslada el pedido.
      const pedirFlete = seccion.getByRole('radio', { name: /Necesito flete/ });
      await pedirFlete.first().waitFor({ state: 'visible', timeout: 15_000 });
      const cuantosGrupos = await pedirFlete.count();
      for (let i = 0; i < cuantosGrupos; i += 1) await pedirFlete.nth(i).check();
      await page.getByText('Base:').first().waitFor({ state: 'visible', timeout: 15_000 });
      visto = ((await seccion.textContent()) || '').replace(/\s+/g, ' ');

      // El grupo es el del carrito visible, no el que el servidor tenía antes.
      const vendedorDeB = queryRows(
        `SELECT u.full_name FROM users u
         JOIN products p ON p.seller_id = u.id
         WHERE p.id = ${sqlLiteral(productoB)}`)[0][0];
      const vendedorDeA = queryRows(
        `SELECT u.full_name FROM users u
         JOIN products p ON p.seller_id = u.id
         WHERE p.id = ${sqlLiteral(productoA)}`)[0][0];
      assert(visto.includes(`Envío de ${vendedorDeB}`),
        `el listado no habla del carrito visible (${nombreB}): "${visto.slice(0, 220)}"`);
      assert(!visto.includes(`Envío de ${vendedorDeA}`),
        `el listado sigue mostrando el carrito viejo del servidor (${nombreA})`);
      // Y el carrito del servidor quedó igual al visible: un solo producto, el B.
      const enServidor = queryRows(`
        SELECT ci.product_id FROM cart_items ci
        JOIN carts c ON c.id = ci.cart_id
        WHERE c.user_id = ${sqlLiteral(state.buyerId)} AND c.status = 'ACTIVE'
      `).map((fila) => fila[0]);
      assert(enServidor.length === 1 && enServidor[0] === productoB,
        `el carrito del servidor no se sincronizó: ${JSON.stringify(enServidor)}`);

      assert(/TopGreen no verifica esta habilitación/.test(visto),
        'la pantalla no aclara que la habilitación es una declaración');
      for (const prohibido of ['@example.com', '+54', 'CBU', 'cbu', 'alias']) {
        assert(!visto.includes(prohibido), `la pantalla muestra «${prohibido}»`);
      }
    } finally {
      await navegador.close();
    }

    return `2 grupos, ${enRosario.length} y ${enCordoba.length} candidatos propios; `
      + `límite en ${aRosario} km respetado; API = PostGIS; el listado sigue al `
      + 'carrito armado en pantalla, no al del servidor; sin contacto en JSON ni DOM';
  } finally {
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    for (const [producto, previo] of [[productoA, origenPrevioA], [productoB, origenPrevioB]]) {
      querySql(previo
        ? `UPDATE products SET locality_id = ${sqlLiteral(previo)} WHERE id = ${sqlLiteral(producto)}`
        : `UPDATE products SET locality_id = NULL WHERE id = ${sqlLiteral(producto)}`);
    }
  }
});

await runCase(44, 'El destino de la orden sale del padrón y las órdenes viejas siguen legibles', async () => {
  const destino = localidadDeEnvio();

  // Un destino que no existe no crea nada.
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/items', {
    method: 'POST', token: state.buyerToken,
    body: { product_id: state.product.id, quantity: 1 },
  });
  const ordenesAntes = queryCount(
    `SELECT COUNT(*) FROM orders WHERE buyer_id = ${sqlLiteral(state.buyerId)}`);
  const rechazo = await expectApiError(400, () => apiRequest('/orders/checkout/transfer', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: 'Ruta 8 km 220',
      shipping_locality_id: '00000000',
      shipping_postal_code: '2700',
      notes: 'Destino inventado',
      shipping_decisions: trasladoPropio(),
    },
  }));
  assert(/padr/i.test(rechazo), `el rechazo no explica el motivo: ${rechazo}`);
  assert(
    queryCount(`SELECT COUNT(*) FROM orders WHERE buyer_id = ${sqlLiteral(state.buyerId)}`)
      === ordenesAntes,
    'un destino inválido igual creó una orden',
  );

  // Con un destino del padrón, la orden lo guarda y la ciudad y la provincia
  // salen del padrón, no del texto del cliente.
  const creada = await apiRequest('/orders/checkout/transfer', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: 'Ruta 8 km 220',
      shipping_locality_id: destino,
      shipping_postal_code: '2700',
      notes: 'Orden con destino oficial',
      shipping_decisions: trasladoPropio(),
    },
  });
  const [orden] = creada.data.orders;
  const [enBase] = queryRows(`
    SELECT o.shipping_locality_id,
           l.name,
           l.province_name,
           o.shipping_address_json->>'city',
           o.shipping_address_json->>'province'
    FROM orders o
    JOIN localities l ON l.id = o.shipping_locality_id
    WHERE o.id = ${sqlLiteral(orden.order_id)}
  `);
  assert(enBase, 'la orden nueva no quedó con destino del padrón');
  assert(enBase[0] === destino, `destino SQL inesperado: ${enBase[0]}`);
  assert(enBase[3] === enBase[1], 'la ciudad guardada no es la del padrón');
  assert(enBase[4] === enBase[2], 'la provincia guardada no es la del padrón');

  // Una orden anterior a la logística no tiene destino y tiene que seguir
  // leyéndose igual.
  querySql(`
    UPDATE orders SET shipping_locality_id = NULL
    WHERE id = ${sqlLiteral(orden.order_id)}
  `);
  const historica = await apiRequest(`/orders/${orden.order_id}`, { token: state.buyerToken });
  assert(historica.status === 200,
    `una orden sin destino dejó de leerse: HTTP ${historica.status}`);
  assert(historica.data.order_number === orden.order_number, 'la orden histórica cambió de número');
  const listado = await apiRequest('/orders/my?as_role=buyer', { token: state.buyerToken });
  assert(listado.status === 200, 'el listado de órdenes se rompe con una orden sin destino');
  assert(
    listado.data.some((o) => o.order_number === orden.order_number),
    'la orden sin destino desapareció del listado',
  );

  return `destino inválido rechazado sin escribir; ${enBase[1]}, ${enBase[2]} guardada desde el `
    + 'padrón; orden sin destino sigue legible en detalle y listado';
});

await runCase(45, 'La escritura de un carrito abandonado no puede quedar última', async () => {
  // El checkout se desmonta al cerrarlo. Si la coordinación de las escrituras
  // viviera adentro suyo, cerrar con una escritura en vuelo, cambiar el
  // carrito y volver a abrir crearía otra cola: la escritura nueva saldría por
  // su cuenta, y la vieja —huérfana— terminaría última encima del carrito
  // vigente. Todo el recorrido es de interfaz, sin recargar la página, y los
  // tiempos los decide la prueba, no la red.
  const publicaciones = queryRows(`
    SELECT p.id, p.seller_id, p.name FROM products p
    WHERE p.status = 'ACTIVE' AND p.stock > 0 AND p.publication_type <> 'servicio'
    ORDER BY p.seller_id, p.id
  `);
  const primeraDeCada = new Map();
  for (const [id, vendedor, nombre] of publicaciones) {
    if (!primeraDeCada.has(vendedor)) primeraDeCada.set(vendedor, { id, nombre, vendedor });
  }
  const [productoA, productoB] = [...primeraDeCada.values()].slice(0, 2);
  assert(productoB, 'hacen falta dos vendedores con publicaciones activas');
  const nombreDelVendedor = (id) => queryRows(
    `SELECT full_name FROM users WHERE id = ${sqlLiteral(id)}`)[0][0];
  const vendedorDeA = nombreDelVendedor(productoA.vendedor);
  const vendedorDeB = nombreDelVendedor(productoB.vendedor);
  assert(vendedorDeA !== vendedorDeB, 'los dos productos tienen que ser de vendedores distintos');

  const carritoDelServidor = () => queryRows(`
    SELECT ci.product_id FROM cart_items ci
    JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${sqlLiteral(state.buyerId)} AND c.status = 'ACTIVE'
    ORDER BY ci.product_id
  `).map((fila) => fila[0]);

  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
        window.localStorage.removeItem('agromarket_cart');
      },
      { a: state.buyerToken, r: state.buyerRefreshToken },
    );
    const page = await context.newPage();

    // La primera escritura del carrito queda retenida hasta que la prueba la
    // suelte; de las respuestas se lleva cuenta para no medir sobre una
    // escritura que todavía está viajando.
    let liberarA = () => {};
    const retenidaA = new Promise((listo) => { liberarA = listo; });
    const cuerpos = [];
    let respuestas = 0;
    await page.route('**/api/cart/sync', async (ruta) => {
      const numero = cuerpos.length + 1;
      cuerpos.push(ruta.request().postData() || '');
      if (numero === 1) await retenidaA;
      await ruta.continue();
    });
    page.on('response', (respuesta) => {
      if (respuesta.url().includes('/api/cart/sync')) respuestas += 1;
    });

    const esperarA = async (condicion, mensaje, limite = 20_000) => {
      const hasta = Date.now() + limite;
      while (Date.now() < hasta) {
        if (condicion()) return;
        await page.waitForTimeout(100);
      }
      throw new Error(mensaje);
    };

    // Nunca se recarga la página: recargar rearmaría cualquier cola por sí
    // solo y la prueba dejaría de medir lo que dice medir.
    const agregarDesdeLaInterfaz = async (producto) => {
      const buscador = page.getByLabel('Buscar en el mercado');
      await buscador.fill(producto.nombre);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: producto.nombre, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await accionDeLaTarjeta(page, producto.nombre).click();
    };

    const abrirCheckout = async () => {
      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 15_000 });
      await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
      await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
      await page.getByPlaceholder('2000').fill('2700');
    };

    const cerrar = () => page.locator('button[aria-label="Cerrar"]:visible').first().click();

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });

    // 1. carrito A armado en pantalla, checkout, destino: sale su escritura y
    //    queda retenida.
    await agregarDesdeLaInterfaz(productoA);
    await abrirCheckout();
    await elegirDestino(page, 'Pergamino');
    await esperarA(() => cuerpos.length === 1, 'la elección del destino no disparó la escritura del carrito');
    await page.waitForTimeout(1000);
    assert(cuerpos.length === 1, `esperaba una sola escritura en vuelo, hubo ${cuerpos.length}`);
    assert(cuerpos[0].includes(productoA.id), 'la escritura retenida no lleva el carrito A');
    assert(respuestas === 0, 'la escritura retenida ya había contestado');

    // 2. con esa escritura en vuelo se cierra el checkout, se cambia el
    //    carrito visible de A a B y se vuelve a abrir.
    await cerrar();
    await descartarSiPregunta(page,
      async () => (await page.getByRole('heading', { name: /Datos de env/i }).count()) === 0,
      'cerrar el checkout con el destino elegido');

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('heading', { name: /Mi carrito/i }).waitFor({ timeout: 15_000 });
    // El botón del carrito dejó de identificarse por `title` —que no es un
    // nombre accesible confiable— y pasó a decir «Quitar» con su etiqueta.
    await page.getByRole('button', { name: /^Quitar / }).first().click();
    await page.getByText('Tu carrito está vacío').waitFor({ timeout: 15_000 });
    await cerrar();
    await agregarDesdeLaInterfaz(productoB);
    await abrirCheckout();

    // 3. destino de nuevo: sale la escritura de B, con tiempo de sobra para
    //    terminar ANTES de que se libere la vieja.
    await elegirDestino(page, 'Pergamino');
    await page.waitForTimeout(3000);
    liberarA();
    await esperarA(() => respuestas >= 2,
      `las dos escrituras no llegaron a contestar (${respuestas} de 2)`);
    await page.waitForTimeout(1000);

    // 4. servidor, listado y paso de pago tienen que representar sólo a B.
    const enServidor = carritoDelServidor();
    assert(enServidor.length === 1 && enServidor[0] === productoB.id,
      `la escritura del carrito abandonado quedó última: el servidor tiene `
      + `${JSON.stringify(enServidor)} y en pantalla está ${productoB.id}`);

    const seccion = page.locator('[class*="_fletes_"]');
    await seccion.getByText(/Envío de/).first().waitFor({ state: 'visible', timeout: 20_000 });
    const listado = ((await seccion.textContent()) || '').replace(/\s+/g, ' ');
    assert(listado.includes(`Envío de ${vendedorDeB}`),
      `el listado no habla del carrito vigente: "${listado.slice(0, 200)}"`);
    assert(!listado.includes(`Envío de ${vendedorDeA}`),
      `el listado sigue mostrando el carrito abandonado (${vendedorDeA})`);

    await resolverTrasladoPropio(page);
    await page.getByRole('button', { name: /Continuar al pago/i }).click();
    await page.getByRole('heading', { name: /Medio de pago/i }).waitFor({ timeout: 15_000 });
    const grupos = page.locator('fieldset[class*="_grupoDePago_"]');
    await grupos.first().waitFor({ state: 'visible', timeout: 20_000 });
    const pago = ((await grupos.first().textContent()) || '').replace(/\s+/g, ' ');
    assert(await grupos.count() === 1, `el pago armó ${await grupos.count()} grupos`);
    assert(pago.includes(vendedorDeB), `el pago no describe el carrito vigente: "${pago.slice(0, 200)}"`);
    assert(!pago.includes(vendedorDeA), `el pago describe el carrito abandonado (${vendedorDeA})`);

    return `carrito cambiado de A a B con la escritura de A retenida y liberada última: `
      + `el servidor, el listado y los datos bancarios hablan sólo de ${vendedorDeB} `
      + `(${cuerpos.length} escrituras, ${respuestas} respuestas)`;
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  }
});

await runCase(46, 'Vaciar el destino descarta la respuesta que venía en camino', async () => {
  // Cambiar de provincia vacía la localidad. Una respuesta del destino
  // anterior, liberada después, no puede volver a poner un listado.
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/items', {
    method: 'POST', token: state.buyerToken,
    body: { product_id: state.product.id, quantity: 1 },
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
      },
      { a: state.buyerToken, r: state.buyerRefreshToken },
    );
    const page = await context.newPage();

    let liberar = () => {};
    const retenida = new Promise((listo) => { liberar = listo; });
    let consultas = 0;
    await page.route('**/api/logistics/compatible-carriers*', async (ruta) => {
      consultas += 1;
      if (consultas === 1) await retenida;
      await ruta.continue();
    });

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Agregar|Agregar al carrito|Contratar/ }).first().click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor();

    await elegirDestino(page, 'Pergamino');
    await page.waitForTimeout(1000);
    assert(consultas === 1, `esperaba 1 consulta retenida, hubo ${consultas}`);

    // Cambiar de provincia vacía la localidad: el destino deja de existir.
    await page.locator('#checkout-provincia').selectOption('14');
    await page.waitForTimeout(600);
    assert(await page.locator('#checkout-localidad').inputValue() === '',
      'cambiar de provincia no vació la localidad');

    liberar();
    await page.waitForTimeout(2500);

    const seccion = page.locator('[class*="_fletes_"]');
    const cuantas = await seccion.count();
    const texto = cuantas ? ((await seccion.first().textContent()) || '').slice(0, 160) : '';
    assert(cuantas === 0, `sin destino reapareció un listado: "${texto}"`);

    return 'respuesta del destino anterior liberada tras vaciar la localidad: '
      + 'no reapareció ningún listado';
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  }
});

await runCase(47, 'Un login nuevo no hereda el "ya sincronizado" del anterior', async () => {
  // La cola de sincronización vive en el proveedor del carrito, que no se
  // desmonta al cerrar sesión. Si el resumen que decide "esto ya está
  // sincronizado" mira sólo producto y cantidad, la cuenta que entra después
  // con el mismo carrito no manda nada, y su carrito del servidor —vacío—
  // alimenta fletes, opciones de pago y la orden.
  const [[productoId, nombreDelProducto]] = queryRows(`
    SELECT p.id, p.name FROM products p
    WHERE p.status = 'ACTIVE' AND p.stock > 0 AND p.publication_type <> 'servicio'
    ORDER BY p.id LIMIT 1
  `);

  const segunda = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const tokenDeLaSegunda = segunda.data.access_token;
  const [[idDeLaSegunda]] = queryRows(
    "SELECT id FROM users WHERE email = 'cliente@ejemplo.com'");

  const carritoDe = (usuario) => queryRows(`
    SELECT ci.product_id FROM cart_items ci
    JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${sqlLiteral(usuario)} AND c.status = 'ACTIVE'
    ORDER BY ci.product_id
  `).map((fila) => fila[0]);

  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart', { method: 'DELETE', token: tokenDeLaSegunda });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
        window.localStorage.removeItem('agromarket_cart');
      },
      { a: state.buyerToken, r: state.buyerRefreshToken },
    );
    const page = await context.newPage();

    const escrituras = [];
    await page.route('**/api/cart/sync', async (ruta) => {
      escrituras.push(ruta.request().postData() || '');
      await ruta.continue();
    });

    const esperarA = async (condicion, mensaje, limite = 20_000) => {
      const hasta = Date.now() + limite;
      while (Date.now() < hasta) {
        if (condicion()) return;
        await page.waitForTimeout(100);
      }
      throw new Error(mensaje);
    };

    // Sin recargar nunca: recargar rearmaría cola y sesión por su cuenta.
    const asegurarCatalogo = async () => {
      if (await page.locator('#catalog-category').count() === 0) {
        await page.getByRole('button', { name: 'TopGreen', exact: true }).first().click();
      }
      await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    };

    const agregarDesdeLaInterfaz = async () => {
      await asegurarCatalogo();
      const buscador = page.getByLabel('Buscar en el mercado');
      await buscador.fill(nombreDelProducto);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: nombreDelProducto, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await accionDeLaTarjeta(page, nombreDelProducto).click();
    };

    const comprarHastaElDestino = async () => {
      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 15_000 });
      await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0202');
      await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
      await page.getByPlaceholder('2000').fill('2700');
      await elegirDestino(page, 'Pergamino');
    };

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });

    // La primera cuenta sincroniza su carrito.
    await agregarDesdeLaInterfaz();
    await comprarHastaElDestino();
    await page.locator('[class*="_fletes_"]').getByText(/Envío de/).first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    assert(escrituras.length === 1, `esperaba 1 escritura de la primera cuenta, hubo ${escrituras.length}`);
    const primera = carritoDe(state.buyerId);
    assert(primera.length === 1 && primera[0] === productoId,
      `la primera cuenta no dejó su carrito en el servidor: ${JSON.stringify(primera)}`);

    // Cerrar sesión y entrar con otra cuenta, sin recargar la página.
    await page.locator('button[aria-label="Cerrar"]:visible').first().click();
    await descartarSiPregunta(page,
      async () => (await page.getByRole('heading', { name: /Datos de env/i }).count()) === 0,
      'cerrar el checkout de la primera cuenta');
    await page.getByRole('button', { name: 'Salir' }).click();
    await page.getByRole('button', { name: 'Ingresar', exact: true }).waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('tu@email.com').fill('cliente@ejemplo.com');
    await page.getByPlaceholder('••••••••').fill('cliente123');
    await page.locator('[class*="_submitButton_"][type="submit"]').click();
    await page.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });

    // Mismo producto, misma cantidad: el resumen del carrito es idéntico.
    await agregarDesdeLaInterfaz();
    await comprarHastaElDestino();
    await esperarA(() => escrituras.length === 2,
      'la segunda cuenta no volvió a sincronizar: heredó el "ya está" de la anterior '
      + `y quedó en ${escrituras.length} escritura(s) en total`);
    await page.locator('[class*="_fletes_"]').getByText(/Envío de/).first()
      .waitFor({ state: 'visible', timeout: 20_000 });

    const segundaEnServidor = carritoDe(idDeLaSegunda);
    assert(segundaEnServidor.length === 1 && segundaEnServidor[0] === productoId,
      `el carrito de la segunda cuenta no quedó en el servidor: ${JSON.stringify(segundaEnServidor)}`);

    return `mismo carrito en dos sesiones: 2 escrituras, una por cuenta; `
      + 'el listado de la segunda sale de su propio carrito, no del heredado';
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    await apiRequest('/cart', { method: 'DELETE', token: tokenDeLaSegunda });
  }
});

await runCase(48, 'Un turno encolado no sale con las credenciales de la sesión nueva', async () => {
  // Una escritura encolada bajo una sesión puede arrancar cuando ya entró
  // otra: `apiFetch` firma con las credenciales del momento, así que saldría
  // autenticada como la cuenta nueva llevando la instantánea de la vieja. Y la
  // cuenta nueva no puede quedar esperando detrás de una escritura ajena.
  const publicaciones = queryRows(`
    SELECT p.id, p.name FROM products p
    WHERE p.status = 'ACTIVE' AND p.stock > 0 AND p.publication_type <> 'servicio'
    ORDER BY p.id LIMIT 3
  `);
  assert(publicaciones.length === 3, 'hacen falta tres publicaciones activas');
  const [primero, segundo, tercero] = publicaciones.map(([id, nombre]) => ({ id, nombre }));

  const segunda = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const tokenDeLaSegunda = segunda.data.access_token;
  const [[idDeLaSegunda]] = queryRows(
    "SELECT id FROM users WHERE email = 'cliente@ejemplo.com'");

  const carritoDe = (usuario) => queryRows(`
    SELECT ci.product_id FROM cart_items ci
    JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${sqlLiteral(usuario)} AND c.status = 'ACTIVE'
    ORDER BY ci.product_id
  `).map((fila) => fila[0]);

  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart', { method: 'DELETE', token: tokenDeLaSegunda });

  let liberarLaPrimera = () => {};
  const retenida = new Promise((listo) => { liberarLaPrimera = listo; });

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
        window.localStorage.removeItem('agromarket_cart');
      },
      { a: state.buyerToken, r: state.buyerRefreshToken },
    );
    const page = await context.newPage();
    const escrituras = [];
    await page.route('**/api/cart/sync', async (ruta) => {
      const numero = escrituras.length + 1;
      escrituras.push({
        cuerpo: ruta.request().postData() || '',
        autorizacion: ruta.request().headers().authorization || '',
      });
      if (numero === 1) {
        // La primera SALE ya, con la sesión que la originó todavía abierta, y
        // lo que se retiene es su respuesta. Retener el envío la convertiría en
        // otra cosa —una petición que todavía no viajó— y la prueba dejaría de
        // representar «en vuelo cuando se cerró la sesión».
        const respuesta = await ruta.fetch();
        await retenida;
        await ruta.fulfill({ response: respuesta });
        return;
      }
      await ruta.continue();
    });

    const esperarA = async (condicion, mensaje, limite = 20_000) => {
      const hasta = Date.now() + limite;
      while (Date.now() < hasta) {
        if (condicion()) return;
        await page.waitForTimeout(100);
      }
      throw new Error(mensaje);
    };

    // Sin recargar nunca: recargar rearmaría cola y sesión por su cuenta.
    const asegurarCatalogo = async () => {
      if (await page.locator('#catalog-category').count() === 0) {
        await page.getByRole('button', { name: 'TopGreen', exact: true }).first().click();
      }
      await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    };

    const agregarDesdeLaInterfaz = async (producto) => {
      await asegurarCatalogo();
      const buscador = page.getByLabel('Buscar en el mercado');
      await buscador.fill(producto.nombre);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: producto.nombre, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await accionDeLaTarjeta(page, producto.nombre).click();
    };

    const comprarHastaElDestino = async () => {
      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 15_000 });
      await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0303');
      await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
      await page.getByPlaceholder('2000').fill('2700');
      await elegirDestino(page, 'Pergamino');
    };

    // Cerrar el checkout con el destino ya elegido pregunta por los cambios sin
    // guardar: este caso los descarta a propósito, que es lo que hacía antes.
    const cerrarModal = async () => {
      await page.locator('button[aria-label="Cerrar"]:visible').first().click();
      await descartarSiPregunta(page,
        async () => (await page.getByRole('heading', { name: /Datos de env/i }).count()) === 0,
        'cerrar el checkout');
    };

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });

    // La primera cuenta: una escritura retenida y otra encolada detrás,
    // todavía sin arrancar.
    await agregarDesdeLaInterfaz(primero);
    await comprarHastaElDestino();
    await esperarA(() => escrituras.length === 1, 'no salió la primera escritura');
    await cerrarModal();
    await agregarDesdeLaInterfaz(segundo);
    await comprarHastaElDestino();
    await page.waitForTimeout(1500);
    assert(escrituras.length === 1,
      `la escritura encolada arrancó antes de tiempo: ${escrituras.length}`);
    await cerrarModal();

    // Cambio de cuenta con la primera escritura todavía en vuelo y la segunda
    // esperando turno.
    await page.getByRole('button', { name: 'Salir' }).click();
    await page.getByRole('button', { name: 'Ingresar', exact: true }).waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('tu@email.com').fill('cliente@ejemplo.com');
    await page.getByPlaceholder('••••••••').fill('cliente123');
    await page.locator('[class*="_submitButton_"][type="submit"]').click();
    await page.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });

    // La cuenta nueva arma su carrito. No puede quedar esperando detrás de la
    // escritura ajena, que sigue retenida.
    await agregarDesdeLaInterfaz(tercero);
    await comprarHastaElDestino();
    await esperarA(() => escrituras.length === 2,
      'la cuenta nueva quedó esperando detrás de la escritura de la sesión anterior');
    await page.locator('[class*="_fletes_"]').getByText(/Envío de/).first()
      .waitFor({ state: 'visible', timeout: 20_000 });

    // Recién ahora se libera la primera. Su compañera de cola, encolada por la
    // sesión anterior, no puede salir ahora que las credenciales son de otra.
    liberarLaPrimera();
    await page.waitForTimeout(3000);

    assert(escrituras.length === 2,
      `salió una escritura de más tras el cambio de cuenta: ${escrituras.length}`);
    const [conRetencion, deLaCuentaNueva] = escrituras;
    assert(conRetencion.autorizacion === `Bearer ${state.buyerToken}`,
      'la escritura retenida no viajó con las credenciales de su propia sesión');
    assert(deLaCuentaNueva.autorizacion !== conRetencion.autorizacion,
      'la escritura de la cuenta nueva viajó con las credenciales de la anterior');
    assert(deLaCuentaNueva.cuerpo.includes(tercero.id)
      && !deLaCuentaNueva.cuerpo.includes(segundo.id),
      `la escritura de la cuenta nueva lleva la instantánea de la anterior: ${deLaCuentaNueva.cuerpo}`);

    const anterior = carritoDe(state.buyerId);
    assert(anterior.length === 1 && anterior[0] === primero.id,
      `la sesión anterior no quedó con lo que alcanzó a mandar: ${JSON.stringify(anterior)}`);
    const nueva = carritoDe(idDeLaSegunda);
    assert(nueva.length === 1 && nueva[0] === tercero.id,
      `el carrito de la cuenta nueva no es el suyo: ${JSON.stringify(nueva)}`);

    return 'con una escritura retenida y otra encolada, el cambio de cuenta descarta la '
      + 'encolada, la nueva no espera detrás de la ajena y cada carrito queda con lo suyo';
  } finally {
    liberarLaPrimera();
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    await apiRequest('/cart', { method: 'DELETE', token: tokenDeLaSegunda });
  }
});

await runCase(49, 'La cookie no autentica una ruta protegida: sólo la cabecera', async () => {
  // Antes la cookie alcanzaba sola, y eso era CSRF: el navegador la manda en
  // cualquier petición hacia acá, la haya pedido nuestra página o la de un
  // tercero. Estaba demostrado, no supuesto. Ahora la credencial sale del
  // header y de ningún otro lado, así que no hay nada que un sitio ajeno pueda
  // hacer viajar solo.
  const otra = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const tokenA = state.buyerToken;
  const tokenB = otra.data.access_token;
  const [[idB]] = queryRows("SELECT id FROM users WHERE email = 'cliente@ejemplo.com'");

  const [productoX, productoY, productoZ] = queryRows(`
    SELECT p.id FROM products p
    WHERE p.status = 'ACTIVE'
      AND p.publication_type <> 'servicio'
      AND COALESCE(p.stock, 0) - COALESCE(p.stock_reservado, 0) > 0
    ORDER BY COALESCE(p.stock, 0) - COALESCE(p.stock_reservado, 0) DESC, p.id
    LIMIT 3
  `).map((fila) => fila[0]);

  const carritoDe = (usuario) => queryRows(`
    SELECT ci.product_id, ci.quantity FROM cart_items ci
    JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${sqlLiteral(usuario)} AND c.status = 'ACTIVE'
    ORDER BY ci.product_id
  `).map((fila) => fila.join('x')).join('|');

  await apiRequest('/cart/sync', {
    method: 'POST', token: tokenA, body: { items: [{ product_id: productoX, quantity: 1 }] },
  });
  await apiRequest('/cart/sync', {
    method: 'POST', token: tokenB, body: { items: [{ product_id: productoY, quantity: 1 }] },
  });
  const antesDeA = carritoDe(state.buyerId);
  const antesDeB = carritoDe(idB);
  assert(antesDeA && antesDeB && antesDeA !== antesDeB,
    'la preparación no dejó dos carritos distintos');

  const correoDe = (id) => queryRows(
    `SELECT email FROM users WHERE id = ${sqlLiteral(id)}`)[0][0];
  const correoDeA = correoDe(state.buyerId);
  const correoDeB = correoDe(idB);

  // 1. La cabecera sola sigue siendo la credencial.
  const soloHeader = await pedirCrudo('/auth/me', { header: tokenA });
  assert(soloHeader.status === 200 && soloHeader.datos.email === correoDeA,
    `sólo cabecera: HTTP ${soloHeader.status} para ${soloHeader.datos?.email}`);

  // 2. La cookie sola ya no autentica nada, ni para leer.
  const soloCookie = await pedirCrudo('/auth/me', { cookie: `access_token=${tokenA}` });
  assert(soloCookie.status === 401,
    `la cookie sola autenticó: HTTP ${soloCookie.status} para ${soloCookie.datos?.email}`);
  const motivo = String(soloCookie.datos?.detail ?? soloCookie.datos ?? '');
  assert(!motivo.includes(correoDeA) && !motivo.includes(tokenA.slice(0, 12)),
    `el rechazo devuelve cuenta o token: "${motivo}"`);

  // 3. Con las dos, manda la cabecera: es la que puso quien escribió la
  //    llamada. Ya no hay contradicción que resolver porque la cookie no es
  //    una credencial acá; que la de la otra cuenta esté puesta no cambia nada.
  const conCookieAjena = await pedirCrudo('/auth/me', {
    header: tokenA, cookie: `access_token=${tokenB}`,
  });
  assert(conCookieAjena.status === 200 && conCookieAjena.datos.email === correoDeA,
    `la cookie ajena movió la identidad: ${conCookieAjena.status} ${conCookieAjena.datos?.email}`);
  const alReves = await pedirCrudo('/auth/me', {
    header: tokenB, cookie: `access_token=${tokenA}`,
  });
  assert(alReves.status === 200 && alReves.datos.email === correoDeB,
    `al revés: ${alReves.status} ${alReves.datos?.email}`);

  // 4. Y escribiendo: la cookie sola no toca un carrito.
  const escritura = await pedirCrudo('/cart/sync', {
    method: 'POST',
    cookie: `access_token=${tokenA}`,
    body: { items: [{ product_id: productoZ, quantity: 7 }] },
  });
  assert(escritura.status === 401,
    `la cookie sola escribió: HTTP ${escritura.status}`);
  assert(carritoDe(state.buyerId) === antesDeA, 'se escribió sobre el primer carrito');
  assert(carritoDe(idB) === antesDeB, 'se escribió sobre el segundo carrito');

  // 5. La dependencia opcional SÍ sigue leyendo la cookie, y eso no es un
  //    olvido: es lo único que puede reconocer la vuelta de Mercado Pago, que
  //    es una navegación de nivel superior sin cabecera posible.
  const opcional = JSON.parse(correrEnLaApi(PROBAR_OPCIONAL, JSON.stringify({
    a: tokenA, b: tokenB,
  })));
  assert(opcional.solo_cookie === correoDeA,
    `la opcional dejó de reconocer la cookie y el callback de MP se queda sin identidad: ${opcional.solo_cookie}`);
  assert(opcional.conflicto === null && opcional.conflicto_invertido === null,
    `la opcional eligió identidad con dos credenciales: ${JSON.stringify(opcional)}`);

  return 'la cabecera sola autentica; la cookie sola da 401 para leer y para escribir, '
    + 'sin nombrar cuenta ni token y sin tocar ningún carrito; con las dos manda la '
    + 'cabecera; y la dependencia opcional conserva la cookie para la vuelta de Mercado Pago';
});

await runCase(50, 'Renovar es una mutación: sólo con la cabecera', async () => {
  // El refresco EMITE credenciales nuevas. No pasa por la dependencia de
  // acceso —lee su propio token—, así que cerrar sólo la dependencia lo habría
  // dejado abierto justo a él.
  const otra = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const refrescoA = state.buyerRefreshToken;
  const refrescoB = otra.data.refresh_token;
  const correoDeA = queryRows(
    `SELECT email FROM users WHERE id = ${sqlLiteral(state.buyerId)}`)[0][0];
  const emite = (respuesta) => Boolean(respuesta.datos?.access_token);

  // 1. Con la cabecera renueva y emite sus dos cookies. Salen `SameSite=None`,
  //    que acá no es una concesión: la página y la API viven en sitios distintos
  //    —en Railway, dos servicios bajo un sufijo público—, y entre sitios el
  //    navegador DESCARTA un `Set-Cookie` marcado `Lax`. Con `Lax` la cookie no
  //    llegaría a existir. Lo que protege no es el atributo: es que ninguna ruta
  //    que mute acepta la cookie, y esta misma prueba lo exige más abajo.
  const soloHeader = await pedirCrudo('/auth/refresh', { method: 'POST', header: refrescoA });
  assert(soloHeader.status === 200 && emite(soloHeader)
    && soloHeader.datos.user.email === correoDeA,
    `sólo cabecera: HTTP ${soloHeader.status}`);
  assert(soloHeader.galletas.length === 2,
    `renovar con cabecera emitió ${soloHeader.galletas.length} cookies en vez de 2`);

  // 2. La cookie sola no renueva, y no emite nada.
  const soloCookie = await pedirCrudo('/auth/refresh', {
    method: 'POST', cookie: `refresh_token=${refrescoA}`,
  });
  assert(soloCookie.status === 401,
    `la cookie sola renovó: HTTP ${soloCookie.status}`);
  assert(!emite(soloCookie), 'el rechazo igual emitió tokens');
  assert(soloCookie.galletas.length === 0,
    `el rechazo movió ${soloCookie.galletas.length} cookies`);
  const motivo = String(soloCookie.datos?.detail ?? soloCookie.datos ?? '');
  assert(!motivo.includes(correoDeA), `el rechazo nombra una cuenta: "${motivo}"`);

  // 3. Con las dos, manda la cabecera. La cookie ajena no arrastra la sesión.
  const conCookieAjena = await pedirCrudo('/auth/refresh', {
    method: 'POST', header: refrescoA, cookie: `refresh_token=${refrescoB}`,
  });
  assert(conCookieAjena.status === 200 && conCookieAjena.datos.user.email === correoDeA,
    `la cookie ajena movió a quién se le renueva: ${conCookieAjena.datos?.user?.email}`);

  return 'renovar con cabecera emite sus dos cookies; la cookie sola da 401 sin emitir '
    + 'tokens ni mover cookies; con las dos manda la cabecera';
});

// --- escenario de logística compartido por los casos de la Pieza C ----------
// Dos vendedores con orígenes distintos, un destino del padrón y dos
// transportistas: uno que cubre las dos puntas de los dos grupos y otro que
// sólo llega a uno. Con eso alcanza para probar elección, incompatibilidad e
// inyección sin inventar cantidades del seed.
async function prepararEscenarioDeFletes() {
  const marca = Date.now();
  const password = 'smoke123';
  const localidad = (nombre, provincia) => {
    const [fila] = queryRows(`
      SELECT id FROM localities
      WHERE name = ${sqlLiteral(nombre)} AND province_name = ${sqlLiteral(provincia)}
      LIMIT 1
    `);
    assert(fila, `el padrón no tiene ${nombre}, ${provincia}`);
    return fila[0];
  };
  const destino = localidad('Pergamino', 'Buenos Aires');
  const origenA = localidad('Rosario', 'Santa Fe');
  const origenB = localidad('Córdoba', 'Córdoba');
  const km = (a, b) => Number(queryRows(`
    SELECT ROUND((ST_Distance(x.coordinates, y.coordinates)/1000)::numeric, 1)
    FROM localities x, localities y
    WHERE x.id = ${sqlLiteral(a)} AND y.id = ${sqlLiteral(b)}
  `)[0][0]);
  const aRosario = km(destino, origenA);
  const aCordoba = km(destino, origenB);
  assert(aCordoba > aRosario, 'las distancias del padrón no son las esperadas');

  const publicaciones = queryRows(`
    SELECT p.id, p.seller_id, p.name, p.stock FROM products p
    WHERE p.status = 'ACTIVE' AND p.stock > 0 AND p.publication_type <> 'servicio'
    ORDER BY p.seller_id, p.id
  `);
  const primeraDeCada = new Map();
  for (const [id, vendedor, nombre, stock] of publicaciones) {
    if (!primeraDeCada.has(vendedor)) {
      primeraDeCada.set(vendedor, { id, vendedor, nombre, stock: Number(stock) });
    }
  }
  const [pedidoA, pedidoB] = [...primeraDeCada.values()].slice(0, 2);
  assert(pedidoB, 'hacen falta dos vendedores con publicaciones activas');

  const origenPrevio = {
    [pedidoA.id]: queryRows(
      `SELECT COALESCE(locality_id, '') FROM products WHERE id = ${sqlLiteral(pedidoA.id)}`)[0][0],
    [pedidoB.id]: queryRows(
      `SELECT COALESCE(locality_id, '') FROM products WHERE id = ${sqlLiteral(pedidoB.id)}`)[0][0],
  };
  querySql(`UPDATE products SET locality_id = ${sqlLiteral(origenA)} WHERE id = ${sqlLiteral(pedidoA.id)}`);
  querySql(`UPDATE products SET locality_id = ${sqlLiteral(origenB)} WHERE id = ${sqlLiteral(pedidoB.id)}`);

  const transportistas = {};
  for (const [etiqueta, radio] of [
    ['amplio', Math.ceil(aCordoba) + 20],
    ['corto', Math.ceil(aRosario) + 5],
  ]) {
    const correo = `piezac.${etiqueta}.${marca}@example.com`;
    await registrarYVerificar({
      email: correo,
      password,
      full_name: `Flete ${etiqueta} ${marca}`,
      phone: `+54 9 11 4000-${etiqueta === 'amplio' ? '0001' : '0002'}`,
      whatsapp: `+54 9 11 4000-${etiqueta === 'amplio' ? '0001' : '0002'}`,
      is_carrier: true,
      carrier_base_locality_id: destino,
      carrier_transport: `Camión ${etiqueta}`,
      carrier_transport_certified: true,
      carrier_certification_detail: `RUTA, cargas generales, N.° ${etiqueta.toUpperCase()}-${marca}`,
      carrier_coverage_radius_km: radio,
      carrier_capacity: '30 toneladas',
    });
    const sesion = await apiRequest('/auth/login', {
      method: 'POST', body: { email: correo, password },
    });
    transportistas[etiqueta] = {
      email: correo,
      password,
      token: sesion.data.access_token,
      refresco: sesion.data.refresh_token,
      id: queryRows(`SELECT id FROM users WHERE email = ${sqlLiteral(correo)}`)[0][0],
      nombre: `Flete ${etiqueta} ${marca}`,
    };
  }

  const restaurar = () => {
    for (const [producto, previo] of Object.entries(origenPrevio)) {
      querySql(`UPDATE products SET locality_id = ${previo ? sqlLiteral(previo) : 'NULL'} `
        + `WHERE id = ${sqlLiteral(producto)}`);
    }
  };

  return { destino, origenA, origenB, pedidoA, pedidoB, transportistas, restaurar, marca };
}

function nombreDeUsuario(id) {
  return queryRows(`SELECT full_name FROM users WHERE id = ${sqlLiteral(id)}`)[0][0];
}

// Alembic donde vive la aplicación, igual que el seed y las consultas. Sus
// avisos salen por stderr, así que se juntan las dos salidas: si sólo se
// mirara stdout, una migración correcta parecería no haber corrido.
function correrAlembic(comando, variables = []) {
  // Las variables viajan con `-e`, que es como docker exec las mete adentro
  // del contenedor, y además en el entorno del proceso para que funcione
  // igual cuando la API corre nativa.
  const corrida = spawnSync(
    'docker',
    [
      'exec',
      ...variables.flatMap((asignacion) => ['-e', asignacion]),
      '-i', 'topgreen-api', 'alembic', ...comando.split(' '),
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        ...Object.fromEntries(variables.map((a) => a.split('=', 2))),
      },
    },
  );
  return `${corrida.stdout ?? ''}${corrida.stderr ?? ''}`;
}

function ordenesDe(usuario) {
  return queryRows(`
    SELECT o.id, o.seller_id, COALESCE(o.shipping_mode, '-'), COALESCE(o.carrier_id, '-')
    FROM orders o WHERE o.buyer_id = ${sqlLiteral(usuario)}
    ORDER BY o.created_at, o.id
  `);
}

function stockDe(producto) {
  return Number(queryRows(`SELECT stock FROM products WHERE id = ${sqlLiteral(producto)}`)[0][0]);
}

await runCase(51, 'Cada pedido resuelve su traslado y la decisión llega a la orden', async () => {
  // Dos vendedores en el mismo carrito: uno se resuelve eligiendo
  // transportista desde la interfaz y el otro por cuenta propia. La orden de
  // cada uno tiene que guardar exactamente eso.
  const escenario = await prepararEscenarioDeFletes();
  const { destino, pedidoA, pedidoB, transportistas } = escenario;
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  const ordenesAntes = ordenesDe(state.buyerId).length;
  const stockAntes = [stockDe(pedidoA.id), stockDe(pedidoB.id)];

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
        window.localStorage.removeItem('agromarket_cart');
      },
      { a: state.buyerToken, r: state.buyerRefreshToken },
    );
    const page = await context.newPage();
    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });

    for (const pedido of [pedidoA, pedidoB]) {
      const buscador = page.getByLabel('Buscar en el mercado');
      await buscador.fill(pedido.nombre);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: pedido.nombre, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await accionDeLaTarjeta(page, pedido.nombre).click();
    }

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0404');
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');
    await elegirDestino(page, 'Pergamino');

    const seccion = page.locator('[class*="_fletes_"]');
    await seccion.getByRole('radio', { name: /Coordino el traslado por mi cuenta/ })
      .first().waitFor({ state: 'visible', timeout: 20_000 });

    // Sin resolver, la interfaz no avanza.
    await page.locator('form:has(h2) button[type="submit"]').click();
    await page.waitForTimeout(800);
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ state: 'visible' });
    assert(ordenesDe(state.buyerId).length === ordenesAntes,
      'avanzó al pago sin resolver el traslado');

    // Pedido del vendedor A: transportista elegido desde la pantalla.
    const grupoA = seccion.locator('[class*="_fleteGrupo_"]')
      .filter({ hasText: `Envío de ${nombreDeUsuario(pedidoA.vendedor)}` });
    await grupoA.getByRole('radio', { name: /Necesito flete/ }).check();
    await grupoA.getByRole('button', { name: new RegExp(`Seleccionar a ${transportistas.amplio.nombre}`) })
      .click();
    await grupoA.getByText('Transportista elegido').waitFor({ state: 'visible', timeout: 20_000 });

    // Pedido del vendedor B: por cuenta propia.
    const grupoB = seccion.locator('[class*="_fleteGrupo_"]')
      .filter({ hasText: `Envío de ${nombreDeUsuario(pedidoB.vendedor)}` });
    await grupoB.getByRole('radio', { name: /Coordino el traslado por mi cuenta/ }).check();

    await page.locator('form:has(h2) button[type="submit"]').click();
    await elegirTransferencia(page);
    await page.getByRole('button', { name: /Confirmar y crear las órdenes/ }).click();
    await page.getByRole('heading', { name: /Tus órdenes/ })
      .waitFor({ timeout: 20_000 });

    const despues = ordenesDe(state.buyerId);
    assert(despues.length === ordenesAntes + 2,
      `esperaba 2 órdenes nuevas, hubo ${despues.length - ordenesAntes}`);
    const nuevas = despues.slice(ordenesAntes);
    const deA = nuevas.find(([, vendedor]) => vendedor === pedidoA.vendedor);
    const deB = nuevas.find(([, vendedor]) => vendedor === pedidoB.vendedor);
    assert(deA && deA[2] === 'carrier' && deA[3] === transportistas.amplio.id,
      `la orden con transportista no guardó la decisión: ${JSON.stringify(deA)}`);
    assert(deB && deB[2] === 'self' && deB[3] === '-',
      `la orden por cuenta propia no guardó la decisión: ${JSON.stringify(deB)}`);
    assert(stockDe(pedidoA.id) === stockAntes[0] && stockDe(pedidoB.id) === stockAntes[1],
      'el checkout por transferencia movió stock, y no le toca');

    return `2 pedidos, 2 decisiones distintas: ${transportistas.amplio.nombre} en uno y `
      + 'cuenta propia en el otro; sin resolver no avanza y el stock queda intacto';
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    escenario.restaurar();
  }
});

await runCase(52, 'El contacto aparece al elegir y desaparece cuando la elección deja de valer', async () => {
  // Antes de elegir no hay contacto, ni en el JSON ni en la pantalla. Al
  // elegir aparece, porque el servidor revalidó. Al quitar la selección, o al
  // cambiar el destino, vuelve a desaparecer.
  const escenario = await prepararEscenarioDeFletes();
  const { destino, pedidoA, transportistas } = escenario;
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/sync', {
    method: 'POST', token: state.buyerToken,
    body: { items: [{ product_id: pedidoA.id, quantity: 1 }] },
  });

  // 1. el listado, en JSON, no trae contacto de nadie
  const listado = (await apiRequest(
    `/logistics/compatible-carriers?destination_locality_id=${destino}`,
    { token: state.buyerToken },
  )).data;
  const crudo = JSON.stringify(listado).toLowerCase();
  for (const prohibido of ['email', 'phone', 'whatsapp', '@example.com', 'cbu', 'alias']) {
    assert(!crudo.includes(prohibido), `el listado expone «${prohibido}»`);
  }

  // 2. al elegir, y sólo entonces, el servidor devuelve el contacto
  const elegido = (await apiRequest('/logistics/select-carrier', {
    method: 'POST', token: state.buyerToken,
    body: {
      destination_locality_id: destino,
      seller_id: pedidoA.vendedor,
      carrier_id: transportistas.amplio.id,
    },
  })).data;
  assert(elegido.carrier.email === transportistas.amplio.email,
    'la selección no devolvió el correo del transportista');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
        window.localStorage.removeItem('agromarket_cart');
      },
      { a: state.buyerToken, r: state.buyerRefreshToken },
    );
    const page = await context.newPage();
    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    const buscador = page.getByLabel('Buscar en el mercado');
    await buscador.fill(pedidoA.nombre);
    await buscador.press('Enter');
    await page.getByRole('heading', { name: pedidoA.nombre, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await accionDeLaTarjeta(page, pedidoA.nombre).click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 15_000 });
    await elegirDestino(page, 'Pergamino');

    const seccion = page.locator('[class*="_fletes_"]');
    await seccion.getByRole('radio', { name: /Necesito flete/ }).first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    await seccion.getByRole('radio', { name: /Necesito flete/ }).first().check();
    await page.getByText('Base:').first().waitFor({ state: 'visible', timeout: 20_000 });

    const sinElegir = (await seccion.textContent()) || '';
    assert(!sinElegir.includes(transportistas.amplio.email),
      'el listado muestra el correo antes de elegir');
    assert(!sinElegir.includes('4000-0001'),
      'el listado muestra el teléfono antes de elegir');
    assert(sinElegir.includes('Los datos de contacto aparecen cuando lo seleccionás'),
      'no se avisa que el contacto aparece al seleccionar');

    // 3. elegir desde la pantalla: ahora sí, contacto
    await seccion.getByRole('button', {
      name: new RegExp(`Seleccionar a ${transportistas.amplio.nombre}`),
    }).click();
    await seccion.getByText('Transportista elegido').waitFor({ state: 'visible', timeout: 20_000 });
    const conElegido = (await seccion.textContent()) || '';
    assert(conElegido.includes(transportistas.amplio.email),
      'elegido y sin contacto a la vista');

    // 4. quitar la selección lo vuelve a ocultar
    await seccion.getByRole('button', { name: 'Quitar del pedido' }).click();
    await page.waitForTimeout(500);
    const trasQuitar = (await seccion.textContent()) || '';
    assert(!trasQuitar.includes(transportistas.amplio.email),
      'quitar la selección dejó el contacto a la vista');

    // 5. y cambiar el destino también: lo elegido para otro viaje no vale
    await seccion.getByRole('button', {
      name: new RegExp(`Seleccionar a ${transportistas.amplio.nombre}`),
    }).click();
    await seccion.getByText('Transportista elegido').waitFor({ state: 'visible', timeout: 20_000 });
    await elegirDestino(page, 'Rosario', '82');
    await page.waitForTimeout(2500);
    const trasCambiarDestino = (await seccion.textContent()) || '';
    assert(!trasCambiarDestino.includes(transportistas.amplio.email),
      'cambiar el destino conservó el contacto de la elección anterior');
    assert(!trasCambiarDestino.includes('Transportista elegido'),
      'cambiar el destino conservó la selección anterior');

    return 'sin contacto en JSON ni DOM antes de elegir; presente al elegir; '
      + 'oculto de nuevo al quitar la selección y al cambiar el destino';
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    escenario.restaurar();
  }
});

await runCase(53, 'Una decisión inválida no deja media compra hecha', async () => {
  // Todo lo que puede venir mal desde el cliente, junto: transportista que no
  // cubre el viaje, transportista de otro grupo, decisión faltante, decisión
  // de más, vendedor inventado y cuenta propia con transportista. Ninguna
  // puede crear una orden ni mover una unidad de stock.
  const escenario = await prepararEscenarioDeFletes();
  const { destino, pedidoA, pedidoB, transportistas } = escenario;
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/sync', {
    method: 'POST', token: state.buyerToken,
    body: {
      items: [
        { product_id: pedidoA.id, quantity: 1 },
        { product_id: pedidoB.id, quantity: 1 },
      ],
    },
  });

  const ordenesAntes = ordenesDe(state.buyerId).length;
  const stockAntes = [stockDe(pedidoA.id), stockDe(pedidoB.id)];
  const sobre = (decisiones) => ({
    shipping_address: 'Ruta 8 km 220',
    shipping_locality_id: destino,
    shipping_postal_code: '2700',
    shipping_decisions: decisiones,
  });
  const propioA = { seller_id: pedidoA.vendedor, mode: 'self' };
  const propioB = { seller_id: pedidoB.vendedor, mode: 'self' };

  const intentos = [
    ['falta una decisión', [propioA], /Falta decidir/i],
    ['una decisión de más', [propioA, propioB, { seller_id: state.buyerId, mode: 'self' }],
      /no está en el carrito/i],
    ['vendedor inventado', [propioA, { seller_id: 'no-existe', mode: 'self' }],
      /no está en el carrito/i],
    ['dos decisiones para el mismo vendedor', [propioA, propioA, propioB],
      /dos decisiones/i],
    ['transportista sin elegir', [{ seller_id: pedidoA.vendedor, mode: 'carrier' }, propioB],
      /Falta elegir el transportista/i],
    ['cuenta propia con transportista',
      [{ ...propioA, carrier_id: transportistas.amplio.id }, propioB],
      /no puede llevar transportista/i],
    ['transportista que no cubre el viaje',
      [propioA, { seller_id: pedidoB.vendedor, mode: 'carrier', carrier_id: transportistas.corto.id }],
      /ya no cubre este viaje/i],
    ['transportista inventado',
      [propioA, { seller_id: pedidoB.vendedor, mode: 'carrier', carrier_id: state.buyerId }],
      /ya no cubre este viaje/i],
  ];

  for (const [rutas, endpoint] of [['transferencia', '/orders/checkout/transfer'],
    ['Mercado Pago', '/orders/checkout']]) {
    for (const [etiqueta, decisiones, esperado] of intentos) {
      const motivo = await expectApiError(400, () => apiRequest(endpoint, {
        method: 'POST', token: state.buyerToken, body: sobre(decisiones),
      }));
      assert(esperado.test(motivo),
        `${rutas} / ${etiqueta}: motivo inesperado «${motivo}»`);
      assert(ordenesDe(state.buyerId).length === ordenesAntes,
        `${rutas} / ${etiqueta}: se creó una orden igual`);
      assert(stockDe(pedidoA.id) === stockAntes[0] && stockDe(pedidoB.id) === stockAntes[1],
        `${rutas} / ${etiqueta}: se movió stock`);
    }
  }

  // El transportista corto sí sirve para el grupo que sí cubre: la
  // incompatibilidad es del viaje, no del transportista.
  const bueno = await apiRequest('/orders/checkout/transfer', {
    method: 'POST', token: state.buyerToken,
    body: sobre([
      { seller_id: pedidoA.vendedor, mode: 'carrier', carrier_id: transportistas.corto.id },
      propioB,
    ]),
  });
  assert(bueno.status === 200, `la decisión válida falló: HTTP ${bueno.status}`);
  const creadas = ordenesDe(state.buyerId).slice(ordenesAntes);
  assert(creadas.length === 2, `esperaba 2 órdenes, hubo ${creadas.length}`);

  escenario.restaurar();
  return `${intentos.length} decisiones inválidas por cada checkout: 400 con motivo, `
    + '0 órdenes nuevas y stock intacto; la válida crea las 2 órdenes';
});

await runCase(54, 'Cada participante ve lo suyo y el transportista sólo su necesidad logística', async () => {
  // Las tres vistas sobre las mismas órdenes: comprador, vendedor y
  // transportista elegido. Y un transportista ajeno, que no tiene que poder
  // ni enumerar ni abrir la operación.
  const escenario = await prepararEscenarioDeFletes();
  const { destino, pedidoA, pedidoB, transportistas } = escenario;
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/sync', {
    method: 'POST', token: state.buyerToken,
    body: {
      items: [
        // La cantidad sale del stock real, no de un número fijo: el seed
        // publica de a una unidad en algunos casos.
        { product_id: pedidoA.id, quantity: Math.min(2, pedidoA.stock) },
        { product_id: pedidoB.id, quantity: 1 },
      ],
    },
  });
  const creadas = await apiRequest('/orders/checkout/transfer', {
    method: 'POST', token: state.buyerToken,
    body: {
      shipping_address: 'Ruta 8 km 220',
      shipping_locality_id: destino,
      shipping_postal_code: '2700',
      shipping_decisions: [
        { seller_id: pedidoA.vendedor, mode: 'carrier', carrier_id: transportistas.amplio.id },
        { seller_id: pedidoB.vendedor, mode: 'self' },
      ],
    },
  });
  assert(creadas.status === 200, `no se pudo crear el escenario: HTTP ${creadas.status}`);

  try {
    // --- comprador: ve su decisión y el contacto del transportista
    const compras = (await apiRequest('/orders/my?as_role=buyer', { token: state.buyerToken })).data;
    const conFlete = compras.find((o) => o.shipping?.mode === 'carrier');
    const porSuCuenta = compras.find((o) => o.shipping?.mode === 'self');
    assert(conFlete && conFlete.shipping.carrier_name === transportistas.amplio.nombre,
      'el comprador no ve el transportista que eligió');
    assert(conFlete.shipping.carrier_email === transportistas.amplio.email,
      'el comprador no ve el contacto del transportista');
    assert(porSuCuenta, 'el comprador no ve el pedido que coordina por su cuenta');
    assert(!porSuCuenta.shipping.carrier_name,
      'el pedido por cuenta propia inventó un transportista');

    // --- vendedor: lo mismo, desde su venta
    const vendedor = queryRows(
      `SELECT email FROM users WHERE id = ${sqlLiteral(pedidoA.vendedor)}`)[0][0];
    const { acceso: tokenVendedor } = emitirTokensDeSesion(vendedor);
    const ventas = (await apiRequest('/orders/my?as_role=seller', { token: tokenVendedor })).data;
    const venta = ventas.find((o) => o.shipping?.mode === 'carrier');
    assert(venta && venta.shipping.carrier_email === transportistas.amplio.email,
      'el vendedor no ve el transportista ni su contacto');

    // --- transportista elegido: sólo necesidad logística
    const operaciones = (await apiRequest('/logistics/my-operations',
      { token: transportistas.amplio.token })).data.operations;
    assert(operaciones.length >= 1, 'el transportista elegido no ve su operación');
    const crudo = JSON.stringify(operaciones).toLowerCase();
    for (const prohibido of ['price', 'amount', 'total', 'cbu', 'alias', 'receipt',
      'phone', 'whatsapp', '@example.com', 'buyer']) {
      assert(!crudo.includes(prohibido),
        `la vista del transportista expone «${prohibido}»`);
    }
    const [operacion] = operaciones;
    assert(operacion.items.every((item) => item.quantity > 0),
      'la operación no dice cuánto hay que mover');
    assert(operacion.destination && operacion.destination.name === 'Pergamino',
      'la operación no dice a dónde va');
    assert(operacion.origins.length > 0, 'la operación no dice de dónde sale');

    // --- transportista ajeno: la operación no existe para él
    await expectApiError(404, () => apiRequest(
      `/logistics/my-operations/${operacion.order_id}`,
      { token: transportistas.corto.token },
    ));
    const listaAjena = (await apiRequest('/logistics/my-operations',
      { token: transportistas.corto.token })).data.operations;
    assert(listaAjena.length === 0,
      `un transportista ajeno enumeró ${listaAjena.length} operaciones`);

    // --- y tampoco puede leer la orden por la puerta de las órdenes
    await expectApiError(403, () => apiRequest(`/orders/${operacion.order_id}`,
      { token: transportistas.amplio.token }));

    // --- en pantalla: el panel del transportista tampoco muestra plata
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      await context.addInitScript(
        ({ a, r }) => {
          window.localStorage.setItem('access_token', a);
          window.localStorage.setItem('refresh_token', r);
        },
        { a: transportistas.amplio.token, r: transportistas.amplio.refresco },
      );
      const page = await context.newPage();
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
      await page.getByRole('button', { name: /Mis Operaciones/ })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Mis Operaciones/ }).click();
      await page.getByRole('heading', { name: 'Mis Operaciones' })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByText(/Operación #/).first().waitFor({ state: 'visible', timeout: 15_000 });
      // Lo que se mide es el panel, no la pagina que quedo atras: la portada
      // muestra operaciones reales con su precio y su localidad, y leer `body`
      // mezclaba esa vitrina con lo que el transportista ve de su operacion.
      const panel = page.locator('[class*="overlay"]').first();
      const visto = ((await panel.textContent()) || '').replace(/\s+/g, ' ');
      assert(visto.includes('Pergamino'), 'el panel no muestra el destino');
      assert(!/\$\s?\d/.test(visto), `el panel del transportista muestra importes: "${visto.slice(0, 200)}"`);
      for (const prohibido of ['CBU', 'Alias', 'comprobante', '@example.com']) {
        assert(!visto.toLowerCase().includes(prohibido.toLowerCase()),
          `el panel del transportista muestra «${prohibido}»`);
      }
    } finally {
      await browser.close();
    }

    return 'comprador y vendedor ven la decisión y el contacto; el transportista elegido '
      + 've origen, destino y cantidades sin un solo dato financiero; el ajeno recibe 404 '
      + 'y lista vacía';
  } finally {
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    escenario.restaurar();
  }
});

await runCase(55, 'Una orden anterior a la logística sigue legible y la migración vuelve atrás', async () => {
  // Las órdenes que existían antes no tienen decisión, y eso NO es cuenta
  // propia: nadie declaró nada. Tienen que seguir leyéndose y decirlo así.
  const [antigua] = queryRows(`
    SELECT o.id, o.buyer_id FROM orders o
    WHERE o.shipping_mode IS NULL
    ORDER BY o.created_at LIMIT 1
  `);
  let idAntigua = antigua ? antigua[0] : null;
  if (!idAntigua) {
    // Si todas las órdenes de esta corrida ya tienen decisión, se fabrica el
    // estado histórico en la base, que es exactamente lo que dejó la
    // migración en las órdenes viejas.
    const [fila] = queryRows(`
      SELECT id FROM orders WHERE buyer_id = ${sqlLiteral(state.buyerId)}
      ORDER BY created_at DESC LIMIT 1
    `);
    assert(fila, 'no hay ninguna orden para volver histórica');
    idAntigua = fila[0];
    querySql(`UPDATE orders SET shipping_mode = NULL, carrier_id = NULL `
      + `WHERE id = ${sqlLiteral(idAntigua)}`);
  }

  const detalle = (await apiRequest(`/orders/${idAntigua}`, { token: state.buyerToken })).data;
  assert(detalle.order_number, 'una orden sin decisión dejó de leerse');
  assert(!detalle.shipping?.mode,
    `una orden sin decisión se reinterpretó como «${detalle.shipping?.mode}»`);
  assert(!detalle.shipping?.carrier_name,
    'una orden sin decisión inventó un transportista');

  const listado = (await apiRequest('/orders/my?as_role=buyer', { token: state.buyerToken })).data;
  const enListado = listado.find((o) => o.id === idAntigua);
  assert(enListado && !enListado.shipping?.mode,
    'en el listado, la orden sin decisión no se lee igual');

  // La migración va y vuelve, con datos adentro. El upgrade corre sí o sí:
  // dejar la base a mitad de camino rompería todo lo que venga después.
  const bajada = correrAlembic('downgrade -1');
  const subida = correrAlembic('upgrade head');
  assert(/Running downgrade/.test(bajada), `el downgrade no corrió: ${bajada.slice(-200)}`);
  assert(/Running upgrade/.test(subida), `el upgrade no corrió: ${subida.slice(-200)}`);
  const limpio = correrAlembic('check');
  assert(/No new upgrade operations detected/.test(limpio),
    `alembic check encontró diferencias: ${limpio.slice(-200)}`);

  const trasVolver = (await apiRequest(`/orders/${idAntigua}`, { token: state.buyerToken })).data;
  assert(trasVolver.order_number === detalle.order_number,
    'la orden dejó de leerse después de ir y volver la migración');

  return 'orden sin decisión legible en detalle y listado, sin reinterpretarse como cuenta '
    + 'propia; downgrade y upgrade con datos adentro y `alembic check` sin diferencias';
});

await runCase(56, 'Una selección tardía no revive una decisión ya descartada', async () => {
  // Con la confirmación de un transportista en vuelo, la persona cambia ese
  // pedido a "coordino por mi cuenta". La respuesta llega DESPUÉS. Si el
  // cliente sólo mirara el destino y el carrito —que no cambiaron—, volvería a
  // poner el transportista y a mostrar su contacto encima de una decisión que
  // ya se tomó. Los tiempos los decide la prueba, no la red.
  const escenario = await prepararEscenarioDeFletes();
  const { destino, pedidoA, transportistas } = escenario;
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  const ordenesAntes = ordenesDe(state.buyerId).length;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
        window.localStorage.removeItem('agromarket_cart');
      },
      { a: state.buyerToken, r: state.buyerRefreshToken },
    );
    const page = await context.newPage();

    let liberarSeleccion = () => {};
    const retenida = new Promise((listo) => { liberarSeleccion = listo; });
    let selecciones = 0;
    await page.route('**/api/logistics/select-carrier', async (ruta) => {
      selecciones += 1;
      if (selecciones === 1) await retenida;
      await ruta.continue();
    });
    const checkouts = [];
    await page.route('**/api/orders/checkout', async (ruta) => {
      checkouts.push(ruta.request().postData() || '');
      await ruta.continue();
    });

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    const buscador = page.getByLabel('Buscar en el mercado');
    await buscador.fill(pedidoA.nombre);
    await buscador.press('Enter');
    await page.getByRole('heading', { name: pedidoA.nombre, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await accionDeLaTarjeta(page, pedidoA.nombre).click();

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0505');
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');
    await elegirDestino(page, 'Pergamino');

    const seccion = page.locator('[class*="_fletes_"]');
    await seccion.getByRole('radio', { name: /Necesito flete/ }).first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    await seccion.getByRole('radio', { name: /Necesito flete/ }).first().check();
    await seccion.getByRole('button', {
      name: new RegExp(`Seleccionar a ${transportistas.amplio.nombre}`),
    }).click();

    // La confirmación está en vuelo y retenida.
    const hasta = Date.now() + 15_000;
    while (selecciones === 0 && Date.now() < hasta) await page.waitForTimeout(100);
    assert(selecciones === 1, 'no salió la confirmación de la selección');

    // Con ella retenida, la persona cambia de idea.
    await seccion.getByRole('radio', { name: /Coordino el traslado por mi cuenta/ })
      .first().check();
    await page.waitForTimeout(500);

    // Recién ahora llega la respuesta de la selección abandonada.
    liberarSeleccion();
    await page.waitForTimeout(3000);

    const visto = ((await seccion.textContent()) || '').replace(/\s+/g, ' ');
    assert(!visto.includes('Transportista elegido'),
      'la respuesta tardía reinstaló el transportista');
    assert(!visto.includes(transportistas.amplio.email),
      'la respuesta tardía volvió a mostrar el contacto');
    assert(await seccion.getByRole('radio', { name: /Coordino el traslado por mi cuenta/ })
      .first().isChecked(), 'la decisión por cuenta propia dejó de estar elegida');

    // Y lo que se manda al confirmar la compra es esa decisión, no la otra.
    await page.locator('form:has(h2) button[type="submit"]').click();
    await elegirTransferencia(page);
    await page.getByRole('button', { name: /Confirmar y crear las órdenes/ }).click();
    await page.getByRole('heading', { name: /Tus órdenes/ })
      .waitFor({ timeout: 20_000 });

    assert(checkouts.length === 1, `esperaba un checkout, hubo ${checkouts.length}`);
    const enviado = JSON.parse(checkouts[0]);
    assert(JSON.stringify(enviado.shipping_decisions) ===
      JSON.stringify([{ seller_id: pedidoA.vendedor, mode: 'self' }]),
      `el checkout mandó otra cosa: ${checkouts[0]}`);

    const nuevas = ordenesDe(state.buyerId).slice(ordenesAntes);
    assert(nuevas.length === 1 && nuevas[0][2] === 'self' && nuevas[0][3] === '-',
      `la orden no quedó por cuenta propia: ${JSON.stringify(nuevas)}`);

    return 'selección retenida, decisión cambiada a cuenta propia y liberada después: '
      + 'no reaparece transportista ni contacto, y la orden queda por cuenta propia';
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    escenario.restaurar();
  }
});

await runCase(57, 'El origen de una operación es el del momento de la compra', async () => {
  // El nombre y el precio del producto ya eran snapshot. El origen no lo era y
  // se leía de la publicación: bastaba con que el vendedor la editara después
  // de la compra para cambiarle el punto de retiro al transportista.
  const escenario = await prepararEscenarioDeFletes();
  const { destino, origenA, origenB, pedidoA, transportistas } = escenario;
  const nombreDeOrigen = (id) => {
    const [fila] = queryRows(
      `SELECT name, province_name FROM localities WHERE id = ${sqlLiteral(id)}`);
    return { nombre: fila[0], provincia: fila[1] };
  };
  const origenDeLaCompra = nombreDeOrigen(origenA);
  const origenPosterior = nombreDeOrigen(origenB);

  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/sync', {
    method: 'POST', token: state.buyerToken,
    body: { items: [{ product_id: pedidoA.id, quantity: 1 }] },
  });
  const creada = await apiRequest('/orders/checkout/transfer', {
    method: 'POST', token: state.buyerToken,
    body: {
      shipping_address: 'Ruta 8 km 220',
      shipping_locality_id: destino,
      shipping_postal_code: '2700',
      shipping_decisions: [
        { seller_id: pedidoA.vendedor, mode: 'carrier', carrier_id: transportistas.amplio.id },
      ],
    },
  });
  assert(creada.status === 200, `no se pudo crear la orden: HTTP ${creada.status}`);
  const [ordenId] = creada.data.orders.map((o) => o.order_id);

  const browser = await chromium.launch({ headless: true });
  try {
    // El vendedor cambia la localidad de su publicación DESPUÉS de la compra.
    querySql(`UPDATE products SET locality_id = ${sqlLiteral(origenB)} `
      + `WHERE id = ${sqlLiteral(pedidoA.id)}`);

    const operacion = (await apiRequest(`/logistics/my-operations/${ordenId}`,
      { token: transportistas.amplio.token })).data;
    const origenes = operacion.origins.map((o) => `${o.name}, ${o.province_name}`);
    assert(origenes.includes(`${origenDeLaCompra.nombre}, ${origenDeLaCompra.provincia}`),
      `la operación perdió el origen de la compra: ${JSON.stringify(origenes)}`);
    assert(!origenes.includes(`${origenPosterior.nombre}, ${origenPosterior.provincia}`),
      `la operación adoptó el origen nuevo de la publicación: ${JSON.stringify(origenes)}`);

    // Y lo mismo en la pantalla del transportista.
    const context = await browser.newContext();
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
      },
      { a: transportistas.amplio.token, r: transportistas.amplio.refresco },
    );
    const page = await context.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await page.getByRole('button', { name: /Mis Operaciones/ })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Mis Operaciones/ }).click();
    await page.getByText(/Operación #/).first().waitFor({ state: 'visible', timeout: 15_000 });
    // Lo que se mide es el panel, no la pagina que quedo atras: la portada
    // muestra operaciones reales con su precio y su localidad, y leer `body`
    // mezclaba esa vitrina con lo que el transportista ve de su operacion.
    const panel = page.locator('[class*="overlay"]').first();
    const visto = ((await panel.textContent()) || '').replace(/\s+/g, ' ');
    assert(visto.includes(origenDeLaCompra.nombre),
      `la pantalla no muestra el origen de la compra (${origenDeLaCompra.nombre})`);
    assert(!visto.includes(origenPosterior.nombre),
      `la pantalla muestra el origen nuevo de la publicación (${origenPosterior.nombre})`);

    return `la publicación se mudó de ${origenDeLaCompra.nombre} a ${origenPosterior.nombre} `
      + 'después de la compra y la operación sigue diciendo la primera, en API y en pantalla';
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    escenario.restaurar();
  }
});

await runCase(58, 'Un ítem sin origen guardado no inventa uno, ni antes ni después', async () => {
  // Los ítems anteriores a esta pieza no tienen origen congelado. Eso es
  // "origen no informado": no se rellena con la localidad de hoy, que es
  // justamente lo que el snapshot vino a evitar.
  const escenario = await prepararEscenarioDeFletes();
  const { destino, origenA, origenB, pedidoA, transportistas } = escenario;
  const nombreDe = (id) => queryRows(
    `SELECT name FROM localities WHERE id = ${sqlLiteral(id)}`)[0][0];

  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/sync', {
    method: 'POST', token: state.buyerToken,
    body: { items: [{ product_id: pedidoA.id, quantity: 1 }] },
  });
  const creada = await apiRequest('/orders/checkout/transfer', {
    method: 'POST', token: state.buyerToken,
    body: {
      shipping_address: 'Ruta 8 km 220',
      shipping_locality_id: destino,
      shipping_postal_code: '2700',
      shipping_decisions: [
        { seller_id: pedidoA.vendedor, mode: 'carrier', carrier_id: transportistas.amplio.id },
      ],
    },
  });
  const [ordenId] = creada.data.orders.map((o) => o.order_id);

  try {
    // Se vuelve histórico el ítem: sin snapshot, como quedaron los de antes.
    querySql(`UPDATE order_items SET origin_locality_id = NULL, `
      + `origin_locality_name = NULL, origin_province_name = NULL `
      + `WHERE order_id = ${sqlLiteral(ordenId)}`);
    // Y la publicación se muda, para que haya un origen "de hoy" disponible.
    querySql(`UPDATE products SET locality_id = ${sqlLiteral(origenB)} `
      + `WHERE id = ${sqlLiteral(pedidoA.id)}`);

    const operacion = (await apiRequest(`/logistics/my-operations/${ordenId}`,
      { token: transportistas.amplio.token })).data;
    assert(operacion.order_number, 'una operación sin origen guardado dejó de leerse');
    assert(operacion.items.length > 0, 'la operación perdió sus artículos');
    assert(operacion.origins.length === 0,
      `sin snapshot se inventó un origen: ${JSON.stringify(operacion.origins)}`);
    const crudo = JSON.stringify(operacion);
    for (const localidad of [origenA, origenB]) {
      assert(!crudo.includes(nombreDe(localidad)),
        `la operación se presenta como si saliera de ${nombreDe(localidad)}`);
    }

    const enLista = (await apiRequest('/logistics/my-operations',
      { token: transportistas.amplio.token })).data.operations
      .find((o) => o.order_id === ordenId);
    assert(enLista && enLista.origins.length === 0,
      'en el listado, la operación sin origen guardado no se lee igual');

    // La migración va y vuelve, con datos adentro. El upgrade corre sí o sí.
    const bajada = correrAlembic('downgrade -1');
    const subida = correrAlembic('upgrade head');
    assert(/Running downgrade/.test(bajada), `el downgrade no corrió: ${bajada.slice(-200)}`);
    assert(/Running upgrade/.test(subida), `el upgrade no corrió: ${subida.slice(-200)}`);
    const limpio = correrAlembic('check');
    assert(/No new upgrade operations detected/.test(limpio),
      `alembic check encontró diferencias: ${limpio.slice(-200)}`);

    const trasVolver = (await apiRequest(`/logistics/my-operations/${ordenId}`,
      { token: transportistas.amplio.token })).data;
    assert(trasVolver.order_number === operacion.order_number,
      'la operación dejó de leerse después de ir y volver la migración');
    assert(trasVolver.origins.length === 0,
      'después de la migración apareció un origen que nadie guardó');

    return 'ítem sin origen guardado: la operación se lee, no muestra origen y no adopta '
      + 'el de la publicación; downgrade, upgrade y `alembic check` limpios';
  } finally {
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    escenario.restaurar();
  }
});

// --- contrato monetario -----------------------------------------------------
// Publicar con un precio exacto y comprarlo por los dos caminos. El precio se
// manda como número JSON, que es lo que manda el frontend; lo que se exige es
// que de ahí en adelante nadie lo pase por aritmética binaria.
async function publicarConPrecio(precio, stock, etiqueta, token = state.sellerToken) {
  // Una categoría de PRODUCTOS: esto publica con stock y `publication_type`
  // «producto». Sin el filtro salía «Acopio», que es de servicios, y dejaba
  // una publicación que decía producto adentro de una categoría de servicio.
  const [categoria] = queryRows(
    'SELECT id FROM categories WHERE is_service = false ORDER BY name LIMIT 1');
  const creado = await apiRequest('/products', {
    method: 'POST',
    token,
    body: {
      name: `Smoke ${etiqueta} ${Date.now()}`,
      description: 'Publicación de prueba del contrato monetario.',
      category_id: categoria[0],
      price: precio,
      stock,
      unit: 'unidad',
      locality_id: state.location.localityId,
      publication_type: 'producto',
    },
  });
  return creado.data.id;
}

function montosDeLaOrden(ordenId) {
  const [fila] = queryRows(`
    SELECT o.subtotal, o.shipping_cost, o.total_amount,
           oi.unit_price_snapshot, oi.total_price
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = ${sqlLiteral(ordenId)}
  `);
  assert(fila, `la orden ${ordenId} no está en la base`);
  const [subtotal, envio, total, unitario, linea] = fila;
  return { subtotal, envio, total, unitario, linea };
}

// Un solo recorrido, parametrizado: mismo precio y misma cantidad por los dos
// caminos que crean órdenes. Devuelve lo que vio la API y lo que quedó en SQL.
async function comprarPorLosDosCaminos(productoId, cantidad, vendedorId) {
  const visto = {};

  for (const [camino, endpoint] of [
    ['transferencia', '/orders/checkout/transfer'],
    ['plural', '/orders/checkout'],
  ]) {
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    const carrito = await apiRequest('/cart/sync', {
      method: 'POST', token: state.buyerToken,
      body: { items: [{ product_id: productoId, quantity: cantidad }] },
    });
    const [linea] = carrito.data.items;

    const opciones = (await apiRequest('/orders/payment-options',
      { token: state.buyerToken })).data;
    const opcion = opciones.find((o) => o.seller_id === vendedorId);
    assert(opcion, 'payment-options no trajo al vendedor de la publicación');

    const respuesta = await apiRequest(endpoint, {
      method: 'POST', token: state.buyerToken,
      body: {
        shipping_address: 'Ruta 8 km 220',
        shipping_locality_id: localidadDeEnvio(),
        shipping_postal_code: '2700',
        shipping_decisions: [{ seller_id: vendedorId, mode: 'self' }],
        payment_decisions: [{ seller_id: vendedorId, method: 'transfer' }],
      },
    });

    // Los dos caminos devuelven la misma forma: una lista de órdenes.
    const [creada] = respuesta.data.orders;
    visto[camino] = {
      carritoLinea: linea.subtotal,
      carritoTotal: carrito.data.total_amount,
      opcion: opcion.amount,
      respuesta: creada.amount,
      subtotalApi: null,
      enBase: montosDeLaOrden(creada.order_id),
    };
  }

  return visto;
}

await runCase(59, 'Tres unidades de diez centavos son treinta centavos, no 0,30000000000000004', async () => {
  // El caso más chico posible y el que más duele: 0,1 no existe en binario.
  // Sumarlo tres veces da 0,30000000000000004 y eso es lo que veía el
  // comprador en el carrito, en la opción de pago y en la respuesta.
  const producto = await publicarConPrecio(0.10, 20, 'diez centavos');
  const [[vendedor]] = queryRows(
    `SELECT seller_id FROM products WHERE id = ${sqlLiteral(producto)}`);

  const visto = await comprarPorLosDosCaminos(producto, 3, vendedor);

  for (const [camino, datos] of Object.entries(visto)) {
    for (const [donde, valor] of [
      ['la línea del carrito', datos.carritoLinea],
      ['el total del carrito', datos.carritoTotal],
      ['la opción de pago', datos.opcion],
      ['la respuesta del checkout', datos.respuesta],
      ...(datos.subtotalApi === null ? [] : [['el subtotal de la respuesta', datos.subtotalApi]]),
    ]) {
      assert(valor === 0.3,
        `${camino}: ${donde} devolvió ${valor} en vez de 0.3`);
    }
    assert(datos.enBase.subtotal === '0.30' && datos.enBase.total === '0.30'
      && datos.enBase.linea === '0.30' && datos.enBase.unitario === '0.10',
      `${camino}: en la base quedó ${JSON.stringify(datos.enBase)}`);
    assert(datos.enBase.envio === '0.00',
      `${camino}: el envío quedó en ${datos.enBase.envio}`);
  }

  return '3 × $0,10 = $0,30 exacto en carrito, opción, respuesta y SQL, por los dos '
    + 'checkouts; en binario esa cuenta da 0.30000000000000004';
});

await runCase(60, 'El tope del contrato conserva los centavos por los dos caminos', async () => {
  // 99 × 9.999.999.999,97 = 989.999.999.997,03 exacto. En binario da
  // 989.999.999.997,0299: el error es de una diezmilésima, así que la columna
  // NUMERIC lo redondea y lo esconde. Donde se ve es en lo que devuelve la
  // API, que es lo que el comprador lee y lo que consume el frontend.
  const producto = await publicarConPrecio(9999999999.97, 99, 'tope con centavos');
  const [[vendedor]] = queryRows(
    `SELECT seller_id FROM products WHERE id = ${sqlLiteral(producto)}`);

  const visto = await comprarPorLosDosCaminos(producto, 99, vendedor);
  const EXACTO = 989999999997.03;

  for (const [camino, datos] of Object.entries(visto)) {
    for (const [donde, valor] of [
      ['la línea del carrito', datos.carritoLinea],
      ['el total del carrito', datos.carritoTotal],
      ['la opción de pago', datos.opcion],
      ['la respuesta del checkout', datos.respuesta],
      ...(datos.subtotalApi === null ? [] : [['el subtotal de la respuesta', datos.subtotalApi]]),
    ]) {
      assert(valor === EXACTO,
        `${camino}: ${donde} devolvió ${valor} en vez de ${EXACTO}`);
    }
    assert(datos.enBase.unitario === '9999999999.97',
      `${camino}: el snapshot unitario quedó en ${datos.enBase.unitario}`);
    assert(datos.enBase.linea === '989999999997.03',
      `${camino}: el importe del ítem quedó en ${datos.enBase.linea}`);
    assert(datos.enBase.subtotal === '989999999997.03'
      && datos.enBase.total === '989999999997.03',
      `${camino}: en la base quedó ${JSON.stringify(datos.enBase)}`);
  }

  return '99 × $9.999.999.999,97 = $989.999.999.997,03 exacto en carrito, opción, '
    + 'respuesta, snapshot, subtotal y total, por los dos checkouts';
});

await runCase(61, 'Con varios vendedores, cada total es suyo y uno fuera de contrato no escribe nada', async () => {
  // Dos vendedores en el mismo carrito. Los totales no se suman entre sí: el
  // límite es por orden. Y si el de uno se pasa, no se crea NINGUNA orden y el
  // carrito sigue vivo para que la persona pueda corregir.
  const barato = await publicarConPrecio(0.10, 20, 'multivendedor barato');
  const sesionAdmin = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'admin@topgreen.com', password: 'admin123' },
  });
  // Arranca con un precio chico para poder entrar al carrito; el acto 2 lo
  // sube al máximo publicable con el producto ya adentro.
  const caro = await publicarConPrecio(
    9999999.99, 200, 'multivendedor caro', sesionAdmin.data.access_token);
  const [[vendedorBarato]] = queryRows(
    `SELECT seller_id FROM products WHERE id = ${sqlLiteral(barato)}`);
  const [[vendedorCaro]] = queryRows(
    `SELECT seller_id FROM products WHERE id = ${sqlLiteral(caro)}`);
  assert(vendedorBarato !== vendedorCaro, 'las dos publicaciones son del mismo vendedor');

  const decisiones = [
    { seller_id: vendedorBarato, mode: 'self' },
    { seller_id: vendedorCaro, mode: 'self' },
  ];
  const envio = (extra) => ({
    shipping_address: 'Ruta 8 km 220',
    shipping_locality_id: localidadDeEnvio(),
    shipping_postal_code: '2700',
    shipping_decisions: decisiones,
    // El checkout plural exige una forma de pago por grupo; el de
    // transferencia la pone él y la ignora.
    payment_decisions: [
      { seller_id: vendedorBarato, method: 'transfer' },
      { seller_id: vendedorCaro, method: 'transfer' },
    ],
    ...extra,
  });

  // --- 1. totales independientes, sin sumarse entre sí
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/sync', {
    method: 'POST', token: state.buyerToken,
    body: {
      items: [
        { product_id: barato, quantity: 3 },
        { product_id: caro, quantity: 2 },
      ],
    },
  });
  const opciones = (await apiRequest('/orders/payment-options',
    { token: state.buyerToken })).data;
  const delBarato = opciones.find((o) => o.seller_id === vendedorBarato);
  const delCaro = opciones.find((o) => o.seller_id === vendedorCaro);
  assert(delBarato.amount === 0.3,
    `el total del vendedor barato es ${delBarato.amount}, no 0.3`);
  assert(delCaro.amount === 19999999.98,
    `el total del vendedor caro es ${delCaro.amount}, no 19999999.98`);

  const creadas = await apiRequest('/orders/checkout/transfer', {
    method: 'POST', token: state.buyerToken, body: envio(),
  });
  assert(creadas.data.orders.length === 2, 'no se crearon las dos órdenes');
  const porVendedor = Object.fromEntries(
    creadas.data.orders.map((o) => [o.seller_id, o.amount]));
  assert(porVendedor[vendedorBarato] === 0.3 && porVendedor[vendedorCaro] === 19999999.98,
    `los totales se mezclaron: ${JSON.stringify(porVendedor)}`);

  // --- 2. uno fuera de contrato: ninguna orden y el carrito intacto
  //
  // El carrito no deja armar un total imposible: lo rechaza al agregar, al
  // cambiar cantidad y al sincronizar. Así que el carrito se arma dentro del
  // contrato y se pasa después, por donde puede pasar de verdad: el vendedor
  // sube el precio con el producto ya en el carrito.
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/sync', {
    method: 'POST', token: state.buyerToken,
    body: {
      items: [
        { product_id: barato, quantity: 3 },
        { product_id: caro, quantity: 150 },
      ],
    },
  });
  // 9.999.999.999,99 × 150 = 1.499.999.999.998,50: por encima del máximo.
  await apiRequest(`/products/${caro}`, {
    method: 'PATCH', token: sesionAdmin.data.access_token,
    body: { price: 9999999999.99 },
  });
  const ordenesAntes = queryCount('SELECT COUNT(*) FROM orders');
  const itemsAntes = queryCount('SELECT COUNT(*) FROM order_items');

  for (const endpoint of ['/orders/checkout/transfer', '/orders/checkout']) {
    const motivo = await expectApiError(400, () => apiRequest(endpoint, {
      method: 'POST', token: state.buyerToken, body: envio(),
    }));
    assert(/supera el máximo admitido/i.test(motivo),
      `${endpoint}: motivo inesperado «${motivo}»`);
    assert(queryCount('SELECT COUNT(*) FROM orders') === ordenesAntes
      && queryCount('SELECT COUNT(*) FROM order_items') === itemsAntes,
      `${endpoint}: se escribió algo pese al rechazo`);
    const [[estado]] = queryRows(`
      SELECT c.status FROM carts c
      WHERE c.user_id = ${sqlLiteral(state.buyerId)} AND c.status = 'ACTIVE'
    `);
    assert(estado === 'ACTIVE', `${endpoint}: el carrito quedó en ${estado}`);
  }

  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  return 'dos vendedores con totales independientes ($0,30 y $19.999.999,98); '
    + 'con uno fuera de contrato, 0 órdenes nuevas por los dos checkouts y el carrito '
    + 'sigue activo';
});

// --- vínculo OAuth con Mercado Pago ------------------------------------------
// Todo este bloque corre contra el doble local (scripts/lib/mp-doble.mjs). No
// hay credenciales reales en el proyecto y no las va a haber: la prueba con
// una cuenta de verdad la hace quien tenga acceso legítimo a esa cuenta.
const MP_PUERTO_DEL_DOBLE = 8099;

// La aplicación puede escribir sus propias líneas antes del resultado, así que
// el guion lo marca y acá se busca la marca, no la última línea.
function leerResultado(salida) {
  const linea = salida.split(/\r?\n/).find((texto) => texto.startsWith('RESULTADO '));
  assert(linea, `el guion no devolvió resultado: ${salida.slice(-300)}`);
  return JSON.parse(linea.slice('RESULTADO '.length));
}

function huellaDe(state) {
  return createHash('sha256').update(state).digest('hex');
}

// `querySql` recorta la salida entera, así que una columna NULA al principio o
// al final de la fila se pierde y corre a las demás. Cada columna viaja con un
// centinela para que ninguna quede vacía en el borde.
const NULO = 'NULO';

function vinculoEnLaBase(email) {
  const [fila] = queryRows(`
    SELECT coalesce(mp_user_id, '${NULO}'),
           coalesce(mp_access_token_cifrado, '${NULO}'),
           coalesce(mp_refresh_token_cifrado, '${NULO}'),
           coalesce(mp_requiere_reconexion::text, '${NULO}'),
           coalesce(mp_token_expires_at::text, '${NULO}')
    FROM users WHERE email = ${sqlLiteral(email)}
  `);
  assert(fila, `no existe el usuario ${email}`);
  assert(fila.length === 5, `la fila de ${email} vino con ${fila.length} columnas`);
  const [cuenta, acceso, refresco, reconexion, vence] = fila.map(
    (valor) => (valor === NULO ? null : valor),
  );
  return { cuenta, acceso, refresco, reconexion: reconexion === 't', vence };
}

async function ingresarVendedor(email, password) {
  const { data } = await apiRequest('/auth/login', {
    method: 'POST', body: { email, password },
  });
  return { token: data.access_token, id: data.user.id };
}

// El pedido de vinculación devuelve la URL a la que iría el navegador.
async function pedirUrlDeVinculo(token) {
  const { datos, status } = await pedirCrudo('/mp-oauth/auth-url', {
    method: 'POST', header: token, body: {},
  });
  assert(status === 200, `auth-url respondió ${status}: ${JSON.stringify(datos)}`);
  return datos.auth_url;
}

// La pantalla de autorización del doble contesta como contestaría Mercado
// Pago: un 302 al callback con `code` y `state`.
async function autorizarEnElDoble(authUrl, guion) {
  const url = new URL(authUrl);
  url.searchParams.set('guion', guion);
  const respuesta = await fetch(url, { redirect: 'manual' });
  const destino = respuesta.headers.get('location');
  assert(destino, 'el doble no devolvió el callback');
  return destino;
}

async function volverDelCallback(callbackUrl, cookieToken) {
  const respuesta = await fetch(callbackUrl, {
    headers: cookieToken ? { Cookie: `access_token=${cookieToken}` } : {},
    redirect: 'manual',
  });
  const destino = respuesta.headers.get('location') || '';
  const parametros = new URL(destino, FRONTEND_URL).searchParams;
  return {
    status: respuesta.status,
    destino,
    ok: parametros.get('mp'),
    motivo: parametros.get('mp_error'),
    cuerpo: await respuesta.text(),
  };
}

// Un vínculo completo, del principio al fin, como lo haría el navegador.
async function vincular(token, guion) {
  const authUrl = await pedirUrlDeVinculo(token);
  const callback = await autorizarEnElDoble(authUrl, guion);
  return { ...(await volverDelCallback(callback, token)), authUrl, callback };
}

async function estadoDelVinculo(token) {
  const { datos } = await pedirCrudo('/mp-oauth/status', { header: token });
  return datos;
}

async function desvincular(token) {
  await pedirCrudo('/mp-oauth/unlink', { method: 'POST', header: token, body: {} });
}

const SECRETOS_DEL_DOBLE = [SECRETO_DE_ACCESO, SECRETO_DE_REFRESCO, DETALLE_CRUDO,
  'secreto-local-inventado'];

function sinSecretos(texto, donde) {
  for (const secreto of SECRETOS_DEL_DOBLE) {
    assert(!String(texto).includes(secreto),
      `${donde} contiene un secreto («${secreto.slice(0, 22)}…»)`);
  }
}

await runCase(62, 'El vínculo se guarda cifrado y el state no queda escrito en claro', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await desvincular(vendedor.token);

    const inicial = await estadoDelVinculo(vendedor.token);
    assert(inicial.estado === 'desconectado',
      `el vendedor no arranca desconectado: ${JSON.stringify(inicial)}`);

    const authUrl = await pedirUrlDeVinculo(vendedor.token);
    const url = new URL(authUrl);
    const state = url.searchParams.get('state');
    assert(url.searchParams.get('client_id') === 'app-local-de-prueba',
      'la URL de autorización no lleva el client_id de la aplicación');
    assert(state && state.length >= 32, `el state es corto o falta: ${state}`);

    // Lo que hay en la base es la huella, no el valor. El state viaja en una
    // URL: termina en el historial y en los logs del proxy, así que lo
    // guardado no puede servir para fabricar un callback.
    assert(queryCount(`SELECT COUNT(*) FROM mp_oauth_states
      WHERE state_hash = ${sqlLiteral(huellaDe(state))}`) === 1,
      'el state no quedó registrado por su huella');
    assert(queryCount(`SELECT COUNT(*) FROM mp_oauth_states
      WHERE state_hash = ${sqlLiteral(state)}`) === 0,
      'el state quedó guardado en claro');

    const callback = await autorizarEnElDoble(authUrl, 'ok:900001');
    const vuelta = await volverDelCallback(callback, vendedor.token);
    assert(vuelta.status === 302 && vuelta.ok === 'vinculado',
      `el callback no vinculó: ${vuelta.status} → ${vuelta.destino}`);

    const conectado = await estadoDelVinculo(vendedor.token);
    assert(conectado.estado === 'conectado' && conectado.mp_user_id === '900001',
      `estado inesperado: ${JSON.stringify(conectado)}`);
    sinSecretos(JSON.stringify(conectado), 'la respuesta de /status');
    assert(!('access_token' in conectado) && !('mp_access_token' in conectado),
      'la respuesta de /status trae un campo de token');

    const guardado = vinculoEnLaBase('vendedor@ejemplo.com');
    assert(guardado.acceso?.startsWith('gAAAA') && guardado.refresco?.startsWith('gAAAA'),
      'lo guardado no tiene forma de texto cifrado');
    sinSecretos(`${guardado.acceso}${guardado.refresco}`, 'la base');
    assert(guardado.cuenta === '900001', `la cuenta guardada es ${guardado.cuenta}`);

    // Las columnas en claro que traía el proyecto ya no existen.
    const heredadas = queryCount(`SELECT COUNT(*) FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('mp_access_token', 'mp_refresh_token')`);
    assert(heredadas === 0, `siguen existiendo ${heredadas} columna(s) en claro`);

    const usado = queryCount(`SELECT COUNT(*) FROM mp_oauth_states
      WHERE state_hash = ${sqlLiteral(huellaDe(state))} AND usado_el IS NOT NULL`);
    assert(usado === 1, 'el state no quedó sellado como usado');

    return 'vínculo completo: la base guarda Fernet y la huella del state, la '
      + 'respuesta no trae credenciales y las dos columnas en claro se fueron';
  } finally {
    // El doble se cierra primero y pase lo que pase: si la limpieza de
    // datos fallara, el puerto quedaría tomado y el caso siguiente
    // moriría con EADDRINUSE por un problema que no es suyo.
    await doble.cerrar();
    try { await desvincular(vendedor.token); } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(63, 'Callback repetido, alterado, sin sesión o de otra sesión no vincula nada', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const otro = await ingresarVendedor('otro.vendedor.smoke@example.com', 'smoke123');
  try {
    await desvincular(vendedor.token);
    await desvincular(otro.token);

    // --- 1. repetido: el segundo callback no encuentra state que gastar
    const primero = await vincular(vendedor.token, 'ok:900001');
    assert(primero.ok === 'vinculado', `el primer vínculo falló: ${primero.destino}`);
    const repetido = await volverDelCallback(primero.callback, vendedor.token);
    assert(repetido.motivo === 'estado_invalido',
      `el callback repetido devolvió «${repetido.motivo}»`);

    await desvincular(vendedor.token);

    // --- 2. alterado: un carácter distinto en el state
    const authUrl = await pedirUrlDeVinculo(vendedor.token);
    const legitimo = await autorizarEnElDoble(authUrl, 'ok:900001');
    const alterado = new URL(legitimo);
    const original = alterado.searchParams.get('state');
    alterado.searchParams.set('state', `${original.slice(0, -1)}${original.endsWith('a') ? 'b' : 'a'}`);
    const tocado = await volverDelCallback(alterado.toString(), vendedor.token);
    assert(tocado.motivo === 'estado_invalido',
      `el state alterado devolvió «${tocado.motivo}»`);

    // --- 3. sin sesión: el state sigue siendo válido, pero nadie lo reclama
    const anonimo = await volverDelCallback(legitimo, null);
    assert(anonimo.motivo === 'sin_sesion',
      `el callback sin sesión devolvió «${anonimo.motivo}»`);

    // --- 4. otra sesión: el state era del vendedor, la cookie es del otro
    const deOtro = await pedirUrlDeVinculo(vendedor.token);
    const callbackAjeno = await autorizarEnElDoble(deOtro, 'ok:900001');
    const ajeno = await volverDelCallback(callbackAjeno, otro.token);
    assert(ajeno.motivo === 'sesion_distinta',
      `el callback de otra sesión devolvió «${ajeno.motivo}»`);

    // Después de los cuatro rechazos no quedó nadie vinculado.
    for (const [quien, email] of [
      ['el vendedor', 'vendedor@ejemplo.com'],
      ['el otro vendedor', 'otro.vendedor.smoke@example.com'],
    ]) {
      const fila = vinculoEnLaBase(email);
      assert(!fila.cuenta && !fila.acceso && !fila.refresco,
        `${quien} quedó con algo escrito: ${JSON.stringify(fila)}`);
    }

    return 'los cuatro callbacks torcidos —repetido, alterado, sin sesión y de otra '
      + 'sesión— devuelven su motivo y no dejan una sola credencial escrita';
  } finally {
    // El doble se cierra primero y pase lo que pase: si la limpieza de
    // datos fallara, el puerto quedaría tomado y el caso siguiente
    // moriría con EADDRINUSE por un problema que no es suyo.
    await doble.cerrar();
    try { await desvincular(vendedor.token); } catch { /* la limpieza no tapa el motivo real */ }
    try { await desvincular(otro.token); } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(64, 'Una cuenta de Mercado Pago no puede cobrar para dos vendedores', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const primero = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const segundo = await ingresarVendedor('otro.vendedor.smoke@example.com', 'smoke123');
  try {
    await desvincular(primero.token);
    await desvincular(segundo.token);

    const uno = await vincular(primero.token, 'ok:900001');
    assert(uno.ok === 'vinculado', `el primero no pudo vincular: ${uno.destino}`);

    // El segundo autoriza LA MISMA cuenta de Mercado Pago.
    const choque = await vincular(segundo.token, 'ok:900001');
    assert(choque.motivo === 'cuenta_en_uso',
      `el segundo pudo tomar la cuenta ajena: «${choque.motivo}»`);
    const rechazado = await estadoDelVinculo(segundo.token);
    assert(rechazado.estado === 'desconectado',
      `el segundo quedó en ${rechazado.estado}`);

    // Con su propia cuenta sí.
    const propia = await vincular(segundo.token, 'ok:900002');
    assert(propia.ok === 'vinculado', `el segundo no pudo con su cuenta: ${propia.destino}`);

    // Y la base lo sostiene aunque alguien escriba por afuera de la API.
    let laBaseFrena = false;
    try {
      querySql(`UPDATE users SET mp_user_id = '900001'
        WHERE email = ${sqlLiteral('otro.vendedor.smoke@example.com')}`);
    } catch {
      laBaseFrena = true;
    }
    assert(laBaseFrena, 'la base aceptó dos vendedores con la misma cuenta de MP');

    return 'la segunda vinculación a la misma cuenta se rechaza con «cuenta_en_uso», '
      + 'con su propia cuenta funciona, y el índice único lo sostiene desde SQL';
  } finally {
    // El doble se cierra primero y pase lo que pase: si la limpieza de
    // datos fallara, el puerto quedaría tomado y el caso siguiente
    // moriría con EADDRINUSE por un problema que no es suyo.
    await doble.cerrar();
    try { await desvincular(primero.token); } catch { /* la limpieza no tapa el motivo real */ }
    try { await desvincular(segundo.token); } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(65, 'Renovar rota las dos credenciales; si el vendedor revoca, queda en reconectar', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const otro = await ingresarVendedor('otro.vendedor.smoke@example.com', 'smoke123');
  try {
    await desvincular(vendedor.token);
    await desvincular(otro.token);

    // --- 1. rotación: las dos credenciales cambian, la cuenta no
    const alta = await vincular(vendedor.token, 'ok:900001');
    assert(alta.ok === 'vinculado', `no vinculó: ${alta.destino}`);
    const antes = vinculoEnLaBase('vendedor@ejemplo.com');

    const { datos: renovado, status } = await pedirCrudo('/mp-oauth/refresh', {
      method: 'POST', header: vendedor.token, body: {},
    });
    assert(status === 200 && renovado.estado === 'conectado',
      `la renovación devolvió ${status}: ${JSON.stringify(renovado)}`);
    const despues = vinculoEnLaBase('vendedor@ejemplo.com');
    assert(despues.acceso !== antes.acceso && despues.refresco !== antes.refresco,
      'la renovación no rotó las dos credenciales');
    assert(despues.cuenta === antes.cuenta,
      `la renovación cambió la cuenta: ${antes.cuenta} → ${despues.cuenta}`);
    sinSecretos(JSON.stringify(renovado), 'la respuesta de /refresh');

    // --- 2. revocación: el vendedor le sacó el permiso a la aplicación
    const conRevocacion = await vincular(otro.token, 'ok:900002#rechazo');
    assert(conRevocacion.ok === 'vinculado', `no vinculó: ${conRevocacion.destino}`);
    const { datos: caido, status: statusCaido } = await pedirCrudo('/mp-oauth/refresh', {
      method: 'POST', header: otro.token, body: {},
    });
    assert(statusCaido === 200,
      `la renovación fallida devolvió ${statusCaido}, tendría que ser una respuesta útil`);
    assert(caido.estado === 'requiere_reconexion' && caido.motivo === 'mp_rechazo',
      `estado tras la revocación: ${JSON.stringify(caido)}`);
    sinSecretos(JSON.stringify(caido), 'la respuesta de la renovación fallida');
    assert(caido.mp_user_id === '900002',
      'el vendedor no puede ver qué cuenta tiene que reconectar');

    // --- 3. y se sale del pozo reconectando, sin pasar por soporte
    const reconectado = await vincular(otro.token, 'ok:900002');
    assert(reconectado.ok === 'vinculado', `no pudo reconectar: ${reconectado.destino}`);
    const final = await estadoDelVinculo(otro.token);
    assert(final.estado === 'conectado', `quedó en ${final.estado}`);
    assert(vinculoEnLaBase('otro.vendedor.smoke@example.com').reconexion === false,
      'la bandera de reconexión quedó encendida después de reconectar');

    return 'la renovación rota acceso y refresco sin cambiar de cuenta; una revocación '
      + 'deja «requiere_reconexion» con 200 y el vendedor sale solo reconectando';
  } finally {
    // El doble se cierra primero y pase lo que pase: si la limpieza de
    // datos fallara, el puerto quedaría tomado y el caso siguiente
    // moriría con EADDRINUSE por un problema que no es suyo.
    await doble.cerrar();
    try { await desvincular(vendedor.token); } catch { /* la limpieza no tapa el motivo real */ }
    try { await desvincular(otro.token); } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(66, 'Mercado Pago mudo o con respuesta rara no vincula ni filtra su error', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await desvincular(vendedor.token);

    const esperados = [
      ['rechazo', 'mp_rechazo', 'un 401 con el detalle del client_secret adentro'],
      ['basura', 'respuesta_invalida', 'un 200 que no es JSON'],
      ['incompleto', 'respuesta_invalida', 'un 200 sin refresh_token'],
      ['lento', 'mp_sin_respuesta', 'una conexión que nunca contesta'],
    ];

    for (const [guion, motivo, descripcion] of esperados) {
      const intento = await vincular(vendedor.token, guion);
      assert(intento.motivo === motivo,
        `con ${descripcion} el motivo fue «${intento.motivo}», no «${motivo}»`);
      sinSecretos(`${intento.destino} ${intento.cuerpo}`, `la vuelta con ${guion}`);

      const fila = vinculoEnLaBase('vendedor@ejemplo.com');
      assert(!fila.cuenta && !fila.acceso,
        `con ${descripcion} quedó algo escrito: ${JSON.stringify(fila)}`);
    }

    const estado = await estadoDelVinculo(vendedor.token);
    assert(estado.estado === 'desconectado',
      `después de cuatro fallas quedó en ${estado.estado}`);

    return 'las cuatro fallas de Mercado Pago —rechazo, basura, respuesta incompleta y '
      + 'silencio— dan su motivo, no escriben nada y no dejan pasar el texto de MP';
  } finally {
    // El doble se cierra primero y pase lo que pase: si la limpieza de
    // datos fallara, el puerto quedaría tomado y el caso siguiente
    // moriría con EADDRINUSE por un problema que no es suyo.
    await doble.cerrar();
    try { await desvincular(vendedor.token); } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(67, 'La vinculación a mano ya no existe y el cobro sigue apagado', async () => {
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');

  // Pegar un access_token a mano era la puerta de atrás del módulo heredado.
  const aMano = await pedirCrudo('/mp-oauth/manual-link', {
    method: 'POST', header: vendedor.token,
    body: { mp_access_token: 'APP_USR-cualquier-cosa', mp_user_id: '900009' },
  });
  assert([404, 405].includes(aMano.status),
    `manual-link contestó ${aMano.status}: ${JSON.stringify(aMano.datos)}`);

  // Y lo que mueve plata sigue sin estar montado.
  for (const ruta of ['/payments/create-preference', '/payments/webhook', '/payments/my']) {
    const { status } = await pedirCrudo(ruta, { header: vendedor.token });
    assert(status === 404, `${ruta} contestó ${status} en vez de 404`);
  }

  // El contrato publicado tampoco los menciona: no es que estén escondidos.
  const { datos: esquema } = await pedirCrudo('/openapi.json');
  const rutas = Object.keys(esquema.paths || {});
  const cobro = rutas.filter((ruta) => /payments|manual-link/.test(ruta));
  assert(cobro.length === 0, `el esquema publica rutas de cobro: ${cobro.join(', ')}`);

  // Lo que toca pagos son tres rutas de la orden, y ninguna mueve dinero:
  // qué medios acepta cada vendedor, el link a nombre del vendedor —sólo con
  // el cobro encendido— y en qué anda ese pago según Mercado Pago. El módulo
  // heredado, que sí movía plata, sigue sin existir.
  const conPago = rutas.filter((ruta) => /payment/.test(ruta)).sort();
  assert(conPago.join(' | ') === [
    '/api/orders/payment-options',
    '/api/orders/{order_id}/payment-link',
    '/api/orders/{order_id}/payment-state',
  ].join(' | '), `el esquema publica ${conPago.length} rutas de pago: ${conPago.join(', ')}`);

  // Y una sola puerta más hacia Mercado Pago: la que recibe sus avisos. No
  // cobra, no devuelve y no acepta nada sin firma; lo que hace es preguntar.
  const deMercadoPago = rutas.filter((ruta) => /\/mp\//.test(ruta)).sort();
  assert(deMercadoPago.join(' | ') === '/api/mp/webhook',
    `el esquema publica ${deMercadoPago.length} rutas de Mercado Pago: ${deMercadoPago.join(', ')}`);
  const vinculo = rutas.filter((ruta) => ruta.includes('mp-oauth')).sort();
  assert(vinculo.length === 5,
    `el vínculo publica ${vinculo.length} rutas: ${vinculo.join(', ')}`);

  return `manual-link responde ${aMano.status}, las tres rutas del módulo heredado 404, y el `
    + 'esquema publica las 5 del vínculo, 3 de pago sobre la orden y 1 webhook';
});

await runCase(68, 'Sin configuración el vínculo se apaga solo y el resto del marketplace sigue', async () => {
  // Se prueba con la aplicación de verdad, en el proceso donde vive, con la
  // configuración vaciada. Levantar una segunda API en otro puerto sería
  // probar otra cosa.
  const observado = leerResultado(correrEnLaApi(MP_SIN_CONFIGURAR, ''));

  assert(observado.status === 200 && observado.estado === 'no_configurado',
    `/status devolvió ${observado.status} con estado ${observado.estado}`);
  assert(observado.auth_url === 503,
    `/auth-url devolvió ${observado.auth_url} en vez de 503`);
  assert(!/MP_APP_ID|MP_CLIENT_SECRET|MP_TOKEN_KEY|\.env/.test(observado.detalle),
    `el mensaje al usuario nombra variables internas: «${observado.detalle}»`);
  assert(observado.catalogo === 200 && observado.productos === 200,
    `el resto del marketplace se degradó: ${JSON.stringify(observado)}`);

  return 'con MP_APP_ID, MP_CLIENT_SECRET, MP_REDIRECT_URI y MP_TOKEN_KEY vacías el '
    + 'estado es «no_configurado», vincular da 503 sin nombrar variables, y catálogo '
    + 'y productos siguen en 200';
});

await runCase(69, 'Ni la respuesta ni los logs se llevan un secreto puesto', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  try {
    const observado = leerResultado(await correrEnLaApiSinBloquear(MP_LOGS_SIN_SECRETOS));

    assert(observado.vencido === 'estado_invalido',
      `un state nacido vencido devolvió «${observado.vencido}»`);
    assert(observado.rechazo === 'mp_rechazo',
      `el rechazo de MP devolvió «${observado.rechazo}»`);

    // Que haya logueado algo: si no, la prueba no probaría nada.
    assert(observado.lineas > 0, 'la aplicación no registró ni una línea');
    assert(/Mercado Pago/i.test(observado.log),
      'no se registró el rechazo de Mercado Pago');

    for (const secreto of [SECRETO_DE_ACCESO, SECRETO_DE_REFRESCO, DETALLE_CRUDO,
      'secreto-local-inventado', 'invalid_client']) {
      assert(!observado.log.includes(secreto),
        `los logs tienen «${secreto.slice(0, 24)}…»`);
      assert(!observado.respuestas.includes(secreto),
        `las respuestas tienen «${secreto.slice(0, 24)}…»`);
    }
    assert(!observado.log.includes(observado.state),
      'los logs tienen el state completo, que es lo que valida el callback');

    return `${observado.lineas} líneas de la aplicación durante un rechazo y un state `
      + `vencido, con el motivo adentro y sin token, sin client_secret y sin el texto de `
      + `MP (${observado.ajenos} registros del arnés quedaron fuera de la medición)`;
  } finally {
    await doble.cerrar();
  }
});

await runCase(70, 'El vendedor vincula, ve y desvincula desde el panel, en escritorio y en celular', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const browser = await chromium.launch({ headless: true });
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const pantallas = [
    ['escritorio', { width: 1280, height: 900 }],
    ['celular', { width: 390, height: 844 }],
  ];
  const recorridos = [];

  try {
    await desvincular(vendedor.token);

    for (const [nombre, viewport] of pantallas) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const erroresDePagina = [];
      page.on('pageerror', (error) => erroresDePagina.push(error.message));

      try {
        // Se entra por el formulario y no inyectando el token: el callback
        // viene del navegador y necesita la cookie de sesión de verdad.
        await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
        await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
        await page.getByPlaceholder('tu@email.com').fill('vendedor@ejemplo.com');
        await page.getByPlaceholder('••••••••').fill('vendedor123');
        await page.locator('[class*="_submitButton_"][type="submit"]').click();
        await page.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });

        const abrirPanel = async () => {
          await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
          await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor({ timeout: 15_000 });
        };
        await abrirPanel();

        const seccion = page.locator('[class*="_mpSection_"]');
        await seccion.waitFor({ state: 'visible', timeout: 15_000 });
        // El estado del vínculo llega por una consulta aparte: hasta que
        // contesta, la sección dice «Cargando estado…». Se espera el texto que
        // se quiere afirmar en vez de mirar lo que haya en ese instante.
        await seccion.getByText('Cuenta no vinculada')
          .waitFor({ state: 'visible', timeout: 15_000 });

        // Vincular manda a Mercado Pago; acá el doble contesta y devuelve.
        // Se navega a mano al mismo destino porque el doble no es MP: lo que
        // se prueba es que el botón manda a la URL correcta y que la vuelta
        // deja la pantalla en «conectado».
        const [autorizacion] = await Promise.all([
          page.waitForRequest((pedido) => pedido.url().includes(`:${MP_PUERTO_DEL_DOBLE}/authorization`),
            { timeout: 20_000 }),
          page.getByRole('button', { name: /Vincular Mercado Pago/ }).click(),
        ]);
        assert(autorizacion.url().includes('client_id=app-local-de-prueba'),
          `${nombre}: la URL de autorización no lleva el client_id`);

        // La vuelta la recibe el encabezado, que es lo único montado en una
        // carga nueva: avisa, limpia la URL y reabre el panel solo. Si eso no
        // pasara, la persona volvería a la portada sin saber si quedó
        // vinculada, que es exactamente lo que hacía antes.
        await page.getByText('Tu cuenta de Mercado Pago quedó vinculada.')
          .waitFor({ timeout: 20_000 });
        const vuelta = new URL(page.url());
        assert(!vuelta.searchParams.has('mp') && !vuelta.searchParams.has('mp_error'),
          `${nombre}: el resultado quedó pegado en la URL: ${page.url()}`);

        await page.getByRole('heading', { name: 'Mi Perfil' })
          .waitFor({ timeout: 15_000 });
        await seccion.waitFor({ state: 'visible', timeout: 15_000 });
        await seccion.getByText('Cuenta vinculada', { exact: false })
          .waitFor({ state: 'visible', timeout: 15_000 });
        const conectado = (await seccion.textContent()) || '';
        assert(/900001/.test(conectado),
          `${nombre}: el panel no muestra qué cuenta quedó vinculada: ${conectado.replace(/\s+/g, ' ').slice(0, 200)}`);
        sinSecretos(await page.content(), `${nombre}: la página`);

        // Desvincular, con su confirmación.
        await seccion.getByRole('button', { name: 'Desvincular cuenta' }).click();
        // `name` matchea por subcadena: sin `exact` esto también agarra
        // «Desvincular cuenta», que es el botón que acabamos de tocar.
        await page.getByRole('button', { name: 'Desvincular', exact: true }).click();
        await page.getByText('Cuenta de Mercado Pago desvinculada.').waitFor({ timeout: 15_000 });
        await seccion.getByText('Cuenta no vinculada')
          .waitFor({ state: 'visible', timeout: 15_000 });

        // Desvincular es borrar, no marcar: no queda credencial, ni cuenta, ni
        // vencimiento, ni intentos de vinculación colgados.
        const tras = vinculoEnLaBase('vendedor@ejemplo.com');
        assert(!tras.cuenta && !tras.acceso && !tras.refresco && !tras.vence,
          `${nombre}: desvincular dejó algo escrito: ${JSON.stringify(tras)}`);
        assert(queryCount(`SELECT COUNT(*) FROM mp_oauth_states
          WHERE user_id = ${sqlLiteral(vendedor.id)}`) === 0,
          `${nombre}: quedaron intentos de vinculación después de desvincular`);
        assert(erroresDePagina.length === 0,
          `${nombre}: errores de página: ${erroresDePagina.join(' | ')}`);
        recorridos.push(nombre);
      } finally {
        await context.close();
      }
    }

    return `recorrido completo en ${recorridos.join(' y ')}: desconectado → autorización `
      + 'en Mercado Pago → conectado con la cuenta a la vista → desvinculado, sin errores '
      + 'de página y sin credenciales en el HTML';
  } finally {
    // Mismo criterio: primero lo que libera recursos, después la limpieza.
    await doble.cerrar();
    try { await browser.close(); } catch { /* ya estaba cerrado */ }
    try { await desvincular(vendedor.token); } catch { /* no tapa el motivo real */ }
  }
});

await runCase(71, 'Con la clave de cifrado rotada, el vínculo pide reconexión y no se rompe', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await desvincular(vendedor.token);
    const observado = leerResultado(await correrEnLaApiSinBloquear(MP_CLAVE_ROTADA));

    assert(observado.antes === 'conectado',
      `el vínculo no quedó conectado antes de rotar: ${observado.antes}`);
    assert(observado.status === 200 && observado.estado === 'requiere_reconexion',
      `con la clave rotada el estado fue ${observado.status}/${observado.estado}`);
    assert(observado.cuenta === '900001',
      'el vendedor no ve qué cuenta tiene que reconectar');
    assert(observado.refresh_status === 200,
      `renovar con la clave rotada devolvió ${observado.refresh_status}, no una respuesta útil`);
    assert(observado.refresh_estado === 'requiere_reconexion'
      && observado.motivo === 'credencial_ilegible',
      `la renovación devolvió ${observado.refresh_estado}/${observado.motivo}`);
    sinSecretos(observado.cuerpos, 'las respuestas con la clave rotada');

    return 'rotada la clave sin migrar, el estado pasa solo a «requiere_reconexion» con la '
      + 'cuenta a la vista, renovar responde 200 con motivo propio y no aparece un 500';
  } finally {
    // El doble se cierra primero y pase lo que pase: si la limpieza de
    // datos fallara, el puerto quedaría tomado y el caso siguiente
    // moriría con EADDRINUSE por un problema que no es suyo.
    await doble.cerrar();
    try { await desvincular(vendedor.token); } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(72, 'Cancelar en Mercado Pago también gasta el intento', async () => {
  // Volver cancelado es volver. Si el state siguiera vivo, ese mismo intento
  // serviría después para vincular, que es exactamente lo que no queremos de
  // un pedido que la persona ya abandonó.
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await desvincular(vendedor.token);

    const authUrl = await pedirUrlDeVinculo(vendedor.token);
    const state = new URL(authUrl).searchParams.get('state');
    const callback = (parametros) => `${API_URL}/mp-oauth/callback?${parametros}`;

    const cancelado = await volverDelCallback(
      callback(`error=access_denied&error_description=El+usuario+cancelo`
        + `&state=${encodeURIComponent(state)}`),
      vendedor.token,
    );
    assert(cancelado.motivo === 'cancelado',
      `cancelar devolvió «${cancelado.motivo}»`);
    sinSecretos(`${cancelado.destino} ${cancelado.cuerpo}`, 'la vuelta cancelada');

    assert(queryCount(`SELECT COUNT(*) FROM mp_oauth_states
      WHERE state_hash = ${sqlLiteral(huellaDe(state))} AND usado_el IS NOT NULL`) === 1,
      'el intento cancelado quedó vivo');

    // Y con el mismo state, ahora sí con un código bueno, no vincula.
    const reintento = await volverDelCallback(
      callback(`code=ok%3A900001&state=${encodeURIComponent(state)}`), vendedor.token);
    assert(reintento.motivo === 'estado_invalido',
      `el state cancelado se pudo reusar: «${reintento.motivo}»`);

    const fila = vinculoEnLaBase('vendedor@ejemplo.com');
    assert(!fila.cuenta && !fila.acceso && !fila.refresco,
      `quedó algo escrito: ${JSON.stringify(fila)}`);
    const estado = await estadoDelVinculo(vendedor.token);
    assert(estado.estado === 'desconectado', `quedó en ${estado.estado}`);

    return 'la vuelta cancelada sella el intento; reusar ese mismo state con un código '
      + 'válido devuelve «estado_invalido» y no escribe una sola credencial';
  } finally {
    // El doble se cierra primero y pase lo que pase: si la limpieza de
    // datos fallara, el puerto quedaría tomado y el caso siguiente
    // moriría con EADDRINUSE por un problema que no es suyo.
    await doble.cerrar();
    try { await desvincular(vendedor.token); } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(73, 'Una clave de cifrado inválida apaga el vínculo, no lo revienta', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await desvincular(vendedor.token);
    const observado = leerResultado(await correrEnLaApiSinBloquear(MP_CLAVE_INVALIDA));

    assert(observado.antes === 'conectado',
      `el vínculo no quedó conectado con la clave buena: ${observado.antes}`);

    // Una cadena que no es una clave Fernet cuenta como no configurada: es
    // más honesto que ofrecer una integración que no puede guardar nada.
    assert(observado.status === 200 && observado.estado === 'no_configurado',
      `el estado fue ${observado.status}/${observado.estado}`);
    assert(observado.auth_url === 503,
      `vincular devolvió ${observado.auth_url} en vez de 503`);
    assert(observado.refresh_status === 200,
      `renovar devolvió ${observado.refresh_status}: con la clave rota tiene que `
      + 'contestar algo accionable, no un 500');
    assert(observado.refresh_estado === 'no_configurado'
      && observado.motivo === 'sin_configurar',
      `la renovación devolvió ${observado.refresh_estado}/${observado.motivo}`);
    assert(observado.catalogo === 200,
      `el resto del marketplace se degradó: catálogo en ${observado.catalogo}`);
    sinSecretos(observado.cuerpos, 'las respuestas con la clave inválida');
    assert(!/fernet|MP_TOKEN_KEY/i.test(observado.cuerpos),
      `las respuestas nombran la clave o la biblioteca: ${observado.cuerpos.slice(0, 200)}`);

    return 'con MP_TOKEN_KEY escrita pero inválida: estado «no_configurado», vincular 503 '
      + 'y renovar 200 con motivo, ningún 500 y el catálogo intacto';
  } finally {
    // El doble se cierra primero y pase lo que pase: si la limpieza de
    // datos fallara, el puerto quedaría tomado y el caso siguiente
    // moriría con EADDRINUSE por un problema que no es suyo.
    await doble.cerrar();
    try { await desvincular(vendedor.token); } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(74, 'El descarte de credenciales en claro sólo lo autoriza un 1', async () => {
  // Este freno borra credenciales de terceros y no se deshace. Que se abriera
  // con cualquier texto -«0», «false», un dedazo- era una puerta abierta.
  // Se baja hasta la revisión ANTERIOR a la del cifrado, por nombre y no por
  // «-1»: el freno es de esa migración, y contarlo desde la punta haría que
  // cada migración nueva mida otra cosa.
  const bajada = correrAlembic('downgrade c4a91e37d5b8');
  assert(/Running downgrade/.test(bajada), `el downgrade no corrió: ${bajada.slice(-200)}`);

  const enClaro = () => queryCount(
    "SELECT COUNT(*) FROM users WHERE mp_access_token IS NOT NULL");
  const columnasViejas = () => queryCount(`SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'users' AND column_name IN ('mp_access_token', 'mp_refresh_token')`);

  try {
    // Un token como el que dejaba `manual-link`, que es el caso que el freno
    // existe para atajar.
    querySql(`UPDATE users SET mp_access_token = 'APP_USR-de-prueba-en-claro'
      WHERE email = ${sqlLiteral('vendedor@ejemplo.com')}`);
    assert(enClaro() === 1, 'no se pudo fabricar el escenario del freno');

    const negados = [
      [[], 'la variable sin definir'],
      [['MP_MIGRACION_DESCARTAR_TOKENS='], 'vacía'],
      [['MP_MIGRACION_DESCARTAR_TOKENS=0'], 'en 0'],
      [['MP_MIGRACION_DESCARTAR_TOKENS=false'], 'en false'],
      [['MP_MIGRACION_DESCARTAR_TOKENS=11'], 'en 11'],
    ];

    for (const [variables, comoLoLlamamos] of negados) {
      const salida = correrAlembic('upgrade head', variables);
      assert(/credenciales de Mercado Pago/.test(salida),
        `con la variable ${comoLoLlamamos} la migración no frenó: ${salida.slice(-250)}`);
      assert(enClaro() === 1,
        `con la variable ${comoLoLlamamos} se borró la credencial igual`);
      assert(columnasViejas() === 2,
        `con la variable ${comoLoLlamamos} la migración avanzó a medias`);
    }

    // El mensaje dice cuántos hay, nunca cuáles ni de quién.
    const frenada = correrAlembic('upgrade head');
    assert(/Hay 1 usuario/.test(frenada), `el mensaje no dice cuántos: ${frenada.slice(-250)}`);
    assert(!/vendedor@ejemplo\.com|APP_USR/.test(frenada),
      'el mensaje del freno filtra de quién es la credencial');

    const autorizada = correrAlembic('upgrade head', ['MP_MIGRACION_DESCARTAR_TOKENS=1']);
    assert(/Running upgrade/.test(autorizada),
      `con 1 la migración no avanzó: ${autorizada.slice(-250)}`);
    assert(columnasViejas() === 0, 'las columnas en claro siguen existiendo');

    return 'cinco valores que no son «1» -sin definir, vacía, 0, false y 11- frenan la '
      + 'migración sin tocar la credencial; el mensaje dice cuántas hay y no de quién; '
      + 'sólo con 1 avanza y las columnas en claro desaparecen';
  } finally {
    // Pase lo que pase, la base queda en head para lo que venga después.
    correrAlembic('upgrade head', ['MP_MIGRACION_DESCARTAR_TOKENS=1']);
  }
});

// --- cobro por Mercado Pago (pieza MP-B) -------------------------------------
// Contra el mismo doble local: no hay credenciales reales y no se cobra nada de
// verdad. Lo que se prueba es que crear la intención de pago no invente plata,
// no duplique órdenes ni pagos, y no le mande a Mercado Pago nada que TopGreen
// no deba mandar.

// Una publicación de ese vendedor que de verdad se pueda comprar hoy.
//
// «Con stock» quiere decir DISPONIBLE: lo que hay menos lo reservado por
// compras que están esperando el pago. Y de una categoría de productos, no de
// servicios: un servicio no ocupa unidades, así que elegir uno acá sería
// probar la reserva de stock sobre algo que no reserva nada.
function productoConStock(vendedor, minimo = 2) {
  const [fila] = queryRows(`
    SELECT p.id FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.seller_id = ${sqlLiteral(vendedor)} AND p.status = 'ACTIVE'
      AND p.publication_type <> 'servicio' AND c.is_service = false
      AND coalesce(p.stock, 0) - p.stock_reservado >= ${minimo}
    ORDER BY p.price
    LIMIT 1
  `);
  assert(fila, `el vendedor ${vendedor} no tiene publicación con ${minimo} disponible(s)`);
  return fila[0];
}

// Dos publicaciones distintas del mismo vendedor. Hace falta cuando una prueba
// tiene que atribuir un efecto a una compra y no a otra: con el mismo producto,
// una liberación y una consolidación se ven iguales en el total reservado.
function dosProductosDistintos(vendedor, minimo = 2) {
  const filas = queryRows(`
    SELECT p.id FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.seller_id = ${sqlLiteral(vendedor)} AND p.status = 'ACTIVE'
      AND p.publication_type <> 'servicio' AND c.is_service = false
      AND coalesce(p.stock, 0) - p.stock_reservado >= ${minimo}
    ORDER BY p.price
    LIMIT 2
  `);
  assert(filas.length === 2,
    `el vendedor ${vendedor} no tiene dos publicaciones con ${minimo} disponible(s)`);
  return [filas[0][0], filas[1][0]];
}

async function armarCarrito(items) {
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/sync', {
    method: 'POST', token: state.buyerToken, body: { items },
  });
}

function sobreDePago(pagos, extra = {}) {
  return {
    shipping_address: 'Ruta 8 km 220',
    shipping_locality_id: localidadDeEnvio(),
    shipping_postal_code: '2700',
    shipping_decisions: trasladoPropio(),
    payment_decisions: pagos,
    ...extra,
  };
}

const preferenciasPedidas = (doble) => doble.pedidos.filter((p) => p.ruta === 'preferencia');

function pagosDe(ordenId) {
  return queryRows(`
    SELECT coalesce(mp_preference_id, '${NULO}'),
           coalesce(init_point, '${NULO}'),
           coalesce(mp_external_reference, '${NULO}'),
           total_amount,
           status::text
    FROM payments WHERE order_id = ${sqlLiteral(ordenId)}
  `);
}

function ordenEnLaBase(ordenId) {
  const [fila] = queryRows(`
    SELECT status::text, coalesce(payment_method, '${NULO}'), total_amount,
           coalesce(transfer_cbu, '${NULO}')
    FROM orders WHERE id = ${sqlLiteral(ordenId)}
  `);
  assert(fila, `la orden ${ordenId} no está en la base`);
  const [estado, medio, total, cbu] = fila;
  // En la base el estado es el NOMBRE del enum -PLACED, no «placed»-, así que
  // se normaliza acá y no en cada caso.
  return { estado: estado.toLowerCase(), medio, total, cbu: cbu === NULO ? null : cbu };
}

const MP_COMPRADOR = { email: 'cliente@ejemplo.com', password: 'cliente123' };

// Deja al comprador con sesión propia dentro de este bloque: los casos del
// vínculo dejan el carrito y el token del comprador en cualquier estado.
async function comprador() {
  const { data } = await apiRequest('/auth/login', {
    method: 'POST', body: MP_COMPRADOR,
  });
  state.buyerToken = data.access_token;
  state.buyerId = data.user.id;
  return data.user.id;
}

// El mismo secreto que backend/.env. No es real y no vale en ningún lado: es
// el que comparten Mercado Pago y la aplicación para firmar los avisos.
const SECRETO_DEL_WEBHOOK = 'secreto-local-de-prueba-no-es-real';

// Manda un aviso de webhook como lo manda Mercado Pago: el identificador del
// pago en la URL —que es el que entra en la firma—, el tópico, y un cuerpo que
// sólo sirve para saber a quién preguntarle.
//
// `firma: null` manda el aviso sin firmar. `firma: '...'` manda una a mano,
// para poder alterarla.
async function avisar({
  dataId, cuenta, secreto = SECRETO_DEL_WEBHOOK, ts, requestId = 'pedido-de-prueba',
  firma, tipo = 'payment', cuerpo, idEnLaUrl,
} = {}) {
  const segundos = ts ?? Math.floor(Date.now() / 1000);
  const cabeceras = { 'Content-Type': 'application/json', 'x-request-id': requestId };
  const calculada = firma === undefined
    ? firmaDeAviso(secreto, { dataId, requestId, ts: segundos })
    : firma;
  if (calculada !== null) cabeceras['x-signature'] = calculada;

  const enLaUrl = idEnLaUrl ?? dataId;
  const respuesta = await pedirConReintento(
    `${API_URL}/mp/webhook?data.id=${encodeURIComponent(enLaUrl)}&type=${tipo}`,
    {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify(cuerpo ?? {
        type: tipo, action: 'payment.updated',
        data: { id: String(dataId) }, user_id: cuenta,
      }),
    },
  );
  let datos = null;
  try { datos = await respuesta.json(); } catch { datos = null; }
  return { status: respuesta.status, resultado: datos?.resultado };
}

// Una compra por Mercado Pago, lista para pagar. Devuelve la orden creada más
// el producto que llevó, para poder mirarle el stock.
async function ordenMercadoPago(vendedor, { cantidad = 1, producto } = {}) {
  const item = producto ?? productoConStock(vendedor.id, cantidad + 1);
  await armarCarrito([{ product_id: item, quantity: cantidad }]);
  const creado = await apiRequest('/orders/checkout', {
    method: 'POST', token: state.buyerToken,
    body: sobreDePago([{ seller_id: vendedor.id, method: 'mercadopago' }]),
  });
  const [orden] = creado.data.orders;
  assert(orden && orden.preparation === 'lista',
    `la orden quedó ${orden && orden.preparation}`);
  const [pago] = pagosDe(orden.order_id);
  return { ...orden, producto: item, preferencia: pago[0] };
}

function intentosDe(ordenId) {
  return queryRows(`
    SELECT mp_payment_id, estado, monto, moneda
    FROM mp_intentos_de_pago WHERE order_id = ${sqlLiteral(ordenId)}
    ORDER BY creado_el
  `);
}

function reservaDe(ordenId) {
  const [fila] = queryRows(`
    SELECT coalesce(stock_reserva, '${NULO}') FROM orders WHERE id = ${sqlLiteral(ordenId)}
  `);
  assert(fila, `la orden ${ordenId} no está en la base`);
  return fila[0];
}

function reservadoDe(producto) {
  return Number(queryRows(
    `SELECT stock_reservado FROM products WHERE id = ${sqlLiteral(producto)}`)[0][0]);
}

function ventasDe(producto) {
  return Number(queryRows(
    `SELECT sales_count FROM products WHERE id = ${sqlLiteral(producto)}`)[0][0]);
}

// Adelanta el reloj de una orden: le vence el link y su reserva. Se toca la
// base y no el producto porque esperar media hora no es una prueba.
function vencerElLink(ordenId, minutos = 60) {
  querySql(`
    UPDATE payments SET expires_at = now() - interval '${minutos} minutes'
    WHERE order_id = ${sqlLiteral(ordenId)}
  `);
}

// El reconciliador, por su entrada ejecutable de verdad.
async function reconciliar() {
  const salida = await correrEnLaApiSinBloquear(
    'from app.reconciliar import main\nmain()\n');
  const linea = salida.split(/\r?\n/).find((l) => l.startsWith('RECONCILIACION'));
  assert(linea, `el reconciliador no dijo nada:\n${salida.slice(-400)}`);
  return JSON.parse(linea.slice('RECONCILIACION '.length));
}

// Espera a que una condición se cumpla sin navegador de por medio. Sirve para
// saber que la otra punta de una carrera ya llegó al punto que importa, en vez
// de dormir un rato y confiar.
/**
 * Cierra una capa que puede tener trabajo sin guardar.
 *
 * Desde FORM-DIRTY-1 un formulario sucio no se cierra en silencio: pregunta. Los
 * casos que cerraban con algo escrito ahora dicen explícitamente que descartan,
 * que es lo que hacían antes sin que nadie se lo preguntara. Se espera a que
 * pase UNA de las dos cosas —la pregunta o el cierre—, sin pausas fijas.
 */
async function descartarSiPregunta(page, seCerro, mensaje) {
  const descartar = page.getByRole('button', { name: 'Descartar cambios' });
  await esperarA(async () => (await descartar.count()) > 0 || (await seCerro()),
    `${mensaje}: no se cerró ni preguntó por los cambios sin guardar`, 20_000);
  if ((await descartar.count()) > 0) await descartar.click();
  await esperarA(seCerro, `${mensaje}: descartar no cerró la capa`, 20_000);
}

async function esperarA(condicion, mensaje, limite = 20_000) {
  const hasta = Date.now() + limite;
  while (Date.now() < hasta) {
    if (await condicion()) return;
    await new Promise((seguir) => { setTimeout(seguir, 50); });
  }
  throw new Error(`no pasó a tiempo: ${mensaje}`);
}

// ¿La fila de esta orden está bloqueada por otra transacción? Se pregunta con
// NOWAIT: si no se puede tomar el candado al instante, es que alguien lo tiene.
function ordenBloqueada(ordenId) {
  try {
    querySql(`SELECT 1 FROM orders WHERE id = ${sqlLiteral(ordenId)} FOR UPDATE NOWAIT`);
    return false;
  } catch (error) {
    const texto = `${error}${error?.stderr || ''}${error?.stdout || ''}`;
    if (/could not obtain lock|no se pudo obtener el bloqueo|lock.*NOWAIT/i.test(texto)) return true;
    throw error;
  }
}

// El estado del pago tal como lo ve cada uno en su lista de órdenes.
async function comoLoVe(token, rol, numeroDeOrden) {
  const { data } = await apiRequest(`/orders/my?as_role=${rol}`, { token });
  const vista = data.find((o) => o.order_number === numeroDeOrden);
  assert(vista, `${rol} no ve la orden ${numeroDeOrden}`);
  return vista;
}

await runCase(75, 'Carrito mixto: una orden por vendedor, cada una con su medio', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const otro = await ingresarVendedor('admin@topgreen.com', 'admin123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    await desvincular(otro.token);
    const vinculado = await vincular(vendedor.token, 'ok:900101');
    assert(vinculado.ok === 'vinculado', `el vendedor no vinculó: ${vinculado.motivo}`);

    const suyo = productoConStock(vendedor.id);
    const delOtro = productoConStock(otro.id);
    await armarCarrito([
      { product_id: suyo, quantity: 2 },
      { product_id: delOtro, quantity: 1 },
    ]);
    const stockAntes = [stockDe(suyo), stockDe(delOtro)];

    // Lo que la pantalla puede ofrecer: dos grupos, y Mercado Pago sólo en el
    // que tiene vínculo.
    const opciones = (await apiRequest('/orders/payment-options',
      { token: state.buyerToken })).data;
    assert(opciones.length === 2, `payment-options devolvió ${opciones.length} grupos`);
    const conMP = opciones.find((o) => o.seller_id === vendedor.id);
    const sinMP = opciones.find((o) => o.seller_id === otro.id);
    assert(conMP.methods.includes('mercadopago') && conMP.methods.includes('transfer'),
      `el vendedor vinculado ofrece ${JSON.stringify(conMP.methods)}`);
    assert(!sinMP.methods.includes('mercadopago'),
      `el vendedor sin vínculo ofrece Mercado Pago: ${JSON.stringify(sinMP.methods)}`);

    const creado = await apiRequest('/orders/checkout', {
      method: 'POST', token: state.buyerToken,
      body: sobreDePago([
        { seller_id: vendedor.id, method: 'mercadopago' },
        { seller_id: otro.id, method: 'transfer' },
      ]),
    });
    const ordenes = creado.data.orders;
    assert(ordenes.length === 2, `el checkout devolvió ${ordenes.length} órdenes`);

    const ordenMP = ordenes.find((o) => o.payment_method === 'mercadopago');
    const ordenTR = ordenes.find((o) => o.payment_method === 'transfer');
    assert(ordenMP && ordenTR, 'no salió una orden de cada medio');
    assert(ordenMP.preparation === 'lista' && ordenMP.payment_url,
      `la orden de MP quedó ${ordenMP.preparation} (${ordenMP.reason || 'sin motivo'})`);
    assert(!ordenMP.cbu && !ordenMP.alias_bancario,
      'la orden de Mercado Pago trae datos bancarios que no le corresponden');
    assert(ordenTR.cbu || ordenTR.alias_bancario,
      'la orden de transferencia no dice a dónde transferir');
    assert(!ordenTR.payment_url, 'la orden de transferencia trae link de Mercado Pago');

    // Una sola preferencia: la del grupo que la eligió.
    const pedidas = preferenciasPedidas(doble);
    assert(pedidas.length === 1, `el doble recibió ${pedidas.length} preferencias`);

    // Y una sola fila de pago, la de esa orden.
    assert(pagosDe(ordenMP.order_id).length === 1,
      'la orden de Mercado Pago no tiene exactamente un pago');
    assert(pagosDe(ordenTR.order_id).length === 0,
      'la orden de transferencia creó una fila de pago');

    const enBaseMP = ordenEnLaBase(ordenMP.order_id);
    const enBaseTR = ordenEnLaBase(ordenTR.order_id);
    assert(enBaseMP.medio === 'mercadopago' && enBaseTR.medio === 'transfer',
      `los medios quedaron ${enBaseMP.medio}/${enBaseTR.medio}`);
    assert(enBaseMP.estado === 'placed',
      `la orden de MP nació en ${enBaseMP.estado}, no colocada`);
    assert(enBaseMP.estado !== 'paid' && enBaseMP.estado !== 'payment_confirmed',
      'la orden de Mercado Pago nació marcada como pagada');
    assert(enBaseTR.estado === 'awaiting_transfer_receipt',
      `la orden de transferencia nació en ${enBaseTR.estado}`);
    assert(enBaseMP.cbu === null, 'la orden de MP guardó un CBU');

    // Crear la intención de pago no compromete stock: nadie descuenta nada
    // hasta que el pago esté confirmado, y todavía no hay quien lo confirme.
    assert(stockDe(suyo) === stockAntes[0] && stockDe(delOtro) === stockAntes[1],
      `el stock se movió: ${stockAntes} → ${[stockDe(suyo), stockDe(delOtro)]}`);

    return `dos vendedores, dos órdenes: ${ordenMP.order_number} por Mercado Pago `
      + `(1 preferencia, 1 pago, estado ${enBaseMP.estado}) y ${ordenTR.order_number} `
      + 'por transferencia (0 preferencias, 0 pagos); stock intacto en las dos';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(76, 'Dos vendedores con Mercado Pago: pagos separados y el que falla se reanuda', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const otro = await ingresarVendedor('admin@topgreen.com', 'admin123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    await desvincular(otro.token);
    // El segundo vincula una cuenta que el doble rechaza al crear preferencias:
    // vincular bien y fallar al cobrar es exactamente lo que pasa cuando el
    // vendedor le revoca el permiso a la aplicación después.
    assert((await vincular(vendedor.token, 'ok:900201')).ok === 'vinculado',
      'el primer vendedor no vinculó');
    assert((await vincular(otro.token, `ok:${CUENTA_RECHAZA}`)).ok === 'vinculado',
      'el segundo vendedor no vinculó');

    const suyo = productoConStock(vendedor.id);
    const delOtro = productoConStock(otro.id);
    await armarCarrito([
      { product_id: suyo, quantity: 1 },
      { product_id: delOtro, quantity: 1 },
    ]);

    const creado = await apiRequest('/orders/checkout', {
      method: 'POST', token: state.buyerToken,
      body: sobreDePago([
        { seller_id: vendedor.id, method: 'mercadopago' },
        { seller_id: otro.id, method: 'mercadopago' },
      ]),
    });
    const ordenes = creado.data.orders;
    assert(ordenes.length === 2, `el checkout devolvió ${ordenes.length} órdenes`);

    const buena = ordenes.find((o) => o.seller_id === vendedor.id);
    const trabada = ordenes.find((o) => o.seller_id === otro.id);
    assert(buena.preparation === 'lista' && buena.payment_url,
      `la orden que sí se podía preparar quedó ${buena.preparation}`);
    assert(trabada.preparation === 'pendiente' && !trabada.payment_url,
      `la orden del vendedor que rechaza quedó ${trabada.preparation}`);
    assert(trabada.reason === 'mp_rechazo',
      `el motivo es «${trabada.reason}» y no el código nuestro`);
    sinSecretos(JSON.stringify(creado.data), 'la respuesta del checkout');

    // Las dos existen y son distintas: la que falló no se borra ni se
    // convierte en otra cosa, se reanuda.
    assert(buena.order_id !== trabada.order_id, 'las dos órdenes son la misma');
    assert(ordenEnLaBase(trabada.order_id).estado === 'placed',
      'la orden que no pudo preparar el pago no quedó colocada');
    // La fila de pago existe —la intención se escribe con la reserva, antes de
    // hablar con Mercado Pago— pero está **vacía de Mercado Pago**: sin
    // preferencia y sin link. Que exista es lo que hace que esa reserva pueda
    // vencer; que esté vacía es lo que prueba que nada quedó a medias.
    const [intencion] = pagosDe(trabada.order_id);
    assert(intencion, 'la orden que falló quedó sin intención de pago y su reserva no vence');
    assert(pagosDe(trabada.order_id).length === 1, 'quedó más de una fila de pago');
    assert(intencion[0] === NULO && intencion[1] === NULO,
      `la fila de pago quedó a medias con datos de Mercado Pago: ${intencion.join(' | ')}`);
    assert(intencion[4] === 'PENDING', `la intención quedó en «${intencion[4]}»`);
    assert(pagosDe(buena.order_id).length === 1,
      'la orden que salió bien no tiene exactamente un pago');

    // Los dos pagos son de cuentas distintas y con claves distintas: nada se
    // mezcló entre vendedores.
    const pedidas = preferenciasPedidas(doble);
    assert(pedidas.length === 2, `el doble recibió ${pedidas.length} preferencias`);
    const claves = new Set(pedidas.map((p) => p.idempotencia));
    assert(claves.size === 2, 'las dos órdenes usaron la misma clave de idempotencia');
    const cuentas = new Set(pedidas.map((p) => (p.autorizacion.match(/-(\d{6,})-\d+$/) || [])[1]));
    assert(cuentas.size === 2, `las dos preferencias fueron a la cuenta ${[...cuentas]}`);

    // Y el reintento del que falló sigue fallando igual, sin duplicar nada.
    const reintento = await apiRequest(`/orders/${trabada.order_id}/payment-link`, {
      method: 'POST', token: state.buyerToken, body: {},
    });
    assert(reintento.data.preparation === 'pendiente' && reintento.data.reason === 'mp_rechazo',
      `el reintento devolvió ${JSON.stringify(reintento.data)}`);
    // El reintento que vuelve a fallar tampoco escribe nada de Mercado Pago: la
    // intención sigue siendo la misma, una sola y vacía.
    const trasReintento = pagosDe(trabada.order_id);
    assert(trasReintento.length === 1, `el reintento dejó ${trasReintento.length} filas de pago`);
    assert(trasReintento[0][0] === NULO && trasReintento[0][1] === NULO,
      `el reintento dejó un pago a medias: ${trasReintento[0].join(' | ')}`);

    // Y si el vendedor revoca el vínculo, el reintento lo dice con su propio
    // motivo: la orden no cae a transferencia por atrás ni se marca de nada.
    await desvincular(otro.token);
    const sinVinculo = await apiRequest(`/orders/${trabada.order_id}/payment-link`, {
      method: 'POST', token: state.buyerToken, body: {},
    });
    assert(sinVinculo.data.preparation === 'pendiente'
      && sinVinculo.data.reason === 'sin_vinculo',
      `con el vínculo revocado el reintento devolvió ${JSON.stringify(sinVinculo.data)}`);
    assert(sinVinculo.data.payment_method === 'mercadopago',
      'la orden cambió de medio sola al perder el vínculo');
    const sinVinculoEnLaBase = pagosDe(trabada.order_id);
    assert(sinVinculoEnLaBase.length === 1,
      `perder el vínculo dejó ${sinVinculoEnLaBase.length} filas de pago`);
    assert(sinVinculoEnLaBase[0][0] === NULO && sinVinculoEnLaBase[0][1] === NULO,
      `el reintento sin vínculo dejó un pago a medias: ${sinVinculoEnLaBase[0].join(' | ')}`);

    // Cuando el vendedor arregla su cuenta, la MISMA orden se paga: se
    // revincula con una cuenta que sí contesta y se reanuda.
    assert((await vincular(otro.token, 'ok:900202')).ok === 'vinculado',
      'el segundo vendedor no pudo revincular');
    const reanudada = await apiRequest(`/orders/${trabada.order_id}/payment-link`, {
      method: 'POST', token: state.buyerToken, body: {},
    });
    assert(reanudada.data.preparation === 'lista' && reanudada.data.payment_url,
      `la orden no se reanudó: ${JSON.stringify(reanudada.data)}`);
    assert(reanudada.data.order_id === trabada.order_id,
      'reanudar creó otra orden en vez de usar la misma');
    assert(pagosDe(trabada.order_id).length === 1,
      'reanudar no dejó exactamente un pago');
    assert(ordenesDe(state.buyerId).filter(
      ([id]) => id === buena.order_id || id === trabada.order_id).length === 2,
      'el conteo de órdenes del comprador cambió al reanudar');

    return 'dos órdenes por Mercado Pago con claves y cuentas distintas; la que el '
      + 'vendedor no podía cobrar quedó «pendiente» con motivo propio (mp_rechazo, y '
      + 'sin_vinculo tras revocar), sin pago a medias, y se reanudó sobre la misma '
      + 'orden cuando su cuenta volvió';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await desvincular(otro.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(77, 'Doble clic, corte de tiempo y reintento no crean un segundo pago', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900301')).ok === 'vinculado',
      'el vendedor no vinculó');

    await armarCarrito([{ product_id: productoConStock(vendedor.id), quantity: 1 }]);
    const creado = await apiRequest('/orders/checkout', {
      method: 'POST', token: state.buyerToken,
      body: sobreDePago([{ seller_id: vendedor.id, method: 'mercadopago' }]),
    });
    const [orden] = creado.data.orders;
    assert(orden.preparation === 'lista', `la orden quedó ${orden.preparation}`);
    const preferenciasDelAlta = preferenciasPedidas(doble).length;
    assert(preferenciasDelAlta === 1, `el alta pidió ${preferenciasDelAlta} preferencias`);

    // Doble clic de verdad: cinco pedidos a la vez sobre la misma orden.
    const enParalelo = await Promise.all(Array.from({ length: 5 }, () =>
      apiRequest(`/orders/${orden.order_id}/payment-link`, {
        method: 'POST', token: state.buyerToken, body: {},
      })));
    const links = new Set(enParalelo.map((r) => r.data.payment_url));
    assert(links.size === 1 && links.has(orden.payment_url),
      `cinco pedidos devolvieron ${links.size} links distintos`);
    assert(preferenciasPedidas(doble).length === preferenciasDelAlta,
      `los reintentos pidieron ${preferenciasPedidas(doble).length - preferenciasDelAlta} `
      + 'preferencias de más');
    assert(pagosDe(orden.order_id).length === 1,
      `la orden terminó con ${pagosDe(orden.order_id).length} pagos`);

    // Y el índice único es el que lo garantiza, no la suerte del orden de
    // llegada: insertar un segundo pago para la misma orden es imposible.
    let segundo = 'la base aceptó un segundo pago para la misma orden';
    try {
      querySql(`INSERT INTO payments
        (id, order_id, total_amount, status, created_at, updated_at)
        VALUES (gen_random_uuid()::text, ${sqlLiteral(orden.order_id)}, 1,
                'PENDING', now(), now())`);
    } catch (error) {
      segundo = String(error.stderr || error.message);
    }
    assert(/duplicate key|unique/i.test(segundo),
      `la base no frenó el segundo pago: ${segundo.slice(0, 200)}`);

    // Corte de tiempo: la cuenta lenta no contesta nunca y el que corta es la
    // API. La orden queda pendiente, reanudable, y sin pago escrito.
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, `ok:${CUENTA_LENTA}`)).ok === 'vinculado',
      'no se pudo vincular la cuenta lenta');
    await armarCarrito([{ product_id: productoConStock(vendedor.id), quantity: 1 }]);
    const arranque = Date.now();
    const lento = await apiRequest('/orders/checkout', {
      method: 'POST', token: state.buyerToken,
      body: sobreDePago([{ seller_id: vendedor.id, method: 'mercadopago' }]),
    });
    const tardanza = Math.round((Date.now() - arranque) / 1000);
    const [colgada] = lento.data.orders;
    assert(colgada.preparation === 'pendiente' && colgada.reason === 'mp_sin_respuesta',
      `con Mercado Pago mudo la orden quedó ${JSON.stringify(colgada)}`);
    // Igual que arriba: queda la intención con su plazo, sin nada de Mercado
    // Pago adentro. Antes no quedaba ninguna, y esa reserva no vencía nunca.
    const [tras_el_corte] = pagosDe(colgada.order_id);
    assert(tras_el_corte, 'el corte de tiempo dejó la reserva sin intención que la venza');
    assert(tras_el_corte[0] === NULO && tras_el_corte[1] === NULO,
      `el corte de tiempo dejó una fila a medias: ${tras_el_corte.join(' | ')}`);
    assert(ordenEnLaBase(colgada.order_id).estado === 'placed',
      'la orden del corte de tiempo no quedó colocada');

    return `cinco pedidos simultáneos devolvieron el mismo link, con 1 preferencia y `
      + `1 pago; la base rechaza un segundo pago para la misma orden; con Mercado Pago `
      + `mudo la API cortó a los ~${tardanza}s y la orden quedó pendiente sin pago`;
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(78, 'La decisión de pago que falta, sobra o es ajena se rechaza antes de escribir', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const otro = await ingresarVendedor('admin@topgreen.com', 'admin123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    await desvincular(otro.token);
    assert((await vincular(vendedor.token, 'ok:900401')).ok === 'vinculado',
      'el vendedor no vinculó');

    const suyo = productoConStock(vendedor.id);
    const delOtro = productoConStock(otro.id);
    await armarCarrito([
      { product_id: suyo, quantity: 1 },
      { product_id: delOtro, quantity: 1 },
    ]);

    const conMP = { seller_id: vendedor.id, method: 'mercadopago' };
    const conTR = { seller_id: otro.id, method: 'transfer' };
    const intentos = [
      ['sin ninguna decisión', [], /falta elegir cómo pagarle/i],
      ['con una sola de dos', [conMP], /falta elegir cómo pagarle/i],
      ['con la misma dos veces', [conMP, conMP], /dos formas de pago para el mismo/i],
      ['con un vendedor que no está en el carrito',
        [conMP, conTR, { seller_id: state.buyerId, method: 'transfer' }],
        /vendedor que no está en el carrito/i],
      ['con Mercado Pago para quien no lo tiene',
        [conMP, { seller_id: otro.id, method: 'mercadopago' }],
        /no puede recibir pagos por ese medio/i],
    ];

    const ordenesAntes = ordenesDe(state.buyerId).length;
    const pagosAntes = queryCount('SELECT COUNT(*) FROM payments');
    const stockAntes = [stockDe(suyo), stockDe(delOtro)];

    // Una forma de pago inventada la frena el esquema, en el borde y con 422:
    // `method` es un literal cerrado, así que no llega a la regla de negocio.
    intentos.push(['con un medio inventado',
      [conMP, { seller_id: otro.id, method: 'efectivo' }], /method/i, 422]);

    for (const [etiqueta, decisiones, esperado, codigo = 400] of intentos) {
      const motivo = await expectApiError(codigo, () => apiRequest('/orders/checkout', {
        method: 'POST', token: state.buyerToken, body: sobreDePago(decisiones),
      }));
      assert(esperado.test(JSON.stringify(motivo)),
        `${etiqueta}: motivo inesperado «${JSON.stringify(motivo)}»`);
      assert(ordenesDe(state.buyerId).length === ordenesAntes,
        `${etiqueta}: se creó una orden igual`);
      assert(queryCount('SELECT COUNT(*) FROM payments') === pagosAntes,
        `${etiqueta}: se creó un pago igual`);
      assert(preferenciasPedidas(doble).length === 0,
        `${etiqueta}: se pidió una preferencia pese al rechazo`);
      assert(stockDe(suyo) === stockAntes[0] && stockDe(delOtro) === stockAntes[1],
        `${etiqueta}: se movió stock`);
      const [[estado]] = queryRows(`SELECT c.status FROM carts c
        WHERE c.user_id = ${sqlLiteral(state.buyerId)} AND c.status = 'ACTIVE'`);
      assert(estado === 'ACTIVE', `${etiqueta}: el carrito quedó en ${estado}`);
    }

    // Y con las dos decisiones que sí corresponden, sale.
    const creado = await apiRequest('/orders/checkout', {
      method: 'POST', token: state.buyerToken, body: sobreDePago([conMP, conTR]),
    });
    assert(creado.data.orders.length === 2, 'con las decisiones correctas no salieron dos órdenes');

    return `seis formas de mandar mal las decisiones —${intentos.length} en total— rechazadas `
      + 'con HTTP 400 y motivo propio: 0 órdenes, 0 pagos, 0 preferencias, stock quieto y '
      + 'carrito activo; con las correctas, dos órdenes';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(79, 'Lo que viaja a Mercado Pago: el importe de la orden, sin comisión ni secretos', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900501')).ok === 'vinculado',
      'el vendedor no vinculó');

    // Un precio que en binario no existe: 3 × 0,10 da 0,30000000000000004.
    const producto = await publicarConPrecio(0.10, 20, 'preferencia de diez centavos');
    await armarCarrito([{ product_id: producto, quantity: 3 }]);

    const creado = await apiRequest('/orders/checkout', {
      method: 'POST', token: state.buyerToken,
      body: sobreDePago([{ seller_id: vendedor.id, method: 'mercadopago' }]),
    });
    const [orden] = creado.data.orders;
    assert(orden.preparation === 'lista', `la orden quedó ${orden.preparation}`);

    const [pedida] = preferenciasPedidas(doble);
    assert(pedida, 'el doble no recibió ninguna preferencia');
    const cuerpo = pedida.cuerpo;

    // 1. El importe es el de la orden, y es exacto. La cuenta se hace en
    //    centavos enteros: sumar 0,1 tres veces en punto flotante da
    //    0,30000000000000004, que es justamente el error que no puede entrar.
    const centavos = cuerpo.items.reduce(
      (total, item) => total + Math.round(item.unit_price * 100) * item.quantity, 0);
    assert(orden.amount === 0.3, `la orden dice ${orden.amount} y no 0.3`);
    assert(centavos === Math.round(orden.amount * 100),
      `a Mercado Pago le llegaron ${centavos} centavos y la orden dice ${orden.amount}`);
    assert(cuerpo.items.length === 1 && cuerpo.items[0].quantity === 3,
      `los ítems viajaron como ${JSON.stringify(cuerpo.items)}`);
    const [pago] = pagosDe(orden.order_id);
    assert(pago[3] === '0.30', `en la base el pago quedó en ${pago[3]}`);
    assert(cuerpo.items.every((item) => item.currency_id === 'ARS'),
      'algún ítem viajó sin moneda o en otra moneda');

    // 2. Nada de comisión. Ni el 5 % que había antes, ni un cero: lo que no se
    //    manda no se discute, y TopGreen no recibe ese dinero.
    assert(!('marketplace_fee' in cuerpo),
      `el cuerpo lleva marketplace_fee = ${JSON.stringify(cuerpo.marketplace_fee)}`);
    assert(!JSON.stringify(cuerpo).includes('marketplace_fee'),
      'marketplace_fee aparece en algún lado del cuerpo');

    // 3. La referencia es nuestra, inequívoca y sin datos de nadie.
    assert(cuerpo.external_reference === `topgreen-${orden.order_number}`,
      `la referencia es «${cuerpo.external_reference}»`);
    assert(!/@|\d{22}/.test(JSON.stringify(cuerpo)),
      'el cuerpo lleva un correo o algo con forma de CBU');

    // 4. Los retornos salen de la configuración, no de un texto pegado, y
    //    llevan la orden para que la pantalla sepa de cuál vuelve. La URL de
    //    aviso no viaja porque no está configurada: mandar una que no atiende
    //    nadie sería pedirle a Mercado Pago que reintente contra el vacío.
    for (const clave of ['success', 'pending', 'failure']) {
      const url = (cuerpo.back_urls || {})[clave];
      assert(url && url.startsWith(FRONTEND_URL),
        `la URL de retorno «${clave}» es ${url} y no sale de la configuración`);
      assert(url.includes(orden.order_number),
        `la URL de retorno «${clave}» no dice de qué orden vuelve: ${url}`);
    }
    assert(!('notification_url' in cuerpo),
      `viajó una URL de aviso sin estar configurada: ${cuerpo.notification_url}`);

    // 5. La clave de idempotencia va en la cabecera y sale de la orden.
    assert(pedida.idempotencia === `topgreen-orden-${orden.order_id}`,
      `la clave de idempotencia es «${pedida.idempotencia}»`);

    // 6. Autoriza el vendedor, con su token, y ese token no vuelve a salir por
    //    ningún lado que no sea la cabecera hacia Mercado Pago.
    assert(pedida.autorizacion.startsWith('Bearer '), 'la preferencia viajó sin autorización');
    assert(pedida.autorizacion.includes('900501'),
      'la preferencia no autoriza con la cuenta del vendedor');
    sinSecretos(JSON.stringify(creado.data), 'la respuesta del checkout');
    sinSecretos(JSON.stringify(cuerpo), 'el cuerpo de la preferencia');
    const [guardado] = pagosDe(orden.order_id);
    sinSecretos(guardado.join(' '), 'la fila de pago');

    // 7. No se guarda el cuerpo crudo de Mercado Pago: lo que no se guarda no
    //    se filtra.
    const columnas = queryCount(`SELECT COUNT(*) FROM information_schema.columns
      WHERE table_name = 'payments'
        AND column_name IN ('mp_response', 'commission_amount', 'commission_percent',
                            'seller_amount')`);
    assert(columnas === 0, `la tabla de pagos sigue con ${columnas} columna(s) de las viejas`);

    // 8. El link vence, y vence cuando dice la base. Sin vigencia oficial el
    //    link vale para siempre y la reserva de stock que lo espera también.
    assert(cuerpo.expires === true, 'la preferencia viajó sin vigencia');
    const [conVigencia] = queryRows(`SELECT expires_at FROM payments
      WHERE order_id = ${sqlLiteral(orden.order_id)}`);
    assert(conVigencia[0], 'la intención de pago quedó sin vencimiento guardado');
    const declarado = Date.parse(cuerpo.expiration_date_to);
    const enLaBase = Date.parse(`${conVigencia[0].replace(' ', 'T')}Z`);
    assert(Number.isFinite(declarado) && Number.isFinite(enLaBase),
      `las fechas no se entienden: ${cuerpo.expiration_date_to} / ${conVigencia[0]}`);
    assert(Math.abs(declarado - enLaBase) < 2000,
      `a Mercado Pago se le declaró ${cuerpo.expiration_date_to} y la base dice ${conVigencia[0]}`);
    assert(Date.parse(cuerpo.expiration_date_from) < declarado,
      'la ventana de vigencia empieza después de terminar');

    // 9. Efectivo y cajero quedan afuera: se acreditan en días, y la reserva
    //    que los espera bloquearía esa venta para todos los demás.
    const excluidos = (cuerpo.payment_methods?.excluded_payment_types || [])
      .map((tipo) => tipo.id).sort();
    assert(excluidos.join(',') === 'atm,ticket',
      `los tipos excluidos son ${JSON.stringify(excluidos)}`);
    assert(!('installments' in (cuerpo.payment_methods || {})),
      'la preferencia decide cuotas, que no es una decisión nuestra');

    // 10. La metadata ata el pago a esta orden por un camino distinto del de
    //     la referencia, y no lleva dato de ninguna persona.
    assert(cuerpo.metadata?.orden_id === orden.order_id
      && cuerpo.metadata?.orden_numero === orden.order_number,
      `la metadata es ${JSON.stringify(cuerpo.metadata)}`);

    return `3 × $0,10 llegó a Mercado Pago como 0.3 exacto y quedó 0.30 en la base; sin `
      + `marketplace_fee; referencia topgreen-${orden.order_number}; clave de idempotencia `
      + 'derivada de la orden; vigencia declarada igual a la guardada; efectivo y cajero '
      + 'excluidos; autoriza el token del vendedor y no hay cuerpo crudo guardado';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

// Con el cobro apagado —que es como sale a producción— Mercado Pago no existe
// para el comprador: no se ofrece, no se acepta si lo piden a mano, no se crea
// ninguna preferencia, y la venta por transferencia sigue funcionando igual.
// Se prueba adentro de la aplicación, con la bandera apagada en su propia
// configuración: levantar otra API sería probar otra cosa.
const MP_COBRO_APAGADO = `
import json
from fastapi.testclient import TestClient

from app.core.config import settings
settings.MP_CHECKOUT_HABILITADO = False

from app.main import app
from app.models.order import Order, OrderStatus
from app.models.payment import Payment
from app.db.base import SessionLocal

datos = json.loads(input())

cliente = TestClient(app, base_url="https://testserver")
# Idem: la cabecera autentica, la cookie queda para lo que la necesite.
cliente.headers["Authorization"] = "Bearer " + cliente.post(
    "/api/auth/login",
    json={"email": "cliente@ejemplo.com", "password": "cliente123"},
).json()["access_token"]

cliente.delete("/api/cart")
cliente.post("/api/cart/sync", json={"items": [
    {"product_id": datos["producto"], "quantity": 1}]})

opciones = cliente.get("/api/orders/payment-options").json()

sobre = {
    "shipping_address": "Ruta 8 km 220",
    "shipping_locality_id": datos["localidad"],
    "shipping_postal_code": "2700",
    "shipping_decisions": [{"seller_id": datos["vendedor"], "mode": "self"}],
}

a_mano = cliente.post("/api/orders/checkout", json={
    **sobre,
    "payment_decisions": [{"seller_id": datos["vendedor"], "method": "mercadopago"}],
})

por_transferencia = cliente.post("/api/orders/checkout", json={
    **sobre,
    "payment_decisions": [{"seller_id": datos["vendedor"], "method": "transfer"}],
})
creadas = por_transferencia.json().get("orders", []) if por_transferencia.status_code == 200 else []

# Y el reintento del link tampoco puede encender nada.
sesion = SessionLocal()
try:
    orden = sesion.query(Order).filter(
        Order.id == creadas[0]["order_id"]).first() if creadas else None
    if orden is not None:
        # Se fabrica el peor caso: una orden que SÍ se podría pagar por Mercado
        # Pago -colocada y con ese medio-, para que lo único que pueda frenar
        # el link sea la bandera.
        orden.payment_method = "mercadopago"
        orden.status = OrderStatus.PLACED
        sesion.commit()
        enlace = cliente.post(f"/api/orders/{orden.id}/payment-link")
        reintento = {"status": enlace.status_code, "cuerpo": enlace.json()}
        pagos = sesion.query(Payment).filter(Payment.order_id == orden.id).count()
    else:
        reintento, pagos = None, -1
finally:
    sesion.close()

print("RESULTADO " + json.dumps({
    "opciones": opciones,
    "a_mano": {"status": a_mano.status_code, "detalle": str(a_mano.json().get("detail", ""))},
    "transferencia": {
        "status": por_transferencia.status_code,
        "ordenes": [
            {"medio": o["payment_method"], "preparacion": o["preparation"],
             "link": o.get("payment_url"), "cbu": bool(o.get("cbu") or o.get("alias_bancario")),
             "order_id": o["order_id"]}
            for o in creadas
        ],
    },
    "reintento": reintento,
    "pagos": pagos,
}))
`;

await runCase(80, 'Con el cobro apagado no hay Mercado Pago en ningún lado y la transferencia sigue', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    // El vendedor está vinculado y con datos bancarios: lo único que decide
    // que Mercado Pago no se ofrezca es la bandera.
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900601')).ok === 'vinculado',
      'el vendedor no vinculó');
    const conectado = await estadoDelVinculo(vendedor.token);
    assert(conectado.estado === 'conectado', `el vendedor quedó ${conectado.estado}`);

    const producto = productoConStock(vendedor.id, 1);
    const observado = leerResultado(await correrEnLaApiSinBloquear(
      MP_COBRO_APAGADO,
      JSON.stringify({
        producto, vendedor: vendedor.id, localidad: localidadDeEnvio(),
      }),
    ));

    // 1. No se ofrece.
    const [opcion] = observado.opciones;
    assert(opcion, 'payment-options no devolvió el grupo del vendedor');
    assert(!opcion.methods.includes('mercadopago'),
      `con la bandera apagada se ofrece ${JSON.stringify(opcion.methods)}`);
    assert(opcion.methods.includes('transfer'),
      'apagar el cobro se llevó puesta la transferencia');

    // 2. No se acepta aunque lo pidan a mano.
    assert(observado.a_mano.status === 400,
      `pedir Mercado Pago a mano devolvió ${observado.a_mano.status}`);
    assert(/no puede recibir pagos por ese medio/i.test(observado.a_mano.detalle),
      `motivo inesperado: «${observado.a_mano.detalle}»`);

    // 3. La transferencia sigue entera.
    assert(observado.transferencia.status === 200
      && observado.transferencia.ordenes.length === 1,
      `el checkout por transferencia devolvió ${observado.transferencia.status}`);
    const [creada] = observado.transferencia.ordenes;
    assert(creada.medio === 'transfer' && creada.preparacion === 'lista' && creada.cbu,
      `la orden por transferencia quedó ${JSON.stringify(creada)}`);
    assert(!creada.link, 'la orden por transferencia trae link de Mercado Pago');

    // 4. Ni el reintento del link enciende nada: la orden queda pendiente con
    //    el motivo, y no hay pago.
    assert(observado.reintento && observado.reintento.status === 200,
      `el reintento devolvió ${JSON.stringify(observado.reintento)}`);
    assert(observado.reintento.cuerpo.preparation === 'pendiente'
      && observado.reintento.cuerpo.reason === 'deshabilitado',
      `el reintento devolvió ${JSON.stringify(observado.reintento.cuerpo)}`);
    assert(observado.pagos === 0, `quedaron ${observado.pagos} pagos con el cobro apagado`);

    // 5. Y el doble no vio pasar nada en todo el caso.
    assert(preferenciasPedidas(doble).length === 0,
      `el doble recibió ${preferenciasPedidas(doble).length} preferencias con el cobro apagado`);

    return 'con MP_CHECKOUT_HABILITADO en false: el medio no se ofrece, pedirlo a mano da '
      + '400, el reintento del link responde «deshabilitado», 0 preferencias y 0 pagos; '
      + 'la orden por transferencia se crea igual y con sus datos bancarios';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(81, 'La pantalla cobra por grupo, arma la cola de órdenes y no declara pagado', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const otro = await ingresarVendedor('admin@topgreen.com', 'admin123');
  const browser = await chromium.launch({ headless: true });
  try {
    await comprador();
    await desvincular(vendedor.token);
    await desvincular(otro.token);
    assert((await vincular(vendedor.token, 'ok:900701')).ok === 'vinculado',
      'el vendedor no vinculó');

    // La publicación más vieja de cada vendedor, que es una del seed: los
    // casos anteriores dejan publicaciones de prueba y este caso mide la
    // pantalla de pago, no el catálogo.
    const publicacion = (dueno) => {
      const [fila] = queryRows(`
        SELECT id, name FROM products
        WHERE seller_id = ${sqlLiteral(dueno)} AND status = 'ACTIVE'
          AND publication_type <> 'servicio' AND stock >= 1
        ORDER BY created_at, id
        LIMIT 1
      `);
      assert(fila, `el vendedor ${dueno} no tiene publicación activa`);
      return { id: fila[0], nombre: fila[1] };
    };
    const conMP = publicacion(vendedor.id);
    const conTR = publicacion(otro.id);
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    const ordenesAntes = ordenesDe(state.buyerId).length;

    const context = await browser.newContext();
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
        window.localStorage.removeItem('agromarket_cart');
      },
      { a: state.buyerToken, r: state.buyerRefreshToken },
    );
    const page = await context.newPage();
    const errores = [];
    page.on('pageerror', (error) => errores.push(String(error)));

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    for (const item of [conMP, conTR]) {
      const buscador = page.getByLabel('Buscar en el mercado');
      await buscador.fill(item.nombre);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: item.nombre, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await accionDeLaTarjeta(page, item.nombre).click();
    }

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0808');
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');
    await elegirDestino(page, 'Pergamino');
    await resolverTrasladoPropio(page);
    await page.locator('form:has(h2) button[type="submit"]').click();

    // --- lo que la pantalla dice ANTES de confirmar
    await page.getByRole('heading', { name: /Medio de pago/i }).waitFor({ timeout: 20_000 });
    const aviso = page.locator('[class*="_avisoMultiple_"]');
    await aviso.waitFor({ state: 'visible', timeout: 15_000 });
    const textoDelAviso = (await aviso.textContent()) || '';
    assert(/2 órdenes separadas/i.test(textoDelAviso) && /por separado/i.test(textoDelAviso),
      `el aviso del carrito multivendedor dice: «${textoDelAviso.trim()}»`);

    const grupos = page.locator('fieldset[class*="_grupoDePago_"]');
    assert(await grupos.count() === 2, `la pantalla armó ${await grupos.count()} grupos`);
    const grupoMP = grupos.filter({ hasText: nombreDeUsuario(vendedor.id) });
    const grupoTR = grupos.filter({ hasText: nombreDeUsuario(otro.id) });
    assert(await grupoMP.locator('input[value="mercadopago"]').count() === 1,
      'el vendedor vinculado no ofrece Mercado Pago en la pantalla');
    assert(await grupoTR.locator('input[value="mercadopago"]').count() === 0,
      'la pantalla ofrece Mercado Pago para un vendedor sin vínculo');

    // Sin elegir el medio del grupo que tiene dos, no avanza.
    await page.getByRole('button', { name: /Confirmar y crear las órdenes/ }).click();
    await page.locator('[role="alert"]').first().waitFor({ state: 'visible', timeout: 10_000 });
    assert(ordenesDe(state.buyerId).length === ordenesAntes,
      'confirmó sin que el comprador eligiera el medio de un grupo');

    await grupoMP.locator('input[value="mercadopago"]').check();
    await grupoTR.locator('input[value="transfer"]').check();
    await page.getByRole('button', { name: /Confirmar y crear las órdenes/ }).click();

    // --- la cola de órdenes
    await page.getByRole('heading', { name: /Tus órdenes/ }).waitFor({ timeout: 25_000 });
    const nuevas = ordenesDe(state.buyerId).slice(ordenesAntes);
    assert(nuevas.length === 2, `se crearon ${nuevas.length} órdenes`);
    const [ordenMP] = nuevas.filter(([id]) => ordenEnLaBase(id).medio === 'mercadopago');
    const [ordenTR] = nuevas.filter(([id]) => ordenEnLaBase(id).medio === 'transfer');
    assert(ordenMP && ordenTR, 'no salió una orden de cada medio');

    const enlace = page.locator('a[class*="_pagarMP_"]');
    await enlace.waitFor({ state: 'visible', timeout: 15_000 });
    const destino = await enlace.getAttribute('href');
    const [pagoMP] = pagosDe(ordenMP[0]);
    assert(destino === pagoMP[1], `el link de la pantalla es ${destino} y el guardado ${pagoMP[1]}`);
    assert(await enlace.getAttribute('target') === '_blank',
      'el link de pago no abre en otra pestaña');
    assert(preferenciasPedidas(doble).length === 1,
      `el doble recibió ${preferenciasPedidas(doble).length} preferencias`);

    const texto = (await page.locator('[class*="_confirmation_"]').textContent()) || '';
    assert(!/\bpagad[oa]\b/i.test(texto), `la pantalla dice pagado: «${texto.slice(0, 200)}»`);
    assert(/pendiente de confirmación/i.test(texto),
      'la pantalla no dice que el pago está pendiente de confirmación');
    assert(/no confirma el pago/i.test(texto),
      'la pantalla no aclara que volver de Mercado Pago no confirma nada');
    const numeroTR = queryRows(
      `SELECT order_number FROM orders WHERE id = ${sqlLiteral(ordenTR[0])}`)[0][0];
    assert(texto.includes(numeroTR),
      'la cola no muestra la orden por transferencia con su referencia');

    // --- volver de Mercado Pago no cambia nada
    const antes = [ordenEnLaBase(ordenMP[0]).estado, pagosDe(ordenMP[0])[0][4]];
    const numeroMP = queryRows(
      `SELECT order_number FROM orders WHERE id = ${sqlLiteral(ordenMP[0])}`)[0][0];
    const vuelta = await context.newPage();
    await vuelta.goto(`${FRONTEND_URL}/?orden=${numeroMP}&status=approved&payment_id=1`,
      { waitUntil: 'domcontentloaded' });
    await vuelta.waitForTimeout(1500);
    const textoDeLaVuelta = (await vuelta.locator('body').textContent()) || '';
    assert(!/\bpagad[oa]\b/i.test(textoDeLaVuelta),
      'volver de Mercado Pago deja la palabra «pagado» en pantalla');
    const despues = [ordenEnLaBase(ordenMP[0]).estado, pagosDe(ordenMP[0])[0][4]];
    assert(antes[0] === despues[0] && antes[1] === despues[1],
      `volver cambió el estado: ${antes} → ${despues}`);
    assert(pagosDe(ordenMP[0]).length === 1, 'volver creó otra fila de pago');
    assert(errores.length === 0, `errores JS: ${errores.join(' | ')}`);

    return `dos grupos en pantalla con sus medios (uno con Mercado Pago y otro sin), `
      + `aviso de dos órdenes separadas antes de confirmar, una sola preferencia, cola `
      + `con el link del doble y la orden por transferencia; volver a la URL de retorno `
      + `dejó la orden en ${despues[0]} y el pago en ${despues[1]}`;
  } finally {
    await doble.cerrar();
    await browser.close();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

// Dos confirmaciones que llegan juntas. La ventana no se abre desde el
// navegador —ahí el botón se deshabilita— sino entre dos trabajadores de la
// API: los dos leen el mismo carrito activo y los dos creen que les toca.
// Acá se fuerza esa superposición reteniendo a la primera justo antes de
// escribir, que es exactamente donde la carrera existe.
const MP_DOS_CONFIRMACIONES = `
import json, threading

from fastapi.testclient import TestClient

from app.main import app
from app.api import orders as rutas
from app.db.base import SessionLocal
from app.models.cart import Cart, CartStatus
from app.models.order import Order
from app.models.payment import Payment

datos = json.loads(input())

original = rutas.crear_ordenes
llego_la_primera = threading.Event()
puede_seguir = threading.Event()
candado = threading.Lock()
turno = {"primera": True}


def retenida(*args, **kwargs):
    with candado:
        soy_la_primera = turno["primera"]
        turno["primera"] = False
    if soy_la_primera:
        llego_la_primera.set()
        puede_seguir.wait(30)
    return original(*args, **kwargs)


rutas.crear_ordenes = retenida


def sesion():
    cliente = TestClient(app, base_url="https://testserver")
    cliente.headers["Authorization"] = "Bearer " + cliente.post(
        "/api/auth/login",
        json={"email": "cliente@ejemplo.com", "password": "cliente123"},
    ).json()["access_token"]
    return cliente


sobre = {
    "shipping_address": "Ruta 8 km 220",
    "shipping_locality_id": datos["localidad"],
    "shipping_postal_code": "2700",
    "shipping_decisions": [{"seller_id": datos["vendedor"], "mode": "self"}],
    "payment_decisions": [{"seller_id": datos["vendedor"], "method": "mercadopago"}],
}

respuestas = {}


def confirmar(nombre, cliente):
    try:
        r = cliente.post("/api/orders/checkout", json=sobre)
        respuestas[nombre] = {"status": r.status_code, "cuerpo": r.json()}
    except Exception as error:  # noqa: BLE001
        respuestas[nombre] = {"status": -1, "cuerpo": {"error": type(error).__name__}}


def contar():
    consulta = SessionLocal()
    try:
        return (
            consulta.query(Order).filter(Order.buyer_id == datos["comprador"]).count(),
            consulta.query(Payment).count(),
            consulta.query(Cart).filter(
                Cart.user_id == datos["comprador"],
                Cart.status == CartStatus.ACTIVE).count(),
        )
    finally:
        consulta.close()


antes = contar()

primera = threading.Thread(target=confirmar, args=("primera", sesion()))
primera.start()
llego_la_primera.wait(30)

segunda = threading.Thread(target=confirmar, args=("segunda", sesion()))
segunda.start()
segunda.join(60)

puede_seguir.set()
primera.join(60)

despues = contar()

print("RESULTADO " + json.dumps({
    "primera": respuestas.get("primera"),
    "segunda": respuestas.get("segunda"),
    "ordenes": [antes[0], despues[0]],
    "pagos": [antes[1], despues[1]],
    "carritos_activos": despues[2],
}))
`;

await runCase(82, 'Dos confirmaciones simultáneas crean una sola compra', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900901')).ok === 'vinculado',
      'el vendedor no vinculó');

    const producto = productoConStock(vendedor.id, 1);
    await armarCarrito([{ product_id: producto, quantity: 1 }]);
    const stockAntes = stockDe(producto);

    const observado = leerResultado(await correrEnLaApiSinBloquear(
      MP_DOS_CONFIRMACIONES,
      JSON.stringify({
        vendedor: vendedor.id, comprador: state.buyerId, localidad: localidadDeEnvio(),
      }),
    ));

    const estados = [observado.primera.status, observado.segunda.status].sort();
    assert(estados[0] === 200 && estados[1] === 409,
      `las dos confirmaciones devolvieron ${JSON.stringify(estados)}`);

    // La que gana crea su orden; la que pierde no escribe nada y lo dice.
    const ganadora = observado.primera.status === 200 ? observado.primera : observado.segunda;
    const perdedora = observado.primera.status === 409 ? observado.primera : observado.segunda;
    assert(ganadora.cuerpo.orders.length === 1,
      `la ganadora creó ${ganadora.cuerpo.orders.length} órdenes`);
    assert(/ya se confirmó/i.test(String(perdedora.cuerpo.detail)),
      `el motivo de la perdedora es «${perdedora.cuerpo.detail}»`);

    const [ordenesAntes, ordenesDespues] = observado.ordenes;
    assert(ordenesDespues === ordenesAntes + 1,
      `se crearon ${ordenesDespues - ordenesAntes} órdenes en vez de una`);
    const [pagosAntes, pagosDespues] = observado.pagos;
    assert(pagosDespues === pagosAntes + 1,
      `se crearon ${pagosDespues - pagosAntes} pagos en vez de uno`);
    assert(preferenciasPedidas(doble).length === 1,
      `el doble recibió ${preferenciasPedidas(doble).length} preferencias`);
    assert(observado.carritos_activos === 0,
      `quedaron ${observado.carritos_activos} carritos activos`);
    assert(stockDe(producto) === stockAntes, 'se movió stock');

    return 'con las dos confirmaciones superpuestas: una crea la compra y la otra '
      + 'recibe 409 con motivo; 1 orden, 1 pago, 1 preferencia, 0 carritos activos '
      + 'y stock quieto';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(83, 'Una orden cancelada o rechazada no ofrece ni crea link de pago', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900902')).ok === 'vinculado',
      'el vendedor no vinculó');

    // Dos órdenes iguales: una la cancela el comprador y la otra la rechaza
    // el vendedor. Las dos son terminales y ninguna se puede pagar más.
    const creadas = [];
    for (const quien of ['comprador', 'vendedor']) {
      await armarCarrito([{ product_id: productoConStock(vendedor.id, 1), quantity: 1 }]);
      const respuesta = await apiRequest('/orders/checkout', {
        method: 'POST', token: state.buyerToken,
        body: sobreDePago([{ seller_id: vendedor.id, method: 'mercadopago' }]),
      });
      const [orden] = respuesta.data.orders;
      assert(orden.preparation === 'lista', `la orden de ${quien} quedó ${orden.preparation}`);
      creadas.push({ quien, orden });
    }

    // Antes de terminarlas, el comprador las ve pagables en «Mis compras».
    const antes = (await apiRequest('/orders/my?as_role=buyer', { token: state.buyerToken })).data;
    for (const { quien, orden } of creadas) {
      const vista = antes.find((o) => o.order_number === orden.order_number);
      assert(vista.can_pay === true && vista.payment_url,
        `antes de terminarla, la de ${quien} no se podía pagar`);
    }

    await apiRequest(`/orders/${creadas[0].orden.order_id}/cancel`, {
      method: 'POST', token: state.buyerToken, body: { reason: 'me arrepentí' },
    });
    await apiRequest(`/orders/${creadas[1].orden.order_id}/cancel`, {
      method: 'POST', token: vendedor.token, body: { reason: 'no tengo stock' },
    });

    const preferenciasDelAlta = preferenciasPedidas(doble).length;
    const despues = (await apiRequest('/orders/my?as_role=buyer', { token: state.buyerToken })).data;

    for (const { quien, orden } of creadas) {
      const enLaBase = ordenEnLaBase(orden.order_id);
      assert(['cancelled', 'rejected'].includes(enLaBase.estado),
        `la de ${quien} quedó en ${enLaBase.estado}`);

      // La intención local deja de decir «pendiente» sobre algo que ya no se
      // va a cobrar.
      const [pago] = pagosDe(orden.order_id);
      assert(pago && pago[4] === 'CANCELLED',
        `la intención local de la de ${quien} quedó en ${pago && pago[4]}`);

      // Ni la API la ofrece...
      const vista = despues.find((o) => o.order_number === orden.order_number);
      assert(vista.can_pay === false && !vista.payment_url,
        `la de ${quien} sigue ofreciendo pago: ${JSON.stringify(vista.payment_url)}`);

      // ...ni la deja pedir a mano.
      const negado = await expectApiError(409, () =>
        apiRequest(`/orders/${orden.order_id}/payment-link`, {
          method: 'POST', token: state.buyerToken, body: {},
        }));
      assert(/ya no se puede pagar/i.test(negado), `motivo inesperado: «${negado}»`);
    }

    assert(preferenciasPedidas(doble).length === preferenciasDelAlta,
      'se pidió una preferencia para una orden terminal');
    assert(queryCount(`SELECT COUNT(*) FROM payments WHERE order_id IN (
      ${creadas.map(({ orden }) => sqlLiteral(orden.order_id)).join(', ')})`) === 2,
      'el rechazo creó o borró filas de pago');

    return 'cancelada por el comprador y rechazada por el vendedor: las dos quedan con '
      + 'la intención local anulada, sin oferta de pago en «Mis compras» y con 409 al '
      + 'pedir el link a mano; 0 preferencias nuevas';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(84, 'El pago que quedó a medias se retoma desde Mis compras, en escritorio y en celular', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const otro = await ingresarVendedor('admin@topgreen.com', 'admin123');
  const browser = await chromium.launch({ headless: true });
  const recorridos = [];
  try {
    await comprador();
    await desvincular(vendedor.token);
    await desvincular(otro.token);
    assert((await vincular(vendedor.token, 'ok:900903')).ok === 'vinculado',
      'el vendedor no vinculó');

    const abrirCompras = async (page) => {
      await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
      await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor({ timeout: 15_000 });
      await page.getByRole('button', { name: /Mis Compras/i }).click();
      await page.getByRole('heading', { name: 'Mis Compras' }).waitFor({ timeout: 15_000 });
    };
    const tarjetaDe = (page, numero) => page.locator('[class*="_orderCard_"]')
      .filter({ hasText: numero });

    for (const [nombre, viewport] of [
      ['escritorio', { width: 1280, height: 900 }],
      ['celular', { width: 390, height: 844 }],
    ]) {
      // Una compra por Mercado Pago y otra por transferencia, para que la
      // acción aparezca en una sola.
      await armarCarrito([
        { product_id: productoConStock(vendedor.id, 1), quantity: 1 },
        { product_id: productoConStock(otro.id, 1), quantity: 1 },
      ]);
      const creado = await apiRequest('/orders/checkout', {
        method: 'POST', token: state.buyerToken,
        body: sobreDePago([
          { seller_id: vendedor.id, method: 'mercadopago' },
          { seller_id: otro.id, method: 'transfer' },
        ]),
      });
      const conMP = creado.data.orders.find((o) => o.payment_method === 'mercadopago');
      const conTR = creado.data.orders.find((o) => o.payment_method === 'transfer');
      assert(conMP && conTR, 'no salió una orden de cada medio');

      const context = await browser.newContext({ viewport });
      await context.addInitScript(
        ({ a, r }) => {
          window.localStorage.setItem('access_token', a);
          window.localStorage.setItem('refresh_token', r);
        },
        { a: state.buyerToken, r: state.buyerRefreshToken },
      );
      const page = await context.newPage();
      const errores = [];
      page.on('pageerror', (error) => errores.push(String(error)));

      try {
        await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
        await abrirCompras(page);

        const laDeMP = tarjetaDe(page, conMP.order_number);
        const laDeTransferencia = tarjetaDe(page, conTR.order_number);
        const continuar = laDeMP.getByRole('button', { name: /Continuar pago|Preparar pago/ });
        await continuar.waitFor({ state: 'visible', timeout: 20_000 });
        assert(await laDeTransferencia
          .getByRole('button', { name: /Continuar pago|Preparar pago/ }).count() === 0,
          `${nombre}: la orden por transferencia ofrece continuar el pago`);

        // El link que abre es el que guardó el servidor, no uno inventado.
        // Mercado Pago no existe en esta prueba: se corta la navegación y se
        // mira a dónde iba, así se afirma el destino sin salir a internet.
        let destino = '';
        await context.route('https://www.mercadopago.com.ar/**', async (ruta) => {
          destino = ruta.request().url();
          await ruta.fulfill({
            status: 200, contentType: 'text/html', body: '<p>Mercado Pago no viene a esta prueba</p>',
          });
        });
        const [pestaña] = await Promise.all([
          context.waitForEvent('page', { timeout: 20_000 }),
          continuar.click(),
        ]);
        await pestaña.waitForLoadState('domcontentloaded').catch(() => {});
        const [pago] = pagosDe(conMP.order_id);
        assert(destino === pago[1],
          `${nombre}: iba a ${destino} y el guardado es ${pago[1]}`);
        await pestaña.close();

        // Recargar conserva la salida: no depende de nada que viva sólo en
        // esta pantalla.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await abrirCompras(page);
        await tarjetaDe(page, conMP.order_number)
          .getByRole('button', { name: /Continuar pago/ })
          .waitFor({ state: 'visible', timeout: 20_000 });

        // Y cuando la orden termina, la acción desaparece.
        await apiRequest(`/orders/${conMP.order_id}/cancel`, {
          method: 'POST', token: state.buyerToken, body: { reason: 'prueba' },
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await abrirCompras(page);
        await tarjetaDe(page, conMP.order_number).waitFor({ state: 'visible', timeout: 20_000 });
        assert(await tarjetaDe(page, conMP.order_number)
          .getByRole('button', { name: /Continuar pago|Preparar pago/ }).count() === 0,
          `${nombre}: la orden cancelada sigue ofreciendo pagar`);

        assert(errores.length === 0, `${nombre}: errores JS ${errores.join(' | ')}`);
        recorridos.push(`${nombre}: ${conMP.order_number} con acción, ${conTR.order_number} sin`);
      } finally {
        await context.close();
      }
    }

    // El vendedor no ve la acción de pagar en ninguna de sus ventas: pagar no
    // es suyo, y el link tampoco.
    const ventas = (await apiRequest('/orders/my?as_role=seller',
      { token: vendedor.token })).data;
    assert(ventas.every((o) => o.can_pay === false && !o.payment_url),
      'alguna venta le entrega al vendedor el link de pago del comprador');

    return `${recorridos.join('; ')}; recargar conserva la acción, cancelar la saca, y el `
      + 'vendedor nunca recibe el link';
  } finally {
    await doble.cerrar();
    await browser.close();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(85, 'Rechazar o cancelar por el cambio de estado también cierra la orden', async () => {
  // La otra puerta a un estado terminal es `PATCH /orders/{id}/status`, y no
  // la miraba nadie: el caso 83 entra por `POST /cancel`. Por esta ruta la
  // cancelación moría en un 500 antes de escribir el motivo.
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900905')).ok === 'vinculado',
      'el vendedor no vinculó');

    const salidas = [
      ['el vendedor rechaza', 'rejected', () => vendedor.token, 'no tengo stock'],
      ['el comprador cancela', 'cancelled', () => state.buyerToken, 'me arrepentí'],
    ];
    const observado = [];

    for (const [etiqueta, destino, tokenDe, motivo] of salidas) {
      const producto = productoConStock(vendedor.id, 1);
      await armarCarrito([{ product_id: producto, quantity: 1 }]);
      const creado = await apiRequest('/orders/checkout', {
        method: 'POST', token: state.buyerToken,
        body: sobreDePago([{ seller_id: vendedor.id, method: 'mercadopago' }]),
      });
      const [orden] = creado.data.orders;
      assert(orden.preparation === 'lista', `${etiqueta}: la orden quedó ${orden.preparation}`);
      assert(pagosDe(orden.order_id).length === 1, `${etiqueta}: no hay intención de pago`);

      const stockAntes = stockDe(producto);
      const preferenciasAntes = preferenciasPedidas(doble).length;

      // Lo primero es que no sea un 500: el motivo del PATCH se escribía
      // después del error, así que ni el estado ni la razón llegaban a la base.
      const cambio = await apiRequest(`/orders/${orden.order_id}/status`, {
        method: 'PATCH', token: tokenDe(), body: { status: destino, reason: motivo },
      });
      assert(cambio.status === 200, `${etiqueta}: el PATCH devolvió ${cambio.status}`);
      assert(cambio.data.new_status === destino,
        `${etiqueta}: la respuesta dice ${cambio.data.new_status}`);

      // El estado quedó escrito, con su motivo.
      const enLaBase = ordenEnLaBase(orden.order_id);
      assert(enLaBase.estado === destino, `${etiqueta}: en la base quedó ${enLaBase.estado}`);
      const [[razon]] = queryRows(`SELECT coalesce(cancellation_reason, '${NULO}')
        FROM orders WHERE id = ${sqlLiteral(orden.order_id)}`);
      assert(razon === motivo, `${etiqueta}: el motivo guardado es «${razon}»`);

      // La intención local se anula por esta ruta igual que por la otra.
      const [pago] = pagosDe(orden.order_id);
      assert(pago && pago[4] === 'CANCELLED',
        `${etiqueta}: la intención local quedó en ${pago && pago[4]}`);

      // El stock que corresponde restaurar es ninguno: a terminal se entra
      // desde «colocada», y colocar no descuenta stock. Si alguna vez se
      // descontara antes, este número tendría que subir y este caso lo vería.
      assert(stockDe(producto) === stockAntes,
        `${etiqueta}: el stock pasó de ${stockAntes} a ${stockDe(producto)}`);

      // Y la orden terminal no vuelve a ofrecer ni a crear pago.
      const negado = await expectApiError(409, () =>
        apiRequest(`/orders/${orden.order_id}/payment-link`, {
          method: 'POST', token: state.buyerToken, body: {},
        }));
      assert(/ya no se puede pagar/i.test(negado), `${etiqueta}: motivo inesperado «${negado}»`);
      assert(preferenciasPedidas(doble).length === preferenciasAntes,
        `${etiqueta}: se pidió una preferencia después de terminar la orden`);

      const compras = (await apiRequest('/orders/my?as_role=buyer',
        { token: state.buyerToken })).data;
      const vista = compras.find((o) => o.order_number === orden.order_number);
      assert(vista.can_pay === false && !vista.payment_url,
        `${etiqueta}: «Mis compras» sigue ofreciendo pagarla`);

      observado.push(`${etiqueta} → ${destino}, stock ${stockAntes}`);
    }

    return `${observado.join('; ')}; por el PATCH de estado las dos salidas responden 200, `
      + 'escriben estado y motivo, anulan la intención local, no mueven stock y dejan la '
      + 'orden sin puerta de pago';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(86, 'Sin firma válida el webhook no mira nada', async () => {
  // El webhook es una URL pública. Lo único que separa un aviso de Mercado
  // Pago de uno inventado es la firma, así que lo que se comprueba acá es que
  // un aviso mal firmado no consulte cuentas ajenas ni toque una fila.
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900601')).ok === 'vinculado',
      'el vendedor no vinculó');

    const orden = await ordenMercadoPago(vendedor);
    const pago = doble.crearPago({
      referencia: `topgreen-${orden.order_number}`,
      preferencia: orden.preferencia,
      cuenta: '900601',
      monto: orden.amount,
      ordenId: orden.order_id,
      ordenNumero: orden.order_number,
      estado: 'approved',
    });

    const consultasAntes = doble.pedidos.filter((p) => p.ruta === 'consultar').length;
    const stockAntes = stockDe(orden.producto);
    const reservadoAntes = reservadoDe(orden.producto);
    const buena = firmaDeAviso(SECRETO_DEL_WEBHOOK, {
      dataId: pago.id, requestId: 'pedido-de-prueba', ts: Math.floor(Date.now() / 1000),
    });

    const rechazos = [
      ['sin firma', { firma: null }],
      ['firma de otro secreto', { secreto: 'no-es-el-secreto' }],
      ['firma alterada', { firma: `${buena.slice(0, -1)}${buena.endsWith('a') ? 'b' : 'a'}` }],
      ['firma mal formada', { firma: 'v1=lo-que-sea' }],
      ['firma vencida', { ts: Math.floor(Date.now() / 1000) - 4000 }],
      ['firma del futuro', { ts: Math.floor(Date.now() / 1000) + 4000 }],
      // Firmado sobre un identificador y mandado con otro: la firma ata el
      // aviso a **ese** pago y no a cualquiera.
      ['data.id cambiado', { idEnLaUrl: '999999999' }],
    ];

    const vistos = [];
    for (const [etiqueta, opciones] of rechazos) {
      const salida = await avisar({ dataId: pago.id, cuenta: '900601', ...opciones });
      assert(salida.status === 401,
        `${etiqueta}: el webhook respondió ${salida.status} en vez de 401`);
      vistos.push(`${etiqueta}→${salida.resultado}`);
    }

    // Ninguno de esos avisos preguntó nada, ni movió nada.
    assert(doble.pedidos.filter((p) => p.ruta === 'consultar').length === consultasAntes,
      'un aviso sin firma válida llegó a consultar la cuenta del vendedor');
    assert(ordenEnLaBase(orden.order_id).estado === 'placed',
      'un aviso sin firma válida movió el estado de la orden');
    assert(intentosDe(orden.order_id).length === 0,
      'un aviso sin firma válida dejó un intento de pago escrito');
    assert(stockDe(orden.producto) === stockAntes
      && reservadoDe(orden.producto) === reservadoAntes,
      'un aviso sin firma válida movió el stock');

    // Y el mismo aviso, bien firmado, sí.
    const bueno = await avisar({ dataId: pago.id, cuenta: '900601' });
    assert(bueno.status === 200 && bueno.resultado === 'aplicado',
      `el aviso firmado devolvió ${bueno.status} ${bueno.resultado}`);
    assert(ordenEnLaBase(orden.order_id).estado === 'paid',
      'el aviso firmado y aprobado no dejó la orden pagada');
    assert(doble.pedidos.filter((p) => p.ruta === 'consultar').length > consultasAntes,
      'el aviso firmado no consultó el pago en Mercado Pago');

    // Y una última puerta, que es de configuración: una URL de aviso con
    // parámetros hace que Mercado Pago mande IPN sin firma. Si eso se pudiera
    // configurar, todo lo de arriba sería decorativo.
    const plantilla = readFileSync('backend/.env.example', 'utf8')
      .replace(/^MP_NOTIFICACION_URL=.*$/m,
        'MP_NOTIFICACION_URL=https://topgreen.test/api/mp/webhook?x=1')
      .replace(/\b(?:CAMBIAR|GENERAR)_[A-Z0-9_]+/g, 'valor_de_prueba_de_mas_de_32_caracteres');
    const rechazo = cargarConSettings(plantilla);
    assert(!rechazo.trim().endsWith('CARGA_OK'),
      'Settings aceptó una URL de aviso con parámetros: el webhook se degrada a IPN sin firma');
    assert(/MP_NOTIFICACION_URL/.test(rechazo),
      `el rechazo no dice qué clave está mal: ${rechazo.slice(-300)}`);

    return `${vistos.length} avisos mal firmados devolvieron 401 sin consultar ni escribir `
      + `(${vistos.join(', ')}); el mismo aviso bien firmado dejó la orden pagada; y una URL `
      + 'de aviso con parámetros no arranca';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(87, 'Firmado pero ajeno: cobrador, referencia, importe o moneda que no cierran', async () => {
  // La firma dice que el aviso viene de Mercado Pago. No dice que el pago sea
  // de esta orden. Acá se comprueba lo segundo, que es lo que separa un cobro
  // de una declaración.
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const otro = await ingresarVendedor('admin@topgreen.com', 'admin123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    await desvincular(otro.token);
    assert((await vincular(vendedor.token, 'ok:900602')).ok === 'vinculado',
      'el vendedor no vinculó');
    assert((await vincular(otro.token, 'ok:900603')).ok === 'vinculado',
      'el otro vendedor no vinculó');

    // Una orden de cada vendedor: la del segundo sirve para cruzar referencias.
    const orden = await ordenMercadoPago(vendedor);
    const ajena = await ordenMercadoPago(otro);

    const propio = {
      referencia: `topgreen-${orden.order_number}`,
      preferencia: orden.preferencia,
      cuenta: '900602',
      monto: orden.amount,
      ordenId: orden.order_id,
      ordenNumero: orden.order_number,
      estado: 'approved',
    };

    const cruces = [
      ['cobra otra cuenta', { ...propio, cuenta: '900999' }, 'cobrador_ajeno'],
      ['referencia que no existe', { ...propio, referencia: 'topgreen-ORD-INVENTADA' },
        'referencia_desconocida'],
      ['referencia de otro vendedor',
        { ...propio, referencia: `topgreen-${ajena.order_number}`, ordenId: ajena.order_id },
        'vendedor_ajeno'],
      ['preferencia de otra compra', { ...propio, preferencia: 'pref-de-otra-compra' },
        'preferencia_ajena'],
      ['metadata de otra orden', { ...propio, ordenId: ajena.order_id }, 'orden_ajena'],
      ['importe alterado', { ...propio, monto: Number(orden.amount) + 1 }, 'importe_distinto'],
      ['moneda alterada', { ...propio, moneda: 'USD' }, 'moneda_distinta'],
    ];

    const estadoAntes = ordenEnLaBase(orden.order_id).estado;
    const stockAntes = stockDe(orden.producto);
    const reservadoAntes = reservadoDe(orden.producto);
    const ventasAntes = ventasDe(orden.producto);
    const vistos = [];

    for (const [etiqueta, datos, esperado] of cruces) {
      const pago = doble.crearPago(datos);
      const salida = await avisar({ dataId: pago.id, cuenta: '900602' });
      // 200 a propósito: el aviso quedó resuelto y Mercado Pago no tiene que
      // volver. Lo que no hubo es efecto.
      assert(salida.status === 200,
        `${etiqueta}: el webhook respondió ${salida.status}`);
      assert(salida.resultado === esperado,
        `${etiqueta}: el motivo fue «${salida.resultado}» y no «${esperado}»`);
      vistos.push(`${etiqueta}→${salida.resultado}`);
    }

    assert(ordenEnLaBase(orden.order_id).estado === estadoAntes,
      'un pago ajeno movió el estado de la orden');
    assert(intentosDe(orden.order_id).length === 0,
      'un pago ajeno quedó escrito como intento de esta orden');
    assert(reservaDe(orden.order_id) === 'reservada',
      `la reserva quedó en ${reservaDe(orden.order_id)}`);
    assert(stockDe(orden.producto) === stockAntes
      && reservadoDe(orden.producto) === reservadoAntes
      && ventasDe(orden.producto) === ventasAntes,
      'un pago ajeno movió stock, reserva o ventas');
    assert(ordenEnLaBase(ajena.order_id).estado === 'placed',
      'la orden del otro vendedor se movió');

    return `${vistos.length} pagos firmados pero ajenos no movieron nada `
      + `(${vistos.join(', ')})`;
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await desvincular(otro.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(88, 'Volver de Mercado Pago no paga nada: lo dice el webhook', async () => {
  // La pantalla de vuelta decía «¡Pago Exitoso!» por haber llegado a
  // /payment/success. Esa URL la escribe cualquiera. Acá se entra a esa misma
  // pantalla sin que exista un solo pago, y después se hace existir uno.
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const browser = await chromium.launch({ headless: true });
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900604')).ok === 'vinculado',
      'el vendedor no vinculó');

    const orden = await ordenMercadoPago(vendedor);
    const stockAntes = stockDe(orden.producto);

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(
      ({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
      },
      { a: state.buyerToken, r: state.buyerRefreshToken },
    );
    const page = await context.newPage();
    const vuelta = `${FRONTEND_URL}/payment/success?orden=${orden.order_number}`;

    try {
      await page.goto(vuelta, { waitUntil: 'domcontentloaded' });
      // Lo primero que se ve es que se está verificando, no un festejo.
      await page.getByText(/Estamos verificando tu pago/i).waitFor({ timeout: 15_000 });
      const primero = await page.locator('body').innerText();
      assert(!/pago exitoso|pago acreditado|¡gracias por tu compra!/i.test(primero),
        `la vuelta de «success» declaró un pago que no existe:\n${primero.slice(0, 300)}`);

      // Y cuando termina de preguntar, dice que no hay ningún pago. Tarda: la
      // pantalla vuelve a preguntar cinco veces antes de darse por vencida,
      // que es lo que hace que un pago que tarda en aparecer igual aparezca.
      await page.getByText(/Todavía no hay un pago registrado/i).waitFor({ timeout: 45_000 });
      assert(ordenEnLaBase(orden.order_id).estado === 'placed',
        'entrar a /payment/success movió el estado de la orden');
      assert(intentosDe(orden.order_id).length === 0,
        'entrar a /payment/success escribió un intento de pago');
      assert(stockDe(orden.producto) === stockAntes, 'la vuelta del navegador movió stock');

      // Ahora sí: un pago aprobado y su aviso firmado.
      const pago = doble.crearPago({
        referencia: `topgreen-${orden.order_number}`,
        preferencia: orden.preferencia,
        cuenta: '900604',
        monto: orden.amount,
        ordenId: orden.order_id,
        ordenNumero: orden.order_number,
        estado: 'approved',
      });
      const aviso = await avisar({ dataId: pago.id, cuenta: '900604' });
      assert(aviso.resultado === 'aplicado', `el aviso devolvió ${aviso.resultado}`);

      await page.goto(vuelta, { waitUntil: 'domcontentloaded' });
      await page.getByText(/Pago acreditado/i).waitFor({ timeout: 30_000 });
      assert(ordenEnLaBase(orden.order_id).estado === 'paid',
        'con el pago aprobado la orden no quedó pagada');

      return 'la vuelta por «success» sin pago dice que está verificando y después que no '
        + 'hay pago, sin mover orden ni stock; recién el webhook con la consulta aprobada '
        + 'la deja pagada';
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(89, 'Repetido, en paralelo y fuera de orden: una transición y un efecto', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900605')).ok === 'vinculado',
      'el vendedor no vinculó');

    // --- 1. Un rechazo primero. No cierra nada: el link se puede reusar.
    const orden = await ordenMercadoPago(vendedor, { cantidad: 2 });
    const base = {
      referencia: `topgreen-${orden.order_number}`,
      preferencia: orden.preferencia,
      cuenta: '900605',
      monto: orden.amount,
      ordenId: orden.order_id,
      ordenNumero: orden.order_number,
    };
    const stockAntes = stockDe(orden.producto);
    const ventasAntes = ventasDe(orden.producto);
    const reservadoAntes = reservadoDe(orden.producto);

    const rechazado = doble.crearPago({ ...base, estado: 'rejected' });
    await avisar({ dataId: rechazado.id, cuenta: '900605' });
    assert(ordenEnLaBase(orden.order_id).estado === 'placed',
      'un rechazo cerró la orden');
    assert(reservaDe(orden.order_id) === 'reservada',
      'un rechazo soltó la reserva');
    const trasRechazo = await comoLoVe(state.buyerToken, 'buyer', orden.order_number);
    assert(trasRechazo.payment_state === 'rechazado' && trasRechazo.can_pay === true,
      `tras el rechazo el comprador ve ${trasRechazo.payment_state} / ${trasRechazo.can_pay}`);

    // --- 2. Después una aprobación, por el mismo link y con otro intento.
    const aprobado = doble.crearPago({ ...base, estado: 'approved' });
    const primero = await avisar({ dataId: aprobado.id, cuenta: '900605' });
    assert(primero.resultado === 'aplicado', `la aprobación devolvió ${primero.resultado}`);
    assert(ordenEnLaBase(orden.order_id).estado === 'paid',
      'el rechazo anterior tapó la aprobación');

    const cantidad = stockAntes - stockDe(orden.producto);
    assert(cantidad === 2, `la aprobación descontó ${cantidad} unidades y no 2`);
    assert(ventasDe(orden.producto) === ventasAntes + 2,
      'las ventas no subieron al aprobar, o subieron de más');
    assert(reservadoDe(orden.producto) === reservadoAntes - 2,
      'la reserva no se consolidó: quedó comprometida además de descontada');

    // --- 3. El mismo aviso, cinco veces: tres seguidas y dos a la vez.
    const stockTrasAprobar = stockDe(orden.producto);
    const ventasTrasAprobar = ventasDe(orden.producto);
    const repetidos = [];
    for (let vez = 0; vez < 3; vez += 1) {
      repetidos.push((await avisar({ dataId: aprobado.id, cuenta: '900605' })).resultado);
    }
    const paralelos = await Promise.all([
      avisar({ dataId: aprobado.id, cuenta: '900605' }),
      avisar({ dataId: aprobado.id, cuenta: '900605' }),
    ]);
    repetidos.push(...paralelos.map((p) => p.resultado));
    assert(repetidos.every((r) => r === 'repetido'),
      `los avisos repetidos devolvieron ${repetidos.join(', ')}`);
    assert(intentosDe(orden.order_id).length === 2,
      `quedaron ${intentosDe(orden.order_id).length} intentos y son 2 pagos distintos`);
    assert(stockDe(orden.producto) === stockTrasAprobar
      && ventasDe(orden.producto) === ventasTrasAprobar,
      'repetir el aviso movió el stock una segunda vez');

    // --- 4. Una noticia vieja no hace retroceder una aprobación.
    doble.actualizarPago(aprobado.id, {
      status: 'rejected',
      date_last_updated: new Date(Date.now() - 3600_000).toISOString(),
    });
    const vieja = await avisar({ dataId: aprobado.id, cuenta: '900605' });
    assert(vieja.resultado === 'viejo', `la noticia vieja devolvió ${vieja.resultado}`);
    assert(ordenEnLaBase(orden.order_id).estado === 'paid',
      'una noticia vieja despagó la orden');

    // Y una noticia nueva que igual querría deshacer la aprobación tampoco:
    // lo que sí la deshace —devolución, contracargo— tiene su propio estado.
    doble.actualizarPago(aprobado.id, {
      status: 'rejected', date_last_updated: new Date().toISOString(),
    });
    const retroceso = await avisar({ dataId: aprobado.id, cuenta: '900605' });
    assert(retroceso.resultado === 'retroceso',
      `el retroceso devolvió ${retroceso.resultado}`);
    assert(ordenEnLaBase(orden.order_id).estado === 'paid', 'la orden retrocedió');

    // --- 5. Devolución y contracargo: estado propio, sin devolver dinero ni
    //        inventar un movimiento de stock.
    doble.actualizarPago(aprobado.id, {
      status: 'refunded',
      transaction_amount_refunded: orden.amount,
      date_last_updated: new Date().toISOString(),
    });
    await avisar({ dataId: aprobado.id, cuenta: '900605' });
    const devuelta = await comoLoVe(state.buyerToken, 'buyer', orden.order_number);
    assert(devuelta.payment_state === 'devuelto',
      `tras la devolución se ve ${devuelta.payment_state}`);

    doble.actualizarPago(aprobado.id, {
      status: 'charged_back', date_last_updated: new Date().toISOString(),
    });
    await avisar({ dataId: aprobado.id, cuenta: '900605' });
    const contracargo = await comoLoVe(vendedor.token, 'seller', orden.order_number);
    assert(contracargo.payment_state === 'contracargo',
      `tras el contracargo el vendedor ve ${contracargo.payment_state}`);
    assert(stockDe(orden.producto) === stockTrasAprobar,
      'la devolución movió stock sola, sin que nadie lo decidiera');

    return 'rechazo → aprobación funciona; 5 avisos del mismo pago dejaron 1 transición y '
      + '1 descuento; una noticia vieja y un retroceso no despagaron; devolución y '
      + 'contracargo quedan con estado propio y sin mover stock';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(90, 'Dos compradores por la última unidad: una sola reserva', async () => {
  // La comprobación de stock del checkout es cortesía: los dos compradores
  // leen el mismo número y los dos creen que les alcanza. Lo que decide es la
  // reserva, que es un UPDATE condicional y la base serializa.
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900606')).ok === 'vinculado',
      'el vendedor no vinculó');

    // Una publicación con una sola unidad. Nada de cantidades del seed: el
    // caso tiene que decir cuánto hay. Y en una categoría de productos, no de
    // servicios: un servicio no ocupa unidades y no reserva ninguna.
    const [categoria] = queryRows(
      'SELECT id FROM categories WHERE is_service = false ORDER BY name LIMIT 1');
    const creada = await apiRequest('/products', {
      method: 'POST', token: vendedor.token,
      body: {
        name: `Smoke última bolsa ${Date.now()}`,
        description: 'Publicación de prueba de la reserva de stock.',
        category_id: categoria[0],
        price: 1500,
        stock: 1,
        unit: 'unidad',
        locality_id: state.location.localityId,
        publication_type: 'producto',
      },
    });
    const producto = creada.data.id;
    assert(stockDe(producto) === 1, `la publicación quedó con ${stockDe(producto)}`);

    // El segundo comprador es de este caso, y nace acá.
    const rival = `rival.${Date.now()}@example.com`;
    await registrarYVerificar({
      email: rival, password: 'rival123', full_name: 'Compradora Rival',
      phone: '+54 11 5555 0199', role: 'user',
    });
    const { data: sesion } = await apiRequest('/auth/login', {
      method: 'POST', body: { email: rival, password: 'rival123' },
    });
    const rivalToken = sesion.access_token;
    const rivalId = sesion.user.id;

    // Los dos carritos, con la misma última unidad adentro.
    await armarCarrito([{ product_id: producto, quantity: 1 }]);
    await apiRequest('/cart', { method: 'DELETE', token: rivalToken });
    await apiRequest('/cart/sync', {
      method: 'POST', token: rivalToken, body: { items: [{ product_id: producto, quantity: 1 }] },
    });

    const preferenciasAntes = preferenciasPedidas(doble).length;
    const sobre = (usuario) => sobreDePago(
      [{ seller_id: vendedor.id, method: 'mercadopago' }],
      { shipping_decisions: trasladoPropio(usuario) },
    );

    // A la vez, de verdad: las dos peticiones en vuelo al mismo tiempo.
    const [uno, otro] = await Promise.allSettled([
      apiRequest('/orders/checkout', {
        method: 'POST', token: state.buyerToken, body: sobre(state.buyerId),
      }),
      apiRequest('/orders/checkout', {
        method: 'POST', token: rivalToken, body: sobre(rivalId),
      }),
    ]);

    const ganadores = [uno, otro].filter((r) => r.status === 'fulfilled');
    const perdedores = [uno, otro].filter((r) => r.status === 'rejected');
    assert(ganadores.length === 1,
      `ganaron ${ganadores.length} compradores la misma unidad`);
    assert(/HTTP 4\d\d/.test(String(perdedores[0].reason?.message || '')),
      `el que perdió recibió «${perdedores[0].reason?.message}» y no un 4xx claro`);

    const orden = ganadores[0].value.data.orders[0];
    assert(reservaDe(orden.order_id) === 'reservada',
      `la orden ganadora quedó con reserva ${reservaDe(orden.order_id)}`);

    // La mercadería sigue estando: se reservó, no se vendió.
    assert(stockDe(producto) === 1, `el stock quedó en ${stockDe(producto)} y no en 1`);
    assert(reservadoDe(producto) === 1, `quedaron ${reservadoDe(producto)} unidades reservadas`);
    assert(ventasDe(producto) === 0,
      `las ventas subieron a ${ventasDe(producto)} sin que nadie pagara`);

    // Y para el que perdió no se pidió ninguna preferencia: el 4xx llegó
    // antes de que hubiera un link que cobrar.
    assert(preferenciasPedidas(doble).length === preferenciasAntes + 1,
      `se pidieron ${preferenciasPedidas(doble).length - preferenciasAntes} preferencias `
      + 'para una sola orden');
    assert(ordenesDe(rivalId).length + ordenesDe(state.buyerId).length
      >= 1, 'no quedó ninguna orden');

    // El que perdió conserva su carrito: puede corregir sin volver a armarlo.
    const carritoDelQuePerdio = perdedores[0] === uno ? state.buyerToken : rivalToken;
    const { data: carrito } = await apiRequest('/cart', { token: carritoDelQuePerdio });
    assert((carrito.items || []).length === 1,
      'el comprador que perdió se quedó sin carrito');

    return 'dos checkouts simultáneos por 1 unidad: 1 orden con reserva, el otro 4xx con su '
      + 'carrito vivo, 1 sola preferencia pedida, stock 1 y ventas 0 hasta que se pague';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(91, 'El reloj no libera stock: lo libera Mercado Pago', async () => {
  // Una reserva vencida no se suelta porque venció. Se le pregunta primero a
  // Mercado Pago, y recién si no hay pago —y el link quedó cerrado— vuelve la
  // mercadería. Una sola vez, aunque el reconciliador corra diez.
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900607')).ok === 'vinculado',
      'el vendedor no vinculó');

    const observado = [];

    // --- a) Vencida y sin ningún pago: se cierra el link y vuelve el stock.
    const sinPago = await ordenMercadoPago(vendedor);
    const stockA = stockDe(sinPago.producto);
    const reservadoA = reservadoDe(sinPago.producto);
    assert(reservaDe(sinPago.order_id) === 'reservada', 'no quedó reservada');
    vencerElLink(sinPago.order_id);

    const primera = await reconciliar();
    assert(primera.vencida === 1, `la reconciliación dijo ${JSON.stringify(primera)}`);
    assert(doble.vencida(sinPago.preferencia),
      'se liberó el stock sin haber apagado el link en Mercado Pago');
    assert(ordenEnLaBase(sinPago.order_id).estado === 'cancelled',
      `la orden vencida quedó ${ordenEnLaBase(sinPago.order_id).estado}`);
    assert(reservaDe(sinPago.order_id) === 'liberada',
      `la reserva quedó ${reservaDe(sinPago.order_id)}`);
    assert(reservadoDe(sinPago.producto) === reservadoA - 1
      && stockDe(sinPago.producto) === stockA,
      'la liberación no devolvió exactamente lo reservado');

    // Correrlo de nuevo no mueve nada: la entrada es idempotente.
    const otraVez = await reconciliar();
    assert(!otraVez.vencida, `la segunda corrida volvió a vencer: ${JSON.stringify(otraVez)}`);
    assert(reservadoDe(sinPago.producto) === reservadoA - 1,
      'la segunda corrida movió el stock otra vez');

    // Y esa orden ya no ofrece link ni lo vuelve a crear.
    const negado = await expectApiError(409, () => apiRequest(
      `/orders/${sinPago.order_id}/payment-link`,
      { method: 'POST', token: state.buyerToken, body: {} },
    ));
    assert(/ya no se puede pagar|venció/i.test(negado), `motivo inesperado: ${negado}`);
    observado.push('sin pago → link cerrado, orden cancelada, 1 unidad devuelta');

    // --- b) Vencida pero con un pago aprobado que nunca nos avisaron. Acá el
    //        reloj querría liberar y la plata dice que no.
    const cobrada = await ordenMercadoPago(vendedor);
    const stockB = stockDe(cobrada.producto);
    const ventasB = ventasDe(cobrada.producto);
    doble.crearPago({
      referencia: `topgreen-${cobrada.order_number}`,
      preferencia: cobrada.preferencia,
      cuenta: '900607',
      monto: cobrada.amount,
      ordenId: cobrada.order_id,
      ordenNumero: cobrada.order_number,
      estado: 'approved',
    });
    vencerElLink(cobrada.order_id);

    const conCobro = await reconciliar();
    assert(conCobro.cobrada === 1, `la reconciliación dijo ${JSON.stringify(conCobro)}`);
    assert(ordenEnLaBase(cobrada.order_id).estado === 'paid',
      'el reconciliador no procesó el pago aprobado que nadie había avisado: quedó en '
      + `«${ordenEnLaBase(cobrada.order_id).estado}» y el barrido dijo ${JSON.stringify(conCobro)}`);
    assert(stockDe(cobrada.producto) === stockB - 1 && ventasDe(cobrada.producto) === ventasB + 1,
      'la consolidación por reconciliación no descontó exactamente una vez');
    assert(reservaDe(cobrada.order_id) === 'consolidada',
      `la reserva quedó ${reservaDe(cobrada.order_id)}`);
    observado.push('vencida con pago aprobado → pagada y consolidada, no liberada');

    // Repetir no consolida dos veces.
    await reconciliar();
    assert(stockDe(cobrada.producto) === stockB - 1,
      'reconciliar dos veces descontó dos veces');

    // --- c) Vencida con un pago en proceso: no se toca. Un pago empezado
    //        todavía puede acreditarse, y el vencimiento no se lo quita.
    const enProceso = await ordenMercadoPago(vendedor);
    const reservadoC = reservadoDe(enProceso.producto);
    doble.crearPago({
      referencia: `topgreen-${enProceso.order_number}`,
      preferencia: enProceso.preferencia,
      cuenta: '900607',
      monto: enProceso.amount,
      ordenId: enProceso.order_id,
      ordenNumero: enProceso.order_number,
      estado: 'in_process',
    });
    vencerElLink(enProceso.order_id);

    const enCurso = await reconciliar();
    assert(enCurso.en_curso === 1, `la reconciliación dijo ${JSON.stringify(enCurso)}`);
    assert(reservaDe(enProceso.order_id) === 'reservada',
      'se soltó la mercadería de una compra que todavía se estaba pagando');
    assert(reservadoDe(enProceso.producto) === reservadoC,
      'se liberó stock de un pago en proceso');
    assert(ordenEnLaBase(enProceso.order_id).estado === 'placed',
      'se canceló una orden con un pago en proceso');
    observado.push('vencida con pago en proceso → intacta');

    // --- d) Cancelar con Mercado Pago caído. La orden termina —la persona ya
    //        decidió— pero la mercadería NO se suelta hasta poder confirmar
    //        que el link quedó apagado. Soltarla antes es exactamente la
    //        carrera que no puede existir: alguien paga un link vivo por
    //        unidades que ya se le prometieron a otro.
    const aCiegas = await ordenMercadoPago(vendedor);
    const reservadoD = reservadoDe(aCiegas.producto);
    doble.caer(true);
    const cancelada = await apiRequest(`/orders/${aCiegas.order_id}/cancel`, {
      method: 'POST', token: state.buyerToken, body: { reason: 'me arrepentí' },
    });
    doble.caer(false);
    assert(cancelada.status === 200, `cancelar devolvió ${cancelada.status}`);
    assert(ordenEnLaBase(aCiegas.order_id).estado === 'cancelled',
      'la cancelación no llegó a escribirse porque Mercado Pago no contestaba');
    assert(reservaDe(aCiegas.order_id) === 'cierre_pendiente',
      `la reserva quedó ${reservaDe(aCiegas.order_id)} y no en cierre pendiente`);
    assert(reservadoDe(aCiegas.producto) === reservadoD,
      'se soltó la mercadería sin haber podido apagar el link');
    assert(!doble.vencida(aCiegas.preferencia), 'el doble caído igual venció el link');

    // Y cuando Mercado Pago vuelve, el reconciliador cierra y suelta. Una vez.
    const alVolver = await reconciliar();
    assert(alVolver.liberada === 1, `la reconciliación dijo ${JSON.stringify(alVolver)}`);
    assert(doble.vencida(aCiegas.preferencia), 'el link nunca se apagó');
    assert(reservaDe(aCiegas.order_id) === 'liberada',
      `la reserva quedó ${reservaDe(aCiegas.order_id)}`);
    assert(reservadoDe(aCiegas.producto) === reservadoD - 1,
      'la liberación diferida no devolvió exactamente lo reservado');
    await reconciliar();
    assert(reservadoDe(aCiegas.producto) === reservadoD - 1,
      'la segunda corrida volvió a liberar');
    observado.push('cancelada con MP caído → cierre pendiente, y el reconciliador suelta 1 vez');

    return observado.join('; ');
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(92, 'Token revocado y Mercado Pago caído: reintentable, no rechazado', async () => {
  // No poder saber qué pasó no es lo mismo que saber que no pasó. Un 200 acá
  // se traga el aviso —Mercado Pago no vuelve— y el pago queda perdido.
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900608')).ok === 'vinculado',
      'el vendedor no vinculó');

    const orden = await ordenMercadoPago(vendedor);
    const pago = doble.crearPago({
      referencia: `topgreen-${orden.order_number}`,
      preferencia: orden.preferencia,
      cuenta: '900608',
      monto: orden.amount,
      ordenId: orden.order_id,
      ordenNumero: orden.order_number,
      estado: 'approved',
    });
    const stockAntes = stockDe(orden.producto);
    const vistos = [];

    const noSePudo = async (etiqueta, esperado) => {
      const salida = await avisar({ dataId: pago.id, cuenta: '900608' });
      assert(salida.status === 503,
        `${etiqueta}: respondió ${salida.status} en vez de 503 reintentable`);
      assert(salida.resultado === esperado,
        `${etiqueta}: el motivo fue «${salida.resultado}» y no «${esperado}»`);
      assert(ordenEnLaBase(orden.order_id).estado === 'placed',
        `${etiqueta}: la orden se movió sin haber podido consultar`);
      assert(intentosDe(orden.order_id).length === 0,
        `${etiqueta}: quedó escrito un intento sin haber podido consultar`);
      assert(stockDe(orden.producto) === stockAntes, `${etiqueta}: se movió el stock`);
      vistos.push(`${etiqueta}→${salida.status} ${salida.resultado}`);
    };

    // 1. El vendedor le revocó el permiso a la aplicación: Mercado Pago
    //    contesta 401 a la consulta.
    doble.revocar(true);
    await noSePudo('permiso revocado', 'token_rechazado');
    doble.revocar(false);

    // 2. Mercado Pago caído.
    doble.caer(true);
    await noSePudo('Mercado Pago caído', 'mp_sin_respuesta');
    doble.caer(false);

    // 3. Sin credencial de este lado: el vínculo se cortó.
    await desvincular(vendedor.token);
    const sinVinculo = await avisar({ dataId: pago.id, cuenta: '900608' });
    assert(sinVinculo.status === 503 && sinVinculo.resultado === 'sin_destinatario',
      `sin vínculo respondió ${sinVinculo.status} ${sinVinculo.resultado}`);
    assert(ordenEnLaBase(orden.order_id).estado === 'placed',
      'sin vínculo se movió la orden igual');
    vistos.push(`vínculo cortado→${sinVinculo.status} ${sinVinculo.resultado}`);

    // 4. Y cuando el mundo se arregla, el mismo aviso converge.
    assert((await vincular(vendedor.token, 'ok:900608')).ok === 'vinculado',
      'el vendedor no volvió a vincular');
    const bueno = await avisar({ dataId: pago.id, cuenta: '900608' });
    assert(bueno.status === 200 && bueno.resultado === 'aplicado',
      `al reintentar devolvió ${bueno.status} ${bueno.resultado}`);
    assert(ordenEnLaBase(orden.order_id).estado === 'paid',
      'al reintentar la orden no quedó pagada');
    assert(stockDe(orden.producto) === stockAntes - 1,
      'al converger el stock no se descontó exactamente una vez');

    return `${vistos.join('; ')}; con el mundo arreglado el mismo aviso quedó aplicado y la `
      + 'orden pagada, con un solo descuento de stock';
  } finally {
    doble.caer(false);
    doble.revocar(false);
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(93, 'Comprador y vendedor ven lo mismo, y no se despacha lo que no se cobró', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900609')).ok === 'vinculado',
      'el vendedor no vinculó');

    const orden = await ordenMercadoPago(vendedor);

    const mirar = async (etiqueta) => {
      const delComprador = await comoLoVe(state.buyerToken, 'buyer', orden.order_number);
      const delVendedor = await comoLoVe(vendedor.token, 'seller', orden.order_number);
      assert(delComprador.payment_state === delVendedor.payment_state,
        `${etiqueta}: el comprador ve «${delComprador.payment_state}» y el vendedor `
        + `«${delVendedor.payment_state}»`);
      // El link es sólo del comprador. El vendedor no paga por nadie.
      assert(!delVendedor.payment_url && delVendedor.can_pay === false,
        `${etiqueta}: al vendedor le llegó el link de pago`);
      return delComprador.payment_state;
    };

    const pendiente = await mirar('sin pagar');
    assert(pendiente === 'pendiente', `sin pagar se ve «${pendiente}»`);

    // El vendedor no confirma ni despacha una orden que no cobró. No es una
    // regla de pantalla: se pide por API.
    for (const destino of ['confirmed', 'shipped', 'delivered']) {
      const negado = await expectApiError(400, () => apiRequest(
        `/orders/${orden.order_id}/status`,
        { method: 'PATCH', token: vendedor.token, body: { status: destino } },
      ));
      assert(/No puedes cambiar/i.test(negado), `«${destino}» falló por otra cosa: ${negado}`);
    }
    assert(ordenEnLaBase(orden.order_id).estado === 'placed',
      'alguna de esas transiciones pasó igual');

    // --- Se acredita el pago.
    const pago = doble.crearPago({
      referencia: `topgreen-${orden.order_number}`,
      preferencia: orden.preferencia,
      cuenta: '900609',
      monto: orden.amount,
      ordenId: orden.order_id,
      ordenNumero: orden.order_number,
      estado: 'approved',
    });
    await avisar({ dataId: pago.id, cuenta: '900609' });

    const aprobado = await mirar('pagada');
    assert(aprobado === 'aprobado', `pagada se ve «${aprobado}»`);
    // Y recargar dice lo mismo: no hay nada que viva sólo en una pantalla.
    assert((await mirar('pagada, releída')) === 'aprobado', 'releer cambió lo que se ve');

    // Ahora sí puede confirmar.
    const confirmada = await apiRequest(`/orders/${orden.order_id}/status`, {
      method: 'PATCH', token: vendedor.token, body: { status: 'confirmed' },
    });
    assert(confirmada.status === 200 && confirmada.data.new_status === 'confirmed',
      `confirmar devolvió ${confirmada.status}`);

    // --- Una devolución posterior lo dice, para los dos, y no despacha sola.
    doble.actualizarPago(pago.id, {
      status: 'refunded',
      transaction_amount_refunded: orden.amount,
      date_last_updated: new Date().toISOString(),
    });
    await avisar({ dataId: pago.id, cuenta: '900609' });
    const devuelto = await mirar('devuelta');
    assert(devuelto === 'devuelto', `tras la devolución se ve «${devuelto}»`);

    return 'comprador y vendedor ven el mismo estado en las cuatro lecturas; el vendedor no '
      + 'pudo confirmar, enviar ni entregar sin cobro y sí después de aprobado; la '
      + 'devolución queda visible para los dos';
  } finally {
    await doble.cerrar();
    try {
      await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(94, 'La preferencia que falla no deja una reserva inmortal', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  let vendedor = null;
  try {
    // El ingreso va adentro del try: si falla antes, el doble queda escuchando
    // el puerto y el caso siguiente no puede ni levantarlo.
    vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
    await comprador();
    await desvincular(vendedor.token);
    // Una cuenta a la que el doble le devuelve una preferencia inservible: es
    // el rechazo permanente del enunciado. Se elige ésta y no la que rechaza
    // todo porque acá lo que tiene que fallar es **sólo** la preferencia: si
    // también fallara la consulta, el reconciliador no podría preguntar y el
    // caso mediría otra cosa.
    assert((await vincular(vendedor.token, `ok:${CUENTA_INCOMPLETA}`)).ok === 'vinculado',
      'no se pudo vincular la cuenta de preferencia inservible');

    const producto = productoConStock(vendedor.id, 1);
    const antes = stockDe(producto);
    // En diferencias: el producto puede traer reservas de otras compras vivas.
    const reservadoAntes = reservadoDe(producto);
    await armarCarrito([{ product_id: producto, quantity: 1 }]);
    const creado = await apiRequest('/orders/checkout', {
      method: 'POST', token: state.buyerToken,
      body: sobreDePago([{ seller_id: vendedor.id, method: 'mercadopago' }]),
    });
    const [orden] = creado.data.orders;
    assert(orden && orden.preparation !== 'lista',
      `la preferencia no falló: quedó «${orden && orden.preparation}»`);

    // La orden existe y tiene mercadería comprometida aunque nunca haya
    // llegado a tener link.
    assert(reservaDe(orden.order_id) === 'reservada',
      `la reserva quedó en «${reservaDe(orden.order_id)}»`);
    assert(reservadoDe(producto) === reservadoAntes + 1,
      `lo reservado pasó de ${reservadoAntes} a ${reservadoDe(producto)}: tenía que subir una`);

    // Y ésta es la corrección: la intención de pago se escribió con la reserva,
    // antes de hablar con Mercado Pago, así que tiene plazo y el reconciliador
    // la puede encontrar. Sin esa fila la reserva no vencía nunca.
    const [pago] = pagosDe(orden.order_id);
    assert(pago, 'la orden quedó reservada y sin ninguna fila de pago');
    const [[vence]] = queryRows(
      `SELECT expires_at IS NOT NULL FROM payments WHERE order_id = ${sqlLiteral(orden.order_id)}`,
    );
    assert(vence === 't', 'la intención de pago quedó sin plazo');

    // Se abandona: vence y entra al barrido.
    vencerElLink(orden.order_id);
    const primera = await reconciliar();
    assert(reservaDe(orden.order_id) === 'liberada',
      `tras reconciliar la reserva quedó en «${reservaDe(orden.order_id)}»`);
    assert(reservadoDe(producto) === reservadoAntes,
      `lo reservado quedó en ${reservadoDe(producto)} y tenía que volver a ${reservadoAntes}`);
    assert(stockDe(producto) === antes, `el stock quedó en ${stockDe(producto)} y era ${antes}`);
    assert(ordenEnLaBase(orden.order_id).estado === 'cancelled',
      'la orden abandonada no quedó cancelada');

    // Y una sola vez: repetir el barrido no vuelve a soltar nada.
    await reconciliar();
    assert(reservadoDe(producto) === reservadoAntes && stockDe(producto) === antes,
      'repetir el reconciliador movió el stock otra vez');

    return `la preferencia falló, la orden quedó reservada con su plazo escrito, el `
      + `reconciliador la cerró y devolvió 1 unidad (${JSON.stringify(primera)}); `
      + 'repetirlo no movió nada';
  } finally {
    await doble.cerrar();
    try {
      if (vendedor) await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(95, 'El aviso se autentica antes de leer el cuerpo, y la URL pide Webhooks', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  let vendedor = null;
  try {
    // El ingreso va adentro del try: si falla antes, el doble queda escuchando
    // el puerto y el caso siguiente no puede ni levantarlo.
    vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900610')).ok === 'vinculado', 'no vinculó');
    const orden = await ordenMercadoPago(vendedor);
    const propio = doble.crearPago({
      referencia: `topgreen-${orden.order_number}`,
      preferencia: orden.preferencia,
      cuenta: '900610', monto: orden.amount,
      ordenId: orden.order_id, ordenNumero: orden.order_number,
      estado: 'approved',
    });

    // --- 1. Sin `data.id` en la URL no hay nada que autenticar. Que el cuerpo
    //        lo traiga no alcanza: el cuerpo no está firmado.
    const consultasAntes = doble.pedidos.filter((p) => p.ruta === 'consultar').length;
    const sinUrl = await pedirConReintento(`${API_URL}/mp/webhook?type=payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'pedido-de-prueba',
        'x-signature': firmaDeAviso(SECRETO_DEL_WEBHOOK, {
          dataId: propio.id, requestId: 'pedido-de-prueba',
        }),
      },
      body: JSON.stringify({
        type: 'payment', data: { id: String(propio.id) }, user_id: '900610',
      }),
    });
    assert(sinUrl.status === 401,
      `un aviso con el id sólo en el cuerpo devolvió ${sinUrl.status}`);
    assert(doble.pedidos.filter((p) => p.ruta === 'consultar').length === consultasAntes,
      'se consultó Mercado Pago con un aviso que no se podía autenticar');
    assert(ordenEnLaBase(orden.order_id).estado === 'placed', 'la orden se movió igual');

    // --- 2. Con dos identificadores distintos, manda el de la URL: es el
    //        único que entró en la firma. El del cuerpo ni se mira.
    const otro = doble.crearPago({
      referencia: 'topgreen-ORD-INEXISTENTE', preferencia: 'pref-ajena',
      cuenta: '900610', monto: orden.amount, estado: 'approved',
    });
    const cruzado = await avisar({
      dataId: propio.id, cuenta: '900610',
      cuerpo: {
        type: 'payment', action: 'payment.updated',
        data: { id: String(otro.id) }, user_id: '900610',
      },
    });
    assert(cruzado.status === 200, `el aviso cruzado devolvió ${cruzado.status}`);
    const consultados = doble.pedidos.filter((p) => p.ruta === 'consultar').map((p) => p.pago);
    assert(consultados.includes(String(propio.id)),
      'no se consultó el pago que venía firmado en la URL');
    assert(!consultados.includes(String(otro.id)),
      'se consultó el pago que venía en el cuerpo, que no está firmado');
    assert(ordenEnLaBase(orden.order_id).estado === 'paid',
      'el pago de la URL no se aplicó');

    // --- 3. La URL de aviso viaja con el parámetro oficial, y lo pone el
    //        código: la base configurada no puede traer query.
    const salida = await correrEnLaApiSinBloquear([
      'from app.core.config import settings',
      'from app.services import mp_preferencia',
      'from pydantic import ValidationError',
      'from app.core.config import Settings',
      'settings.MP_NOTIFICACION_URL = "https://topgreen.example/api/mp/webhook"',
      'print("URL", mp_preferencia.url_de_aviso())',
      'try:',
      '    Settings(MP_NOTIFICACION_URL="https://x/y?source_news=ipn")',
      '    print("BASE acepta query")',
      'except ValidationError:',
      '    print("BASE rechaza query")',
    ].join('\n'));
    assert(/URL https:\/\/topgreen\.example\/api\/mp\/webhook\?source_news=webhooks/.test(salida),
      `la URL de aviso no lleva el parámetro oficial:\n${salida.slice(-300)}`);
    assert(/BASE rechaza query/.test(salida),
      `la base configurada acepta query arbitraria:\n${salida.slice(-300)}`);

    return 'sin data.id en la URL el aviso da 401 sin consultar; con el cuerpo cruzado se '
      + 'consulta el de la URL y no el del cuerpo; y la notification_url viaja con '
      + 'source_news=webhooks puesto por el código sobre una base sin query';
  } finally {
    await doble.cerrar();
    try {
      if (vendedor) await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(96, 'Una orden de Mercado Pago cobrada no se cancela, ni comprador ni vendedor', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  let vendedor = null;
  try {
    // El ingreso va adentro del try: si falla antes, el doble queda escuchando
    // el puerto y el caso siguiente no puede ni levantarlo.
    vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900611')).ok === 'vinculado', 'no vinculó');

    const orden = await ordenMercadoPago(vendedor);
    const producto = orden.producto;
    const pago = doble.crearPago({
      referencia: `topgreen-${orden.order_number}`,
      preferencia: orden.preferencia, cuenta: '900611', monto: orden.amount,
      ordenId: orden.order_id, ordenNumero: orden.order_number, estado: 'approved',
    });
    await avisar({ dataId: pago.id, cuenta: '900611' });
    assert(ordenEnLaBase(orden.order_id).estado === 'paid', 'la orden no quedó pagada');

    const stockCobrado = stockDe(producto);
    const ventasCobradas = ventasDe(producto);
    const reservaCobrada = reservaDe(orden.order_id);

    // El comprador intenta cancelar una orden que ya tiene plata adentro.
    const delComprador = await expectApiError(409, () => apiRequest(
      `/orders/${orden.order_id}/cancel`,
      { method: 'POST', token: state.buyerToken, body: { reason: 'me arrepentí' } },
    ));
    assert(/pago acreditado/i.test(delComprador),
      `el 409 del comprador dijo otra cosa: ${delComprador}`);

    // Y el vendedor por la misma ruta, que es por donde rechaza.
    const delVendedor = await expectApiError(409, () => apiRequest(
      `/orders/${orden.order_id}/cancel`,
      { method: 'POST', token: vendedor.token, body: { reason: 'no tengo stock' } },
    ));
    assert(/pago acreditado/i.test(delVendedor),
      `el 409 del vendedor dijo otra cosa: ${delVendedor}`);

    // Nada se movió: ni el estado, ni el inventario, ni las ventas.
    assert(ordenEnLaBase(orden.order_id).estado === 'paid',
      `la orden quedó en «${ordenEnLaBase(orden.order_id).estado}»`);
    assert(stockDe(producto) === stockCobrado,
      `el stock pasó de ${stockCobrado} a ${stockDe(producto)}`);
    assert(ventasDe(producto) === ventasCobradas, 'las ventas se movieron');
    assert(reservaDe(orden.order_id) === reservaCobrada, 'la reserva se movió');

    return `los dos intentos de cancelar una orden cobrada dieron 409; sigue pagada, el stock `
      + `en ${stockCobrado} y las ventas en ${ventasCobradas}`;
  } finally {
    await doble.cerrar();
    try {
      if (vendedor) await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(97, 'El vendedor no puede quitar stock que ya está reservado', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  let vendedor = null;
  try {
    // El ingreso va adentro del try: si falla antes, el doble queda escuchando
    // el puerto y el caso siguiente no puede ni levantarlo.
    vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900612')).ok === 'vinculado', 'no vinculó');

    const orden = await ordenMercadoPago(vendedor);
    const producto = orden.producto;
    // En absolutos no: el producto puede traer reservas de otras compras. Lo
    // que importa es el piso que esas reservas imponen, sea cual sea.
    const reservado = reservadoDe(producto);
    assert(reservado >= 1, `la compra no reservó nada: ${reservado}`);
    const stockAntes = stockDe(producto);

    // Bajar el stock por debajo de lo comprometido se rechaza, con el número.
    const negado = await expectApiError(400, () => apiRequest(
      `/products/${producto}`,
      { method: 'PATCH', token: vendedor.token, body: { stock: reservado - 1 } },
    ));
    assert(/reservada/i.test(negado), `el rechazo no explica lo reservado: ${negado}`);
    assert(stockDe(producto) === stockAntes,
      `el stock cambió igual: ${stockDe(producto)} en vez de ${stockAntes}`);

    // La edición normal sigue funcionando, y el borde exacto también: dejarlo
    // justo en lo reservado se acepta.
    const subir = await apiRequest(`/products/${producto}`, {
      method: 'PATCH', token: vendedor.token, body: { stock: stockAntes + 5 },
    });
    assert(subir.status === 200, `subir el stock devolvió ${subir.status}`);
    assert(stockDe(producto) === stockAntes + 5, 'el stock no subió');
    const justo = await apiRequest(`/products/${producto}`, {
      method: 'PATCH', token: vendedor.token, body: { stock: reservado },
    });
    assert(justo.status === 200, `dejarlo en lo reservado devolvió ${justo.status}`);

    // La carrera de verdad: la edición llega con un checkout en vuelo. Se
    // retiene la creación de la preferencia, que ocurre DESPUÉS de que la
    // reserva ya quedó escrita y confirmada.
    const otro = productoConStock(vendedor.id, 1);
    const reservadoDelOtro = reservadoDe(otro);
    await armarCarrito([{ product_id: otro, quantity: 1 }]);
    doble.pausarLaPreferencia();
    const enVuelo = apiRequest('/orders/checkout', {
      method: 'POST', token: state.buyerToken,
      body: sobreDePago([{ seller_id: vendedor.id, method: 'mercadopago' }]),
    });
    await esperarA(() => reservadoDe(otro) === reservadoDelOtro + 1,
      'la reserva del checkout en vuelo');
    const enCarrera = await expectApiError(400, () => apiRequest(
      `/products/${otro}`,
      { method: 'PATCH', token: vendedor.token, body: { stock: reservadoDelOtro } },
    ));
    assert(/reservada/i.test(enCarrera), `la carrera falló por otra cosa: ${enCarrera}`);
    doble.soltarLaPreferencia();
    await enVuelo;

    return 'bajar el stock por debajo de lo reservado da 400 con el motivo; subirlo y dejarlo '
      + 'justo en lo reservado funcionan; y con un checkout en vuelo la edición ya ve la '
      + 'reserva escrita';
  } finally {
    await doble.cerrar();
    try {
      if (vendedor) await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(98, 'El link se apaga al primer cobro, y dos aprobados piden revisión', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  let vendedor = null;
  try {
    // El ingreso va adentro del try: si falla antes, el doble queda escuchando
    // el puerto y el caso siguiente no puede ni levantarlo.
    vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900613')).ok === 'vinculado', 'no vinculó');

    // --- 1. Un cobro apaga su link. Una preferencia cobrada sigue sirviendo
    //        del lado de Mercado Pago si nadie la vence.
    const primera = await ordenMercadoPago(vendedor);
    const pagoUno = doble.crearPago({
      referencia: `topgreen-${primera.order_number}`,
      preferencia: primera.preferencia, cuenta: '900613', monto: primera.amount,
      ordenId: primera.order_id, ordenNumero: primera.order_number, estado: 'approved',
    });
    await avisar({ dataId: pagoUno.id, cuenta: '900613' });
    assert(doble.vencida(primera.preferencia),
      'la preferencia siguió viva después de cobrar');

    // --- 2. Si apagarlo falla, el pago se registra igual y queda anotado que
    //        el link sigue abierto. El reconciliador lo reintenta.
    const segunda = await ordenMercadoPago(vendedor);
    doble.fallarElCierre(1);
    const pagoDos = doble.crearPago({
      referencia: `topgreen-${segunda.order_number}`,
      preferencia: segunda.preferencia, cuenta: '900613', monto: segunda.amount,
      ordenId: segunda.order_id, ordenNumero: segunda.order_number, estado: 'approved',
    });
    const avisado = await avisar({ dataId: pagoDos.id, cuenta: '900613' });
    assert(avisado.status === 200, `el aviso devolvió ${avisado.status} por no poder cerrar`);
    assert(ordenEnLaBase(segunda.order_id).estado === 'paid',
      'no poder apagar el link se llevó puesto el cobro');
    assert(!doble.vencida(segunda.preferencia), 'el doble dice que se venció y falló');
    const [[abierto]] = queryRows(
      `SELECT link_cerrado FROM payments WHERE order_id = ${sqlLiteral(segunda.order_id)}`);
    assert(abierto === 'f', 'quedó anotado como cerrado un link que no se pudo cerrar');

    await reconciliar();
    assert(doble.vencida(segunda.preferencia),
      'el reconciliador no reintentó apagar el link');
    const [[cerrado]] = queryRows(
      `SELECT link_cerrado FROM payments WHERE order_id = ${sqlLiteral(segunda.order_id)}`);
    assert(cerrado === 't', 'el reintento no quedó anotado');

    // --- 3. Dos pagos aprobados distintos para la misma orden. Pasa aunque el
    //        link se apague al primero: dos intentos en vuelo se pueden
    //        acreditar los dos.
    const stockTrasUno = stockDe(primera.producto);
    const ventasTrasUno = ventasDe(primera.producto);
    const pagoBis = doble.crearPago({
      referencia: `topgreen-${primera.order_number}`,
      preferencia: primera.preferencia, cuenta: '900613', monto: primera.amount,
      ordenId: primera.order_id, ordenNumero: primera.order_number, estado: 'approved',
    });
    await avisar({ dataId: pagoBis.id, cuenta: '900613' });

    const visto = await comoLoVe(state.buyerToken, 'buyer', primera.order_number);
    const delVendedor = await comoLoVe(vendedor.token, 'seller', primera.order_number);
    assert(visto.payment_state === 'en_revision',
      `con dos cobros el comprador ve «${visto.payment_state}»`);
    assert(delVendedor.payment_state === 'en_revision',
      `con dos cobros el vendedor ve «${delVendedor.payment_state}»`);

    // Los dos identificadores se conservan, y la mercadería salió una vez.
    const ids = intentosDe(primera.order_id).map((f) => f[0]);
    assert(ids.includes(String(pagoUno.id)) && ids.includes(String(pagoBis.id)),
      `no están los dos pagos guardados: ${ids.join(', ')}`);
    assert(stockDe(primera.producto) === stockTrasUno,
      `el stock se descontó dos veces: ${stockTrasUno} -> ${stockDe(primera.producto)}`);
    assert(ventasDe(primera.producto) === ventasTrasUno, 'las ventas subieron dos veces');
    assert(doble.pedidos.filter((p) => p.ruta === 'reembolso').length === 0,
      'se pidió un reembolso solo');

    // --- 4. Y devolver UNO de los dos no limpia la orden. Si se contaran sólo
    //        los aprobados de hoy, el conteo bajaría a uno y la orden diría
    //        «devuelto», que le contaría al vendedor que le devolvieron todo
    //        cuando le queda un cobro vivo.
    doble.actualizarPago(pagoBis.id, {
      status: 'refunded',
      transaction_amount_refunded: primera.amount,
      date_last_updated: new Date().toISOString(),
    });
    await avisar({ dataId: pagoBis.id, cuenta: '900613' });
    const trasLaDevolucion = await comoLoVe(state.buyerToken, 'buyer', primera.order_number);
    assert(trasLaDevolucion.payment_state === 'en_revision',
      `devolver uno de los dos cobros dejó la orden en «${trasLaDevolucion.payment_state}»`);
    assert(intentosDe(primera.order_id).length >= 2,
      'se perdió alguno de los identificadores al devolver');

    return 'el primer cobro apagó su link; con el cierre caído el pago se registró igual y el '
      + 'reconciliador lo apagó después; dos aprobados distintos dejan «en revisión» con '
      + 'los dos ids guardados y un solo descuento de stock; y devolver uno de los dos no '
      + 'la limpia: sigue en revisión';
  } finally {
    await doble.cerrar();
    try {
      if (vendedor) await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(99, 'El reconciliador no suelta el candado entre preguntar y decidir', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  let vendedor = null;
  try {
    // El ingreso va adentro del try: si falla antes, el doble queda escuchando
    // el puerto y el caso siguiente no puede ni levantarlo.
    vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900614')).ok === 'vinculado', 'no vinculó');

    const orden = await ordenMercadoPago(vendedor);
    const producto = orden.producto;
    const stockAntes = stockDe(producto);
    // En diferencias, no en absolutos: el producto puede venir con reservas de
    // otras compras, y lo que se mide acá es lo que mueve ESTA.
    const reservadoAntes = reservadoDe(producto);
    vencerElLink(orden.order_id);

    // El reconciliador hace dos búsquedas por orden: una al preguntar y otra
    // al cerrar. La segunda es la que decide si se suelta la mercadería, así
    // que es la que se retiene: ahí adentro entra el pago.
    // Se retiene la búsqueda **de esta orden**, no la segunda a secas: el
    // barrido pasa por todas las candidatas, y contar búsquedas sueltas
    // retendría la de cualquier otra.
    const referencia = `topgreen-${orden.order_number}`;
    doble.pausarLaBusqueda({ desde: 2, referencia });
    const barrido = reconciliar();

    await esperarA(() => doble.busquedas(referencia) >= 2,
      'la búsqueda con la que el reconciliador decide sobre esta orden');

    // Con la decisión a medio camino, la fila tiene que estar bloqueada. Si no
    // lo está, entre preguntar y decidir hay una ventana por la que se cuela
    // un cobro y la orden termina cancelada con plata adentro.
    assert(ordenBloqueada(orden.order_id),
      'el reconciliador soltó el candado de la orden entre preguntar y decidir');

    // Y ahora sí: el pago aparece dentro de la ventana, y el aviso llega.
    const pago = doble.crearPago({
      referencia: `topgreen-${orden.order_number}`,
      preferencia: orden.preferencia, cuenta: '900614', monto: orden.amount,
      ordenId: orden.order_id, ordenNumero: orden.order_number, estado: 'approved',
    });
    const aviso = avisar({ dataId: pago.id, cuenta: '900614' });
    doble.soltarLaBusqueda();

    const resumen = await barrido;
    const respuesta = await aviso;

    assert(respuesta.status === 200, `el aviso terminó en ${respuesta.status}`);
    assert(ordenEnLaBase(orden.order_id).estado === 'paid',
      `la orden quedó en «${ordenEnLaBase(orden.order_id).estado}» con un pago acreditado`);
    assert(reservaDe(orden.order_id) === 'consolidada',
      `quedó cobro con la reserva en «${reservaDe(orden.order_id)}»`);
    assert(stockDe(producto) === stockAntes - 1,
      `el stock quedó en ${stockDe(producto)} y tenía que bajar una sola unidad desde ${stockAntes}`);
    assert(reservadoDe(producto) === reservadoAntes - 1,
      `lo reservado pasó de ${reservadoAntes} a ${reservadoDe(producto)}: tenía que bajar una`);
    assert(!resumen.vencida && !resumen.liberada,
      `el reconciliador cerró una orden que se estaba pagando: ${JSON.stringify(resumen)}`);

    return `con el pago entrando entre la búsqueda y el cierre, la fila estaba bloqueada; la `
      + `orden quedó pagada y consolidada, el stock bajó una sola unidad y el barrido `
      + `no la venció (${JSON.stringify(resumen)})`;
  } finally {
    await doble.cerrar();
    try {
      if (vendedor) await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(100, 'Dos reconciliadores a la vez no duplican ningún efecto', async () => {
  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  let vendedor = null;
  try {
    vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
    await comprador();
    await desvincular(vendedor.token);
    assert((await vincular(vendedor.token, 'ok:900615')).ok === 'vinculado', 'no vinculó');

    // Una que nadie pagó y ya venció: al barrido le toca cerrarla y devolver
    // su unidad. Y una cobrada sin avisar: le toca procesar el pago.
    // Dos publicaciones distintas a propósito: con la misma, una liberación y
    // una consolidación se compensan en el total reservado y la prueba no
    // podría distinguir «cada efecto una vez» de «dos efectos cruzados».
    const [productoA, productoB] = dosProductosDistintos(vendedor.id);
    const abandonada = await ordenMercadoPago(vendedor, { producto: productoA });
    const cobrada = await ordenMercadoPago(vendedor, { producto: productoB });
    assert(abandonada.producto !== cobrada.producto, 'las dos órdenes usaron el mismo producto');
    doble.crearPago({
      referencia: `topgreen-${cobrada.order_number}`,
      preferencia: cobrada.preferencia, cuenta: '900615', monto: cobrada.amount,
      ordenId: cobrada.order_id, ordenNumero: cobrada.order_number, estado: 'approved',
    });
    vencerElLink(abandonada.order_id);
    vencerElLink(cobrada.order_id);

    const reservadoAbandonada = reservadoDe(abandonada.producto);
    const stockCobrada = stockDe(cobrada.producto);
    const ventasCobrada = ventasDe(cobrada.producto);

    // Los dos a la vez, de verdad: dos procesos, no dos llamadas seguidas.
    // Es la forma en que esto va a correr si alguien programa el barrido y una
    // corrida se solapa con la anterior porque la primera tardó de más.
    const [uno, dos] = await Promise.all([reconciliar(), reconciliar()]);

    // La abandonada: cerrada una vez y con su unidad devuelta una vez.
    assert(ordenEnLaBase(abandonada.order_id).estado === 'cancelled',
      `la abandonada quedó en «${ordenEnLaBase(abandonada.order_id).estado}»`);
    assert(reservadoDe(abandonada.producto) === reservadoAbandonada - 1,
      `lo reservado pasó de ${reservadoAbandonada} a ${reservadoDe(abandonada.producto)}: `
      + 'se soltó más de una vez');
    assert(reservaDe(abandonada.order_id) === 'liberada',
      `la reserva quedó en «${reservaDe(abandonada.order_id)}»`);

    // La cobrada: pagada, con un solo descuento y una sola venta contada.
    assert(ordenEnLaBase(cobrada.order_id).estado === 'paid',
      `la cobrada quedó en «${ordenEnLaBase(cobrada.order_id).estado}»`);
    assert(stockDe(cobrada.producto) === stockCobrada - 1,
      `el stock pasó de ${stockCobrada} a ${stockDe(cobrada.producto)}: se descontó de más`);
    assert(ventasDe(cobrada.producto) === ventasCobrada + 1,
      `las ventas pasaron de ${ventasCobrada} a ${ventasDe(cobrada.producto)}`);
    assert(intentosDe(cobrada.order_id).length === 1,
      `quedaron ${intentosDe(cobrada.order_id).length} intentos para un solo pago`);

    // Y una tercera corrida, ya con todo resuelto, no encuentra nada que hacer
    // con estas dos: la entrada es idempotente y no sólo entre paralelas.
    const tercera = await reconciliar();
    assert(reservadoDe(abandonada.producto) === reservadoAbandonada - 1
      && stockDe(cobrada.producto) === stockCobrada - 1
      && ventasDe(cobrada.producto) === ventasCobrada + 1,
      `la tercera corrida movió algo: ${JSON.stringify(tercera)}`);

    return 'dos barridos en paralelo sobre una orden abandonada y una cobrada sin avisar: '
      + `1 cancelación, 1 unidad devuelta, 1 descuento y 1 venta contada `
      + `(${JSON.stringify(uno)} y ${JSON.stringify(dos)}); la tercera corrida no movió nada`;
  } finally {
    await doble.cerrar();
    try {
      if (vendedor) await desvincular(vendedor.token);
      await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    } catch { /* la limpieza no tapa el motivo real */ }
  }
});

// ============================================================================
// Documentación fiscal de vendedores, revisada a mano (casos 101 a 108)
//
// La pieza es una cortesía y es informativa: no habilita ni bloquea nada. Por
// eso la regresión mira dos cosas distintas —que la revisión funcione y que
// NO cambie el marketplace— y la segunda vale tanto como la primera.
// ============================================================================

// Dónde guarda la aplicación las constancias. Se le pregunta a ella en vez de
// suponer la ruta: es configurable, y contar archivos en la carpeta
// equivocada daría siempre cero y siempre verde.
const CARPETA_DOCUMENTOS = correrEnLaApi(
  'from app.core.config import settings\nprint(settings.DOCUMENTOS_DIR)',
  '',
).trim();

// Los PDF de constancias viven donde vive la aplicacion. Bajo Docker esa
// carpeta es del contenedor, asi que preguntarle al sistema de archivos del
// host es preguntarle a la maquina equivocada: `existsSync` contesta que no
// aunque el archivo este, y el caso se pone rojo con la API sana. Se pregunta
// donde estan, con el mismo puente que ya se usa para leer la configuracion.
function existeDocumento(nombre) {
  const salida = correrEnLaApi(
    'import os, sys\n'
    + 'from app.core.config import settings\n'
    + 'nombre = sys.stdin.read().strip()\n'
    + 'print("SI" if nombre and os.path.exists(os.path.join(settings.DOCUMENTOS_DIR, nombre)) else "NO")',
    nombre,
  );
  return salida.trim().split(/\r?\n/).at(-1) === 'SI';
}

function documentosEnDisco() {
  try {
    const salida = correrEnLaApi(
      'import os\n'
      + 'from app.core.config import settings\n'
      + 'carpeta = settings.DOCUMENTOS_DIR\n'
      + 'nombres = os.listdir(carpeta) if os.path.isdir(carpeta) else []\n'
      + 'print(len([n for n in nombres if n.endswith(".pdf")]))',
      '',
    );
    return Number(salida.trim().split(/\r?\n/).at(-1));
  } catch {
    return 0;
  }
}

function filasDeDocumentacion() {
  return queryCount('SELECT COUNT(*) FROM documentacion_de_vendedores');
}

function documentacionDe(userId) {
  // El `'fin'` de la última columna no es decorativo: `querySql` recorta la
  // salida, así que una columna vacía al final se pierde y la fila vuelve con
  // menos campos de los que se pidieron. Con un valor fijo al final, las tres
  // que pueden venir nulas quedan siempre adentro.
  const [fila] = queryRows(`
    SELECT estado::text, cuit, razon_social, archivo_ruta,
           COALESCE(motivo_de_rechazo, ''), COALESCE(revisado_por_id, ''),
           COALESCE(revisado_el::text, ''), 'fin'
    FROM documentacion_de_vendedores WHERE user_id = ${sqlLiteral(userId)}
  `);
  if (!fila) return null;
  const [estado, cuit, razon, ruta, motivo, revisor, revisadoEl] = fila;
  // psql devuelve NULL como cadena vacía. Se normaliza acá y no en cada
  // afirmación: comparar contra '' en una y contra null en otra es la clase
  // de detalle que hace pasar una prueba que no probó nada.
  const oNulo = (valor) => (valor === '' ? null : valor);
  return {
    estado, cuit, razon, ruta,
    motivo: oNulo(motivo),
    revisor: oNulo(revisor),
    revisadoEl: oNulo(revisadoEl),
  };
}

function auditoriasDe(documentacionId, accion) {
  return queryCount(`
    SELECT COUNT(*) FROM audit_logs
    WHERE entity = 'documentacion_de_vendedor'
      AND entity_id = ${sqlLiteral(documentacionId)}
      AND action = ${sqlLiteral(accion)}
  `);
}

function idDeLaDocumentacion(userId) {
  const [fila] = queryRows(`
    SELECT id FROM documentacion_de_vendedores WHERE user_id = ${sqlLiteral(userId)}
  `);
  return fila ? fila[0] : null;
}

// Un PDF chico pero de verdad: firma al principio y marcador de fin al final,
// que es lo que mira el servidor. No se versiona ningún archivo de prueba.
function pdfDePrueba(marca = 'constancia') {
  return Buffer.from(
    '%PDF-1.4\n'
    + '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    + '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n'
    + `% ${marca}\n`
    + 'trailer<</Root 1 0 R>>\n%%EOF\n',
  );
}

// Un JPEG con el nombre cambiado a .pdf. La extensión y el tipo declarado los
// elige quien sube; la firma no.
function jpegDisfrazado() {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from('JFIF'),
    Buffer.alloc(512, 0x20),
    Buffer.from('%%EOF'),
  ]);
}

async function presentarDocumentacion({
  token, cuit, razonSocial, archivo, nombre = 'constancia.pdf', tipo = 'application/pdf',
}) {
  const form = new FormData();
  form.append('cuit', cuit);
  form.append('razon_social', razonSocial);
  form.append('archivo', new Blob([archivo], { type: tipo }), nombre);
  const respuesta = await fetch(`${API_URL}/documentacion`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const crudo = await respuesta.text();
  const data = crudo ? JSON.parse(crudo) : null;
  if (!respuesta.ok) {
    throw new Error(
      `POST /documentacion respondió HTTP ${respuesta.status}: ${data?.detail || crudo}`,
    );
  }
  return { status: respuesta.status, data };
}

// Los cuatro CUIT de prueba son formalmente válidos: el dígito verificador
// está bien calculado. Uno inválido se arma cambiándole el último dígito.
const CUIT_VENDEDOR = '30-71009999-1';
const CUIT_SEGUNDO = '30-11111111-8';
const CUIT_TERCERO = '27-12345678-0';
const CUIT_ROTO = '30710099999';

// Un segundo vendedor propio de estos casos: hace falta alguien de quien el
// primero NO pueda leer nada, y hace falta poder afirmar que el distintivo
// aparece para uno y no para el otro.
async function segundoVendedor() {
  if (state.docSegundo) return state.docSegundo;
  const credenciales = {
    email: `smoke.doc.${Date.now()}@example.com`,
    password: 'smokedoc123',
    full_name: 'Vendedora Documentación',
    phone: '+54 11 5555 0808',
    role: 'user',
  };
  await registrarYVerificar(credenciales);
  const ingreso = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: credenciales.email, password: credenciales.password },
  });
  state.docSegundo = {
    token: ingreso.data.access_token,
    id: ingreso.data.user.id,
    email: credenciales.email,
  };
  return state.docSegundo;
}

// Qué presentación está viendo la cola ahora mismo. Toda decisión viaja con
// este valor: la fila sobrevive al reemplazo, así que el `id` solo no alcanza
// para saber qué papel se revisó.
async function presentacionEnLaCola(documentacionId, admin) {
  const cola = await apiRequest('/admin/documentacion', { token: admin });
  const fila = cola.data.items.find((i) => i.id === documentacionId);
  assert(fila, `la cola no trae la documentación ${documentacionId}`);
  return fila.presentado_el;
}

// Decidir como lo hace la interfaz: primero mira la cola, después decide sobre
// lo que la cola mostró.
async function decidirDocumentacion(admin, documentacionId, decision, motivo) {
  const presentadoEl = await presentacionEnLaCola(documentacionId, admin);
  return apiRequest(`/admin/documentacion/${documentacionId}/decidir`, {
    method: 'POST',
    token: admin,
    body: { decision, motivo, presentado_el: presentadoEl },
  });
}

async function tokenDeAdmin() {
  if (state.docAdminToken) return state.docAdminToken;
  const ingreso = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'admin@topgreen.com', password: 'admin123' },
  });
  state.docAdminToken = ingreso.data.access_token;
  return state.docAdminToken;
}

await runCase(101, 'Documentación: nadie lee ni toca la de otro', async () => {
  const admin = await tokenDeAdmin();
  const otro = await segundoVendedor();

  // El vendedor del seed presenta; la segunda cuenta no presenta nada.
  await presentarDocumentacion({
    token: state.sellerToken,
    cuit: CUIT_VENDEDOR,
    razonSocial: 'Campo Verde SRL',
    archivo: pdfDePrueba('del vendedor'),
  });
  const documentacionId = idDeLaDocumentacion(state.sellerId);
  assert(documentacionId, 'la presentación del vendedor no quedó en la base');

  // 1. Las rutas del titular no aceptan de quién es: operan sobre quien pide.
  // Por eso la segunda cuenta, preguntando lo mismo, no ve nada del primero.
  const ajena = await apiRequest('/documentacion', { token: otro.token });
  assert(ajena.data.estado === 'sin_presentacion',
    `la segunda cuenta vio documentación ajena: ${JSON.stringify(ajena.data)}`);

  const archivoAjeno = await expectApiError(404, () =>
    apiRequest('/documentacion/archivo', { token: otro.token }));
  assert(/no presentaste/i.test(archivoAjeno), `motivo inesperado: ${archivoAjeno}`);

  // 2. Reemplazar tampoco alcanza al de otro: la segunda cuenta presentando
  // crea LO SUYO y deja intacta la presentación del primero.
  const rutaAntes = documentacionDe(state.sellerId).ruta;
  await presentarDocumentacion({
    token: otro.token,
    cuit: CUIT_SEGUNDO,
    razonSocial: 'La Segunda SA',
    archivo: pdfDePrueba('de la segunda'),
  });
  const delPrimero = documentacionDe(state.sellerId);
  assert(delPrimero.ruta === rutaAntes,
    'presentar desde otra cuenta cambió el archivo del primero');
  assert(documentacionDe(otro.id).razon === 'La Segunda SA',
    'la segunda cuenta no dejó su propia presentación');

  // 3. Un no administrador no ve la cola, ni un PDF ajeno, ni decide.
  const cola = await expectApiError(403, () =>
    apiRequest('/admin/documentacion', { token: state.sellerToken }));
  const archivoPorAdmin = await expectApiError(403, () =>
    apiRequest(`/admin/documentacion/${documentacionId}/archivo`, { token: otro.token }));
  const decision = await expectApiError(403, () =>
    apiRequest(`/admin/documentacion/${documentacionId}/decidir`, {
      method: 'POST',
      token: otro.token,
      body: { decision: 'aprobada', presentado_el: new Date().toISOString() },
    }));
  assert(/administradores/i.test(cola), `motivo inesperado en la cola: ${cola}`);

  // 4. Y el administrador sí llega a las dos cosas.
  const colaAdmin = await apiRequest('/admin/documentacion?estado=pendiente', { token: admin });
  assert(colaAdmin.data.items.some((i) => i.user_id === state.sellerId),
    'la cola del administrador no trae la presentación pendiente');

  return 'titular aislado por construcción (la ruta no toma user_id); no admin: '
    + `403 en cola, archivo y decisión; la cola del admin trae ${colaAdmin.data.total} fila(s)`;
});

await runCase(102, 'Documentación: lo inválido no deja fila ni archivo huérfano', async () => {
  const otro = await segundoVendedor();
  const filasAntes = filasDeDocumentacion();
  const archivosAntes = documentosEnDisco();
  const estadoAntes = documentacionDe(otro.id);

  const grande = Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.alloc(6 * 1024 * 1024, 0x30),
    Buffer.from('\n%%EOF\n'),
  ]);

  const rechazos = {};
  rechazos.cuit = await expectApiError(400, () => presentarDocumentacion({
    token: otro.token, cuit: CUIT_ROTO, razonSocial: 'La Segunda SA',
    archivo: pdfDePrueba(),
  }));
  rechazos.tamano = await expectApiError(400, () => presentarDocumentacion({
    token: otro.token, cuit: CUIT_SEGUNDO, razonSocial: 'La Segunda SA',
    archivo: grande,
  }));
  rechazos.tipo = await expectApiError(400, () => presentarDocumentacion({
    token: otro.token, cuit: CUIT_SEGUNDO, razonSocial: 'La Segunda SA',
    archivo: pdfDePrueba(), tipo: 'image/jpeg',
  }));
  rechazos.disfrazado = await expectApiError(400, () => presentarDocumentacion({
    token: otro.token, cuit: CUIT_SEGUNDO, razonSocial: 'La Segunda SA',
    archivo: jpegDisfrazado(),
  }));
  rechazos.extension = await expectApiError(400, () => presentarDocumentacion({
    token: otro.token, cuit: CUIT_SEGUNDO, razonSocial: 'La Segunda SA',
    archivo: pdfDePrueba(), nombre: 'constancia.jpg',
  }));
  rechazos.razon = await expectApiError(400, () => presentarDocumentacion({
    token: otro.token, cuit: CUIT_SEGUNDO, razonSocial: '   ',
    archivo: pdfDePrueba(),
  }));

  assert(/verificador/i.test(rechazos.cuit), `el CUIT roto no explica por qué: ${rechazos.cuit}`);
  assert(/5 MB/.test(rechazos.tamano), `el tamaño no dice el máximo: ${rechazos.tamano}`);
  assert(/firma de un PDF/i.test(rechazos.disfrazado),
    `el disfrazado no se rechaza por la firma: ${rechazos.disfrazado}`);

  // Ni una fila de más ni un archivo de más: el rechazo es antes de escribir.
  assert(filasDeDocumentacion() === filasAntes,
    `quedaron ${filasDeDocumentacion() - filasAntes} filas de una presentación rechazada`);
  assert(documentosEnDisco() === archivosAntes,
    `quedaron ${documentosEnDisco() - archivosAntes} archivos huérfanos en disco`);

  const estadoDespues = documentacionDe(otro.id);
  assert(estadoDespues.ruta === estadoAntes.ruta && estadoDespues.cuit === estadoAntes.cuit,
    'un rechazo pisó la presentación anterior');

  return `6 rechazos (CUIT, tamaño, tipo declarado, firma, extensión, razón social) `
    + `con ${filasAntes} filas y ${archivosAntes} archivos intactos`;
});

await runCase(103, 'Documentación: aprobar enciende el distintivo, y sólo el de ese vendedor', async () => {
  const admin = await tokenDeAdmin();
  const otro = await segundoVendedor();
  const documentacionId = idDeLaDocumentacion(state.sellerId);

  // Antes de la decisión: pendiente y sin distintivo en ninguna parte.
  const [productoDelVendedor] = queryRows(`
    SELECT id FROM products
    WHERE seller_id = ${sqlLiteral(state.sellerId)} AND status = 'ACTIVE'
    LIMIT 1
  `);
  assert(productoDelVendedor, 'el vendedor no tiene publicaciones activas');
  const productoId = productoDelVendedor[0];

  const antes = await apiRequest(`/catalog/products/${productoId}`);
  assert(antes.data.seller.documentacion_revisada === false,
    'el distintivo ya estaba encendido con la documentación pendiente');

  const decidida = await decidirDocumentacion(admin, documentacionId, 'aprobada');
  assert(decidida.data.estado === 'aprobada', `quedó en «${decidida.data.estado}»`);

  const enLaBase = documentacionDe(state.sellerId);
  assert(enLaBase.estado === 'APROBADA', `en la base quedó «${enLaBase.estado}»`);
  assert(enLaBase.revisor && enLaBase.revisadoEl,
    'la aprobación quedó sin autor o sin fecha');
  assert(auditoriasDe(documentacionId, 'documentacion_revisada') === 1,
    `quedaron ${auditoriasDe(documentacionId, 'documentacion_revisada')} transiciones auditadas`);

  // El distintivo, en los dos lugares que lo muestran.
  const detalle = await apiRequest(`/catalog/products/${productoId}`);
  assert(detalle.data.seller.documentacion_revisada === true,
    'el detalle no muestra el distintivo después de aprobar');
  const reputacion = await apiRequest(`/ratings/user/${state.sellerId}`);
  assert(reputacion.data.documentacion_revisada === true,
    'la reputación no muestra el distintivo después de aprobar');

  // Y sólo el de ese vendedor: el otro sigue pendiente y sin distintivo.
  const reputacionAjena = await apiRequest(`/ratings/user/${otro.id}`);
  assert(reputacionAjena.data.documentacion_revisada === false,
    'aprobar una documentación encendió el distintivo de otro vendedor');

  // Nada del dato fiscal sale a lo público.
  const publico = JSON.stringify(detalle.data) + JSON.stringify(reputacion.data);
  for (const secreto of ['30-71009999-1', '30710099991', 'Campo Verde SRL', '.pdf', 'cuit']) {
    assert(!publico.includes(secreto),
      `la respuesta pública filtró «${secreto}»`);
  }

  return 'aprobada con autor y fecha, 1 transición auditada, distintivo en detalle y '
    + 'reputación, apagado en el otro vendedor y sin CUIT, razón social ni archivo a la vista';
});

await runCase(104, 'Documentación: el rechazo exige motivo y se puede corregir', async () => {
  const admin = await tokenDeAdmin();
  const otro = await segundoVendedor();
  const documentacionId = idDeLaDocumentacion(otro.id);

  const sinMotivo = await expectApiError(400, () =>
    decidirDocumentacion(admin, documentacionId, 'rechazada'));
  assert(/motivo/i.test(sinMotivo), `no explica que falta el motivo: ${sinMotivo}`);
  assert(documentacionDe(otro.id).estado === 'PENDIENTE',
    'el rechazo sin motivo igual cambió el estado');

  const motivo = 'La constancia está vencida: subí una emitida este año.';
  await decidirDocumentacion(admin, documentacionId, 'rechazada', motivo);

  // El titular ve el motivo, y no ve quién decidió.
  const mia = await apiRequest('/documentacion', { token: otro.token });
  assert(mia.data.estado === 'rechazada', `el titular ve «${mia.data.estado}»`);
  assert(mia.data.motivo_de_rechazo === motivo, 'el titular no ve el motivo real');
  assert(!JSON.stringify(mia.data).toLowerCase().includes('admin'),
    `la respuesta al titular nombra a quien revisó: ${JSON.stringify(mia.data)}`);

  const reputacion = await apiRequest(`/ratings/user/${otro.id}`);
  assert(reputacion.data.documentacion_revisada === false,
    'un rechazo dejó el distintivo encendido');

  // Volver a presentar retira el rechazo y vuelve a pendiente.
  const nueva = await presentarDocumentacion({
    token: otro.token, cuit: CUIT_SEGUNDO, razonSocial: 'La Segunda SA',
    archivo: pdfDePrueba('corregida'),
  });
  assert(nueva.data.estado === 'pendiente', `volvió a «${nueva.data.estado}»`);
  assert(nueva.data.motivo_de_rechazo === null, 'el motivo viejo sigue a la vista');
  const enLaBase = documentacionDe(otro.id);
  assert(enLaBase.motivo === null && !enLaBase.revisor,
    `la fila conserva la revisión anterior: ${JSON.stringify(enLaBase)}`);

  return 'rechazo sin motivo: 400 y estado intacto; con motivo: el titular lo ve, sin '
    + 'distintivo y sin saber quién decidió; volver a presentar retira el rechazo';
});

await runCase(105, 'Documentación: reemplazar una aprobada retira el distintivo y borra la anterior', async () => {
  const documentacionId = idDeLaDocumentacion(state.sellerId);
  const antes = documentacionDe(state.sellerId);
  assert(antes.estado === 'APROBADA', `el caso 103 no dejó una aprobada: ${antes.estado}`);

  const rutaVieja = antes.ruta;
  const archivosAntes = documentosEnDisco();
  const filasAntes = filasDeDocumentacion();

  const reemplazo = await presentarDocumentacion({
    token: state.sellerToken, cuit: CUIT_VENDEDOR, razonSocial: 'Campo Verde SRL',
    archivo: pdfDePrueba('la nueva'),
  });
  assert(reemplazo.data.estado === 'pendiente',
    `reemplazar dejó «${reemplazo.data.estado}» y no pendiente`);

  const despues = documentacionDe(state.sellerId);
  assert(despues.ruta !== rutaVieja, 'el reemplazo reusó el archivo anterior');
  assert(!existeDocumento(rutaVieja),
    `el archivo anterior sigue en disco: ${rutaVieja}`);
  assert(existeDocumento(despues.ruta),
    'el archivo nuevo no quedó en disco');
  assert(documentosEnDisco() === archivosAntes,
    `hay ${documentosEnDisco() - archivosAntes} archivos de más: se conserva sólo el actual`);
  assert(filasDeDocumentacion() === filasAntes, 'el reemplazo duplicó la fila');

  // El distintivo se apaga: lo revisado fue el papel anterior.
  const reputacion = await apiRequest(`/ratings/user/${state.sellerId}`);
  assert(reputacion.data.documentacion_revisada === false,
    'el distintivo sobrevivió al reemplazo de la documentación aprobada');

  // Y la fila es la misma: reemplazar no abre un expediente nuevo.
  assert(idDeLaDocumentacion(state.sellerId) === documentacionId,
    'el reemplazo cambió la identidad de la presentación');
  assert(auditoriasDe(documentacionId, 'documentacion_presentada') >= 2,
    'el reemplazo no quedó auditado');

  return `distintivo apagado, un solo archivo (${archivosAntes}), el anterior borrado del `
    + 'disco y sin fila nueva';
});

await runCase(106, 'Documentación: dos decisiones a la vez dejan una sola', async () => {
  const admin = await tokenDeAdmin();
  const documentacionId = idDeLaDocumentacion(state.sellerId);
  assert(documentacionDe(state.sellerId).estado === 'PENDIENTE',
    'el caso 105 no dejó una pendiente para decidir');

  const auditoriasAntes = auditoriasDe(documentacionId, 'documentacion_revisada');

  // Las dos a la vez de verdad, no una después de la otra: es lo que pasa
  // cuando dos personas miran la misma cola abierta.
  const presentadoEl = await presentacionEnLaCola(documentacionId, admin);
  const decidir = (decision, motivo) => fetch(
    `${API_URL}/admin/documentacion/${documentacionId}/decidir`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, motivo, presentado_el: presentadoEl }),
    },
  ).then(async (r) => ({ status: r.status, cuerpo: await r.text() }));

  const [uno, dos] = await Promise.all([
    decidir('aprobada'),
    decidir('rechazada', 'Falta la constancia del año en curso.'),
  ]);

  const codigos = [uno.status, dos.status].sort();
  assert(codigos[0] === 200 && codigos[1] === 409,
    `las dos decisiones concurrentes devolvieron ${JSON.stringify(codigos)}: `
    + 'una tiene que ganar y la otra enterarse');

  const enLaBase = documentacionDe(state.sellerId);
  assert(enLaBase.estado === 'APROBADA' || enLaBase.estado === 'RECHAZADA',
    `quedó en un estado imposible: ${enLaBase.estado}`);
  assert(enLaBase.revisor && enLaBase.revisadoEl,
    'quedó una decisión sin autor o sin fecha');
  // Y si ganó el rechazo, tiene su motivo; si ganó la aprobación, no lo tiene.
  assert(
    enLaBase.estado === 'RECHAZADA' ? Boolean(enLaBase.motivo) : enLaBase.motivo === null,
    `el motivo no corresponde al estado ganador: ${JSON.stringify(enLaBase)}`,
  );

  const nuevas = auditoriasDe(documentacionId, 'documentacion_revisada') - auditoriasAntes;
  assert(nuevas === 1, `quedaron ${nuevas} transiciones auditadas para una sola decisión`);

  return `una 200 y una 409; quedó «${enLaBase.estado}» con autor y fecha y una sola `
    + 'transición auditada';
});

await runCase(107, 'Documentación: publicar y vender funcionan en los cuatro estados', async () => {
  const admin = await tokenDeAdmin();

  // Una cuenta ESTRENADA acá, y no la de los casos anteriores: «sin
  // presentación» es uno de los cuatro estados que hay que medir, y a esta
  // altura la otra cuenta ya presentó. Reusarla mediría pendiente dos veces
  // y dejaría el primer estado sin probar sin que nada fallara.
  const credenciales = {
    email: `smoke.doc.estados.${Date.now()}@example.com`,
    password: 'smokedoc123',
    full_name: 'Vendedora Cuatro Estados',
    phone: '+54 11 5555 0909',
    role: 'user',
  };
  await registrarYVerificar(credenciales);
  const ingreso = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: credenciales.email, password: credenciales.password },
  });
  const vendedora = { token: ingreso.data.access_token, id: ingreso.data.user.id };

  // Los datos bancarios los carga ella por la ruta de siempre: sin CBU nadie
  // puede cobrar por transferencia, y eso no tiene que ver con esta pieza.
  await apiRequest('/auth/me', {
    method: 'PATCH',
    token: vendedora.token,
    body: { cbu: '0000009000000000000042', alias_bancario: 'demo.smoke.documentacion' },
  });

  // Una categoría de PRODUCTO, no de servicio: el catálogo separa los dos y
  // una publicación de servicio no aparece con el filtro en «productos».
  const [categoria] = queryRows(
    'SELECT id FROM categories WHERE is_service = false ORDER BY name LIMIT 1',
  );
  const resultados = [];

  const publicarYVender = async (estado) => {
    const creado = await apiRequest('/products', {
      method: 'POST',
      token: vendedora.token,
      body: {
        name: `Smoke documentación ${estado} ${Date.now()}`,
        description: 'Publicación de prueba de la revisión documental.',
        category_id: categoria[0],
        price: 15000,
        stock: 5,
        unit: 'unidad',
        locality_id: state.location.localityId,
        publication_type: 'producto',
      },
    });
    const productoId = creado.data.id;

    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    await apiRequest('/cart/items', {
      method: 'POST',
      token: state.buyerToken,
      body: { product_id: productoId, quantity: 1 },
    });
    const opciones = await apiRequest('/orders/payment-options', { token: state.buyerToken });
    const suya = opciones.data.find((o) => o.seller_id === vendedora.id);
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });

    const detalle = await apiRequest(`/catalog/products/${productoId}`);
    const enElCatalogo = await apiRequest(
      `/catalog/products?seller_id=${vendedora.id}&page_size=100`,
    );

    resultados.push({
      estado,
      publica: creado.status === 201 || creado.status === 200,
      enCatalogo: enElCatalogo.data.items.some((p) => p.id === productoId),
      cobra: Boolean(suya && suya.methods.includes('transfer') && suya.cbu),
      distintivo: detalle.data.seller.documentacion_revisada,
    });
  };

  // 1. Sin presentación.
  const inicial = await apiRequest('/documentacion', { token: vendedora.token });
  assert(inicial.data.estado === 'sin_presentacion',
    `la cuenta recién creada ya tenía documentación «${inicial.data.estado}»`);
  await publicarYVender('sin_presentacion');

  // 2. Pendiente.
  await presentarDocumentacion({
    token: vendedora.token, cuit: CUIT_TERCERO, razonSocial: 'Cuatro Estados SA',
    archivo: pdfDePrueba('estados'),
  });
  await publicarYVender('pendiente');

  // 3. Aprobada.
  const suId = idDeLaDocumentacion(vendedora.id);
  await decidirDocumentacion(admin, suId, 'aprobada');
  await publicarYVender('aprobada');

  // 4. Rechazada.
  await presentarDocumentacion({
    token: vendedora.token, cuit: CUIT_TERCERO, razonSocial: 'Cuatro Estados SA',
    archivo: pdfDePrueba('para rechazar'),
  });
  await decidirDocumentacion(admin, suId, 'rechazada', 'Falta el sello de la constancia.');
  await publicarYVender('rechazada');

  assert(resultados.length === 4, `se midieron ${resultados.length} estados y son cuatro`);
  for (const fila of resultados) {
    assert(fila.publica, `con documentación «${fila.estado}» no pudo publicar`);
    assert(fila.enCatalogo, `con documentación «${fila.estado}» la publicación no salió al catálogo`);
    assert(fila.cobra, `con documentación «${fila.estado}» no pudo ofrecer transferencia`);
  }
  const conDistintivo = resultados.filter((r) => r.distintivo).map((r) => r.estado);
  assert(conDistintivo.length === 1 && conDistintivo[0] === 'aprobada',
    `el distintivo apareció en ${JSON.stringify(conDistintivo)} y sólo va en «aprobada»`);

  return 'los cuatro estados publican, salen al catálogo y ofrecen transferencia; el '
    + `distintivo sólo en «aprobada» (${resultados.map((r) => `${r.estado}:${r.distintivo ? 'sí' : 'no'}`).join(', ')})`;
});

await runCase(108, 'Documentación: presentar, revisar y ver el distintivo en el navegador', async () => {
  const admin = await tokenDeAdmin();

  // Cuenta nueva con una publicación propia: hace falta una pantalla donde el
  // distintivo pueda aparecer, y tiene que ser de este vendedor y de nadie más.
  const credenciales = {
    email: `smoke.doc.nav.${Date.now()}@example.com`,
    password: 'smokedoc123',
    full_name: 'Vendedora Navegador',
    phone: '+54 11 5555 1010',
    role: 'user',
  };
  await registrarYVerificar(credenciales);
  const ingreso = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: credenciales.email, password: credenciales.password },
  });
  const vendedora = { token: ingreso.data.access_token, id: ingreso.data.user.id };

  const [categoria] = queryRows(
    'SELECT id FROM categories WHERE is_service = false ORDER BY name LIMIT 1',
  );
  const nombreProducto = `Smoke distintivo ${Date.now()}`;
  await apiRequest('/products', {
    method: 'POST',
    token: vendedora.token,
    body: {
      name: nombreProducto,
      description: 'Publicación para mirar el distintivo en pantalla.',
      category_id: categoria[0],
      price: 21000,
      stock: 4,
      unit: 'unidad',
      locality_id: state.location.localityId,
      publication_type: 'producto',
    },
  });

  const browser = await chromium.launch({ headless: true });
  const observado = {};
  try {
    // --- 1. La vendedora presenta desde su panel ---
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('tu@email.com').fill(credenciales.email);
    await page.getByPlaceholder('••••••••').fill(credenciales.password);
    await page.locator('[class*="_submitButton_"][type="submit"]').click();
    await page.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor({ timeout: 15_000 });

    const seccion = page.locator('[class*="_docSection_"]');
    await seccion.waitFor({ state: 'visible', timeout: 15_000 });
    await seccion.getByText('Sin presentar').waitFor({ state: 'visible', timeout: 15_000 });

    await page.getByRole('button', { name: 'Presentar documentación' }).click();
    await page.locator('#doc-cuit').fill(CUIT_TERCERO);
    await page.locator('#doc-razon-social').fill('Navegador SA');
    await page.locator('#doc-archivo').setInputFiles({
      name: 'constancia-afip.pdf',
      mimeType: 'application/pdf',
      buffer: pdfDePrueba('navegador'),
    });
    await page.getByRole('button', { name: 'Enviar para revisión' }).click();
    await seccion.getByText('Pendiente de revisión')
      .waitFor({ state: 'visible', timeout: 15_000 });
    observado.tituloTrasPresentar = 'Pendiente de revisión';

    // Un rechazo primero, para que el motivo se vea en pantalla y no sólo en
    // la API: es lo único accionable que recibe quien presentó.
    const suId = idDeLaDocumentacion(vendedora.id);
    await decidirDocumentacion(
      admin, suId, 'rechazada', 'La constancia no tiene el CUIT visible.',
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor({ timeout: 15_000 });
    const rechazo = page.locator('[class*="_docRechazo_"]');
    await rechazo.waitFor({ state: 'visible', timeout: 15_000 });
    observado.motivoEnPantalla = (await rechazo.innerText()).includes('CUIT visible');
    assert(observado.motivoEnPantalla, `el motivo no se ve: "${await rechazo.innerText()}"`);
    assert((await rechazo.getAttribute('role')) === 'alert',
      'el motivo del rechazo no se anuncia como aviso');

    // Y vuelve a presentar desde la interfaz, que es el camino de corrección.
    await page.getByRole('button', { name: 'Reemplazar documentación' }).click();
    await page.locator('#doc-cuit').fill(CUIT_TERCERO);
    await page.locator('#doc-razon-social').fill('Navegador SA');
    await page.locator('#doc-archivo').setInputFiles({
      name: 'constancia-corregida.pdf',
      mimeType: 'application/pdf',
      buffer: pdfDePrueba('corregida'),
    });
    await page.getByRole('button', { name: 'Enviar para revisión' }).click();
    await page.locator('[class*="_docSection_"]').getByText('Pendiente de revisión')
      .waitFor({ state: 'visible', timeout: 15_000 });
    await ctx.close();

    // --- 2. La administración revisa desde su cola ---
    const ctxAdmin = await browser.newContext();
    const pa = await ctxAdmin.newPage();
    await pa.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await pa.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await pa.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
    await pa.getByPlaceholder('tu@email.com').fill('admin@topgreen.com');
    await pa.getByPlaceholder('••••••••').fill('admin123');
    await pa.locator('[class*="_submitButton_"][type="submit"]').click();
    await pa.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });

    await pa.getByRole('button', { name: 'Admin' }).first().click();
    await pa.getByRole('heading', { name: 'Panel de Administración' }).waitFor({ timeout: 15_000 });
    await pa.getByRole('button', { name: /Documentación/ }).click();

    const filaDeLaVendedora = pa.locator('tr').filter({ hasText: credenciales.email });
    await filaDeLaVendedora.waitFor({ state: 'visible', timeout: 15_000 });
    observado.enLaCola = true;

    // El PDF no es un enlace: se pide con la sesión. Se comprueba que la
    // descarga la hace la API autenticada y que responde el archivo.
    const [respuestaPdf] = await Promise.all([
      pa.waitForResponse((r) => r.url().includes('/admin/documentacion/')
        && r.url().endsWith('/archivo')),
      filaDeLaVendedora.getByRole('button', { name: /\.pdf$/ }).click(),
    ]);
    observado.pdfHttp = respuestaPdf.status();
    assert(respuestaPdf.status() === 200,
      `abrir la constancia devolvió HTTP ${respuestaPdf.status()}`);
    assert((respuestaPdf.headers()['content-type'] || '').includes('application/pdf'),
      `la constancia no volvió como PDF: ${respuestaPdf.headers()['content-type']}`);

    await filaDeLaVendedora.getByRole('button', { name: 'Aprobar' }).click();
    await pa.locator('tr').filter({ hasText: credenciales.email })
      .waitFor({ state: 'detached', timeout: 15_000 });
    observado.saleDeLaCola = true;
    await ctxAdmin.close();

    // --- 3. El distintivo, en la publicación, para cualquiera ---
    const ctxPublico = await browser.newContext();
    const pp = await ctxPublico.newPage();
    await pp.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await pp.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    await pp.waitForFunction(
      () => document.querySelectorAll('#catalog-category option').length > 1,
    );
    await pp.locator('#catalog-type').selectOption('productos');
    await pp.getByLabel('Buscar en el mercado').fill(nombreProducto);
    await pp.getByLabel('Buscar en el mercado').press('Enter');
    const titulo = pp.getByRole('heading', { name: nombreProducto, exact: true, level: 3 });
    await titulo.waitFor({ state: 'visible', timeout: 15_000 });
    await titulo.click();
    const detalle = pp.getByRole('heading', { name: nombreProducto, exact: true, level: 2 })
      .locator('xpath=ancestor::div[contains(@class,"modal")]');
    await detalle.waitFor({ state: 'visible', timeout: 15_000 });
    const distintivo = detalle.getByText('Documentación revisada');
    await distintivo.waitFor({ state: 'visible', timeout: 15_000 });
    observado.distintivoVisible = true;

    // El texto es exactamente ese. «Vendedor verificado» prometería otra cosa.
    const textoDelDetalle = await detalle.innerText();
    assert(!/verificad/i.test(textoDelDetalle),
      'el detalle dice «verificado», que promete más que una revisión de papeles');
    // Y sigue sin mostrar nada del dato fiscal.
    for (const secreto of ['27-12345678-0', '27123456780', 'Navegador SA', '.pdf']) {
      assert(!textoDelDetalle.includes(secreto),
        `el detalle público muestra «${secreto}»`);
    }
    await ctxPublico.close();
  } finally {
    await browser.close();
  }

  return 'presentó desde el panel (pendiente), vio el motivo del rechazo como aviso, '
    + `corrigió; la cola abrió el PDF con sesión (HTTP ${observado.pdfHttp}) y aprobó; `
    + 'el detalle muestra «Documentación revisada» sin CUIT, razón social ni archivo';
});

await runCase(109, 'Documentación: no se aprueba un papel que nadie abrió', async () => {
  const admin = await tokenDeAdmin();

  // Cuenta propia del caso: hace falta una presentación pendiente y sin
  // historia, y las de los casos anteriores ya pasaron por decisiones.
  const credenciales = {
    email: `smoke.doc.reemplazo.${Date.now()}@example.com`,
    password: 'smokedoc123',
    full_name: 'Vendedora Reemplazo',
    phone: '+54 11 5555 1111',
    role: 'user',
  };
  await registrarYVerificar(credenciales);
  const ingreso = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: credenciales.email, password: credenciales.password },
  });
  const vendedora = { token: ingreso.data.access_token, id: ingreso.data.user.id };

  // A: lo que administración abre y mira.
  await presentarDocumentacion({
    token: vendedora.token, cuit: CUIT_TERCERO, razonSocial: 'Reemplazo SA',
    archivo: pdfDePrueba('el A, el que se revisa'),
  });
  const documentacionId = idDeLaDocumentacion(vendedora.id);
  const laQueSeRevisa = await presentacionEnLaCola(documentacionId, admin);

  // Y se abre de verdad: éste es el archivo que la persona vio.
  const abierto = await apiRequest(
    `/admin/documentacion/${documentacionId}/archivo`, { token: admin },
  );
  assert(abierto.status === 200, `abrir el PDF devolvió HTTP ${abierto.status}`);
  const rutaDeA = documentacionDe(vendedora.id).ruta;

  // B: el titular lo reemplaza mientras la cola sigue abierta en la pantalla.
  await presentarDocumentacion({
    token: vendedora.token, cuit: CUIT_TERCERO, razonSocial: 'Reemplazo SA',
    archivo: pdfDePrueba('el B, el que nadie miró'),
  });
  const rutaDeB = documentacionDe(vendedora.id).ruta;
  assert(rutaDeA !== rutaDeB, 'el reemplazo no cambió el archivo: el caso no prueba nada');
  assert(idDeLaDocumentacion(vendedora.id) === documentacionId,
    'el reemplazo cambió el id: sin id compartido no hay nada que discriminar');

  const auditoriasAntes = auditoriasDe(documentacionId, 'documentacion_revisada');

  // La aprobación llega con lo que la cola mostraba: la presentación A.
  const choque = await expectApiError(409, () =>
    apiRequest(`/admin/documentacion/${documentacionId}/decidir`, {
      method: 'POST',
      token: admin,
      body: { decision: 'aprobada', presentado_el: laQueSeRevisa },
    }));
  assert(/reemplaz/i.test(choque), `el 409 no explica el motivo: ${choque}`);

  // Nada se movió: ni el estado, ni la auditoría, ni el distintivo.
  const despues = documentacionDe(vendedora.id);
  assert(despues.estado === 'PENDIENTE',
    `la presentación quedó en «${despues.estado}» con una decisión que no correspondía`);
  assert(!despues.revisor && !despues.revisadoEl,
    `quedó una revisión registrada: ${JSON.stringify(despues)}`);
  assert(auditoriasDe(documentacionId, 'documentacion_revisada') === auditoriasAntes,
    'se auditó una revisión que no ocurrió');
  const reputacion = await apiRequest(`/ratings/user/${vendedora.id}`);
  assert(reputacion.data.documentacion_revisada === false,
    'el distintivo se encendió sobre un papel que nadie abrió');

  // Recargar la cola y revisar la presentación actual sí decide.
  const buena = await decidirDocumentacion(admin, documentacionId, 'aprobada');
  assert(buena.data.estado === 'aprobada', `quedó en «${buena.data.estado}»`);
  assert(documentacionDe(vendedora.id).ruta === rutaDeB,
    'se aprobó una presentación que ya no era la actual');
  assert(auditoriasDe(documentacionId, 'documentacion_revisada') === auditoriasAntes + 1,
    'la aprobación válida no dejó exactamente una transición');

  return 'aprobar con la versión vieja: 409, sin cambiar el estado, sin auditar y sin '
    + 'distintivo; recargando la cola, la presentación actual se aprueba y deja una '
    + 'sola transición';
});

await runCase(110, 'La carpeta de constancias no puede caer adentro de la pública', async () => {
  // La privacidad de un PDF no puede depender de escribir bien una variable.
  // Si DOCUMENTOS_DIR queda dentro de UPLOAD_DIR, que se publica entero, las
  // constancias pasan a ser descargables **sin que el código falle en ningún
  // lado**: sigue guardando y sirviendo con normalidad. Por eso la aplicación
  // tiene que negarse a arrancar.
  const base = readFileSync('backend/.env.example', 'utf8')
    .replace(/\bCAMBIAR_[A-Z0-9_]+/g, 'valor-de-prueba-para-cargar-settings');

  // Las dos claves se REEMPLAZAN, no se agregan al final: la plantilla ya las
  // declara, y un archivo con la misma clave dos veces deja indefinido cual
  // gana. `cargarConSettings` ahora rechaza el contenido repetido, asi que
  // agregarlas romperia el caso a la vista en vez de medir otra cosa.
  const con = (subidas, documentos) => base
    .replace(/^UPLOAD_DIR=.*$/m, `UPLOAD_DIR=${subidas}`)
    .replace(/^DOCUMENTOS_DIR=.*$/m, `DOCUMENTOS_DIR=${documentos}`);

  const casos = [
    ['la misma carpeta', con('uploads', 'uploads')],
    ['una subcarpeta', con('uploads', 'uploads/constancias')],
    ['dando la vuelta con ..', con('uploads', 'documentos/../uploads/privado')],
    ['con rutas absolutas', con('/data/uploads', '/data/uploads/docs')],
  ];

  const rechazos = [];
  for (const [etiqueta, contenido] of casos) {
    const salida = cargarConSettings(`${contenido}\n`);
    assert(!salida.includes('CARGA_OK'),
      `«${etiqueta}»: la aplicación arrancó con las constancias adentro de lo público`);
    rechazos.push(etiqueta);
  }

  // El mensaje tiene que servirle a quien configura, no sólo decir que no.
  const detalle = cargarConSettings(`${con('uploads', 'uploads/constancias')}\n`);
  assert(/DOCUMENTOS_DIR/.test(detalle) && /UPLOAD_DIR/.test(detalle),
    `el rechazo no nombra las dos variables: ${detalle}`);

  // Y las dos plantillas versionadas siguen cargando: la comprobación nueva no
  // puede romper la configuración que se entrega.
  for (const plantilla of ['backend/.env.example', 'backend/.env.production.example']) {
    const contenido = readFileSync(plantilla, 'utf8')
      .replace(/\b(?:CAMBIAR|GENERAR)_[A-Z0-9_]+/g, 'valor-de-prueba-para-cargar-settings');
    const salida = cargarConSettings(contenido);
    assert(salida.includes('CARGA_OK'), `${plantilla} dejó de cargar: ${salida}`);
  }

  return `${rechazos.length} configuraciones peligrosas rechazadas al arrancar `
    + `(${rechazos.join(', ')}), con las dos variables nombradas en el motivo, y las `
    + 'dos plantillas versionadas cargando';
});

// ============================================================================
// Datos logísticos del transportista (casos 111 a 114)
//
// Tres datos opcionales con tres reglas distintas, y cada caso cuida una:
// el dominio es privado hasta que hay selección, las cargas declaradas no
// filtran, y lo que se escribe se normaliza de una sola forma.
// ============================================================================

const DOMINIO_VIGILADO = 'ZZ 999 XX';

// Un transportista propio de estos casos, con base en el destino que se le
// pida y radio de sobra: lo que se mide acá no es la geografía.
async function transportistaConDatos({ destino, etiqueta, radio = 400, extra = {} }) {
  const credenciales = {
    email: `flete.datos.${etiqueta}.${Date.now()}@example.com`,
    password: 'smoke123',
    full_name: `Flete Datos ${etiqueta} ${Date.now()}`,
    is_carrier: true,
    carrier_base_locality_id: destino,
    carrier_transport: 'Camión con acoplado',
    carrier_transport_certified: true,
    carrier_certification_detail: 'RUTA, cargas generales, prueba',
    carrier_coverage_radius_km: radio,
    carrier_capacity: '30 toneladas',
    ...extra,
  };
  await registrarYVerificar(credenciales);
  const ingreso = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: credenciales.email, password: credenciales.password },
  });
  const [fila] = queryRows(
    `SELECT id FROM users WHERE email = ${sqlLiteral(credenciales.email)}`);
  return {
    ...credenciales,
    etiqueta,
    id: fila[0],
    token: ingreso.data.access_token,
  };
}

// Un carrito de una sola futura orden, con el origen puesto en una localidad
// que el transportista cubre. Devuelve cómo volver a dejar el producto como
// estaba.
async function carritoConOrigen(origenId) {
  // Lo que importa acá es lo que se puede vender HOY, que es `stock` menos lo
  // reservado por compras en curso: mirar sólo `stock` elegía publicaciones
  // que la API rechaza con «Disponible: 0». Y se toma la más holgada en vez de
  // la primera por identificador, porque los identificadores son UUID que el
  // seed genera al azar en cada corrida: ordenar por ahí hacía que el caso
  // dependiera del sorteo y fallara una corrida sí y otra no.
  const [fila] = queryRows(`
    SELECT p.id, COALESCE(p.locality_id, ''), 'fin'
    FROM products p
    WHERE p.status = 'ACTIVE'
      AND p.publication_type <> 'servicio'
      AND COALESCE(p.stock, 0) - COALESCE(p.stock_reservado, 0) > 0
    ORDER BY COALESCE(p.stock, 0) - COALESCE(p.stock_reservado, 0) DESC, p.id
    LIMIT 1
  `);
  assert(fila, 'no hay publicaciones activas con unidades libres para armar el carrito');
  const [producto, origenPrevio] = fila;
  querySql(`UPDATE products SET locality_id = ${sqlLiteral(origenId)} WHERE id = ${sqlLiteral(producto)}`);
  await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
  await apiRequest('/cart/items', {
    method: 'POST', token: state.buyerToken, body: { product_id: producto, quantity: 1 },
  });
  return {
    producto,
    restaurar: () => querySql(
      origenPrevio
        ? `UPDATE products SET locality_id = ${sqlLiteral(origenPrevio)} WHERE id = ${sqlLiteral(producto)}`
        : `UPDATE products SET locality_id = NULL WHERE id = ${sqlLiteral(producto)}`,
    ),
  };
}

function localidadDelPadron(nombre, provincia) {
  const [fila] = queryRows(`
    SELECT id FROM localities
    WHERE name = ${sqlLiteral(nombre)} AND province_name = ${sqlLiteral(provincia)}
    LIMIT 1
  `);
  assert(fila, `el padrón no tiene ${nombre}, ${provincia}`);
  return fila[0];
}

async function candidatosPara(destino) {
  return (await apiRequest(
    `/logistics/compatible-carriers?destination_locality_id=${destino}`,
    { token: state.buyerToken },
  )).data;
}

await runCase(111, 'El dominio no existe antes de elegir, y aparece al elegir', async () => {
  const destino = localidadDelPadron('Pergamino', 'Buenos Aires');
  const transportista = await transportistaConDatos({
    destino,
    etiqueta: 'privado',
    extra: {
      carrier_vehicle_model: 'Scania R450',
      carrier_plate: DOMINIO_VIGILADO,
      carrier_cargo_types: ['maquinaria', 'granos_a_granel'],
    },
  });

  const carrito = await carritoConOrigen(destino);
  try {
    // --- 1. El listado: lo público sí, lo privado no ---
    const listado = await candidatosPara(destino);
    const crudo = JSON.stringify(listado);
    const mio = listado.groups
      .flatMap((g) => g.carriers)
      .find((c) => c.id === transportista.id);
    assert(mio, 'el transportista de la prueba no aparece entre los compatibles');

    assert(mio.vehicle_model === 'Scania R450',
      `la marca no llegó al listado: ${JSON.stringify(mio.vehicle_model)}`);
    assert(JSON.stringify(mio.cargo_declared) === JSON.stringify(['granos_a_granel', 'maquinaria'].map(
      (c) => ({ granos_a_granel: 'Granos a granel', maquinaria: 'Maquinaria agrícola' })[c])),
      `las cargas no llegaron en orden de catálogo: ${JSON.stringify(mio.cargo_declared)}`);

    assert(!crudo.includes(DOMINIO_VIGILADO),
      'el dominio salió en la respuesta de candidatos, que es la de antes de elegir');
    assert(!('plate' in mio), 'el candidato trae el campo del dominio');
    assert(!crudo.includes(transportista.email),
      'el contacto salió antes de seleccionar');

    // Tampoco en el catálogo ni en la reputación, que son públicos de verdad.
    const catalogo = await apiRequest('/catalog/products?page_size=100');
    assert(!JSON.stringify(catalogo.data).includes(DOMINIO_VIGILADO),
      'el dominio aparece en el catálogo');
    const reputacion = await apiRequest(`/ratings/user/${transportista.id}`);
    assert(!JSON.stringify(reputacion.data).includes(DOMINIO_VIGILADO),
      'el dominio aparece en la reputación pública');

    // --- 2. La selección: recién ahí ---
    const grupo = listado.groups.find((g) => g.carriers.some((c) => c.id === transportista.id));
    const elegido = (await apiRequest('/logistics/select-carrier', {
      method: 'POST',
      token: state.buyerToken,
      body: {
        destination_locality_id: destino,
        seller_id: grupo.seller_id,
        carrier_id: transportista.id,
      },
    })).data.carrier;
    assert(elegido.plate === DOMINIO_VIGILADO,
      `al seleccionar, el dominio no vino: ${JSON.stringify(elegido.plate)}`);
    assert(elegido.email === transportista.email, 'al seleccionar no vino el contacto');
    assert(elegido.vehicle_model === 'Scania R450', 'la marca se perdió al seleccionar');

    // --- 3. Cambiar de elegido no arrastra el dominio anterior ---
    const otro = await transportistaConDatos({
      destino,
      etiqueta: 'segundo',
      extra: { carrier_plate: 'AA 111 BB', carrier_vehicle_model: 'Iveco Stralis' },
    });
    const listadoDos = await candidatosPara(destino);
    const grupoDos = listadoDos.groups.find(
      (g) => g.carriers.some((c) => c.id === otro.id));
    assert(grupoDos, 'el segundo transportista no quedó compatible');
    const segundo = (await apiRequest('/logistics/select-carrier', {
      method: 'POST',
      token: state.buyerToken,
      body: {
        destination_locality_id: destino,
        seller_id: grupoDos.seller_id,
        carrier_id: otro.id,
      },
    })).data;
    const crudoSegundo = JSON.stringify(segundo);
    assert(segundo.carrier.plate === 'AA 111 BB',
      `la segunda selección no trajo su dominio: ${segundo.carrier.plate}`);
    assert(!crudoSegundo.includes(DOMINIO_VIGILADO),
      'la segunda selección conserva el dominio del transportista anterior');

    return 'el listado trae marca y cargas y no el dominio ni el contacto; el dominio '
      + 'aparece al seleccionar, y una selección nueva no arrastra la anterior';
  } finally {
    carrito.restaurar();
    try { await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken }); } catch { /* la limpieza no tapa el motivo */ }
  }
});

await runCase(112, 'Las cargas declaradas no filtran ni reordenan a nadie', async () => {
  const destino = localidadDelPadron('Pergamino', 'Buenos Aires');
  // Tres transportistas: uno que declara, uno que declara otra cosa y uno que
  // no declara nada. El último es el que importa: si las cargas filtraran,
  // sería el primero en desaparecer.
  const conCargas = await transportistaConDatos({
    destino, etiqueta: 'concargas',
    extra: { carrier_cargo_types: ['granos_a_granel'] },
  });
  const conOtras = await transportistaConDatos({
    destino, etiqueta: 'conotras',
    extra: { carrier_cargo_types: ['hacienda'] },
  });
  const sinCargas = await transportistaConDatos({ destino, etiqueta: 'sincargas' });

  const carrito = await carritoConOrigen(destino);
  try {
    const idsYOrden = (listado) => listado.groups
      .flatMap((g) => g.carriers)
      .map((c) => c.id);

    const antes = idsYOrden(await candidatosPara(destino));
    for (const quien of [conCargas, conOtras, sinCargas]) {
      assert(antes.includes(quien.id), `${quien.etiqueta} no aparece de entrada`);
    }

    // Ahora se cambia lo declarado de todas las formas posibles: agregar,
    // quitar, reemplazar y declarar por primera vez.
    await apiRequest('/auth/me', {
      method: 'PATCH', token: conCargas.token,
      body: { carrier_cargo_types: ['granos_a_granel', 'refrigerada', 'otra'],
              carrier_cargo_other: 'Semillas certificadas' },
    });
    await apiRequest('/auth/me', {
      method: 'PATCH', token: conOtras.token, body: { carrier_cargo_types: [] },
    });
    await apiRequest('/auth/me', {
      method: 'PATCH', token: sinCargas.token, body: { carrier_cargo_types: ['agroquimicos'] },
    });

    const despues = idsYOrden(await candidatosPara(destino));
    assert(JSON.stringify(antes) === JSON.stringify(despues),
      'cambiar las cargas declaradas cambió el conjunto o el orden de candidatos:\n'
      + `  antes:   ${JSON.stringify(antes)}\n  después: ${JSON.stringify(despues)}`);

    // Y el que no declara nada sigue apareciendo, con su lista vacía.
    const listado = await candidatosPara(destino);
    const vacio = listado.groups.flatMap((g) => g.carriers).find((c) => c.id === conOtras.id);
    assert(vacio, 'el que se quedó sin declarar nada desapareció del directorio');
    assert(Array.isArray(vacio.cargo_declared) && vacio.cargo_declared.length === 0,
      `sin declarar nada la lista tendría que venir vacía: ${JSON.stringify(vacio.cargo_declared)}`);

    // El detalle de «Otra» se muestra pegado a su opción, no suelto.
    const conOtra = listado.groups.flatMap((g) => g.carriers).find((c) => c.id === conCargas.id);
    assert(conOtra.cargo_declared.includes('Otra: Semillas certificadas'),
      `el detalle de «Otra» no se muestra con su opción: ${JSON.stringify(conOtra.cargo_declared)}`);

    return `${antes.length} candidatos antes y los mismos ${despues.length} después, en el `
      + 'mismo orden, tras agregar, vaciar y estrenar declaraciones; el que no declara '
      + 'nada sigue en el directorio';
  } finally {
    carrito.restaurar();
    try { await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken }); } catch { /* idem */ }
  }
});

await runCase(113, 'Los tres datos se guardan como se escriben, con límites explícitos', async () => {
  const destino = localidadDelPadron('Pergamino', 'Buenos Aires');
  const quien = await transportistaConDatos({ destino, etiqueta: 'normaliza' });

  const mio = async () => (await apiRequest('/auth/me', { token: quien.token })).data;

  // 1. Alta sin ninguno de los tres: perfil válido y campos vacíos.
  const inicial = await mio();
  assert(inicial.carrier_vehicle_model === null && inicial.carrier_plate === null,
    `un alta sin los datos nuevos no los deja vacíos: ${JSON.stringify(inicial.carrier_plate)}`);
  assert(Array.isArray(inicial.carrier_cargo_types) && inicial.carrier_cargo_types.length === 0,
    'sin declarar nada, las cargas tendrían que venir como lista vacía');

  // 2. Duplicados, mayúsculas y espacios: una sola forma guardada.
  const guardado = (await apiRequest('/auth/me', {
    method: 'PATCH', token: quien.token,
    body: {
      carrier_cargo_types: ['  MAQUINARIA ', 'maquinaria', 'granos_a_granel', 'Maquinaria'],
      carrier_vehicle_model: '  Scania R450  ',
      carrier_plate: '  AB   123   CD  ',
    },
  })).data;
  assert(JSON.stringify(guardado.carrier_cargo_types) === JSON.stringify(['granos_a_granel', 'maquinaria']),
    `las cargas no quedaron normalizadas: ${JSON.stringify(guardado.carrier_cargo_types)}`);
  assert(guardado.carrier_vehicle_model === 'Scania R450',
    `la marca conservó espacios: ${JSON.stringify(guardado.carrier_vehicle_model)}`);
  assert(guardado.carrier_plate === 'AB 123 CD',
    `el dominio no colapsó los espacios: ${JSON.stringify(guardado.carrier_plate)}`);

  // 3. «Otra» exige detalle, y el detalle se suelta si «Otra» se va.
  const sinDetalle = await expectApiError(400, () => apiRequest('/auth/me', {
    method: 'PATCH', token: quien.token,
    body: { carrier_cargo_types: ['otra'], carrier_cargo_other: '   ' },
  }));
  assert(/Otra/.test(sinDetalle), `el rechazo no explica qué falta: ${sinDetalle}`);

  const conOtra = (await apiRequest('/auth/me', {
    method: 'PATCH', token: quien.token,
    body: { carrier_cargo_types: ['otra'], carrier_cargo_other: '  bidones   de 200 litros ' },
  })).data;
  assert(conOtra.carrier_cargo_other === 'bidones de 200 litros',
    `el detalle no quedó normalizado: ${JSON.stringify(conOtra.carrier_cargo_other)}`);

  const sinOtra = (await apiRequest('/auth/me', {
    method: 'PATCH', token: quien.token, body: { carrier_cargo_types: ['maquinaria'] },
  })).data;
  assert(sinOtra.carrier_cargo_other === null,
    `quitar «Otra» dejó su detalle colgado: ${JSON.stringify(sinOtra.carrier_cargo_other)}`);

  // 4. Lo que no está en el catálogo se rechaza diciendo qué vale.
  const invalida = await expectApiError(400, () => apiRequest('/auth/me', {
    method: 'PATCH', token: quien.token, body: { carrier_cargo_types: ['tractores'] },
  }));
  assert(/granos_a_granel/.test(invalida), `el rechazo no dice cuáles valen: ${invalida}`);

  // 5. Límites explícitos: largo del detalle y cantidad de declaradas.
  const largo = await expectApiError(400, () => apiRequest('/auth/me', {
    method: 'PATCH', token: quien.token,
    body: { carrier_cargo_types: ['otra'], carrier_cargo_other: 'x'.repeat(121) },
  }));
  assert(/120/.test(largo), `el límite del detalle no se dice: ${largo}`);

  // 6. Otro usuario no puede tocar esto, ni el que no es transportista.
  const ajeno = await expectApiError(400, () => apiRequest('/auth/me', {
    method: 'PATCH', token: state.buyerToken, body: { carrier_plate: 'XX 000 XX' },
  }));
  // El motivo exacto importa: si la cuenta no es transportista, el rechazo
  // tiene que ser ése y no «te falta la localidad base», que sería la puerta
  // de un perfil incompleto y no la de no tener perfil.
  assert(/no tiene perfil de transportista/i.test(ajeno),
    `el rechazo no es el de una cuenta sin perfil de transportista: ${ajeno}`);
  // El `'fin'` al final es por `querySql`, que recorta la salida: una columna
  // vacía al final se pierde y la fila vuelve con menos campos de los pedidos.
  const [suyo] = queryRows(
    `SELECT is_carrier::text, COALESCE(carrier_plate, ''), 'fin' FROM users
     WHERE id = ${sqlLiteral(state.buyerId)}`);
  assert(suyo[0] === 'false' && suyo[1] === '',
    `el intento le escribió datos de transportista a una cuenta que no lo es: ${JSON.stringify(suyo)}`);
  const [sigue] = queryRows(
    `SELECT COALESCE(carrier_plate, '') FROM users WHERE id = ${sqlLiteral(quien.id)}`);
  assert(sigue[0] === 'AB 123 CD', `el dominio del transportista cambió: ${sigue[0]}`);

  // 7. Guardar sólo el dominio no borra lo declarado.
  await apiRequest('/auth/me', {
    method: 'PATCH', token: quien.token, body: { carrier_plate: 'CD 456 EF' },
  });
  const final = await mio();
  assert(JSON.stringify(final.carrier_cargo_types) === JSON.stringify(['maquinaria']),
    `editar un campo borró otro: ${JSON.stringify(final.carrier_cargo_types)}`);

  return 'duplicados, mayúsculas y espacios normalizados; «Otra» con detalle obligatorio y '
    + 'soltado al quitarla; catálogo cerrado y límite de 120 anunciados; una edición '
    + 'parcial no pisa el resto';
});

await runCase(114, 'En pantalla: se comparan marca y cargas, el dominio recién al elegir', async () => {
  const escenario = await prepararEscenarioDeFletes();
  const { destino, pedidoA, transportistas } = escenario;

  // Los tres datos, cargados por la ruta de siempre: el propio transportista
  // editando su perfil. El dominio es el que se vigila en el DOM.
  const DOMINIO = 'QQ 777 WW';
  await apiRequest('/auth/me', {
    method: 'PATCH', token: transportistas.amplio.token,
    body: {
      carrier_vehicle_model: 'Scania R450',
      carrier_plate: DOMINIO,
      carrier_cargo_types: ['maquinaria', 'otra'],
      carrier_cargo_other: 'Bidones de 200 litros',
    },
  });

  const browser = await chromium.launch({ headless: true });
  const observado = {};
  try {
    // --- 1. El titular ve y edita sus tres datos en su panel ---
    const ctxTransportista = await browser.newContext();
    const pt = await ctxTransportista.newPage();
    await pt.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await pt.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await pt.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
    await pt.getByPlaceholder('tu@email.com').fill(transportistas.amplio.email);
    await pt.getByPlaceholder('••••••••').fill(transportistas.amplio.password);
    await pt.locator('[class*="_submitButton_"][type="submit"]').click();
    await pt.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });
    await pt.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await pt.getByRole('heading', { name: 'Mi Perfil' }).waitFor({ timeout: 15_000 });

    const suPanel = await pt.locator('[class*="_profileSection_"], form, main').first().innerText()
      .catch(async () => pt.locator('body').innerText());
    const textoPanel = await pt.locator('body').innerText();
    assert(textoPanel.includes('Scania R450'), 'el titular no ve su marca y modelo');
    assert(textoPanel.includes(DOMINIO), 'el titular no ve su propio dominio');
    assert(/Privado/i.test(textoPanel),
      'el panel no le avisa al titular que el dominio no se muestra en el listado');
    assert(/Maquinaria agrícola/.test(textoPanel), 'el titular no ve sus cargas declaradas');
    assert(/Bidones de 200 litros/.test(textoPanel), 'el detalle de «Otra» no se muestra');
    observado.panel = true;
    await ctxTransportista.close();

    // --- 2. El comprador: compara sin dominio, y lo ve al elegir ---
    const ctx = await browser.newContext();
    await ctx.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: state.buyerToken, r: state.buyerRefreshToken });
    const page = await ctx.newPage();

    // Nada de lo que pide la pantalla puede traer el dominio antes de elegir:
    // se vigilan TODAS las respuestas, no sólo la que se mira.
    const fugas = [];
    page.on('response', async (respuesta) => {
      const url = respuesta.url();
      if (!url.includes('/api/') || url.includes('/select-carrier')) return;
      try {
        const cuerpo = await respuesta.text();
        if (cuerpo.includes(DOMINIO)) fugas.push(url);
      } catch { /* una respuesta sin cuerpo legible no aporta */ }
    });

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    const buscador = page.getByLabel('Buscar en el mercado');
    await buscador.fill(pedidoA.nombre);
    await buscador.press('Enter');
    await page.getByRole('heading', { name: pedidoA.nombre, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await accionDeLaTarjeta(page, pedidoA.nombre).click();

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0505');
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');
    await elegirDestino(page, 'Pergamino');

    const seccion = page.locator('[class*="_fletes_"]');
    const grupo = seccion.locator('[class*="_fleteGrupo_"]')
      .filter({ hasText: `Envío de ${nombreDeUsuario(pedidoA.vendedor)}` });
    await grupo.getByRole('radio', { name: /Necesito flete/ }).check();
    await grupo.getByRole('button', { name: new RegExp(`Seleccionar a ${transportistas.amplio.nombre}`) })
      .waitFor({ state: 'visible', timeout: 20_000 });

    // Antes de elegir: marca y cargas sí, dominio y contacto no.
    const comparando = await grupo.innerText();
    assert(comparando.includes('Scania R450'),
      'la tarjeta del candidato no muestra la marca para comparar');
    assert(/Declara transportar:.*Maquinaria agrícola/.test(comparando),
      `la tarjeta no muestra las cargas declaradas: ${comparando.slice(0, 300)}`);
    assert(!comparando.includes(DOMINIO),
      'el dominio está en pantalla antes de elegir transportista');
    assert(!comparando.includes(transportistas.amplio.email),
      'el contacto está en pantalla antes de elegir');
    observado.antes = true;

    // Al elegir: aparece, junto al contacto.
    await grupo.getByRole('button', { name: new RegExp(`Seleccionar a ${transportistas.amplio.nombre}`) })
      .click();
    await grupo.getByText('Transportista elegido').waitFor({ state: 'visible', timeout: 20_000 });
    const elegido = await grupo.innerText();
    assert(elegido.includes(DOMINIO), 'después de elegir, el dominio no aparece');
    assert(elegido.includes(transportistas.amplio.email), 'después de elegir, falta el contacto');
    observado.despues = true;

    // Y al quitarlo, se va con él: no queda un dato privado de una decisión
    // que ya no existe.
    await grupo.getByRole('button', { name: 'Quitar del pedido' }).click();
    await grupo.getByRole('button', { name: new RegExp(`Seleccionar a ${transportistas.amplio.nombre}`) })
      .waitFor({ state: 'visible', timeout: 20_000 });
    const trasQuitar = await grupo.innerText();
    assert(!trasQuitar.includes(DOMINIO), 'el dominio quedó en pantalla después de quitar la selección');
    assert(!trasQuitar.includes(transportistas.amplio.email),
      'el contacto quedó en pantalla después de quitar la selección');
    observado.quitado = true;

    assert(fugas.length === 0,
      `el dominio viajó en ${fugas.length} respuesta(s) que no son la de selección: `
      + fugas.slice(0, 3).join(', '));

    await ctx.close();
  } finally {
    await browser.close();
    escenario.restaurar();
    try { await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken }); } catch { /* idem */ }
  }

  return 'el titular ve y edita los tres datos con el aviso de que el dominio es privado; '
    + 'la tarjeta compara marca y cargas sin dominio ni contacto; elegir los revela y '
    + 'quitar la selección los saca, y ninguna otra respuesta de la pantalla los trajo';
});

await runCase(115, 'Un detalle de «Otra» sin «Otra» no sobrevive, venga del alta o de una edición', async () => {
  const destino = localidadDelPadron('Pergamino', 'Buenos Aires');

  // La suerte del detalle depende de UNA sola cosa: si «otra» quedó declarada.
  // No de si el pedido trajo o no el campo de las cargas. Eso es lo que este
  // caso separa, porque es justo por ahí por donde se colaba.
  const huerfano = 'Bidones sueltos de 200 litros';

  const enBase = (id) => {
    // El `'fin'` es por `querySql`, que recorta la salida: una columna vacía
    // al final se pierde y la fila vuelve con menos campos de los pedidos.
    const [fila] = queryRows(`
      SELECT COALESCE(carrier_cargo_types::text, 'NULO'),
             COALESCE(carrier_cargo_other, 'NULO'),
             (carrier_cargo_other IS NULL)::text,
             'fin'
      FROM users WHERE id = ${sqlLiteral(id)}`);
    return { cargas: fila[0], detalle: fila[1], esNulo: fila[2] === 'true' };
  };

  // 1. En el ALTA: se manda el detalle y no se manda ninguna carga.
  const delAlta = await transportistaConDatos({
    destino, etiqueta: 'huerfano', extra: { carrier_cargo_other: huerfano },
  });
  const altaApi = (await apiRequest('/auth/me', { token: delAlta.token })).data;
  assert(altaApi.carrier_cargo_other === null,
    `el alta guardó un detalle sin «Otra» declarada: ${JSON.stringify(altaApi.carrier_cargo_other)}`);
  const altaSql = enBase(delAlta.id);
  assert(altaSql.esNulo,
    `en la base quedó un detalle huérfano del alta: ${altaSql.detalle}`);

  // 2. En una EDICIÓN, sobre un perfil que no declaró nada: sólo el detalle.
  const editado = await transportistaConDatos({ destino, etiqueta: 'edicion' });
  const soloDetalle = (await apiRequest('/auth/me', {
    method: 'PATCH', token: editado.token, body: { carrier_cargo_other: huerfano },
  })).data;
  assert(soloDetalle.carrier_cargo_other === null,
    `la edición guardó un detalle sin «Otra»: ${JSON.stringify(soloDetalle.carrier_cargo_other)}`);
  assert(enBase(editado.id).esNulo,
    `en la base quedó un detalle huérfano de la edición: ${enBase(editado.id).detalle}`);

  // 3. Y con cargas declaradas que NO incluyen «otra», mandando sólo el detalle.
  await apiRequest('/auth/me', {
    method: 'PATCH', token: editado.token, body: { carrier_cargo_types: ['maquinaria'] },
  });
  const conOtras = (await apiRequest('/auth/me', {
    method: 'PATCH', token: editado.token, body: { carrier_cargo_other: huerfano },
  })).data;
  assert(conOtras.carrier_cargo_other === null,
    `declarando maquinaria se guardó el detalle de «Otra»: ${JSON.stringify(conOtras.carrier_cargo_other)}`);
  assert(JSON.stringify(conOtras.carrier_cargo_types) === JSON.stringify(['maquinaria']),
    `la declaración cambió al mandar sólo el detalle: ${JSON.stringify(conOtras.carrier_cargo_types)}`);

  // 4. El camino legítimo sigue funcionando, y esto es lo que impide que la
  //    corrección sea «borrar el detalle siempre».
  const legitimo = (await apiRequest('/auth/me', {
    method: 'PATCH', token: editado.token,
    body: { carrier_cargo_types: ['maquinaria', 'otra'], carrier_cargo_other: huerfano },
  })).data;
  assert(legitimo.carrier_cargo_other === huerfano,
    `declarando «Otra» no se guardó su detalle: ${JSON.stringify(legitimo.carrier_cargo_other)}`);

  // 5. Con «otra» ya declarada, mandar sólo el detalle lo actualiza: acá el
  //    campo tampoco viaja, y sin embargo el detalle tiene que sobrevivir.
  const actualizado = (await apiRequest('/auth/me', {
    method: 'PATCH', token: editado.token,
    body: { carrier_cargo_other: '  Bidones   de 20 litros  ' },
  })).data;
  assert(actualizado.carrier_cargo_other === 'Bidones de 20 litros',
    `con «Otra» declarada no se pudo actualizar el detalle: ${JSON.stringify(actualizado.carrier_cargo_other)}`);

  // 6. Y al soltar «otra», el detalle se va con ella.
  const sinOtra = (await apiRequest('/auth/me', {
    method: 'PATCH', token: editado.token, body: { carrier_cargo_types: ['maquinaria'] },
  })).data;
  assert(sinOtra.carrier_cargo_other === null,
    `quitar «Otra» dejó su detalle colgado: ${JSON.stringify(sinOtra.carrier_cargo_other)}`);
  assert(enBase(editado.id).esNulo, 'en la base el detalle quedó colgado tras quitar «Otra»');

  return 'un detalle sin «Otra» no se guarda por ninguno de los dos caminos —alta y '
    + 'edición— ni mandando el campo de cargas ni omitiéndolo; con «Otra» declarada se '
    + 'guarda, se actualiza mandando sólo el detalle, y se va cuando «Otra» se va';
});

await runCase(116, 'La cookie sola no dispara ninguna de las cuatro mutaciones del ataque', async () => {
  // Las cuatro reproducciones del CSRF que quedó demostrado en el informe.
  // Multipart es un tipo de contenido «simple»: un sitio ajeno lo manda sin
  // verificación previa y el navegador le pone la cookie. Lo que lo cierra no
  // es CORS —que sólo tapa la respuesta— sino que la cookie no autentica.
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const cookieDelVendedor = `access_token=${vendedor.token}`;
  const pdf = `%PDF-1.4\n${'x'.repeat(400)}\n%%EOF`;
  // Una imagen de verdad: con uno inventado el rechazo sería de la validación
  // de imágenes y no diría nada sobre qué credencial se aceptó.
  const png = RECIBO_PNG;

  const documentacionDe = (email) => {
    // El `'fin'` es por `querySql`, que recorta la salida: una columna vacía
    // al final se pierde y la fila vuelve con menos campos de los pedidos.
    const [fila] = queryRows(`
      SELECT COALESCE(d.razon_social, ''), COALESCE(d.estado::text, ''), 'fin'
      FROM users u LEFT JOIN documentacion_de_vendedores d ON d.user_id = u.id
      WHERE u.email = ${sqlLiteral(email)}`);
    return `${fila[0]}|${fila[1]}`;
  };

  // El tope que declara `POST /products/{id}/images`. Se escribe acá para poder
  // ELEGIR bien, no para relajar nada: el limite real del producto no se toca y
  // este caso tampoco vacia imagenes para fabricarse un verde.
  const TOPE_DE_IMAGENES = 3;

  // La publicacion se elige entre las que TIENEN LUGAR para otra imagen.
  //
  // Antes era `ORDER BY id LIMIT 1` a secas, y los ids del seed son UUID al
  // azar: si la que salia primera ya tenia sus tres imagenes, la carga positiva
  // de mas abajo —la que TIENE que entrar con Bearer— rebotaba con 400 y este
  // caso se ponia rojo con la defensa CSRF intacta. Con dieciseis publicaciones
  // del vendedor y una sola llena en el seed, eso pasaba una de cada dieciseis
  // bases. Medido: reproducido llenando esa publicacion por el camino real.
  //
  // El `ORDER BY` se conserva para que la eleccion sea estable dentro de una
  // misma base; lo que cambia es que ahora sale de un conjunto donde la
  // precondicion del caso se cumple, asi que el resultado ya no depende del
  // sorteo del seed.
  const conLugar = queryRows(`
    SELECT p.id, COUNT(i.id)
    FROM products p
    LEFT JOIN product_images i ON i.product_id = p.id
    WHERE p.seller_id = ${sqlLiteral(vendedor.id)}
    GROUP BY p.id
    HAVING COUNT(i.id) < ${TOPE_DE_IMAGENES}
    ORDER BY p.id
    LIMIT 1`);
  assert(conLugar.length,
    'el vendedor del seed no tiene ninguna publicacion con lugar para otra imagen '
    + `(el tope es ${TOPE_DE_IMAGENES}); sin eso este caso no puede probar la carga `
    + 'positiva y hay que revisar el seed, no relajar el limite');
  const [productoDelVendedor, imagenesAlElegir] = conLugar[0];
  assert(Number(imagenesAlElegir) < TOPE_DE_IMAGENES,
    `la publicacion elegida ya tiene ${imagenesAlElegir} imagenes de ${TOPE_DE_IMAGENES}`);
  const imagenesDe = (producto) => queryCount(
    `SELECT COUNT(*) FROM product_images WHERE product_id = ${sqlLiteral(producto)}`);

  const orden = await crearOrdenTransferencia('Ruta 8 km 300');
  const comprobanteDe = (id) => {
    const [fila] = queryRows(
      `SELECT COALESCE(transfer_receipt_url, ''), 'fin' FROM orders WHERE id = ${sqlLiteral(id)}`);
    return fila[0];
  };

  // Un CUIT con dígito verificador válido: si no, el rechazo sería de la
  // validación del producto y no probaría nada de credenciales.
  const cuit = '20123456786';

  const antes = {
    documentacion: documentacionDe('vendedor@ejemplo.com'),
    imagenes: imagenesDe(productoDelVendedor),
    comprobante: comprobanteDe(orden.order_id),
  };

  // --- 1, 2 y 3: las tres rutas multipart, con la cookie sola
  const intentos = [
    ['documentación fiscal', '/documentacion', cookieDelVendedor, {
      campos: { cuit, razon_social: 'Robada Por CSRF SRL' },
      archivo: { campo: 'archivo', nombre: 'suplantado.pdf', contenido: pdf, tipo: 'application/pdf' },
    }],
    ['imágenes de publicación', `/products/${productoDelVendedor}/images`, cookieDelVendedor, {
      archivo: { campo: 'files', nombre: 'intrusa.png', contenido: png, tipo: 'image/png' },
    }],
    ['comprobante de transferencia', `/orders/${orden.order_id}/transfer-receipt`,
      `access_token=${state.buyerToken}`, {
      archivo: { campo: 'file', nombre: 'falso.png', contenido: png, tipo: 'image/png' },
    }],
  ];

  for (const [etiqueta, ruta, cookie, cuerpo] of intentos) {
    const respuesta = await subirCrudo(ruta, { cookie, ...cuerpo });
    assert(respuesta.status === 401,
      `${etiqueta}: la cookie sola devolvió HTTP ${respuesta.status} en vez de 401`);
    const motivo = String(respuesta.datos?.detail ?? respuesta.datos ?? '');
    assert(!/vendedor@ejemplo\.com|cliente@ejemplo\.com/.test(motivo),
      `${etiqueta}: el rechazo nombra una cuenta: "${motivo}"`);
  }

  assert(documentacionDe('vendedor@ejemplo.com') === antes.documentacion,
    `la documentación cambió: ${antes.documentacion} → ${documentacionDe('vendedor@ejemplo.com')}`);
  assert(imagenesDe(productoDelVendedor) === antes.imagenes,
    `entraron imágenes: ${antes.imagenes} → ${imagenesDe(productoDelVendedor)}`);
  assert(comprobanteDe(orden.order_id) === antes.comprobante,
    'se adjuntó un comprobante con la cookie sola');

  // --- 4: renovar, que es la cuarta mutación y no pasa por la dependencia
  const renovacion = await pedirCrudo('/auth/refresh', {
    method: 'POST', cookie: `refresh_token=${state.buyerRefreshToken}`,
  });
  assert(renovacion.status === 401,
    `renovar con la cookie sola: HTTP ${renovacion.status}`);
  assert(renovacion.galletas.length === 0,
    `renovar rechazado igual emitió ${renovacion.galletas.length} cookies`);
  assert(!renovacion.datos?.access_token, 'renovar rechazado igual emitió un token');

  // --- y lo mismo con la cabecera: las cuatro tienen que seguir andando
  const conCabecera = await subirCrudo('/documentacion', {
    header: vendedor.token,
    campos: { cuit, razon_social: 'Campo Verde SRL' },
    archivo: { campo: 'archivo', nombre: 'constancia.pdf', contenido: pdf, tipo: 'application/pdf' },
  });
  assert(conCabecera.status === 201,
    `con cabecera la documentación no entró: HTTP ${conCabecera.status} ${JSON.stringify(conCabecera.datos)}`);

  const imagenConCabecera = await subirCrudo(`/products/${productoDelVendedor}/images`, {
    header: vendedor.token,
    archivo: { campo: 'files', nombre: 'propia.png', contenido: png, tipo: 'image/png' },
  });
  assert(imagenConCabecera.status < 400,
    `con cabecera la imagen no entró: HTTP ${imagenConCabecera.status} `
    + `${JSON.stringify(imagenConCabecera.datos)} — la publicación elegida tenía `
    + `${imagenesAlElegir} de ${TOPE_DE_IMAGENES} imágenes al empezar`);
  assert(imagenesDe(productoDelVendedor) === antes.imagenes + 1,
    `con cabecera no se sumó la imagen: ${imagenesDe(productoDelVendedor)}`);

  const comprobanteConCabecera = await subirCrudo(
    `/orders/${orden.order_id}/transfer-receipt`, {
      header: state.buyerToken,
      archivo: { campo: 'file', nombre: 'recibo.png', contenido: png, tipo: 'image/png' },
    });
  assert(comprobanteConCabecera.status < 400,
    `con cabecera el comprobante no entró: HTTP ${comprobanteConCabecera.status}`);
  assert(comprobanteDe(orden.order_id) !== antes.comprobante,
    'con cabecera el comprobante no quedó adjunto');

  const renovacionBuena = await pedirCrudo('/auth/refresh', {
    method: 'POST', header: state.buyerRefreshToken,
  });
  assert(renovacionBuena.status === 200 && renovacionBuena.datos?.access_token,
    `con cabecera no se pudo renovar: HTTP ${renovacionBuena.status}`);
  state.buyerToken = renovacionBuena.datos.access_token;
  state.buyerRefreshToken = renovacionBuena.datos.refresh_token;

  return 'las tres cargas multipart y la renovación devuelven 401 con la cookie sola, sin '
    + 'escribir documentación, imágenes ni comprobante y sin emitir credenciales; con la '
    + 'cabecera las cuatro siguen funcionando';
});

await runCase(117, 'En el navegador cruzado: la cookie se guarda, se renueva, se borra y sirve para volver de Mercado Pago', async () => {
  // «Cruzado» de verdad: la página vive en `localhost` y la API en `127.0.0.1`.
  // Son hosts distintos, así que para el navegador son sitios distintos, que es
  // la situación de producción —frontend y Backend en dominios separados— y la
  // única en la que `Lax` significa algo.
  const apiCruzada = API_URL.replace('localhost', '127.0.0.1');
  assert(!FRONTEND_URL.includes('127.0.0.1'),
    'la página y la API quedaron en el mismo host: el caso no probaría nada cruzado');

  const doble = await levantarDoble(MP_PUERTO_DEL_DOBLE);
  const navegador = await chromium.launch({ headless: true });
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  try {
    await desvincular(vendedor.token);
    const ctx = await navegador.newContext();
    const page = await ctx.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    const deSesion = async () => (await ctx.cookies())
      .filter((c) => c.name === 'access_token' || c.name === 'refresh_token');

    // 1. Entrar guarda las dos cookies, y salen `SameSite=None`.
    const entrada = await page.evaluate(async (api) => (await fetch(`${api}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email: 'vendedor@ejemplo.com', password: 'vendedor123' }),
    })).json(), apiCruzada);
    const guardadas = await deSesion();
    assert(guardadas.length === 2,
      `el navegador guardó ${guardadas.length} cookies de sesión en vez de 2`);
    // `None` y no `Lax`, y está medido con control: entre sitios distintos el
    // navegador DESCARTA un `Set-Cookie` marcado `Lax` —no sólo deja de
    // mandarlo, no lo guarda—, así que con `Lax` esta cookie no llegaría a
    // existir y la vuelta de Mercado Pago se quedaría sin a quién reconocer.
    // Que la cookie sea ambiental ya no habilita nada: la seguridad no viene
    // del atributo, viene de que ninguna ruta que mute acepta la cookie.
    for (const galleta of guardadas) {
      assert(galleta.sameSite === 'None',
        `${galleta.name} quedó SameSite=${galleta.sameSite}: entre sitios no se guardaría`);
      assert(galleta.httpOnly, `${galleta.name} dejó de ser HttpOnly`);
      assert(galleta.secure, `${galleta.name} dejó de ser Secure`);
    }
    const primeras = Object.fromEntries(guardadas.map((c) => [c.name, c.value]));

    // 2. Renovar con la cabecera las reemplaza, y las nuevas siguen saliendo
    //    `SameSite=None` por lo mismo que arriba.
    const renovado = await page.evaluate(async ({ api, refresco }) =>
      (await fetch(`${api}/auth/refresh`, {
        method: 'POST', credentials: 'include',
        headers: { Authorization: `Bearer ${refresco}` },
      })).json(), { api: apiCruzada, refresco: entrada.refresh_token });
    assert(renovado.access_token, 'renovar desde el navegador no devolvió token');
    const renovadas = await deSesion();
    // Lo que importa no es que el texto del token cambie —dos JWT emitidos en
    // el mismo segundo para la misma cuenta salen idénticos— sino que la cookie
    // guardada sea la que acaba de emitir el refresco.
    const guardadaAhora = renovadas.find((c) => c.name === 'access_token');
    assert(guardadaAhora && guardadaAhora.value === renovado.access_token,
      'la cookie guardada no es la que emitió el refresco');
    assert(renovadas.length === 2, `tras renovar quedaron ${renovadas.length} cookies`);
    for (const galleta of renovadas) {
      assert(galleta.sameSite === 'None',
        `tras renovar ${galleta.name} quedó SameSite=${galleta.sameSite}`);
      assert(galleta.value.length > 20, `${galleta.name} quedó vacía tras renovar`);
    }

    // 3. Salir las borra, también cruzado.
    await page.evaluate(async (api) => (await fetch(`${api}/auth/logout`, {
      method: 'POST', credentials: 'include',
    })).status, apiCruzada);
    const trasSalir = await deSesion();
    assert(trasSalir.length === 0,
      `cerrar sesión dejó ${trasSalir.length} cookies: ${trasSalir.map((c) => c.name).join(', ')}`);

    // 4. La vuelta de Mercado Pago: navegación de nivel superior entre sitios,
    //    sin ninguna cabecera posible. Es lo único para lo que existe la cookie.
    await page.evaluate(async (api) => (await fetch(`${api}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email: 'vendedor@ejemplo.com', password: 'vendedor123' }),
    })).json(), apiCruzada);
    assert((await deSesion()).length === 2, 'la segunda entrada no dejó cookies');

    const authUrl = await pedirUrlDeVinculo(vendedor.token);
    const callback = (await autorizarEnElDoble(authUrl, 'ok:900001'))
      .replace('localhost', '127.0.0.1');

    await page.goto(callback, { waitUntil: 'domcontentloaded' });
    const destino = new URL(page.url());
    assert(destino.searchParams.get('mp') === 'vinculado',
      `la vuelta no vinculó: ${destino.search} · ${destino.searchParams.get('mp_error')}`);

    const fila = vinculoEnLaBase('vendedor@ejemplo.com');
    assert(fila.cuenta === '900001',
      `la cuenta vinculada no es la del vendedor: ${JSON.stringify(fila.cuenta)}`);
    assert(fila.acceso && fila.refresco, 'no quedaron credenciales guardadas');

    // 5. Y el dueño se sigue comprobando: el mismo state, con la cookie de
    //    otra cuenta, no vincula. La cookie identifica; no autoriza sola.
    await desvincular(vendedor.token);
    const otroAuthUrl = await pedirUrlDeVinculo(vendedor.token);
    const otroCallback = (await autorizarEnElDoble(otroAuthUrl, 'ok:900002'))
      .replace('localhost', '127.0.0.1');
    await page.evaluate(async (api) => (await fetch(`${api}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email: 'cliente@ejemplo.com', password: 'cliente123' }),
    })).json(), apiCruzada);

    await page.goto(otroCallback, { waitUntil: 'domcontentloaded' });
    const ajeno = new URL(page.url());
    assert(ajeno.searchParams.get('mp_error') === 'sesion_distinta',
      `el state ajeno devolvió «${ajeno.searchParams.get('mp_error')}» en vez de sesion_distinta`);
    const sinVinculo = vinculoEnLaBase('vendedor@ejemplo.com');
    assert(!sinVinculo.cuenta,
      `se vinculó con la sesión de otra cuenta: ${sinVinculo.cuenta}`);

    await ctx.close();
    return 'entrar guarda dos cookies HttpOnly y Secure, renovar con cabecera las reemplaza, '
      + 'salir las borra; la vuelta de Mercado Pago —navegación de nivel superior entre '
      + 'sitios— llega con la cookie y vincula, y con la sesión de otra cuenta no vincula';
  } finally {
    await navegador.close();
    await doble.cerrar();
    try { await desvincular(vendedor.token); } catch { /* la limpieza no tapa el motivo real */ }
  }
});

await runCase(118, 'La anatomía la declara la publicación, no la deduce la interfaz', async () => {
  // 1. Todas tienen una de las cuatro, y ninguna contradice a `is_service`.
  //    Ese booleano es el que decide el cobro y la reserva de stock: una
  //    publicación que dijera «insumo» dentro de una categoría de servicio
  //    mostraría stock y «Agregar» sobre algo que nunca descuenta unidades.
  const [conteo] = queryRows(`
    SELECT
      COUNT(*) FILTER (WHERE p.operation_kind NOT IN ('activo','insumo','servicio','logistica')),
      COUNT(*) FILTER (WHERE (p.operation_kind IN ('servicio','logistica')) <> c.is_service),
      COUNT(*), 'fin'
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'ACTIVE'
  `);
  const [fueraDelCatalogo, contradicen, total] = conteo;
  assert(Number(total) > 0, 'no hay publicaciones activas para medir');
  assert(Number(fueraDelCatalogo) === 0,
    `${fueraDelCatalogo} publicaciones tienen una anatomía fuera del catálogo`);
  assert(Number(contradicen) === 0,
    `${contradicen} publicaciones tienen una anatomía que contradice a su categoría`);

  // 2. Las cuatro existen en el catálogo sembrado: si faltara una, la grilla
  //    nunca dibujaría esa anatomía y la puerta pasaría sin haberla mirado.
  const presentes = queryRows(`
    SELECT DISTINCT operation_kind, 'fin' FROM products WHERE status = 'ACTIVE'
  `).map(([kind]) => kind).sort();
  assert(JSON.stringify(presentes) === JSON.stringify(['activo', 'insumo', 'logistica', 'servicio']),
    `faltan anatomías en el catálogo sembrado: ${JSON.stringify(presentes)}`);

  // 3. Y la prueba de que es un dato de la PUBLICACIÓN y no de su categoría:
  //    dos publicaciones de la misma categoría, con anatomías distintas.
  //
  //    Antes esto se comprobaba buscando una categoría mezclada en la base, y
  //    era frágil por un motivo real: el caso 58 baja y vuelve a subir la
  //    migración, y bajar BORRA la columna. Al volver a subir, cada
  //    publicación toma otra vez la omisión de su categoría y la mezcla
  //    desaparece. Se prueba creándola, que no depende del orden ni de lo que
  //    haya hecho el resto de la suite.
  const [categoriaDeProducto] = queryRows(`
    SELECT id, name, 'fin' FROM categories WHERE is_service = false AND slug = 'maquinaria-agricola'
  `);
  const vendedorParaMezcla = (await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  })).data.access_token;
  const localidadParaMezcla = localidadDelPadron('Pergamino', 'Buenos Aires');
  const publicarMezcla = async (anatomia, extra = {}) => (await apiRequest('/products', {
    method: 'POST', token: vendedorParaMezcla,
    body: {
      name: `Smoke mezcla ${anatomia} ${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      description: 'Publicación de prueba de la anatomía por publicación.',
      category_id: categoriaDeProducto[0],
      price: 250000, stock: 4, unit: 'unidad',
      locality_id: localidadParaMezcla,
      publication_type: 'producto',
      operation_kind: anatomia,
      ...extra,
    },
  })).data;

  const comoActivo = await publicarMezcla('activo', { condition: 'usado' });
  const comoInsumo = await publicarMezcla('insumo');
  const mezclaEnBase = queryRows(`
    SELECT operation_kind, 'fin' FROM products
    WHERE id IN (${sqlLiteral(comoActivo.id)}, ${sqlLiteral(comoInsumo.id)})
    ORDER BY operation_kind
  `).map(([kind]) => kind);
  assert(JSON.stringify(mezclaEnBase) === JSON.stringify(['activo', 'insumo']),
    `dos publicaciones de «${categoriaDeProducto[1]}» no conservaron anatomías distintas: `
    + JSON.stringify(mezclaEnBase));

  // 4. La respuesta pública la trae, en el listado y en el detalle.
  const listado = (await apiRequest('/catalog/products?page_size=100')).data;
  const items = listado.products || listado.items || [];
  assert(items.length > 0, 'el catálogo público no devolvió publicaciones');
  const sinAnatomia = items.filter((p) => !p.operation_kind);
  assert(sinAnatomia.length === 0,
    `${sinAnatomia.length} publicaciones del listado público no traen operation_kind`);

  const [unaFila] = queryRows(`
    SELECT id, operation_kind, 'fin' FROM products
    WHERE status = 'ACTIVE' AND operation_kind = 'logistica' ORDER BY id LIMIT 1
  `);
  const detalle = (await apiRequest(`/catalog/products/${unaFila[0]}`)).data;
  assert(detalle.operation_kind === unaFila[1],
    `el detalle dice «${detalle.operation_kind}» y la base «${unaFila[1]}»`);

  return `${total} publicaciones activas con anatomía declarada, ninguna contradice a su categoría; `
    + `las cuatro presentes; dos publicaciones de «${categoriaDeProducto[1]}» conservan `
    + 'anatomías distintas, y el dato viaja en listado y detalle';
});

await runCase(119, 'El alta y la edición no pueden dejar una publicación que contradiga su categoría', async () => {
  const [producto] = queryRows(`
    SELECT id, name, default_operation_kind, 'fin' FROM categories
    WHERE is_service = false AND slug = 'maquinaria-agricola'
  `);
  const [servicio] = queryRows(`
    SELECT id, name, default_operation_kind, 'fin' FROM categories
    WHERE is_service = true AND slug = 'contratistas'
  `);
  assert(producto && servicio, 'faltan las categorías que necesita el caso');

  // El caso se para solo: pide su propia sesión y su propia localidad en vez
  // de heredarlas de un caso anterior, para que una corrida filtrada mida lo
  // mismo que la suite entera.
  const vendedor = (await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  })).data.access_token;
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');

  const base = (extra) => ({
    name: `Smoke anatomía ${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    description: 'Publicación de prueba de la anatomía declarada.',
    price: 100000,
    stock: 3,
    unit: 'unidad',
    locality_id: localidad,
    publication_type: 'producto',
    ...extra,
  });

  // 1. Sin declararla, hereda la que declara la categoría.
  const heredada = await apiRequest('/products', {
    method: 'POST', token: vendedor, body: base({ category_id: producto[0] }),
  });
  assert(heredada.data.operation_kind === producto[2],
    `el alta sin declarar dio «${heredada.data.operation_kind}» y la categoría declara «${producto[2]}»`);

  // 2. Declarándola, manda la publicación.
  const declarada = await apiRequest('/products', {
    method: 'POST', token: vendedor,
    body: base({ category_id: producto[0], operation_kind: 'insumo' }),
  });
  assert(declarada.data.operation_kind === 'insumo',
    `el alta declarando «insumo» guardó «${declarada.data.operation_kind}»`);

  // 3. Una anatomía del otro lado se rechaza, y el rechazo dice cuáles valen.
  const cruzada = await expectApiError(400, () => apiRequest('/products', {
    method: 'POST', token: vendedor,
    body: base({ category_id: producto[0], operation_kind: 'servicio' }),
  }));
  assert(/activo/.test(cruzada) && /insumo/.test(cruzada),
    `el rechazo del alta no dice qué opciones valen: ${cruzada}`);

  // 4. En la edición, lo mismo: no se puede cruzar el límite a mano.
  const cruzadaEnEdicion = await expectApiError(400, () => apiRequest(
    `/products/${declarada.data.id}`,
    { method: 'PATCH', token: vendedor, body: { operation_kind: 'logistica' } },
  ));
  assert(/activo/.test(cruzadaEnEdicion) && /insumo/.test(cruzadaEnEdicion),
    `el rechazo de la edición no dice qué opciones valen: ${cruzadaEnEdicion}`);

  // 5. El tipo de publicación tampoco puede cruzar el límite, y son dos
  //    rechazos distintos con dos mensajes distintos: `servicio` en una
  //    categoría de productos, y `producto` en una de servicios. Sin esto
  //    quedaba una fila que la interfaz lee como servicio y el alta guardó
  //    como producto —con stock y sin ningún campo de servicio—.
  const servicioEnProductos = await expectApiError(400, () => apiRequest('/products', {
    method: 'POST', token: vendedor,
    body: base({ category_id: producto[0], publication_type: 'servicio' }),
  }));
  assert(/es de productos/.test(servicioEnProductos) && /«servicio»/.test(servicioEnProductos),
    `el rechazo del servicio en una categoría de productos no lo explica: ${servicioEnProductos}`);

  const productoEnServicios = await expectApiError(400, () => apiRequest('/products', {
    method: 'POST', token: vendedor,
    body: base({ category_id: servicio[0], publication_type: 'producto' }),
  }));
  assert(/es de servicios/.test(productoEnServicios) && /«producto»/.test(productoEnServicios),
    `el rechazo del producto en una categoría de servicios no lo explica: ${productoEnServicios}`);
  assert(servicioEnProductos !== productoEnServicios,
    'los dos cruces del alta dan el mismo mensaje y no se pueden distinguir');

  // 6. Y mover la publicación al otro lado tampoco: `publication_type` no es
  //    editable, así que el movimiento dejaría la contradicción guardada. Se
  //    frena, dice por qué, y **la fila no se toca**.
  const [antes] = queryRows(`
    SELECT category_id::text, operation_kind, publication_type, COALESCE(stock::text, 'sin stock'), 'fin'
    FROM products WHERE id = ${sqlLiteral(declarada.data.id)}
  `);
  const cruceDeCategoria = await expectApiError(400, () => apiRequest(
    `/products/${declarada.data.id}`,
    { method: 'PATCH', token: vendedor, body: { category_id: servicio[0] } },
  ));
  assert(/No se puede mover/.test(cruceDeCategoria) && new RegExp(servicio[1]).test(cruceDeCategoria),
    `el rechazo del movimiento no dice a dónde no se puede mover: ${cruceDeCategoria}`);
  assert(cruceDeCategoria !== servicioEnProductos && cruceDeCategoria !== productoEnServicios,
    'el rechazo de la edición no se distingue de los del alta');

  const [despues] = queryRows(`
    SELECT category_id::text, operation_kind, publication_type, COALESCE(stock::text, 'sin stock'), 'fin'
    FROM products WHERE id = ${sqlLiteral(declarada.data.id)}
  `);
  assert(JSON.stringify(antes) === JSON.stringify(despues),
    `el rechazo dejó la fila cambiada: antes ${JSON.stringify(antes)} y después ${JSON.stringify(despues)}`);

  // 7. Mover dentro del mismo lado sí se puede, y ahí la anatomía declarada
  //    **sobrevive**: un activo que se muda de «Maquinaria» a «Insumos
  //    agrícolas» sigue siendo un activo. La categoría sólo decide la omisión
  //    para el que no declaró nada; no pisa lo que el vendedor eligió.
  const [otroProducto] = queryRows(`
    SELECT id, name, default_operation_kind, 'fin' FROM categories
    WHERE is_service = false AND slug = 'insumos-agricolas'
  `);
  assert(otroProducto, 'falta la categoría de productos a la que mover');
  assert(otroProducto[2] !== 'activo',
    'la categoría destino declara «activo» y el caso no probaría nada');

  const conActivo = await apiRequest('/products', {
    method: 'POST', token: vendedor,
    body: base({ category_id: producto[0], operation_kind: 'activo', condition: 'usado' }),
  });
  const movida = await apiRequest(`/products/${conActivo.data.id}`, {
    method: 'PATCH', token: vendedor, body: { category_id: otroProducto[0] },
  });
  assert(movida.data.operation_kind === 'activo',
    `al mover a «${otroProducto[1]}» la anatomía declarada se perdió: quedó «${movida.data.operation_kind}»`);

  const [guardada] = queryRows(`
    SELECT p.operation_kind, c.is_service, p.publication_type, 'fin' FROM products p
    JOIN categories c ON c.id = p.category_id WHERE p.id = ${sqlLiteral(conActivo.data.id)}
  `);
  assert((guardada[0] === 'servicio' || guardada[0] === 'logistica') === (guardada[1] === 't' || guardada[1] === true),
    `la fila guardada quedó contradiciendo a su categoría: ${JSON.stringify(guardada)}`);
  assert((guardada[2] === 'servicio') === (guardada[1] === 't' || guardada[1] === true),
    `el tipo de publicación quedó contradiciendo a su categoría: ${JSON.stringify(guardada)}`);

  // Ninguna fila de la base puede estar cruzada, no sólo las de este caso.
  const [cruzadas] = queryRows(`
    SELECT COUNT(*)::text, 'fin' FROM products p JOIN categories c ON c.id = p.category_id
    WHERE (p.publication_type = 'servicio') <> c.is_service
  `);
  assert(cruzadas[0] === '0',
    `quedaron ${cruzadas[0]} publicaciones con el tipo cruzado contra su categoría`);

  // 6. La condición vive con la anatomía: sólo el activo la guarda, y al
  //    dejar de serlo se suelta en vez de quedar escrita sobre algo que ya
  //    no la muestra.
  const conCondicion = await apiRequest('/products', {
    method: 'POST', token: vendedor,
    body: base({ category_id: producto[0], operation_kind: 'activo', condition: 'usado' }),
  });
  const [guardadaCondicion] = queryRows(`
    SELECT COALESCE(condition, 'sin declarar'), 'fin' FROM products WHERE id = ${sqlLiteral(conCondicion.data.id)}
  `);
  assert(guardadaCondicion[0] === 'usado',
    `el activo no guardó su condición: ${JSON.stringify(guardadaCondicion)}`);

  const insumoConCondicion = await apiRequest('/products', {
    method: 'POST', token: vendedor,
    body: base({ category_id: producto[0], operation_kind: 'insumo', condition: 'usado' }),
  });
  const [descartada] = queryRows(`
    SELECT COALESCE(condition, 'sin declarar'), 'fin' FROM products WHERE id = ${sqlLiteral(insumoConCondicion.data.id)}
  `);
  assert(descartada[0] === 'sin declarar',
    `un insumo se quedó con una condición guardada: ${JSON.stringify(descartada)}`);

  await apiRequest(`/products/${conCondicion.data.id}`, {
    method: 'PATCH', token: vendedor, body: { operation_kind: 'insumo' },
  });
  const [soltada] = queryRows(`
    SELECT COALESCE(condition, 'sin declarar'), 'fin' FROM products WHERE id = ${sqlLiteral(conCondicion.data.id)}
  `);
  assert(soltada[0] === 'sin declarar',
    `dejar de ser activo no soltó la condición: ${JSON.stringify(soltada)}`);

  return 'sin declarar hereda la de la categoría y declarada manda la publicación; '
    + 'los tres cruces se rechazan con tres mensajes distintos —servicio en '
    + 'categoría de productos, producto en categoría de servicios y mover la '
    + 'publicación al otro lado, que además deja la fila intacta—; mover dentro '
    + 'del mismo lado conserva la anatomía declarada, ninguna fila de la base queda '
    + 'cruzada, y la condición sólo la guarda el activo y se suelta al dejar de serlo';
});


await runCase(120, '«Mis publicaciones» muestra cada anatomía como es, y no como un producto', async () => {
  // La captura de la entrega anterior mostraba «Muestreo de Suelo» —un
  // servicio— con foto, con «Stock: 3000 unidades» y con el precio impreso a
  // mano. El stock de un servicio es NULL en la base: ese 3000 salía de otra
  // fila del formato, no de un dato del vendedor.
  const vendedor = (await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  })).data;

  const [servicioConPrecio] = queryRows(`
    SELECT p.name, p.price::text, p.pricing_type, p.operation_kind, 'fin' FROM products p
    JOIN users u ON u.id = p.seller_id JOIN categories c ON c.id = p.category_id
    WHERE u.email = 'vendedor@ejemplo.com' AND c.is_service = true AND p.price > 0
    ORDER BY p.created_at LIMIT 1
  `);
  const [productoConStock] = queryRows(`
    SELECT p.name, p.stock::text, COALESCE(p.unit, 'sin unidad'), 'fin' FROM products p
    JOIN users u ON u.id = p.seller_id JOIN categories c ON c.id = p.category_id
    WHERE u.email = 'vendedor@ejemplo.com' AND c.is_service = false AND p.stock > 0
    ORDER BY p.created_at LIMIT 1
  `);
  assert(servicioConPrecio && productoConStock, 'el seed no dejó un servicio y un producto del mismo vendedor');

  // Y uno sin precio publicado, que es el que imprimía «$ 0».
  const [categoriaDeServicio] = queryRows(
    "SELECT id, 'fin' FROM categories WHERE slug = 'acopio'");
  const sinPrecio = `Smoke servicio a cotizar ${Date.now()}`;
  await apiRequest('/products', {
    method: 'POST', token: vendedor.access_token,
    body: {
      name: sinPrecio,
      description: 'Servicio de prueba sin precio publicado, para ver qué imprime el panel.',
      category_id: categoriaDeServicio[0],
      price: 0,
      unit: 'servicio',
      locality_id: localidadDelPadron('Pergamino', 'Buenos Aires'),
      publication_type: 'servicio',
      operation_kind: 'servicio',
      pricing_type: 'a_convenir',
    },
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext();
    await contexto.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      { accessToken: vendedor.access_token, refreshToken: vendedor.refresh_token },
    );
    const page = await contexto.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await page.getByRole('button', { name: 'Mis publicaciones' }).click();
    await page.getByRole('heading', { name: 'Mis publicaciones' }).waitFor();

    const tarjeta = (nombre) => page
      .getByRole('heading', { name: nombre, exact: true, level: 3 })
      .locator('xpath=ancestor::*[contains(@class,"productCard")]');

    // 1. El servicio con precio: sin stock, sin fotografía, con su modalidad.
    const conPrecio = tarjeta(servicioConPrecio[0]);
    await conPrecio.waitFor({ timeout: 20_000 });
    const textoServicio = await conPrecio.innerText();
    assert(!/Stock/i.test(textoServicio),
      `el servicio sigue mostrando stock: ${JSON.stringify(textoServicio)}`);
    assert(!/Sin registro fotogr/i.test(textoServicio) && !/No pudimos cargar/i.test(textoServicio),
      `el servicio sigue reservando lugar para una fotografía: ${JSON.stringify(textoServicio)}`);
    assert(await conPrecio.locator('img, [role="img"]').count() === 0,
      'el servicio dibuja una imagen en el panel');
    // El distintivo de estado tiene que seguir DENTRO de su tarjeta: al sacarle
    // la caja de la foto se quedó sin ancestro posicionado y se fue a la
    // esquina del panel, lejos de la publicación que describe.
    // Y dice «Activo», no «Agotado»: un servicio no reserva unidades, así que
    // no se agota. La fila igual guarda stock 0 —es el valor por omisión de la
    // columna—, y con eso alcanzaba para mostrar agotado todo lo publicado.
    assert(/^Activo$/m.test(textoServicio),
      `la tarjeta del servicio no muestra su estado como corresponde: ${JSON.stringify(textoServicio)}`);
    // El rótulo es el de SU anatomía: el seed puede darnos un servicio o una
    // publicación de logística, y decir «Servicio» sobre un flete sería el
    // mismo error que este caso persigue.
    const etiquetaEsperada = { servicio: 'Servicio', logistica: 'Logística' }[servicioConPrecio[3]];
    assert(etiquetaEsperada, `anatomía inesperada en el seed: ${servicioConPrecio[3]}`);
    assert(textoServicio.toUpperCase().includes(etiquetaEsperada.toUpperCase()),
      `la tarjeta no dice que es «${etiquetaEsperada}»: ${JSON.stringify(textoServicio)}`);
    const miles = Number(servicioConPrecio[1]).toLocaleString('es-AR', { maximumFractionDigits: 0 });
    assert(textoServicio.includes(miles),
      `el precio no salió por el formateador compartido: esperaba ${miles} en ${JSON.stringify(textoServicio)}`);
    assert(!/\$\s*0(\D|$)/.test(textoServicio),
      `el servicio con precio imprimió cero: ${JSON.stringify(textoServicio)}`);

    // 2. El servicio sin precio dice «A cotizar» y no «$ 0».
    const aCotizar = tarjeta(sinPrecio);
    await aCotizar.waitFor({ timeout: 20_000 });
    const textoSinPrecio = await aCotizar.innerText();
    assert(/A cotizar/.test(textoSinPrecio),
      `el servicio sin precio no dice «A cotizar»: ${JSON.stringify(textoSinPrecio)}`);
    assert(!/\$/.test(textoSinPrecio),
      `el servicio sin precio imprimió un importe: ${JSON.stringify(textoSinPrecio)}`);
    assert(/A convenir/.test(textoSinPrecio),
      `la modalidad no salió por el formateador compartido: ${JSON.stringify(textoSinPrecio)}`);
    assert(!/Agotado/.test(textoSinPrecio),
      `un servicio recién publicado aparece agotado: ${JSON.stringify(textoSinPrecio)}`);

    // 3. El producto conserva lo suyo: stock con su unidad y lugar de foto.
    const producto = tarjeta(productoConStock[0]);
    await producto.waitFor({ timeout: 20_000 });
    const textoProducto = await producto.innerText();
    const cantidad = Number(productoConStock[1]).toLocaleString('es-AR');
    assert(textoProducto.includes(`Stock: ${cantidad}`),
      `el producto perdió su stock formateado: esperaba «Stock: ${cantidad}» en ${JSON.stringify(textoProducto)}`);
    if (productoConStock[2] !== 'sin unidad') {
      assert(textoProducto.includes(productoConStock[2]),
        `el stock del producto no dice la unidad: ${JSON.stringify(textoProducto)}`);
    }
    assert(await producto.locator('img, [role="img"]').count() > 0,
      'el producto dejó de mostrar su lugar de fotografía');
    // Y el lugar de la foto es el del sistema, no un dibujo escondido: el panel
    // tenía su propia copia de un SVG en data-URI que decía «Sin Imagen».
    assert(await producto.locator('img[src^="data:"]').count() === 0,
      'el panel sigue metiendo una imagen inventada en data-URI');

    await contexto.close();
  } finally {
    await browser.close();
  }

  return 'en el panel del vendedor el servicio no muestra stock, no reserva lugar '
    + 'para una foto que no puede tener y dice su modalidad; el servicio sin precio '
    + 'dice «A cotizar» en vez de $ 0; y el producto conserva stock con unidad y su '
    + 'lugar de fotografía';
});

await runCase(121, 'Se puede publicar sin fotografía, y el sistema lo dice en vez de esconderlo', async () => {
  // El handoff declara la fotografía opcional con respaldo neutro, y el alta la
  // exigía: sin una imagen el formulario no dejaba publicar. Eso empuja al
  // vendedor a subir cualquier cosa con tal de poder vender.
  // El caso se para solo: su sesión, su categoría y su localidad, para que una
  // corrida filtrada mida lo mismo que la suite entera.
  const vendedor = (await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  })).data;
  const [categoria] = queryRows(`
    SELECT name, 'fin' FROM categories WHERE is_service = false AND is_active = true
    ORDER BY name LIMIT 1
  `);
  const [ubicacion] = queryRows(`
    SELECT l.province_id, l.id, 'fin' FROM localities l
    WHERE l.name = 'Pergamino' AND l.province_name = 'Buenos Aires' LIMIT 1
  `);
  assert(categoria && ubicacion, 'faltan categoría o localidad para completar el formulario');
  const [vendedorId] = queryRows(
    "SELECT id::text, 'fin' FROM users WHERE email = 'vendedor@ejemplo.com'");

  const nombre = `Producto Smoke Sin Foto ${Date.now()}`;
  let demora = 'sin medir';
  const browser = await chromium.launch({ headless: true });
  const erroresDePagina = [];

  // Qué se ve DE VERDAD donde tiene que estar la placa.
  //
  // El caso decía «no pinta la placa» y nada más, así que un rojo en la corrida
  // completa no se podía distinguir de otro: ni si el fondo estaba vacío, ni si
  // la hoja de estilos con la regla había llegado, ni si sólo faltaba un
  // instante. Esto conserva ese estado en el propio mensaje del fallo.
  const describirPlaca = (placa) => placa.evaluate((nodo) => {
    const estilo = getComputedStyle(nodo);
    let reglas = 0;
    let conLaPlaca = 0;
    for (const hoja of Array.from(document.styleSheets)) {
      let lista = [];
      try {
        lista = Array.from(hoja.cssRules || []);
      } catch {
        continue; // hoja de otro origen: no se puede leer y no es la nuestra
      }
      reglas += lista.length;
      conLaPlaca += lista.filter((r) => (r.cssText || '').includes('no-photo.svg')).length;
    }
    return {
      fondo: estilo.backgroundImage,
      conectado: nodo.isConnected,
      colorDeFondo: estilo.backgroundColor,
      clases: nodo.className,
      estado: nodo.getAttribute('data-estado'),
      alto: Math.round(nodo.getBoundingClientRect().height),
      hojas: document.styleSheets.length,
      reglas,
      reglasConLaPlaca: conLaPlaca,
      html: nodo.outerHTML.slice(0, 200),
    };
  });

  // Se espera a la condición, no a un instante fijo, y se devuelve cuánto
  // tardó: si tarda algo, es una carrera y queda medida en el resultado.
  const esperarLaPlaca = async (placa, quien) => {
    const empezo = Date.now();
    let visto = null;
    let primera = null;
    let intentos = 0;
    while (Date.now() - empezo < 10_000) {
      intentos += 1;
      visto = await describirPlaca(placa);
      if (primera === null) primera = visto;
      if (/estados\/no-photo\.svg/.test(visto.fondo)) {
        return { tardo: Date.now() - empezo, intentos, primera };
      }
      await new Promise((seguir) => { setTimeout(seguir, 100); });
    }
    throw new Error(`${quien} no pinta la placa de «sin registro fotográfico»; `
      + `despues de ${intentos} lecturas en 10 s lo que hay es `
      + `${JSON.stringify(visto)}`);
  };


  try {
    const contexto = await browser.newContext();
    await contexto.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      { accessToken: vendedor.access_token, refreshToken: vendedor.refresh_token },
    );
    const page = await contexto.newPage();
    page.on('pageerror', (error) => erroresDePagina.push(error.message));
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });

    // 1. Publicar sin adjuntar un solo archivo.
    await page.getByRole('button', { name: /Vender/ }).first().click();
    await page.getByRole('heading', { name: /Publicar un producto/i }).waitFor({ state: 'visible' });

    const rotuloDeFotos = await page.getByRole('heading', { name: /Fotograf/i }).first().innerText();
    assert(/opcional/i.test(rotuloDeFotos),
      `el rótulo de las fotos no dice que son opcionales: ${JSON.stringify(rotuloDeFotos)}`);
    assert(!/\*/.test(rotuloDeFotos),
      `el rótulo de las fotos sigue marcado como obligatorio: ${JSON.stringify(rotuloDeFotos)}`);

    await page.locator('#name').fill(nombre);
    await page.locator('#category option').filter({ hasText: categoria[0] })
      .first().waitFor({ state: 'attached', timeout: 10_000 });
    await page.locator('#category').selectOption({ label: categoria[0] });
    await page.locator('#description')
      .fill('Publicación sin fotografía, para comprobar que el sistema dice la ausencia.');
    await page.locator('#price').fill('54321');
    await page.locator('#stock').fill('2');
    await page.locator('#province').selectOption(ubicacion[0]);
    await page.locator('#locality').selectOption(ubicacion[1]);
    await page.locator('form button[type="submit"]').click();
    await page.getByText(/publicado exitosamente!/i).waitFor({ state: 'visible', timeout: 20_000 });

    // 2. Quedó publicada, y sin ninguna imagen inventada.
    const [fila] = queryRows(`
      SELECT p.id::text, COUNT(pi.id)::text, 'fin'
      FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.name = ${sqlLiteral(nombre)} AND p.seller_id = ${sqlLiteral(vendedorId[0])}
      GROUP BY p.id
    `);
    assert(fila, 'la publicación sin foto no quedó en la base');
    assert(fila[1] === '0', `la publicación sin foto quedó con ${fila[1]} imágenes`);

    // 3. El catálogo la muestra y dice que no hay fotografía.
    const comprador = await browser.newContext();
    const publica = await comprador.newPage();
    await publica.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await publica.getByLabel('Buscar en el mercado').fill(nombre);
    // La publicación es la más nueva, así que el catálogo YA la muestra antes
    // de buscar: si se mira el DOM apenas aparece el título, se puede estar
    // mirando el dibujo anterior a la búsqueda, que React reemplaza cuando
    // llega la respuesta filtrada. Sobre un nodo que quedó fuera del documento
    // `getComputedStyle` devuelve "", y de ahí salía «no pinta la placa». Se
    // espera la respuesta de ESA búsqueda antes de tocar nada.
    await Promise.all([
      publica.waitForResponse((r) => r.url().includes('/catalog/products')
        && r.url().includes('search=') && r.status() === 200, { timeout: 20_000 }),
      publica.getByLabel('Buscar en el mercado').press('Enter'),
    ]);

    const titulo = publica.getByRole('heading', { name: nombre, exact: true, level: 3 });
    await titulo.waitFor({ state: 'visible', timeout: 20_000 });
    const tarjeta = titulo.locator('xpath=ancestor::*[contains(@class,"card")]');
    const placaTarjeta = tarjeta.getByRole('img', { name: /^Sin registro fotográfico\./ }).first();
    await placaTarjeta.waitFor({ state: 'visible' });
    const laTarjeta = await esperarLaPlaca(placaTarjeta, 'la tarjeta');
    assert(await tarjeta.getByText('No pudimos cargar la imagen').count() === 0,
      'la tarjeta confunde «no hay foto» con «la foto falló»');

    // 4. Y la ficha también, con el mismo rótulo y sin dibujo de relleno.
    await titulo.click();
    const ficha = publica.getByRole('dialog');
    await ficha.waitFor({ timeout: 20_000 });
    const placaFicha = ficha.getByRole('img', { name: /^Sin registro fotográfico\./ }).first();
    await placaFicha.waitFor({ state: 'visible' });
    const laFicha = await esperarLaPlaca(placaFicha, 'la ficha');
    demora = `${laTarjeta.intentos} lectura(s) en la tarjeta y ${laFicha.intentos} en la ficha`;
    if (laTarjeta.intentos > 1 || laFicha.intentos > 1) {
      demora += `; la primera lectura de la tarjeta decia `
        + `${JSON.stringify(laTarjeta.primera)}`;
    }
    assert(await ficha.getByText('No pudimos cargar la imagen').count() === 0,
      'la ficha confunde «no hay foto» con «la foto falló»');

    assert(erroresDePagina.length === 0, `errores JS: ${erroresDePagina.join(' | ')}`);
    await comprador.close();
    await contexto.close();
  } finally {
    await browser.close();
  }

  return 'el alta publica sin adjuntar ninguna imagen y rotula las fotos como '
    + 'opcionales; la publicación queda con 0 imágenes en la base, y el catálogo '
    + 'y la ficha dicen «Sin registro fotográfico» en vez de inventar un dibujo '
    + `(la placa apareció con ${demora})`;
});

await runCase(122, 'Sin conexión se dice sin conexión, y una caída del servidor no se disfraza de red', async () => {
  // El mercado no tenía estado de error: cualquier falla terminaba en la lista
  // vacía con el cartel «No hay operaciones con estos filtros», que afirma algo
  // que nadie comprobó. Son dos fallas distintas y se dicen distinto.
  const browser = await chromium.launch({ headless: true });
  const SIN_RED = 'Sin conexión. Revisá tu red e intentá de nuevo.';

  try {
    const contexto = await browser.newContext();
    const page = await contexto.newPage();
    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /operaciones$/ }).first().waitFor({ timeout: 20_000 });

    // 1. El servidor se cae, con red presente: mensaje general, no «sin red».
    await page.route('**/api/catalog/products*', (route) => route.fulfill({
      status: 500, contentType: 'application/json',
      body: JSON.stringify({ detail: 'caída controlada del catálogo' }),
    }));
    await page.getByLabel('Buscar en el mercado').fill('trigo');
    await page.getByLabel('Buscar en el mercado').press('Enter');

    const aviso = page.getByRole('alert');
    await aviso.waitFor({ state: 'visible', timeout: 20_000 });
    const textoDelServidor = await aviso.innerText();
    assert(/No pudimos cargar el mercado/.test(textoDelServidor),
      `la caída del servidor no muestra el mensaje general: ${JSON.stringify(textoDelServidor)}`);
    assert(!textoDelServidor.includes('Sin conexión'),
      `la caída del servidor se disfraza de falta de red: ${JSON.stringify(textoDelServidor)}`);
    assert(!/No hay operaciones con estos filtros/.test(textoDelServidor),
      'la falla sigue confundiéndose con un catálogo vacío');

    // 2. Con el error a la vista, la navegación sigue viva: no se silencia nada.
    await page.getByRole('button', { name: 'Quiénes somos', exact: true }).first().click();
    await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Mercado', exact: true }).first().click();
    await aviso.waitFor({ state: 'visible', timeout: 20_000 });

    // 3. Sin red: el texto exacto que pidió PM.
    await contexto.setOffline(true);
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.getByText(SIN_RED, { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
    const textoSinRed = await page.getByRole('alert').innerText();
    assert(textoSinRed.includes(SIN_RED),
      `el aviso sin red no dice el texto acordado: ${JSON.stringify(textoSinRed)}`);

    // 4. Vuelve la red y el servidor: reintentar trae el catálogo de verdad.
    await contexto.setOffline(false);
    await page.unroute('**/api/catalog/products*');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.getByRole('heading', { name: /operaciones$/ }).first().waitFor({ timeout: 20_000 });
    assert(await page.getByRole('alert').count() === 0,
      'el aviso de error quedó pegado después de que el catálogo volvió');

    await contexto.close();
  } finally {
    await browser.close();
  }

  return 'una caída del servidor muestra el mensaje general, sin red muestra el '
    + 'texto exacto «' + SIN_RED + '», ninguna de las dos se confunde con un '
    + 'catálogo vacío, la navegación sigue funcionando con el error a la vista y '
    + 'reintentar recupera el catálogo';
});

await runCase(123, 'Al 200 % de zoom las cinco pantallas siguen siendo usables', async () => {
  // Zoom del navegador al 200 % = la mitad de píxeles CSS de ancho y de alto.
  // Una pantalla de escritorio de 1280x720 queda en 640x360, que es lo que se
  // emula acá. No se mide «a ojo»: por pantalla se comprueba que no haya corte
  // horizontal, que la acción principal siga visible y habilitada, y que el
  // foco del teclado se vea.
  const ANCHO = 640;
  const ALTO = 360;
  const browser = await chromium.launch({ headless: true });
  const medidas = [];

  const medir = async (page, pantalla, accion) => {
    const caja = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    assert(caja.scroll <= caja.cliente + 1,
      `${pantalla} al 200 % se corta a lo ancho: scrollWidth=${caja.scroll} clientWidth=${caja.cliente}`);

    await accion.first().waitFor({ state: 'visible', timeout: 20_000 });
    assert(await accion.first().isEnabled(),
      `${pantalla}: la acción principal quedó deshabilitada al 200 %`);
    const recuadro = await accion.first().boundingBox();
    assert(recuadro && recuadro.width > 0 && recuadro.height > 0,
      `${pantalla}: la acción principal no tiene superficie al 200 %`);
    assert(recuadro.x >= -1 && recuadro.x + recuadro.width <= caja.cliente + 1,
      `${pantalla}: la acción principal queda fuera del ancho al 200 % (x=${recuadro.x}, ancho=${recuadro.width})`);

    // El foco del teclado tiene que verse, y en TODAS las paradas: alcanza con
    // un campo que se lo coma para que la persona pierda el hilo. Se tabula
    // desde el principio y se mira el contorno calculado de cada elemento que
    // queda enfocado.
    const sinAnillo = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      // El anillo entra con una transición de 0,2 s: medirlo en el mismo
      // instante del Tab devuelve 0 px de ancho y hace ver un defecto que no
      // existe. Se espera a que termine de dibujarse.
      await page.waitForTimeout(300);
      const parada = await page.evaluate(() => {
        const activo = document.activeElement;
        if (!activo || activo === document.body) return null;
        const estilo = getComputedStyle(activo);
        const caja = activo.getBoundingClientRect();
        if (caja.width === 0 || caja.height === 0) return null;
        return {
          quien: `${activo.tagName.toLowerCase()}${activo.id ? '#' + activo.id : ''}`,
          estilo: estilo.outlineStyle,
          ancho: parseFloat(estilo.outlineWidth) || 0,
        };
      });
      if (!parada) continue;
      if (parada.estilo === 'none' || parada.ancho < 2) sinAnillo.push(parada.quien);
    }
    assert(sinAnillo.length === 0,
      `${pantalla}: el foco no se ve al 200 % en ${sinAnillo.join(', ')}`);

    medidas.push(`${pantalla} ${caja.scroll}/${caja.cliente}`);
  };

  try {
    // 1. Las dos superficies comerciales, 2. catálogo, 3. detalle y 4. ingreso,
    //    sin sesión.
    const anonimo = await browser.newContext({ viewport: { width: ANCHO, height: ALTO } });
    const publica = await anonimo.newPage();

    await publica.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await publica.getByRole('heading', { name: /seguir produciendo/, level: 1 }).waitFor({ timeout: 20_000 });
    await medir(publica, 'inicio', publica.getByRole('button', { name: 'Explorar operaciones' }));

    await publica.getByRole('button', { name: 'Servicios', exact: true }).first().click();
    await publica.getByRole('heading', { name: /resuelve el trabajo/, level: 1 }).waitFor({ timeout: 20_000 });
    await medir(publica, 'servicios', publica.getByRole('button', { name: 'Ver servicios publicados' }));

    await publica.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await publica.locator('article').first().waitFor({ timeout: 20_000 });
    await medir(publica, 'catálogo', publica.getByRole('button', { name: /Agregar|Agregar al carrito|Contratar|Solicitar cotización|Sin stock|Ingresar para continuar/ }));

    await publica.locator('article').first().click();
    const ficha = publica.getByRole('dialog');
    await ficha.waitFor({ timeout: 20_000 });
    await medir(publica, 'detalle', ficha.getByRole('button', { name: /Agregar|Agregar al carrito|Contratar|Solicitar cotización|Sin stock|Ingresar para continuar/ }));
    await publica.keyboard.press('Escape');
    await ficha.waitFor({ state: 'hidden', timeout: 20_000 });

    await publica.getByRole('button', { name: 'Ingresar', exact: true }).first().click();
    await publica.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
    await medir(publica, 'ingreso', publica.locator('form button[type="submit"]'));
    await anonimo.close();

    // 4. Carrito y checkout, con sesión de comprador.
    const comprador = (await apiRequest('/auth/login', {
      method: 'POST', body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
    })).data;
    const conSesion = await browser.newContext({ viewport: { width: ANCHO, height: ALTO } });
    await conSesion.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      { accessToken: comprador.access_token, refreshToken: comprador.refresh_token },
    );
    const compra = await conSesion.newPage();
    await compra.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await compra.getByRole('button', { name: /^Agregar/ }).first().click();
    await compra.getByRole('button', { name: /Carrito/ }).first().click();
    await compra.getByRole('heading', { name: /Mi carrito/i }).waitFor({ timeout: 20_000 });
    await medir(compra, 'carrito', compra.getByRole('button', { name: 'Continuar compra' }));

    await compra.getByRole('button', { name: 'Continuar compra' }).click();
    await compra.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 20_000 });
    await medir(compra, 'checkout', compra.getByRole('button', { name: /Continuar|Siguiente|Confirmar/ }));
    await conSesion.close();

    // 5. Panel del vendedor.
    const vendedor = (await apiRequest('/auth/login', {
      method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
    })).data;
    const panelCtx = await browser.newContext({ viewport: { width: ANCHO, height: ALTO } });
    await panelCtx.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      { accessToken: vendedor.access_token, refreshToken: vendedor.refresh_token },
    );
    const panel = await panelCtx.newPage();
    await panel.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await panel.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await panel.getByRole('button', { name: 'Mis publicaciones' }).click();
    await panel.getByRole('heading', { name: 'Mis publicaciones' }).waitFor({ timeout: 20_000 });
    await medir(panel, 'panel', panel.getByRole('button', { name: '+ Publicar' }));
    await panelCtx.close();
  } finally {
    await browser.close();
  }

  return `640x360 —equivalente a 1280x720 al 200 %— en inicio, servicios, catálogo, `
    + `detalle, ingreso, carrito, checkout y panel: sin corte horizontal (${medidas.join('; ')}), `
    + 'acción principal visible, habilitada y dentro del ancho, y foco de teclado visible';
});

await runCase(124, 'Inicio muestra operaciones reales, con el total de la API y sin claims', async () => {
  // La portada era una placa índigo con «Bienvenido a TopGreen», tres
  // beneficios con iconos y tres claims —inteligencia artificial, mecanización
  // y confianza respaldada por alianzas— que el producto no demuestra.
  const CLAIMS = [
    /Bienvenido a TopGreen/i,
    /inteligencia artificial/i,
    /MECANIZACIÓN/,
    /CONFIANZA/,
    /alianzas/i,
    /destacad/i,
  ];

  const catalogo = await apiRequest('/catalog/products?page=1&page_size=1');
  const total = catalogo.data.total;
  assert(typeof total === 'number' && total > 0, `la API no devolvió un total usable: ${total}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await contexto.newPage();
    const pedidos = [];
    page.on('request', (r) => pedidos.push(r.url()));
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /seguir produciendo/, level: 1 }).waitFor({ timeout: 20_000 });

    const texto = await page.locator('main, body').first().innerText();
    for (const claim of CLAIMS) {
      assert(!claim.test(texto), `la portada sigue diciendo ${claim}: ${JSON.stringify(texto.slice(0, 400))}`);
    }

    // 1. El conteo es el de la API, no un número escrito a mano.
    //
    //    Bajo la dirección B el medidor son dos piezas —la cifra y su rótulo—
    //    dentro del mismo párrafo, y el rótulo va en versalitas por hoja de
    //    estilo. Se busca el párrafo entero, sin distinguir mayúsculas, y se
    //    exige que la cifra sea EXACTAMENTE el total de la API: que lo
    //    contenga no alcanza, porque «155» contiene «15».
    const medidor = page.locator('p', { hasText: /operaci(ón|ones) disponibles? ahora/i }).first();
    const conteo = (await medidor.innerText()).replace(/\s+/g, ' ').trim();
    assert(new RegExp(`(^|\\D)${total}(\\D|$)`).test(conteo),
      `el conteo dice «${conteo}» y la API informa ${total}`);

    // 2. Hasta tres publicaciones, y son publicaciones que existen en la base.
    //    Se espera a la primera: mientras la vista previa carga hay esqueletos,
    //    y contar en ese momento mediria el esqueleto y no el resultado.
    const tarjetas = page.locator('article[class*="card"]');
    await tarjetas.first().waitFor({ state: 'visible', timeout: 20_000 });
    const cuantas = await tarjetas.count();
    assert(cuantas > 0 && cuantas <= 3, `la vista previa muestra ${cuantas} operaciones`);
    for (let i = 0; i < cuantas; i += 1) {
      const titulo = (await tarjetas.nth(i).getByRole('heading', { level: 3 }).innerText()).trim();
      const [fila] = queryRows(`
        SELECT COUNT(*)::text, 'fin' FROM products WHERE name = ${sqlLiteral(titulo)} AND status = 'ACTIVE'
      `);
      assert(fila[0] !== '0', `«${titulo}» no es una publicación activa de la base`);
    }

    // 3. La fotografía del hero es uno de los dos derivados autorizados, y no
    //    se pidió ninguna imagen conceptual ni ningún dominio externo.
    const heroe = await page.locator('img[src*="/media/comercial/"]').first().getAttribute('src');
    assert(/home-cosecha-hero-(1920|1200)\.webp$/.test(heroe || ''),
      `el hero no usa un derivado autorizado: ${heroe}`);
    const concepto = pedidos.filter((u) => /-concepto\.webp/.test(u));
    assert(concepto.length === 0, `se pidieron imágenes conceptuales: ${concepto.join(', ')}`);
    const externos = pedidos.filter((u) => {
      const host = new URL(u).hostname;
      return host !== 'localhost' && host !== '127.0.0.1';
    });
    assert(externos.length === 0, `la portada pidió recursos externos: ${externos.join(', ')}`);

    // 4. Sin overlay sobre la fotografía: ninguna capa encima con fondo propio.
    const encima = await page.evaluate(() => {
      const foto = document.querySelector('img[src*="/media/comercial/"]');
      if (!foto) return 'sin foto';
      const caja = foto.getBoundingClientRect();
      const arriba = document.elementFromPoint(caja.x + caja.width / 2, caja.y + caja.height / 2);
      if (!arriba) return 'sin elemento';
      return arriba.tagName;
    });
    assert(encima === 'IMG', `hay algo encima de la fotografía del hero: ${encima}`);

    // 5. El servidor se cae: se dice, se puede reintentar y no se confunde con
    //    «todavía no hay operaciones publicadas».
    await page.route('**/api/catalog/products*', (route) => route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'caída controlada' }),
    }));
    await page.getByRole('button', { name: 'Ver todas las operaciones' }).click();
    await page.getByRole('button', { name: 'Inicio', exact: true }).first().click();
    const aviso = page.getByRole('alert');
    await aviso.waitFor({ state: 'visible', timeout: 20_000 });
    const textoDelError = await aviso.innerText();
    assert(/No pudimos cargar las operaciones/.test(textoDelError),
      `el error de la portada no se explica: ${JSON.stringify(textoDelError)}`);
    assert(!/Todavía no hay operaciones/.test(textoDelError),
      'la falla se confunde con un catálogo vacío');

    // 6. Sin red: el texto acordado, y no el general.
    await contexto.setOffline(true);
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.getByText('Sin conexión. Revisá tu red e intentá de nuevo.', { exact: true })
      .waitFor({ state: 'visible', timeout: 20_000 });

    // 7. Vuelve todo y reintentar recupera las operaciones de verdad.
    await contexto.setOffline(false);
    await page.unroute('**/api/catalog/products*');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.locator('article[class*="card"]').first().waitFor({ timeout: 20_000 });
    assert(await page.getByRole('alert').count() === 0,
      'el aviso de error quedó pegado después de recuperar las operaciones');

    // 8. Un título largo no rompe la composición ni se corta con puntos
    //    suspensivos: el nombre completo tiene que poder leerse.
    const vendedor = (await apiRequest('/auth/login', {
      method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
    })).data.access_token;
    const [categoriaLarga] = queryRows(
      "SELECT id, 'fin' FROM categories WHERE is_service = false ORDER BY name LIMIT 1");
    const nombreLargo = `Cabezal maicero de arrastre con sinfín reforzado, kit de cuchillas y `
      + `repuestos originales para cosechadora de gran porte ${Date.now()}`;
    await apiRequest('/products', {
      method: 'POST', token: vendedor,
      body: {
        name: nombreLargo,
        description: 'Publicación de prueba de texto largo en la vista previa de la portada.',
        category_id: categoriaLarga[0],
        price: 123456789,
        stock: 4,
        unit: 'unidad',
        locality_id: localidadDelPadron('Pergamino', 'Buenos Aires'),
        publication_type: 'producto',
        operation_kind: 'insumo',
      },
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const tarjetaLarga = page
      .getByRole('heading', { name: nombreLargo, exact: true, level: 3 });
    await tarjetaLarga.waitFor({ state: 'visible', timeout: 20_000 });
    const medida = await page.evaluate(() => ({
      s: document.documentElement.scrollWidth,
      c: document.documentElement.clientWidth,
    }));
    assert(medida.s <= medida.c + 1,
      `un título largo desbordó la portada: scrollWidth=${medida.s} clientWidth=${medida.c}`);
    const recorte = await tarjetaLarga.evaluate((el) => getComputedStyle(el).textOverflow);
    assert(recorte !== 'ellipsis', 'el título de la operación se corta con puntos suspensivos');

    await contexto.close();
  } finally {
    await browser.close();
  }

  return `la portada no tiene claims ni «destacadas»; el conteo repite el total de la API (${total}), `
    + 'las operaciones son publicaciones activas de la base, el hero usa un derivado autorizado '
    + 'sin nada encima y sin pedidos externos, error, sin conexión y recuperación se distinguen, '
    + 'y un título de 140 caracteres no desborda ni se corta con puntos suspensivos';
});

await runCase(125, 'Servicios muestra publicaciones reales de servicio y logística, sin video ni claims', async () => {
  // La página describía una consultora: video con overlay índigo, cinco
  // servicios escritos a mano y promesas de inteligencia artificial,
  // satélites, IoT, sustentabilidad y alianzas.
  const CLAIMS = [
    /inteligencia artificial/i,
    /satélit/i,
    /Internet de las Cosas/i,
    /IoT/,
    /sostenibilidad|sustentabilidad/i,
    /alianzas/i,
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await contexto.newPage();
    const pedidos = [];
    page.on('request', (r) => pedidos.push(r.url()));
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Servicios', exact: true }).first().click();
    await page.getByRole('heading', { name: /resuelve el trabajo/, level: 1 }).waitFor({ timeout: 20_000 });

    const texto = await page.locator('main, body').first().innerText();
    for (const claim of CLAIMS) {
      assert(!claim.test(texto), `Servicios sigue prometiendo ${claim}`);
    }
    assert(await page.locator('video').count() === 0, 'sigue habiendo un video en Servicios');

    // 1. El hero es el derivado interino autorizado, sin ampliarlo y sin nada
    //    encima.
    const heroe = await page.locator('img[src*="/media/comercial/"]').first().getAttribute('src');
    assert(/servicios-relevamiento-hero-960(-4x3)?\.webp$/.test(heroe || ''),
      `el hero de Servicios no usa un derivado autorizado: ${heroe}`);
    const concepto = pedidos.filter((u) => /-concepto\.webp/.test(u));
    assert(concepto.length === 0, `se pidieron imágenes conceptuales: ${concepto.join(', ')}`);

    // 2. Las publicaciones son de verdad, y son de servicio o de logística.
    const tarjetas = page.locator('article[class*="card"]');
    await tarjetas.first().waitFor({ state: 'visible', timeout: 20_000 });
    const cuantas = await tarjetas.count();
    assert(cuantas > 0 && cuantas <= 3, `Servicios muestra ${cuantas} publicaciones`);
    for (let i = 0; i < cuantas; i += 1) {
      const tarjeta = tarjetas.nth(i);
      const titulo = (await tarjeta.getByRole('heading', { level: 3 }).innerText()).trim();
      const [fila] = queryRows(`
        SELECT p.operation_kind, c.is_service::text, 'fin' FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.name = ${sqlLiteral(titulo)} AND p.status = 'ACTIVE'
      `);
      assert(fila, `«${titulo}» no es una publicación activa de la base`);
      assert(fila[0] === 'servicio' || fila[0] === 'logistica',
        `«${titulo}» no es un servicio: la base dice «${fila[0]}»`);
      // La tarjeta de un servicio no gana fotografía, ni siquiera el respaldo.
      assert(await tarjeta.locator('img, [role="img"]').count() === 0,
        `la tarjeta de «${titulo}» dibuja una imagen`);
    }

    // 3. «Ver servicios publicados» deja el filtro puesto, no sólo la URL.
    await page.getByRole('button', { name: 'Ver servicios publicados' }).click();
    await page.getByRole('heading', { name: 'Operaciones disponibles', level: 1 }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1200);
    const tipo = await page.locator('#catalog-type').inputValue();
    assert(tipo === 'servicios', `el filtro de tipo quedó en «${tipo}»`);
    const rotulos = await page.locator('article[class*="card"] .tg-eyebrow').allInnerTexts();
    assert(rotulos.length > 0, 'el mercado filtrado no muestra ninguna operación');
    for (const rotulo of rotulos) {
      assert(/servicio|logística/i.test(rotulo),
        `el mercado filtrado por servicios muestra «${rotulo}»`);
    }

    // 4. El error de Servicios tiene su propio texto.
    await page.route('**/api/catalog/products*', (route) => route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'caída controlada' }),
    }));
    await page.getByRole('button', { name: 'Servicios', exact: true }).first().click();
    const aviso = page.getByRole('alert');
    await aviso.waitFor({ state: 'visible', timeout: 20_000 });
    const textoDelError = await aviso.innerText();
    assert(/No pudimos cargar los servicios/.test(textoDelError),
      `el error de Servicios no se explica: ${JSON.stringify(textoDelError)}`);

    await contexto.close();
  } finally {
    await browser.close();
  }

  return 'Servicios no tiene video, ni lista escrita a mano, ni claims de IA, satélites, IoT o '
    + 'sustentabilidad; el hero usa el derivado interino autorizado; las publicaciones son '
    + 'servicios o logística de la base y no ganan foto; «Ver servicios publicados» deja el '
    + 'filtro puesto y el error tiene su propio texto';
});

await runCase(126, 'Con más de cien publicaciones nuevas encima, los servicios siguen apareciendo', async () => {
  // El borde que encontró PM leyendo el código: la vista previa de Servicios y
  // el filtro del Mercado bajaban una página de cien publicaciones y filtraban
  // del lado del navegador. Con treinta filas anda; con mil miente. Este caso
  // fabrica el escenario que el seed no puede: un servicio tapado por ciento
  // una publicaciones más nuevas.
  const vendedor = (await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  })).data.access_token;
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');
  const [categoriaDeServicio] = queryRows(
    "SELECT id, 'fin' FROM categories WHERE slug = 'asesoramiento'");
  const [categoriaDeProducto] = queryRows(
    "SELECT id, 'fin' FROM categories WHERE is_service = false ORDER BY name LIMIT 1");
  assert(categoriaDeServicio && categoriaDeProducto, 'faltan las categorías del caso');

  const marca = Date.now();
  const servicioTapado = `Smoke servicio tapado ${marca}`;
  await apiRequest('/products', {
    method: 'POST', token: vendedor,
    body: {
      name: servicioTapado,
      description: 'Servicio publicado antes de la avalancha de productos nuevos.',
      category_id: categoriaDeServicio[0],
      price: 45000,
      unit: 'hectárea',
      locality_id: localidad,
      publication_type: 'servicio',
      operation_kind: 'servicio',
      pricing_type: 'por_hectarea',
    },
  });

  // Ciento una publicaciones más nuevas. Es una más que la página que el
  // mercado descarga: con cien exactas el defecto viejo podía sobrevivir.
  const TAPA = 101;
  for (let i = 0; i < TAPA; i += 1) {
    await apiRequest('/products', {
      method: 'POST', token: vendedor,
      body: {
        name: `Smoke tapa ${marca}-${String(i).padStart(3, '0')}`,
        description: 'Publicación de producto creada para tapar al servicio anterior.',
        category_id: categoriaDeProducto[0],
        price: 1000 + i,
        stock: 5,
        unit: 'unidad',
        locality_id: localidad,
        publication_type: 'producto',
        operation_kind: 'insumo',
      },
    });
  }

  const [posicion] = queryRows(`
    SELECT COUNT(*)::text, 'fin' FROM products
    WHERE status = 'ACTIVE' AND created_at > (
      SELECT created_at FROM products WHERE name = ${sqlLiteral(servicioTapado)}
    )
  `);
  assert(Number(posicion[0]) > 100,
    `el servicio quedó a ${posicion[0]} publicaciones del frente y el caso necesita más de 100`);

  // 1. El endpoint filtra en la base: lo que devuelve son servicios, y el
  //    total es el del conjunto pedido y no el del catálogo entero.
  const filtrado = await apiRequest('/catalog/products?publication_type=servicio&page_size=3');
  assert(filtrado.status === 200, `el filtro por tipo respondió HTTP ${filtrado.status}`);
  assert(filtrado.data.items.length > 0, 'el filtro por tipo no devolvió ninguna publicación');
  // La respuesta pública no publica `publication_type` —y no se lo agrego por
  // una prueba—, así que se comprueba por la anatomía, que es la misma regla:
  // un `servicio` sólo puede ser `servicio` o `logistica`, y el alta rechaza
  // cualquier cruce entre las dos columnas.
  assert(filtrado.data.items.every((item) => ['servicio', 'logistica'].includes(item.operation_kind)),
    `el filtro por tipo devolvió publicaciones que no son de servicio: ${
      filtrado.data.items.map((item) => item.operation_kind).join(', ')}`);
  assert(filtrado.data.items[0].name === servicioTapado,
    `el servicio más nuevo no encabeza el filtro: ${filtrado.data.items[0].name}`);

  const [enBase] = queryRows(`
    SELECT COUNT(*)::text, 'fin' FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'ACTIVE' AND p.publication_type = 'servicio'
  `);
  const [todas] = queryRows(
    "SELECT COUNT(*)::text, 'fin' FROM products WHERE status = 'ACTIVE'");
  assert(String(filtrado.data.total) === enBase[0],
    `el total del endpoint filtrado dice ${filtrado.data.total} y en la base hay ${enBase[0]} servicios`);
  assert(filtrado.data.total !== Number(todas[0]),
    'el total filtrado es igual al del catálogo entero: no filtró antes de contar');

  // 2. Un valor inventado no pasa: el parámetro está validado.
  const invalido = await expectApiError(422, () =>
    apiRequest('/catalog/products?publication_type=cualquiera'));
  assert(/publication_type/.test(invalido),
    `el rechazo del tipo inválido no dice de qué parámetro habla: ${invalido}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext();
    const page = await contexto.newPage();

    // 3. La vista previa de Servicios lo encuentra, tapado y todo.
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Servicios', exact: true }).first().click();
    await page.getByRole('heading', { name: /resuelve el trabajo/, level: 1 }).waitFor({ timeout: 20_000 });
    await page.locator('article[class*="card"]').first().waitFor({ timeout: 20_000 });
    await page.getByRole('heading', { name: servicioTapado, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 20_000 });

    // 4. Y el Mercado filtrado por servicios, también.
    await page.getByRole('button', { name: /Ver servicios publicados/ }).first().click();
    await page.locator('#catalog-type').waitFor({ state: 'attached', timeout: 25_000 });
    const tipo = await page.locator('#catalog-type').inputValue();
    assert(tipo === 'servicios', `el filtro del mercado quedó en «${tipo}»`);
    await page.getByRole('heading', { name: servicioTapado, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 25_000 });

    const conteo = await page.locator('[class*="_conteo_"]').first().innerText();
    const mostradas = Number((conteo.match(/\d+/) || ['0'])[0]);
    assert(mostradas > 0 && mostradas <= Number(enBase[0]),
      `el mercado filtrado dice «${conteo}» y en la base hay ${enBase[0]} servicios`);

    await contexto.close();
  } finally {
    await browser.close();
  }

  return `con ${posicion[0]} publicaciones más nuevas encima, el endpoint filtrado devuelve `
    + `sólo servicios y cuenta ${filtrado.data.total} de ${todas[0]} publicaciones activas; `
    + 'un tipo inválido da 422; y tanto la vista previa de Servicios como el Mercado '
    + 'filtrado encuentran el servicio tapado';
});
await runCase(127, 'El conteo del Mercado sale del total de la API y no de la página descargada', async () => {
  // La corrección que devolvió PM: la API venía diciendo cuántas publicaciones
  // hay para la consulta, y la pantalla contaba las tarjetas dibujadas. Con el
  // seed no se notaba —entra todo en una página— y por eso nadie lo vio. Este
  // caso fabrica un catálogo más grande que la página y exige que el número
  // que se lee sea el de la base, con la parte descargada dicha aparte.
  const contarActivas = () => Number(queryRows(
    "SELECT COUNT(*)::text, 'fin' FROM products WHERE status = 'ACTIVE'")[0][0]);

  // Autosuficiente: si este caso corre solo, el seed no llega a las cien
  // publicaciones que hacen falta para que la página se quede corta, así que
  // las completa. Si ya corrió el 126, no publica nada.
  if (contarActivas() <= 100) {
    const vendedor = (await apiRequest('/auth/login', {
      method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
    })).data.access_token;
    const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');
    const [categoria] = queryRows(
      "SELECT id, 'fin' FROM categories WHERE is_service = false ORDER BY name LIMIT 1");
    const marca = Date.now();
    for (let i = contarActivas(); i <= 100; i += 1) {
      await apiRequest('/products', {
        method: 'POST', token: vendedor,
        body: {
          name: `Smoke conteo ${marca}-${String(i).padStart(3, '0')}`,
          description: 'Publicación creada para que el catálogo supere la página descargada.',
          category_id: categoria[0],
          price: 1000 + i,
          stock: 5,
          unit: 'unidad',
          locality_id: localidad,
          publication_type: 'producto',
          operation_kind: 'insumo',
        },
      });
    }
  }

  const activas = [String(contarActivas())];
  assert(Number(activas[0]) > 100,
    `la base tiene ${activas[0]} publicaciones activas y el caso necesita más de 100`);

  const pagina = await apiRequest('/catalog/products?page=1&page_size=100');
  assert(pagina.status === 200, `el catálogo respondió HTTP ${pagina.status}`);
  assert(pagina.data.items.length === 100,
    `la página trajo ${pagina.data.items.length} publicaciones y tienen que ser 100`);
  assert(String(pagina.data.total) === activas[0],
    `el total de la API dice ${pagina.data.total} y en la base hay ${activas[0]} activas`);

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await contexto.newPage();
    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 20_000 });
    await page.locator('article[class*="card"]').first().waitFor({ timeout: 25_000 });

    const conteo = page.locator('[class*="_conteo_"]').first();
    const texto = (await conteo.innerText()).replace(/\s+/g, ' ').trim();
    const dibujadas = await page.locator('article[class*="card"]').count();

    // 1. El número grande es el de la base, no el de las tarjetas dibujadas.
    assert(texto.includes(activas[0]),
      `el conteo dice «${texto}» y en la base hay ${activas[0]} publicaciones activas`);
    // 2. Y no se confunde la página con el total: se dicen los dos.
    // `innerText` devuelve el texto ya pintado y el rótulo va en versalitas por
    // hoja de estilo, así que se compara sin distinguir mayúsculas.
    assert(new RegExp(`^${dibujadas} de ${activas[0]} operaciones$`, 'i').test(texto),
      `el conteo dice «${texto}» y tendría que decir «${dibujadas} de ${activas[0]} operaciones»`);
    assert(dibujadas < Number(activas[0]),
      'la página dibujó todo el catálogo y el caso no probaría nada');

    // 3. Con un filtro que sí viaja a la consulta, el total baja al del
    //    conjunto pedido: no queda pegado al del catálogo entero.
    const [servicios] = queryRows(`
      SELECT COUNT(*)::text, 'fin' FROM products
      WHERE status = 'ACTIVE' AND publication_type = 'servicio'
    `);
    await page.locator('#catalog-type').selectOption('servicios');
    await page.waitForFunction(
      (esperado) => {
        const nodo = document.querySelector('[class*="_conteo_"]');
        return !!nodo && nodo.innerText.replace(/\s+/g, ' ').trim().includes(esperado);
      },
      servicios[0],
      { timeout: 25_000 },
    );
    const filtrado = (await conteo.innerText()).replace(/\s+/g, ' ').trim();
    assert(!filtrado.includes(activas[0]),
      `filtrado por servicios el conteo sigue diciendo «${filtrado}»`);

    await contexto.close();
  } finally {
    await browser.close();
  }

  return `con ${activas[0]} publicaciones activas y una página de 100, el Mercado dice el `
    + 'total de la API y aclara cuántas bajaron; al filtrar por servicios el número pasa '
    + `a las ${queryRows("SELECT COUNT(*)::text, 'fin' FROM products WHERE status = 'ACTIVE' AND publication_type = 'servicio'")[0][0]} que hay en la base`;
});

await runCase(128, 'La cabecera es la misma en Inicio, Mercado y Servicios, y sólo el Mercado suma la banda de búsqueda', async () => {
  // Dos propiedades en un caso, porque son la misma cabecera.
  //
  // La primera: la banda de identidad no cambia de sección a sección. Al entrar
  // al Mercado, el buscador se metía en esa banda y empujaba las cinco
  // secciones a una barra blanca aparte, así que la cabecera se transformaba
  // justo cuando uno pasaba de mirar a operar. Ahora la banda de arriba es
  // idéntica y el Mercado agrega una segunda banda con el buscador, DEBAJO.
  //
  // La segunda: esa banda crece con el rol —administrar suma «Admin», publicar
  // suma «Vender», la sesión suma carrito, cuenta y salir— y es justo donde
  // algo se cae cuando la pantalla es angosta, y donde desaparecería «Salir»
  // si alguien copiara la lámina resumida del handoff.
  const ROLES = [
    ['anónimo', null, ['Ingresar']],
    ['comprador', ['cliente@ejemplo.com', 'cliente123'], ['Carrito', 'Mi cuenta', 'Salir']],
    ['vendedor', ['vendedor@ejemplo.com', 'vendedor123'], ['Vender', 'Carrito', 'Mi cuenta', 'Salir']],
    ['admin', ['admin@topgreen.com', 'admin123'], ['Admin', 'Vender', 'Carrito', 'Mi cuenta', 'Salir']],
  ];
  const ANCHOS = [
    ['escritorio', 1440, 900],
    ['tablet', 768, 1024],
    ['celular', 390, 844],
  ];
  const SECCIONES = ['Inicio', 'Mercado', 'Servicios', 'Quiénes somos', 'Contacto'];

  // Lo que describe a la banda de identidad: dónde está, cuánto mide, con qué
  // marca y con qué celdas, en ese orden. Si dos secciones devuelven lo mismo,
  // la banda es la misma banda.
  const RETRATO = () => {
    const cabecera = document.querySelector('header');
    const banda = cabecera.firstElementChild;
    const caja = banda.getBoundingClientRect();
    const marca = banda.querySelector('img');
    const nombre = (b) => (
      b.getAttribute('aria-label')
      || (b.textContent || '').replace(/\s+/g, ' ').trim()
      || (b.querySelector('img') || {}).alt
      || '?'
    );
    return {
      arriba: Math.round(caja.top),
      alto: Math.round(caja.height),
      marca: marca ? marca.getAttribute('src') : 'sin marca',
      altoMarca: marca ? Math.round(marca.getBoundingClientRect().height) : 0,
      celdas: [...banda.querySelectorAll('button')].map(nombre),
      // El buscador no puede vivir adentro de la banda de identidad.
      buscadorAdentro: !!banda.querySelector('#buscar-mercado'),
    };
  };

  const browser = await chromium.launch({ headless: true });
  const revisados = [];
  const paridades = [];
  try {
    // --- A. La banda de identidad es la misma en las tres secciones -------
    for (const [nombreAncho, width, height] of ANCHOS) {
      const contexto = await browser.newContext({ viewport: { width, height } });
      const page = await contexto.newPage();
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 });

      const retratar = async (seccion) => {
        await page.locator('header').first()
          .getByRole('button', { name: seccion, exact: true }).first().click();
        await page.waitForTimeout(900);
        return page.evaluate(RETRATO);
      };

      const inicio = await retratar('Inicio');
      const mercado = await retratar('Mercado');
      const servicios = await retratar('Servicios');

      for (const [nombre, retrato] of [['Inicio', inicio], ['Mercado', mercado], ['Servicios', servicios]]) {
        assert(JSON.stringify(retrato) === JSON.stringify(inicio),
          `${nombreAncho}: la banda de identidad de ${nombre} no es la de Inicio\n`
          + `  Inicio:  ${JSON.stringify(inicio)}\n`
          + `  ${nombre}: ${JSON.stringify(retrato)}`);
        assert(!retrato.buscadorAdentro,
          `${nombreAncho}/${nombre}: el buscador está adentro de la banda de identidad`);
        assert(retrato.celdas.length >= 6,
          `${nombreAncho}/${nombre}: la banda tiene ${retrato.celdas.length} celdas y faltan destinos`);
        // El orden de lectura es el mismo en los tres anchos: la marca, después
        // la sesión, después los cinco destinos. Se comprueba en el documento,
        // que es lo que recorren el teclado y un lector de pantalla, y no en la
        // posición dibujada, que cambia con el ancho.
        assert(retrato.celdas[0] === 'TopGreen',
          `${nombreAncho}/${nombre}: la banda no arranca por la marca: ${retrato.celdas[0]}`);
        assert(JSON.stringify(retrato.celdas.slice(-5)) === JSON.stringify(SECCIONES),
          `${nombreAncho}/${nombre}: los cinco destinos no cierran la banda en orden: `
          + JSON.stringify(retrato.celdas));
      }

      // --- B. El buscador existe SÓLO en el Mercado, y en su propia banda --
      const dondeEstaElBuscador = async (seccion) => {
        await page.locator('header').first()
          .getByRole('button', { name: seccion, exact: true }).first().click();
        await page.waitForTimeout(900);
        return page.evaluate(() => {
          const campo = document.querySelector('#buscar-mercado');
          if (!campo) return null;
          const banda = document.querySelector('header').firstElementChild;
          return {
            arribaDelCampo: Math.round(campo.getBoundingClientRect().top),
            abajoDeLaBanda: Math.round(banda.getBoundingClientRect().bottom),
            marcador: campo.getAttribute('placeholder'),
            etiqueta: (document.querySelector('label[for="buscar-mercado"]') || {}).textContent,
          };
        });
      };

      assert(await dondeEstaElBuscador('Inicio') === null,
        `${nombreAncho}: Inicio dibuja un buscador que no filtra nada`);
      assert(await dondeEstaElBuscador('Servicios') === null,
        `${nombreAncho}: Servicios dibuja un buscador que no filtra nada`);

      const enMercado = await dondeEstaElBuscador('Mercado');
      assert(enMercado, `${nombreAncho}: el Mercado se quedó sin buscador`);
      assert(enMercado.arribaDelCampo >= enMercado.abajoDeLaBanda - 1,
        `${nombreAncho}: el buscador arranca en ${enMercado.arribaDelCampo} y la banda de `
        + `identidad termina en ${enMercado.abajoDeLaBanda}: no está debajo`);
      assert(enMercado.etiqueta === 'Buscar en el mercado',
        `${nombreAncho}: la etiqueta del buscador dice «${enMercado.etiqueta}»`);
      assert(enMercado.marcador === (nombreAncho === 'celular' ? 'Buscar' : 'Buscar producto, servicio o ubicación'),
        `${nombreAncho}: el buscador dice «${enMercado.marcador}»`);

      // --- C. Y desde ahí sigue filtrando el catálogo ----------------------
      const [publicacion] = queryRows(
        "SELECT name, 'fin' FROM products WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1");
      assert(publicacion, 'la base no tiene publicaciones activas para probar la búsqueda');
      await page.locator('article[class*="card"]').first().waitFor({ timeout: 25_000 });
      const antes = await page.locator('article[class*="card"]').count();
      await page.getByLabel('Buscar en el mercado').fill(publicacion[0]);
      await page.getByLabel('Buscar en el mercado').press('Enter');
      await page.waitForTimeout(1500);
      const despues = await page.locator('article[class*="card"]').count();
      assert(despues > 0 && despues < antes,
        `${nombreAncho}: buscar «${publicacion[0]}» pasó de ${antes} a ${despues} tarjetas`);
      await page.getByRole('heading', { name: publicacion[0], exact: true, level: 3 })
        .first().waitFor({ state: 'visible', timeout: 20_000 });

      paridades.push(nombreAncho);
      await contexto.close();
    }

    // --- D. Las acciones de cada rol, en los tres anchos -------------------
    for (const [rol, credenciales, acciones] of ROLES) {
      let sesion = null;
      if (credenciales) {
        const entrada = await apiRequest('/auth/login', {
          method: 'POST', body: { email: credenciales[0], password: credenciales[1] },
        });
        assert(entrada.status === 200, `${rol}: el ingreso respondió HTTP ${entrada.status}`);
        sesion = entrada.data;
      }
      for (const [nombreAncho, width, height] of ANCHOS) {
        const contexto = await browser.newContext({ viewport: { width, height } });
        if (sesion) {
          await contexto.addInitScript(
            ({ accessToken, refreshToken }) => {
              window.localStorage.setItem('access_token', accessToken);
              window.localStorage.setItem('refresh_token', refreshToken);
            },
            { accessToken: sesion.access_token, refreshToken: sesion.refresh_token },
          );
        }
        const page = await contexto.newPage();
        await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
        const cabecera = page.locator('header').first();
        await cabecera.waitFor({ state: 'visible', timeout: 20_000 });
        await page.getByLabel('Buscar en el mercado').waitFor({ state: 'visible', timeout: 20_000 });

        // 1. Los cinco destinos siguen ahí y se ven: ni escondidos con
        //    `display: none` ni empujados a un scroll horizontal.
        for (const seccion of SECCIONES) {
          const destino = cabecera.getByRole('button', { name: seccion, exact: true }).first();
          assert(await destino.isVisible(),
            `${rol}/${nombreAncho}: la sección «${seccion}» no se ve en la cabecera`);
        }

        // 2. Y las acciones del rol, con sus áreas táctiles.
        for (const accion of acciones) {
          const boton = cabecera.getByRole('button', { name: new RegExp(accion) }).first();
          assert(await boton.isVisible(),
            `${rol}/${nombreAncho}: falta la acción «${accion}»`);
          const caja = await boton.boundingBox();
          assert(caja && caja.height >= 44,
            `${rol}/${nombreAncho}: «${accion}» mide ${caja ? Math.round(caja.height) : 0} px de alto`);
        }

        // 3. La cuenta dice el nombre real en escritorio y «Cuenta» en celular:
        //    un nombre variable no entra en 390 px sin cortarse.
        if (credenciales) {
          const cuenta = cabecera.getByRole('button', { name: 'Mi cuenta' }).first();
          const visible = (await cuenta.innerText()).trim();
          if (nombreAncho === 'celular') {
            assert(visible === 'Cuenta',
              `${rol}/celular: la celda de la cuenta dice «${visible}» en vez de «Cuenta»`);
          } else {
            assert(visible !== 'Cuenta' && visible.length > 0,
              `${rol}/${nombreAncho}: la celda de la cuenta no muestra el nombre real`);
          }
        }

        // 4. El buscador del mercado dice lo corto en celular y lo descriptivo
        //    en escritorio; la etiqueta, que es lo que se anuncia, no cambia.
        const marcador = await page.getByLabel('Buscar en el mercado').getAttribute('placeholder');
        assert(marcador === (nombreAncho === 'celular' ? 'Buscar' : 'Buscar producto, servicio o ubicación'),
          `${rol}/${nombreAncho}: el buscador dice «${marcador}»`);

        // 5. Nada de esto empuja la página a lo ancho.
        const desborde = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        assert(desborde.scroll <= desborde.client + 1,
          `${rol}/${nombreAncho}: la página desborda ${desborde.scroll} > ${desborde.client}`);

        revisados.push(`${rol}/${nombreAncho}`);
        await contexto.close();
      }
    }
  } finally {
    await browser.close();
  }

  return `banda de identidad idéntica en Inicio, Mercado y Servicios en ${paridades.length} anchos `
    + '—misma posición, mismo alto, misma marca y las mismas celdas en el mismo orden—, con el '
    + 'buscador sólo en el Mercado, debajo de esa banda, filtrando el catálogo desde ahí; y '
    + `${revisados.length} combinaciones de rol y ancho con los cinco destinos visibles, todas `
    + 'las acciones del rol con 44 px de alto —«Salir» incluido—, el nombre real en escritorio '
    + 'y «Cuenta» en celular, el buscador con su texto por ancho y cero desborde horizontal';
});

await runCase(129, 'El ingreso no deja la credencial escrita en la consola del navegador', async () => {
  // El login imprimía en consola el correo con el que se entra, la respuesta
  // completa de `/auth/login` —que trae `access_token` y `refresh_token`— y el
  // objeto entero del usuario. Cualquier cosa que corra en la página lee eso:
  // una extensión, un script de terceros, alguien mirando la pantalla del
  // soporte técnico. Este caso mira la consola mientras se entra de verdad.
  //
  // No alcanza con escuchar el evento `console` de Playwright: cuando el
  // argumento es un objeto, el evento entrega «JSHandle@object» y el token no
  // aparece. Se espía la consola desde adentro de la página, serializando cada
  // argumento, que es lo que ve de verdad quien está en el mismo documento.
  const CUENTA = { email: 'cliente@ejemplo.com', password: 'cliente123' };

  const ESPIA = () => {
    window.__consolaEspiada = [];
    const serializar = (valor) => {
      if (typeof valor === 'string') return valor;
      if (valor instanceof Error) return `${valor.name}: ${valor.message} ${valor.stack || ''}`;
      try {
        return JSON.stringify(valor);
      } catch (error) {
        return String(valor);
      }
    };
    for (const nivel of ['log', 'info', 'debug', 'warn', 'error', 'trace', 'table', 'dir']) {
      const original = typeof console[nivel] === 'function' ? console[nivel].bind(console) : null;
      console[nivel] = (...args) => {
        try {
          window.__consolaEspiada.push(`${nivel}: ${args.map(serializar).join(' ')}`);
        } catch (error) { /* espiar no puede romper la página */ }
        if (original) original(...args);
      };
    }
  };

  const leerConsola = (page) => page.evaluate(() => (window.__consolaEspiada || []).join('\n'));
  const guardado = (page, clave) => page.evaluate((k) => localStorage.getItem(k), clave);

  const browser = await chromium.launch({ headless: true });
  const hallazgos = [];
  try {
    // --- 1. Ingreso válido, mirando la consola ---------------------------
    const contexto = await browser.newContext();
    await contexto.addInitScript(ESPIA);
    const page = await contexto.newPage();
    const eventos = [];
    page.on('console', (m) => eventos.push(`${m.type()}: ${m.text()}`));

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Ingresar', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
    await page.getByPlaceholder('tu@email.com').fill(CUENTA.email);
    await page.getByPlaceholder('••••••••').fill(CUENTA.password);
    await page.locator('[class*="_submitButton_"][type="submit"]').click();
    await page.getByRole('button', { name: 'Mi cuenta' }).first().waitFor({ state: 'visible', timeout: 25_000 });

    const acceso = await guardado(page, 'access_token');
    const refresco = await guardado(page, 'refresh_token');
    assert(acceso && refresco, 'el ingreso no dejó el par de tokens en el navegador');

    const consola = await leerConsola(page);
    const [cuentaEnBase] = queryRows(
      `SELECT id::text, 'fin' FROM users WHERE email = ${sqlLiteral(CUENTA.email)}`);
    assert(cuentaEnBase, 'la cuenta de prueba no está en la base');

    // Los valores exactos que no pueden estar escritos en ningún nivel.
    const PROHIBIDO = [
      ['el access token', acceso],
      ['el refresh token', refresco],
      ['la contraseña', CUENTA.password],
      ['el correo de ingreso', CUENTA.email],
      ['el identificador de la cuenta', cuentaEnBase[0]],
    ];
    for (const [que, valor] of PROHIBIDO) {
      if (consola.includes(valor)) hallazgos.push(`${que} quedó impreso en la consola`);
    }
    // Y la forma: la respuesta de autenticación entera, con sus claves.
    if (/access_token|refresh_token|token_type/.test(consola)) {
      hallazgos.push('la consola imprimió la respuesta de autenticación');
    }
    assert(hallazgos.length === 0,
      `${hallazgos.join('; ')}\n--- consola ---\n${consola.slice(0, 900)}`);

    // El evento de Playwright se mira igual, por si algo escribe fuera del
    // `console` envuelto: no prueba lo mismo, pero no cuesta nada.
    const crudo = eventos.join('\n');
    for (const [que, valor] of PROHIBIDO) {
      assert(!crudo.includes(valor), `${que} salió por el evento de consola`);
    }

    // --- 2. La sesión sirve: una pantalla protegida carga ----------------
    await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await page.getByRole('heading', { name: 'Mi Panel' }).waitFor({ timeout: 20_000 });

    // --- 3. El refresh automático sigue vivo ------------------------------
    //     Se rompe el access token guardado y se pide algo protegido que no
    //     sea de `/auth/`: el envoltorio tiene que renovar con el refresh y
    //     reintentar sin que la persona se entere.
    const roto = `${acceso.slice(0, -6)}xxxxxx`;
    await page.evaluate((t) => localStorage.setItem('access_token', t), roto);
    await page.getByRole('button', { name: /Notificaciones/ }).first().click();
    await page.waitForTimeout(2500);
    const accesoRenovado = await guardado(page, 'access_token');
    assert(accesoRenovado && accesoRenovado !== roto,
      'el access token roto no se renovó: el refresh automático dejó de funcionar');
    assert(await page.getByRole('heading', { name: 'Mi Panel' }).isVisible(),
      'la sesión se cayó al renovar el token');

    // Y la renovación tampoco se imprime.
    const consolaTrasRefresh = await leerConsola(page);
    for (const valor of [accesoRenovado, await guardado(page, 'refresh_token')]) {
      assert(valor && !consolaTrasRefresh.includes(valor),
        'la renovación del token quedó impresa en la consola');
    }

    // --- 4. Salir limpia lo que tiene que limpiar -------------------------
    await page.getByRole('button', { name: 'Cerrar' }).first().click().catch(() => {});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Salir', exact: true }).first().click();
    await page.getByRole('button', { name: 'Ingresar', exact: true }).first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    assert(await guardado(page, 'access_token') === null
      && await guardado(page, 'refresh_token') === null,
      'salir dejó tokens guardados en el navegador');

    await contexto.close();

    // --- 5. Ingreso rechazado: tampoco escribe lo que se intentó ---------
    const contexto2 = await browser.newContext();
    await contexto2.addInitScript(ESPIA);
    const page2 = await contexto2.newPage();
    await page2.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page2.getByRole('button', { name: 'Ingresar', exact: true }).first().click();
    await page2.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
    await page2.getByPlaceholder('tu@email.com').fill(CUENTA.email);
    await page2.getByPlaceholder('••••••••').fill('contrasena-que-no-es');
    await page2.locator('[class*="_submitButton_"][type="submit"]').click();
    await page2.getByText(/incorrect|no está confirmada/i).first()
      .waitFor({ state: 'visible', timeout: 20_000 });

    const consolaRechazo = await leerConsola(page2);
    for (const [que, valor] of [
      ['el correo intentado', CUENTA.email],
      ['la contraseña intentada', 'contrasena-que-no-es'],
    ]) {
      assert(!consolaRechazo.includes(valor),
        `${que} quedó impreso al rechazar el ingreso\n--- consola ---\n${consolaRechazo.slice(0, 600)}`);
    }
    assert(await guardado(page2, 'access_token') === null,
      'un ingreso rechazado guardó un token');

    await contexto2.close();
  } finally {
    await browser.close();
  }

  return 'con un ingreso válido no aparecen en ningún nivel de consola el access token, el '
    + 'refresh token, la contraseña, el correo de ingreso, el identificador de la cuenta ni '
    + 'la respuesta de autenticación; la sesión abre una pantalla protegida, el refresh '
    + 'automático renueva un access token roto sin imprimirlo y salir borra el par; y un '
    + 'ingreso rechazado no escribe lo que se intentó ni guarda nada';
});

await runCase(130, 'El token sigue siendo el mismo JWT despues de cambiar la biblioteca que lo firma', async () => {
  // `python-jose` salio del proyecto porque arrastra `ecdsa`, que tiene el
  // ataque Minerva declarado sin arreglo. Lo reemplaza PyJWT. El riesgo de ese
  // cambio no es que deje de andar —eso lo ve cualquier caso de login—, es que
  // el token cambie de forma sin que nadie lo note y las sesiones abiertas se
  // caigan en el despliegue.
  //
  // Este caso fija el contrato del token SIN usar ninguna biblioteca de JWT:
  // parte la cadena a mano, lee la cabecera y la carga, y recalcula la firma
  // con HMAC-SHA256 crudo. Si mañana se cambia otra vez de biblioteca, esto
  // sigue diciendo si el token es el mismo token.
  const env = readFileSync('backend/.env', 'utf8');
  const leerEnv = (clave) => {
    const linea = env.split(/\r?\n/).filter((l) => l.startsWith(`${clave}=`)).pop();
    return linea ? linea.slice(clave.length + 1).trim() : null;
  };
  const secreto = leerEnv('JWT_SECRET');
  const algoritmo = leerEnv('JWT_ALGORITHM') || 'HS256';
  const minutosDeAcceso = Number(leerEnv('ACCESS_TOKEN_MINUTES') || 15);
  const diasDeRefresco = Number(leerEnv('REFRESH_TOKEN_DAYS') || 30);
  assert(secreto, 'backend/.env no declara JWT_SECRET');
  assert(algoritmo === 'HS256', `el algoritmo configurado es ${algoritmo} y este caso mide HS256`);

  const desdeBase64Url = (s) =>
    Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const aBase64Url = (buf) =>
    buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const firmar = (cabezaYCarga) =>
    aBase64Url(createHmac('sha256', secreto).update(cabezaYCarga).digest());

  const partir = (token) => {
    const trozos = token.split('.');
    assert(trozos.length === 3, `el token no tiene tres partes: ${trozos.length}`);
    return {
      cabecera: JSON.parse(desdeBase64Url(trozos[0])),
      carga: JSON.parse(desdeBase64Url(trozos[1])),
      firma: trozos[2],
      cuerpo: `${trozos[0]}.${trozos[1]}`,
    };
  };

  const entrada = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  assert(entrada.status === 200, `el ingreso respondio HTTP ${entrada.status}`);
  const ahora = Math.floor(Date.now() / 1000);

  const revisados = [];
  for (const [nombre, token, tipoEsperado, segundosEsperados] of [
    ['acceso', entrada.data.access_token, 'access', minutosDeAcceso * 60],
    ['refresco', entrada.data.refresh_token, 'refresh', diasDeRefresco * 86400],
  ]) {
    assert(token, `el ingreso no devolvio el token de ${nombre}`);
    const { cabecera, carga, firma, cuerpo } = partir(token);

    // 1. La cabecera es exactamente la de un JWS compacto HS256.
    assert(JSON.stringify(cabecera) === JSON.stringify({ alg: 'HS256', typ: 'JWT' })
      || JSON.stringify(cabecera) === JSON.stringify({ typ: 'JWT', alg: 'HS256' }),
      `la cabecera del token de ${nombre} es ${JSON.stringify(cabecera)}`);

    // 2. Las reclamaciones son las de siempre y el vencimiento es el declarado.
    assert(typeof carga.sub === 'string' && carga.sub.length > 0,
      `el token de ${nombre} no trae sujeto`);
    assert(carga.sub === entrada.data.user.id,
      `el sujeto del token de ${nombre} no es la cuenta que entro`);
    assert(carga.type === tipoEsperado,
      `el token de ${nombre} dice type=${carga.type}`);
    assert(Number.isInteger(carga.exp), `el vencimiento de ${nombre} no es entero: ${carga.exp}`);
    const desvio = Math.abs((carga.exp - ahora) - segundosEsperados);
    assert(desvio <= 120,
      `el token de ${nombre} vence en ${carga.exp - ahora} s y la configuracion dice ${segundosEsperados} s`);
    // 3. Nada de mas: el token no lleva la cuenta adentro.
    const claves = Object.keys(carga).sort().join(',');
    assert(claves === 'exp,sub,type',
      `el token de ${nombre} lleva reclamaciones de mas: ${claves}`);

    // 4. Y la firma es HMAC-SHA256 del secreto, recalculada acá sin PyJWT.
    assert(firma === firmar(cuerpo),
      `la firma del token de ${nombre} no es HMAC-SHA256 del secreto configurado`);

    revisados.push(`${nombre} vence en ${Math.round((carga.exp - ahora) / 60)} min`);
  }

  // 5. Lo que NO puede pasar. Un token con la carga cambiada y firmado con
  //    otro secreto, uno sin algoritmo y uno vencido: los tres rechazados.
  const acceso = partir(entrada.data.access_token);
  const cabeceraOriginal = entrada.data.access_token.split('.')[0];
  const cargaComoTexto = (obj) =>
    aBase64Url(Buffer.from(JSON.stringify(obj), 'utf8'));

  const otroSujeto = { ...acceso.carga, sub: '00000000-0000-0000-0000-000000000000' };
  const cuerpoFalso = `${cabeceraOriginal}.${cargaComoTexto(otroSujeto)}`;
  const firmadoConOtroSecreto = `${cuerpoFalso}.${
    aBase64Url(createHmac('sha256', 'otro-secreto-que-no-es-el-del-servidor').update(cuerpoFalso).digest())}`;

  const sinAlgoritmo = `${aBase64Url(Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }), 'utf8'))}.${
    cargaComoTexto(acceso.carga)}.`;

  const cuerpoVencido = `${cabeceraOriginal}.${cargaComoTexto({ ...acceso.carga, exp: ahora - 3600 })}`;
  const vencidoBienFirmado = `${cuerpoVencido}.${firmar(cuerpoVencido)}`;

  for (const [que, token] of [
    ['un token con el sujeto cambiado y firmado con otro secreto', firmadoConOtroSecreto],
    ['un token que dice alg=none', sinAlgoritmo],
    ['un token vencido pero bien firmado', vencidoBienFirmado],
  ]) {
    await expectApiError(401, () => apiRequest('/auth/me', { token }));
    revisados.push(`rechaza ${que}`);
  }

  // 6. Y el bueno sigue abriendo la sesion.
  const yo = await apiRequest('/auth/me', { token: entrada.data.access_token });
  assert(yo.status === 200 && yo.data.email === 'cliente@ejemplo.com',
    `el token valido no abrio la sesion: HTTP ${yo.status}`);

  return `el token es un JWS compacto HS256 con cabecera exacta, sujeto, tipo y vencimiento `
    + `declarados y nada mas —${revisados.slice(0, 2).join('; ')}—, con la firma verificada `
    + 'recalculando HMAC-SHA256 fuera de la biblioteca; rechaza sujeto cambiado con otro '
    + 'secreto, alg=none y vencido bien firmado, y el valido abre la sesion';
});

await runCase(131, 'Toda respuesta publica sale con la base defensiva, y la politica del Frontend no tiene comodines', async () => {
  // El Frontend y el Backend contestaban sin HSTS, sin politica de contenido,
  // sin `nosniff`, sin prohibicion de marco, sin `Referrer-Policy` y sin
  // `Permissions-Policy`. El Nginx local heredado traia dos cabeceras y no es
  // el que sirve el despliegue: el que sirve es
  // `infra/railway/nginx.conf.template`, que no definia ninguna.
  //
  // Este caso tiene dos mitades, porque los dos servicios se prueban distinto:
  // el Backend corre aca y se le mide la respuesta de verdad; el Frontend en
  // produccion lo sirve Nginx, asi que se le exige el contrato a la plantilla
  // y al Dockerfile que la completa, y ademas se levanta un candidato con esa
  // misma plantilla cuando la maquina tiene Nginx.
  const ESPERADAS = {
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  const PERMISOS_NEGADOS = [
    'accelerometer', 'autoplay', 'camera', 'display-capture', 'encrypted-media',
    'fullscreen', 'geolocation', 'gyroscope', 'magnetometer', 'microphone',
    'midi', 'payment', 'picture-in-picture', 'publickey-credentials-get',
    'screen-wake-lock', 'usb', 'xr-spatial-tracking',
  ];

  // Las cabeceras crudas: `fetch` colapsa repetidas en una sola cadena separada
  // por coma, que es justo lo que hace falta para detectar duplicados.
  const cabecerasDe = async (url, opciones = {}) => {
    const r = await fetch(url, { redirect: 'manual', ...opciones });
    const mapa = {};
    r.headers.forEach((valor, nombre) => { mapa[nombre.toLowerCase()] = valor; });
    return { status: r.status, h: mapa, cuerpo: r };
  };

  const exigirBase = (etiqueta, h) => {
    for (const [nombre, valor] of Object.entries(ESPERADAS)) {
      assert(h[nombre] === valor,
        `${etiqueta}: ${nombre} vale ${JSON.stringify(h[nombre])} y tiene que valer ${JSON.stringify(valor)}`);
      // Una cabecera repetida con valores distintos llega como «a, b»: dos
      // politicas para lo mismo es peor que ninguna.
      assert(!h[nombre].includes(','),
        `${etiqueta}: ${nombre} llego duplicada -> ${h[nombre]}`);
    }
    const permisos = h['permissions-policy'] || '';
    for (const capacidad of PERMISOS_NEGADOS) {
      assert(new RegExp(`(^|[ ,])${capacidad}=\\(\\)`).test(permisos),
        `${etiqueta}: Permissions-Policy no niega ${capacidad} -> ${permisos}`);
    }
    assert(!/\bnone\b|\*/.test(permisos.replace(/=\(\)/g, '')),
      `${etiqueta}: Permissions-Policy tiene un comodin -> ${permisos}`);
  };

  // --- A. Backend: exito, error, inexistente, documentacion y descarga -----
  const entrada = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  });
  const token = entrada.data.access_token;
  const base = API_URL.replace(/\/api$/, '');

  const rutasDelBackend = [
    ['salud', `${API_URL}/health`, {}],
    ['catalogo 200', `${API_URL}/catalog/products?page_size=1`, {}],
    ['sesion 401', `${API_URL}/auth/me`, {}],
    ['inexistente 404', `${API_URL}/no-existe-esta-ruta`, {}],
    ['documentacion interactiva', `${API_URL}/docs`, {}],
    ['sesion 200', `${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }],
    ['raiz', `${base}/`, {}],
  ];
  const codigos = [];
  for (const [etiqueta, url, opciones] of rutasDelBackend) {
    const { status, h } = await cabecerasDe(url, opciones);
    exigirBase(`backend/${etiqueta}`, h);
    codigos.push(`${etiqueta}=${status}`);
  }

  // El CORS no se toca: sigue contestando el preflight y el origen permitido.
  const preflight = await cabecerasDe(`${API_URL}/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: FRONTEND_URL,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert(preflight.h['access-control-allow-origin'] === FRONTEND_URL,
    `el preflight perdio el origen permitido: ${preflight.h['access-control-allow-origin']}`);
  exigirBase('backend/preflight', preflight.h);

  // Y una descarga conserva tipo, nombre y contenido.
  const constancia = await cabecerasDe(`${API_URL}/documentacion/archivo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (constancia.status === 200) {
    exigirBase('backend/descarga', constancia.h);
    assert(constancia.h['content-type'] === 'application/pdf',
      `la descarga perdio el tipo: ${constancia.h['content-type']}`);
    assert(/filename=/.test(constancia.h['content-disposition'] || ''),
      `la descarga perdio el nombre: ${constancia.h['content-disposition']}`);
    const bytes = new Uint8Array(await constancia.cuerpo.arrayBuffer());
    assert(bytes.length > 0 && String.fromCharCode(...bytes.slice(0, 4)) === '%PDF',
      'la descarga dejo de ser un PDF');
    codigos.push('descarga=200');
  } else {
    // Sin documentacion presentada no hay archivo que bajar; el caso no
    // inventa uno, pero deja dicho que esa fila no se midio.
    codigos.push(`descarga=${constancia.status} (sin documentacion presentada)`);
  }

  // La API no pone politica de contenido, y es a proposito: devuelve JSON y
  // archivos, y la unica pagina HTML que sirve trae sus recursos de un CDN.
  const salud = await cabecerasDe(`${API_URL}/health`);
  assert(!salud.h['content-security-policy'],
    'la API empezo a mandar CSP: revisar que no rompa la documentacion interactiva');

  // --- B. Frontend: el contrato de la plantilla que sirve el despliegue ----
  const plantilla = readFileSync('infra/railway/nginx.conf.template', 'utf8');
  const dockerfile = readFileSync('Dockerfile.railway', 'utf8');

  const declarada = (nombre) => {
    const filas = plantilla.split(/\r?\n/).filter(
      (l) => new RegExp(`^\\s*add_header\\s+${nombre}\\b`, 'i').test(l));
    assert(filas.length === 1,
      `la plantilla declara ${filas.length} veces ${nombre}; tiene que ser una`);
    assert(/\balways\b/.test(filas[0]),
      `${nombre} sin \`always\`: no saldria en los errores`);
    return filas[0];
  };
  for (const nombre of ['Strict-Transport-Security', 'X-Content-Type-Options',
    'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy',
    'Content-Security-Policy']) {
    declarada(nombre);
  }

  // En Nginx un `add_header` adentro de un `location` REEMPLAZA a los
  // heredados. Si alguien agrega uno ahi, las seis se caen sin aviso.
  const dentroDeLocation = plantilla
    .split(/location\s/).slice(1)
    .some((trozo) => /add_header/i.test(trozo.split(/\n\s*}/)[0]));
  assert(!dentroDeLocation,
    'hay un add_header adentro de un location: eso descarta las cabeceras del server');

  const csp = declarada('Content-Security-Policy');
  // `'unsafe-inline'` esta en la lista por medicion, no por prolijidad: se
  // levantaron los dos candidatos, con y sin el permiso, y los veintiocho
  // atributos `style` de React se aplican igual —React los asigna por CSSOM y
  // la CSP no gobierna el CSSOM—, sin un solo «Refused to apply inline style».
  for (const prohibido of ["'unsafe-eval'", "'unsafe-inline'", "https:", "http:", " *"]) {
    assert(!csp.includes(prohibido),
      `la politica trae ${prohibido}, que la orden prohibe: ${csp}`);
  }
  // `data:` y `blob:` se toleran en UN solo lugar, `img-src`, y porque hay dos
  // funciones que los necesitan: el alta previsualiza la foto con
  // `FileReader.readAsDataURL` y la edicion de una publicacion previsualiza las
  // fotos nuevas con `URL.createObjectURL`. En cualquier otra directiva son un
  // agujero.
  const directivas = Object.fromEntries(
    csp.replace(/^[^"]*"|"[^"]*$/g, '').split(';')
      .map((d) => d.trim()).filter(Boolean)
      .map((d) => [d.split(/\s+/)[0], d]));
  for (const [nombre, cuerpo] of Object.entries(directivas)) {
    if (nombre === 'img-src') continue;
    assert(!/\b(data|blob):/.test(cuerpo),
      `la directiva ${nombre} permite data:/blob: y no le hace falta: ${cuerpo}`);
  }
  assert(/img-src[^;]*\bdata:/.test(csp) && /img-src[^;]*\bblob:/.test(csp),
    `img-src tiene que permitir data: y blob: para las dos vistas previas: ${csp}`);
  for (const exigido of ["default-src 'self'", "object-src 'none'",
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
    "script-src 'self'", "style-src 'self'", "font-src 'self'", "media-src 'self'"]) {
    assert(csp.includes(exigido), `la politica no declara ${exigido}: ${csp}`);
  }
  // Los origenes no estan escritos a mano: quedan como marcadores que completa
  // la construccion con las MISMAS variables con las que se compilo el bundle.
  for (const marcador of ['__CSP_ORIGEN_API__', '__CSP_ORIGEN_IMAGENES__']) {
    assert(csp.includes(marcador),
      `la politica escribio un origen a mano en vez de ${marcador}: ${csp}`);
    assert(dockerfile.includes(marcador),
      `Dockerfile.railway no sustituye ${marcador}`);
  }
  assert(/VITE_API_URL/.test(dockerfile) && /VITE_IMAGES_URL/.test(dockerfile),
    'Dockerfile.railway no toma los origenes de las variables del build');
  assert(/grep -q "__CSP_ORIGEN_"/.test(dockerfile),
    'Dockerfile.railway no falla si queda un marcador sin sustituir');

  // Y la receta no se lee: se EJECUTA. Sin demonio de Docker no se construye la
  // imagen, pero el paso que arma la politica es un `sh -c` y se puede correr
  // igual, uniendo las continuaciones como hace Docker. Esto encontro que la
  // version anterior salia con 0 aunque la variable viniera vacia: `test -n` en
  // el medio de la cadena no cortaba nada, el marcador se sustituia por nada y
  // el grep final no lo veia porque el marcador ya no estaba.
  // La receta se ubica por lo que HACE —es el RUN que nombra el marcador—, no
  // por como empieza: asi el caso sigue midiendo la receta aunque se reescriba.
  // Las continuaciones se unen igual que las une Docker, en una sola linea.
  const bloques = dockerfile
    .replace(/\\\r?\n\s*/g, ' ')
    .split(/\r?\n/)
    .filter((l) => /^RUN /.test(l))
    .map((l) => l.replace(/^RUN /, '').trim());
  const conLaPolitica = bloques.filter((b) => b.includes('__CSP_ORIGEN_API__'));
  assert(conLaPolitica.length === 1,
    `Dockerfile.railway tiene ${conLaPolitica.length} RUN que arman la politica; tiene que ser uno`);
  const unida = conLaPolitica[0];
  const taller = mkdtempSync(`${tmpdir()}/topgreen-receta-`);
  const copia = `${taller}/plantilla`;
  const guion = unida.replaceAll('/etc/nginx/templates/default.conf.template', copia);

  // La receta se ejecuta SIEMPRE en Alpine, que es donde va a correr de verdad.
  //
  // Antes habia una sonda que preguntaba si el `sed` de la maquina se portaba
  // como el del destino. Contestaba con UNA expresion y la receta real usa
  // DOS: el `sed` de BSD pasaba la sonda y despues fallaba la receta, asi que
  // la heuristica clasificaba macOS como compatible y el caso se ponia rojo
  // igual. Una sonda que no reproduce lo que va a pasar no sirve para decidir.
  //
  // La suite ya depende de Docker —`npm run smoke` empieza por
  // `docker compose down -v`—, asi que correr la receta en `alpine:3` no suma
  // una dependencia: saca una heuristica y prueba el entorno real del
  // Dockerfile.
  const ejecutar = (api, imagenes) => {
    writeFileSync(copia, plantilla);
    return spawnSync('docker', [
      'run', '--rm', '-v', `${taller}:${taller}`,
      '-e', `VITE_API_URL=${api}`, '-e', `VITE_IMAGES_URL=${imagenes}`,
      'alpine:3', 'sh', '-c', guion,
    ], { encoding: 'utf8' });
  };

  const buena = ejecutar('https://api.ejemplo.test/api', 'https://imagenes.ejemplo.test');
  assert(buena.status === 0,
    'la receta fallo con variables validas dentro de alpine:3: '
    + `${buena.stderr || buena.error?.message || ''}`);
  const salida = readFileSync(copia, 'utf8');
  assert(/connect-src 'self' https:\/\/api\.ejemplo\.test"/.test(salida),
    'la receta metio la ruta /api en la politica; CSP entiende origenes, no rutas');
  assert(/img-src[^;]*https:\/\/imagenes\.ejemplo\.test/.test(salida),
    'la receta no sustituyo el origen de imagenes');
  assert(!salida.includes('__CSP_ORIGEN_'), 'la receta dejo un marcador sin sustituir');

  const vacia = ejecutar('', 'https://imagenes.ejemplo.test');
  assert(vacia.status !== 0,
    'con VITE_API_URL vacia la receta salio con 0: la politica quedaria con un origen en blanco');
  const vaciaImagenes = ejecutar('https://api.ejemplo.test/api', '');
  assert(vaciaImagenes.status !== 0,
    'con VITE_IMAGES_URL vacia la receta salio con 0');
  rmSync(taller, { recursive: true, force: true });

  // --- C. Y si la maquina tiene Nginx, se sirve de verdad ------------------
  let modo = 'contrato de la plantilla (esta maquina no tiene nginx)';
  const hayNginx = spawnSync('nginx', ['-v'], { encoding: 'utf8' }).status === 0;
  if (hayNginx && existsSync('dist/index.html')) {
    const carpeta = mkdtempSync(`${tmpdir()}/topgreen-nginx-`);
    const puerto = 8199;
    const origenApi = 'http://127.0.0.1:8000';
    const conf = plantilla
      .replace('${PORT}', String(puerto))
      .replace('/usr/share/nginx/html', `${process.cwd()}/dist`)
      .replaceAll('__CSP_ORIGEN_API__', origenApi)
      .replaceAll('__CSP_ORIGEN_IMAGENES__', origenApi);
    writeFileSync(`${carpeta}/servidor.conf`, conf);
    writeFileSync(`${carpeta}/nginx.conf`, [
      'worker_processes 1;',
      `error_log ${carpeta}/error.log warn;`,
      `pid ${carpeta}/nginx.pid;`,
      'events { worker_connections 64; }',
      'http {',
      '  include /etc/nginx/mime.types;',
      '  default_type application/octet-stream;',
      `  access_log ${carpeta}/access.log;`,
      `  client_body_temp_path ${carpeta}/body;`,
      `  proxy_temp_path ${carpeta}/proxy;`,
      `  fastcgi_temp_path ${carpeta}/fastcgi;`,
      `  uwsgi_temp_path ${carpeta}/uwsgi;`,
      `  scgi_temp_path ${carpeta}/scgi;`,
      `  include ${carpeta}/servidor.conf;`,
      '}',
    ].join('\n'));

    const prueba = spawnSync('nginx', ['-t', '-c', `${carpeta}/nginx.conf`], { encoding: 'utf8' });
    assert(prueba.status === 0, `la plantilla no es una configuracion valida: ${prueba.stderr}`);
    spawnSync('nginx', ['-c', `${carpeta}/nginx.conf`], { encoding: 'utf8' });
    try {
      const asset = readdirSync('dist/assets').find((f) => f.endsWith('.js'));
      assert(asset, 'dist no tiene un asset con hash para medir');
      for (const [etiqueta, ruta] of [
        ['documento', '/'],
        ['asset', `/assets/${asset}`],
        ['salud', '/health'],
        ['ruta spa inexistente', '/una-ruta-que-no-existe'],
      ]) {
        const { status, h } = await cabecerasDe(`http://127.0.0.1:${puerto}${ruta}`);
        assert(status === 200, `frontend/${etiqueta} respondio ${status}`);
        exigirBase(`frontend/${etiqueta}`, h);
        assert((h['content-security-policy'] || '').includes(origenApi),
          `frontend/${etiqueta}: la politica no quedo apuntando al origen del build`);
        assert(!(h['content-security-policy'] || '').includes('__CSP_ORIGEN_'),
          `frontend/${etiqueta}: quedo un marcador sin sustituir`);
        assert(!(h['content-security-policy'] || '').includes(','),
          `frontend/${etiqueta}: la politica llego duplicada`);
      }
      modo = `candidato Nginx real en :${puerto}, cuatro rutas`;
    } finally {
      spawnSync('nginx', ['-c', `${carpeta}/nginx.conf`, '-s', 'quit'], { encoding: 'utf8' });
    }
  }

  // --- D. El error 500 no controlado sale con la MISMA base ----------------
  // Un 500 no se puede pedir por HTTP: no hay —ni tiene que haber— una ruta que
  // reviente a pedido. Asi que la prueba levanta la aplicacion REAL donde vive,
  // con su pila de middleware de verdad, y le engancha EN MEMORIA una ruta que
  // lanza un RuntimeError. Esa ruta no existe en el producto: nace y muere
  // adentro de este proceso de Python.
  //
  // Lo que esto encontro: `add_middleware` deja la capa por DENTRO de
  // `ServerErrorMiddleware`, que Starlette pone siempre en la capa 0. Cuando la
  // excepcion sube, esa capa escribe su respuesta con el `send` crudo y el
  // middleware de uno no la ve nunca. El 500 salia sin una sola cabecera.
  const guionDel500 = `
import json, sys
from app.main import app
from starlette.testclient import TestClient


@app.get("/__revienta_solo_en_la_prueba__")
async def _revienta():
    raise RuntimeError("explosion deliberada de la regresion")


medidas = {}
with TestClient(app, raise_server_exceptions=False) as cliente:
    for etiqueta, ruta in [("500", "/__revienta_solo_en_la_prueba__"),
                           ("200", "/api/health"),
                           ("401", "/api/auth/me"),
                           ("404", "/api/no-existe")]:
        r = cliente.get(ruta)
        medidas[etiqueta] = {
            "status": r.status_code,
            "tipo": r.headers.get("content-type"),
            "cuerpo": r.text[:400],
            # get_list revela una cabecera repetida, que el dict colapsaria.
            "cabeceras": {n: r.headers.get_list(n) for n in (
                "strict-transport-security", "x-content-type-options",
                "x-frame-options", "referrer-policy", "permissions-policy")},
        }
print(json.dumps(medidas))
`;
  const crudo500 = execFileSync(
    'docker',
    ['exec', '-i', 'topgreen-api', 'python', '-c', guionDel500],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const medidas = JSON.parse(crudo500.trim().split(/\r?\n/).at(-1));

  assert(medidas['500'].status === 500,
    `la ruta que revienta respondio ${medidas['500'].status} en vez de 500`);

  // Las cinco cabeceras, una sola vez y con el MISMO valor que en 200/401/404.
  for (const [nombre, valor] of Object.entries(ESPERADAS)) {
    const lista = medidas['500'].cabeceras[nombre];
    assert(lista.length === 1,
      `backend/500: ${nombre} aparece ${lista.length} veces -> ${JSON.stringify(lista)}`);
    assert(lista[0] === valor,
      `backend/500: ${nombre} vale ${JSON.stringify(lista[0])} y tiene que valer ${JSON.stringify(valor)}`);
  }
  const permisosDel500 = medidas['500'].cabeceras['permissions-policy'];
  assert(permisosDel500.length === 1, `backend/500: Permissions-Policy duplicada`);
  for (const capacidad of PERMISOS_NEGADOS) {
    assert(new RegExp(`(^|[ ,])${capacidad}=\\(\\)`).test(permisosDel500[0]),
      `backend/500: Permissions-Policy no niega ${capacidad}`);
  }
  for (const otro of ['200', '401', '404']) {
    for (const nombre of Object.keys(medidas['500'].cabeceras)) {
      assert(medidas['500'].cabeceras[nombre][0] === medidas[otro].cabeceras[nombre][0],
        `backend/500: ${nombre} difiere de la respuesta ${otro}`);
    }
  }

  // Y el 500 sigue sin contar nada: mismo cuerpo generico, mismo tipo, cero
  // rastros de la excepcion.
  assert(medidas['500'].cuerpo === 'Internal Server Error',
    `el cuerpo del 500 dejo de ser el generico: ${JSON.stringify(medidas['500'].cuerpo)}`);
  assert(/^text\/plain/.test(medidas['500'].tipo || ''),
    `el 500 cambio de Content-Type: ${medidas['500'].tipo}`);
  for (const rastro of ['RuntimeError', 'Traceback', 'explosion deliberada',
    'app/main.py', '__revienta']) {
    assert(!medidas['500'].cuerpo.includes(rastro),
      `el 500 filtra "${rastro}" al cliente: ${JSON.stringify(medidas['500'].cuerpo)}`);
  }

  return `Backend: ${rutasDelBackend.length} rutas con la base completa —${codigos.join(', ')}—, `
    + 'CORS y preflight intactos, descarga con su tipo y su nombre, y sin CSP en la API a '
    + `proposito. Frontend: ${modo}; politica sin comodines, sin 'unsafe-eval' ni 'unsafe-inline', `
    + 'con los origenes tomados del build y ningun add_header adentro de un location. '
    + 'La receta que arma la politica se ejecuta de verdad: sustituye los dos origenes sin '
    + 'la ruta y corta la construccion si alguna variable llega vacia. Y un RuntimeError no '
    + 'controlado, lanzado a traves del ASGI real, sale 500 con las cinco cabeceras una sola '
    + 'vez y con los mismos valores que 200/401/404, sin filtrar la excepcion';
});

await runCase(132, 'El seed de demostracion se niega a correr fuera de un entorno descartable', async () => {
  // `python -m app.seed` crea cuatro cuentas con correos y contrasenas escritos
  // en el repositorio. Sobre una base de verdad eso son accesos publicos y
  // predecibles, y hasta ahora `ENV=production` no cambiaba nada: el seed corria
  // igual, escribia siete tablas y despues imprimia las tres credenciales.
  //
  // Este caso NO toca ninguna base. Le pasa al seed una `DATABASE_URL` que
  // apunta a un puerto muerto: si el freno funciona, el proceso corta antes de
  // intentar conectarse y nunca se entera de que esa base no existe. Y si
  // alguien sacara el freno, el unico dano posible seria un error de conexion.
  const BASE_INEXISTENTE = 'postgresql+psycopg://nadie:nada@127.0.0.1:59999/no_existe';

  const correrSeed = (entorno) => {
    const argumentos = ['exec', '-i'];
    if (entorno !== null) argumentos.push('-e', `ENV=${entorno}`);
    argumentos.push('-e', `DATABASE_URL=${BASE_INEXISTENTE}`,
      'topgreen-api', 'python', '-m', 'app.seed');
    const r = spawnSync('docker', argumentos, { encoding: 'utf8' });
    return { estado: r.status, salida: r.stdout || '', error: r.stderr || '' };
  };

  // --- A. El entorno productivo documentado ---------------------------------
  const produccion = correrSeed('production');
  assert(produccion.estado === 2,
    `con ENV=production el seed salio con ${produccion.estado} y tiene que salir con 2`);
  assert(/no corre con ENV/.test(produccion.error),
    `el rechazo no explica que paso: ${JSON.stringify(produccion.error.slice(0, 200))}`);

  // Un rechazo que igual intento conectarse no es un rechazo: seria una carrera
  // perdida por poco. El puerto muerto lo delata.
  for (const rastro of ['connection', 'could not connect', 'OperationalError',
    'psycopg', '59999']) {
    assert(!new RegExp(rastro, 'i').test(produccion.error),
      `el seed llego a tocar la base antes de frenar: aparece "${rastro}"`);
  }
  assert(produccion.salida.trim() === '',
    `el rechazo escribio en la salida normal: ${JSON.stringify(produccion.salida.slice(0, 200))}`);

  // --- B. Y no se le escapa una credencial ----------------------------------
  // Los correos y contrasenas viven en el seed; el mensaje de rechazo no los
  // puede repetir, porque va a parar a la consola de un servicio desplegado.
  const todo = produccion.salida + produccion.error;
  for (const credencial of ['admin@topgreen.com', 'vendedor@ejemplo.com',
    'cliente@ejemplo.com', 'transportista@ejemplo.com',
    'admin123', 'vendedor123', 'cliente123', 'transportista123']) {
    assert(!todo.includes(credencial),
      `el rechazo nombra la credencial demo ${credencial}`);
  }

  // --- C. La lista dice donde SI, asi que un valor raro tambien se frena ----
  // Con una lista de prohibidos, cualquiera de estos se colaba.
  const rechazados = [];
  for (const entorno of ['Production', 'PRODUCTION', 'prod', 'produccion',
    'staging', '', '  ']) {
    const r = correrSeed(entorno);
    assert(r.estado === 2,
      `con ENV=${JSON.stringify(entorno)} el seed salio con ${r.estado} en vez de 2`);
    rechazados.push(JSON.stringify(entorno));
  }

  // --- D. Y local sigue pasando, sin sembrar nada acá ------------------------
  // Se pregunta por la funcion del freno, no por el seed entero: correrlo seria
  // sembrar una base en medio de la suite.
  const guion = `
import json
from app.seed import exigir_entorno_con_seed, ENTORNOS_CON_SEED
resultado = {"admitidos": sorted(ENTORNOS_CON_SEED)}
for entorno in ("local", "LOCAL", " local "):
    import app.core.config as configuracion
    configuracion.settings.ENV = entorno
    try:
        exigir_entorno_con_seed()
        resultado[entorno] = "pasa"
    except Exception as error:
        resultado[entorno] = f"frena: {type(error).__name__}"
print(json.dumps(resultado))
`;
  const crudo = execFileSync(
    'docker',
    ['exec', '-i', 'topgreen-api', 'python', '-c', guion],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const permitidos = JSON.parse(crudo.trim().split(/\r?\n/).at(-1));
  for (const entorno of ['local', 'LOCAL', ' local ']) {
    assert(permitidos[entorno] === 'pasa',
      `ENV=${JSON.stringify(entorno)} tendria que pasar y ${permitidos[entorno]}`);
  }
  assert(permitidos.admitidos.length === 1 && permitidos.admitidos[0] === 'local',
    `la lista de entornos admitidos crecio: ${JSON.stringify(permitidos.admitidos)}`);

  // --- E. Y no hay puerta trasera -------------------------------------------
  // Un `ALLOW_SEED` se enciende para salir del paso y queda encendido. Si
  // alguien agrega uno, este caso lo dice el mismo dia.
  // Se miran las lineas de codigo, no los comentarios: el propio archivo explica
  // por que NO hay un `ALLOW_SEED`, y esa explicacion no es una puerta trasera.
  const fuente = readFileSync('backend/app/seed.py', 'utf8')
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  for (const puerta of ['ALLOW_', 'FORCE_', 'SKIP_', 'os.environ', 'getenv']) {
    assert(!fuente.includes(puerta),
      `app/seed.py incorpora ${puerta}: el freno no puede tener un interruptor`);
  }

  return `ENV=production: salida 2, sin abrir conexion —la base apuntaba a un puerto muerto y `
    + `no hubo ni un error de conexion—, sin escribir en la salida normal y sin nombrar `
    + `ninguna de las ocho credenciales demo. Tambien rechaza ${rechazados.join(', ')}. `
    + `La lista dice donde SI: admitidos = ${JSON.stringify(permitidos.admitidos)}, y local `
    + `pasa con mayusculas y con espacios. Sin ALLOW_/FORCE_/SKIP_ ni lectura suelta del entorno`;
});

await runCase(133, 'El registro publico no reparte roles: el rol lo pone el servidor', async () => {
  // `POST /api/auth/register` tomaba el rol del cuerpo del pedido y lo guardaba
  // tal cual. Un desconocido mandaba `"role": "admin"`, recibia 201, confirmaba
  // el correo desde su propia casilla, entraba y quedaba con el padron de
  // usuarios y el tablero en la mano. Lo reproduje de punta a punta antes de
  // tocar nada, y llegaba hasta crear MAS administradores.
  const sufijo = Date.now().toString(36);
  const correoDe = (que) => `sec5-${que}-${sufijo}@ejemplo.com`;

  const efectosDe = (correo) => ({
    cuentas: queryCount(
      `SELECT count(*) FROM users WHERE email = ${sqlLiteral(correo)}`),
    tokens: queryCount(
      'SELECT count(*) FROM email_verification_tokens t JOIN users u ON u.id = t.user_id '
      + `WHERE u.email = ${sqlLiteral(correo)}`),
    avisos: queryCount(
      'SELECT count(*) FROM notifications n JOIN users u ON u.id = n.user_id '
      + `WHERE u.email = ${sqlLiteral(correo)}`),
  });
  const rolDe = (correo) => {
    const filas = queryRows(
      `SELECT role FROM users WHERE email = ${sqlLiteral(correo)}`);
    return filas.length ? filas[0][0] : null;
  };

  const localidad = queryRows('SELECT id FROM localities LIMIT 1')[0][0];
  const transportista = (correo, extra) => ({
    email: correo, password: 'clave123', full_name: 'Transportista SEC5',
    is_carrier: true, carrier_base_locality_id: localidad,
    carrier_transport: 'Camion', carrier_transport_certified: true,
    carrier_certification_detail: 'Declaracion de prueba', carrier_coverage_radius_km: 100,
    ...extra,
  });

  // --- A. Pedir `admin` se rechaza, y no deja NADA atras --------------------
  const admins = () => queryCount("SELECT count(*) FROM users WHERE role = 'ADMIN'");
  const adminsAntes = admins();
  const rechazados = [];
  for (const [etiqueta, cuerpo] of [
    ['role: "admin"', { email: correoDe('admin'), password: 'clave123', full_name: 'Escalada', role: 'admin' }],
    ['role: "ADMIN"', { email: correoDe('mayus'), password: 'clave123', full_name: 'Escalada', role: 'ADMIN' }],
    ['transportista + admin', transportista(correoDe('transp-admin'), { role: 'admin' })],
  ]) {
    const correo = cuerpo.email;
    const correosAntes = contarCorreos();
    await expectApiError(422, () =>
      apiRequest('/auth/register', { method: 'POST', body: cuerpo }));

    // Un rechazo que igual escribio algo no es un rechazo.
    const efectos = efectosDe(correo);
    assert(efectos.cuentas === 0, `${etiqueta}: quedo una cuenta creada`);
    assert(efectos.tokens === 0, `${etiqueta}: quedo un token de verificacion`);
    assert(efectos.avisos === 0, `${etiqueta}: quedo una notificacion`);
    assert(contarCorreos() === correosAntes,
      `${etiqueta}: salio un correo del outbox`);
    rechazados.push(etiqueta);
  }
  assert(admins() === adminsAntes,
    `la cantidad de administradores cambio: ${adminsAntes} -> ${admins()}`);

  // --- B. Lo que SI tiene que seguir funcionando ----------------------------
  // El frontend manda `"role": "user"` explicito, asi que ese payload no puede
  // romperse; y un alta sin rol y una de transportista tienen que seguir dando
  // de alta una cuenta comun.
  const aceptados = [];
  for (const [etiqueta, cuerpo] of [
    ['sin role', { email: correoDe('sin'), password: 'clave123', full_name: 'Sin Rol' }],
    ['role: "user"', { email: correoDe('user'), password: 'clave123', full_name: 'Con Rol', role: 'user' }],
    ['transportista', transportista(correoDe('transp'))],
  ]) {
    const alta = await apiRequest('/auth/register', { method: 'POST', body: cuerpo });
    assert(alta.status === 201, `${etiqueta}: el alta respondio ${alta.status}`);
    assert(rolDe(cuerpo.email) === 'USER',
      `${etiqueta}: la cuenta quedo con rol ${rolDe(cuerpo.email)}`);
    aceptados.push(etiqueta);
  }

  // --- C. Y el que persiste no confia en el esquema -------------------------
  // Acotar el tipo en el esquema frena al HTTP, pero no a alguien que arme el
  // objeto por dentro. Se construye salteando la validacion, con el rol forzado
  // a ADMIN, se llama al endpoint de verdad y se mira que se guardo.
  const correoForzado = correoDe('forzado');
  const guion = `
import json
from app.schemas.auth import UserRegisterRequest
from app.api.auth import register_user
from app.db.base import SessionLocal
from app.models.user import User, UserRole

forzado = UserRegisterRequest.model_construct(
    email="${correoForzado}", password="clave123", full_name="Forzado",
    phone=None, role=UserRole.ADMIN, is_carrier=False,
    carrier_base_locality_id=None, carrier_transport=None,
    carrier_transport_certified=False, carrier_certification_detail=None,
    carrier_coverage_radius_km=None, carrier_capacity=None,
    carrier_vehicle_model=None, carrier_plate=None,
    carrier_cargo_types=None, carrier_cargo_other=None,
)
db = SessionLocal()
try:
    register_user(forzado, db)
finally:
    db.close()
db = SessionLocal()
u = db.query(User).filter(User.email == "${correoForzado}").first()
print(json.dumps({"en_el_esquema": forzado.role.value, "persistido": u.role.value}))
db.close()
`;
  const crudo = execFileSync(
    'docker',
    ['exec', '-i', 'topgreen-api', 'python', '-c', guion],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const forzado = JSON.parse(crudo.trim().split(/\r?\n/).at(-1));
  assert(forzado.en_el_esquema === 'admin',
    'la prueba no logro forzar el rol en el esquema: no estaria midiendo nada');
  assert(forzado.persistido === 'user',
    `el endpoint guardo el rol que traia el esquema: ${forzado.persistido}`);

  // --- D. Una cuenta publica confirmada no entra a administracion -----------
  const correoPublico = correoDe('publico');
  await registrarYVerificar({
    email: correoPublico, password: 'clave123', full_name: 'Publico SEC5',
  });
  const sesionPublica = await apiRequest('/auth/login', {
    method: 'POST', body: { email: correoPublico, password: 'clave123' },
  });
  const publico = sesionPublica.data.access_token;
  const sesionAdmin = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'admin@topgreen.com', password: 'admin123' },
  });
  const administrador = sesionAdmin.data.access_token;

  const rutasAdmin = ['/admin/users', '/admin/dashboard', '/admin/products', '/admin/orders'];
  for (const ruta of rutasAdmin) {
    await expectApiError(403, () => apiRequest(ruta, { token: publico }));
    const comoAdmin = await apiRequest(ruta, { token: administrador });
    assert(comoAdmin.status === 200,
      `el administrador perdio el acceso a ${ruta}: ${comoAdmin.status}`);
  }

  // El unico camino autorizado conserva su capacidad de asignar roles...
  const correoAscendido = correoDe('ascendido');
  const creado = await apiRequest('/admin/users', {
    method: 'POST', token: administrador,
    body: { email: correoAscendido, password: 'clave123', full_name: 'Ascendido', role: 'admin' },
  });
  assert(creado.status === 201, `el alta administrativa respondio ${creado.status}`);
  assert(rolDe(correoAscendido) === 'ADMIN',
    'el flujo administrativo dejo de poder asignar el rol de administracion');
  // ...y sigue siendo el unico.
  await expectApiError(403, () => apiRequest('/admin/users', {
    method: 'POST', token: publico,
    body: { email: correoDe('colado'), password: 'clave123', full_name: 'Colado', role: 'admin' },
  }));

  // --- E. Y la documentacion no ofrece lo que el servidor no da -------------
  const respuesta = await fetch(`${API_URL}/openapi.json`);
  const openapi = await respuesta.json();
  const rolPublico = openapi.components.schemas.UserRegisterRequest.properties.role;
  if (rolPublico !== undefined) {
    const valores = rolPublico.enum || (rolPublico.const ? [rolPublico.const] : null);
    assert(valores && valores.length === 1 && valores[0] === 'user',
      `el registro publico anuncia roles ${JSON.stringify(valores)}`);
  }
  assert(!JSON.stringify(openapi.components.schemas.UserRegisterRequest).includes('admin'),
    'el esquema publico del registro menciona admin');

  return `Rechaza ${rechazados.join(', ')} con 422 y sin dejar cuenta, token, notificacion `
    + `ni correo; los administradores siguen siendo ${adminsAntes}. Acepta ${aceptados.join(', ')} `
    + 'y las tres quedan USER. Con el esquema construido por fuera del HTTP y el rol forzado a '
    + `admin, lo persistido sigue siendo ${forzado.persistido}. Una cuenta publica confirmada `
    + `recibe 403 en las ${rutasAdmin.length} rutas administrativas donde el administrador `
    + 'recibe 200, y /admin/users conserva su capacidad de asignar el rol. OpenAPI publica '
    + `role = ${JSON.stringify(rolPublico && (rolPublico.enum || rolPublico.const))}`;
});

await runCase(134, 'El ingreso deja de aceptar intentos ilimitados, por cuenta y por origen', async () => {
  // `POST /api/auth/login` no contaba nada: treinta y un intentos seguidos con la
  // contrasena equivocada devolvian treinta y un 401 y la cuenta seguia entrando
  // con la contrasena buena.
  //
  // ORDEN DE ESTE CASO, que no es casual. El contador por IP es uno solo para
  // todo lo que llega de 127.0.0.1, asi que los bloques que fallan a proposito
  // gastan cupo de ese contador. Los primeros bloques suman unos veinte fallos
  // —lejos de los treinta— y el bloque que SI busca agotar el limite por IP va
  // al final y por otra bolsa: manda `X-Forwarded-For`, que fuera del borde cae
  // en la bolsa de identidades no confiables. Asi el umbral por IP se mide de
  // punta a punta sin dejar limitado el origen que usan los demas casos.
  const sufijo = Date.now().toString(36);
  const correoDe = (que) => `sec6-${que}-${sufijo}@ejemplo.com`;
  const CLAVE = 'clave-buena-123';

  // `apiRequest` no deja mandar headers ni leer los de la respuesta, y acá hacen
  // falta las dos cosas.
  const ingresar = async (email, password, headers = {}) => {
    const r = await pedirConReintento(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify({ email, password }),
    });
    const crudo = await r.text();
    let cuerpo = null;
    try { cuerpo = crudo ? JSON.parse(crudo) : null; } catch { cuerpo = crudo; }
    return { estado: r.status, cuerpo, esperar: r.headers.get('retry-after') };
  };
  const ultimoIngresoDe = (correo) => {
    const filas = queryRows(
      `SELECT coalesce(last_login::text, '') FROM users WHERE email = ${sqlLiteral(correo)}`);
    return filas.length ? filas[0][0] : null;
  };

  const cuenta = async (correo) => {
    await registrarYVerificar({ email: correo, password: CLAVE, full_name: 'Fuerza Bruta' });
    return correo;
  };

  // --- A. Un acierto antes del limite no se rompe y limpia el contador ------
  const correoAcierto = await cuenta(correoDe('acierto'));
  for (let i = 1; i <= 4; i += 1) {
    const r = await ingresar(correoAcierto, 'equivocada');
    assert(r.estado === 401, `intento ${i} respondio ${r.estado} y tenia que ser 401`);
  }
  const antesDelAcierto = ultimoIngresoDe(correoAcierto);
  const acierto = await ingresar(correoAcierto, CLAVE);
  assert(acierto.estado === 200, `la credencial correcta respondio ${acierto.estado}`);
  assert(acierto.cuerpo.access_token && acierto.cuerpo.refresh_token,
    'el ingreso correcto no emitio los dos tokens');
  assert(ultimoIngresoDe(correoAcierto) !== antesDelAcierto,
    'el ingreso correcto no actualizo last_login');
  // Y el contador de la cuenta quedo limpio: si no, el quinto fallo siguiente
  // seria el sexto y contestaria 429.
  for (let i = 1; i <= 5; i += 1) {
    const r = await ingresar(correoAcierto, 'equivocada');
    assert(r.estado === 401,
      `tras el acierto, el fallo ${i} respondio ${r.estado}: el contador no se limpio`);
  }

  // --- B. El sexto fallo por correo, exacto, y lo que trae el 429 -----------
  const sexto = await ingresar(correoAcierto, 'equivocada');
  assert(sexto.estado === 429, `el sexto fallo respondio ${sexto.estado} y tenia que ser 429`);
  const esperaSexto = Number(sexto.esperar);
  assert(Number.isInteger(esperaSexto) && esperaSexto > 0 && esperaSexto <= 15 * 60,
    `Retry-After invalido en el 429: ${JSON.stringify(sexto.esperar)}`);
  // El cuerpo no puede confirmar la cuenta: si dijera "esta cuenta esta
  // bloqueada", el limite seria un oraculo para averiguar que correos existen.
  const textoDel429 = JSON.stringify(sexto.cuerpo).toLowerCase();
  assert(!textoDel429.includes(correoAcierto.toLowerCase()),
    'el 429 repite el correo del intento');
  for (const filtracion of ['cuenta', 'usuario', 'existe', 'contrasena', 'contraseña']) {
    assert(!textoDel429.includes(filtracion),
      `el cuerpo del 429 habla de "${filtracion}" y no tiene que confirmar nada`);
  }

  // Ya limitada, ni siquiera la credencial CORRECTA entra, y no se toca la base.
  const ultimoAntes = ultimoIngresoDe(correoAcierto);
  const correctaLimitada = await ingresar(correoAcierto, CLAVE);
  assert(correctaLimitada.estado === 429,
    `con el limite puesto, la credencial correcta respondio ${correctaLimitada.estado}`);
  assert(!correctaLimitada.cuerpo.access_token && !correctaLimitada.cuerpo.refresh_token,
    'el 429 emitio tokens');
  assert(ultimoIngresoDe(correoAcierto) === ultimoAntes,
    'el 429 igual actualizo last_login');

  // --- C. Cuenta que existe y cuenta que no, indistinguibles ---------------
  const correoQueNoExiste = correoDe('fantasma');
  const correoQueExiste = await cuenta(correoDe('existe'));
  const secuencias = {};
  for (const [etiqueta, correo] of [['existe', correoQueExiste], ['no existe', correoQueNoExiste]]) {
    const pasos = [];
    for (let i = 1; i <= 6; i += 1) {
      const r = await ingresar(correo, 'equivocada');
      pasos.push({ estado: r.estado, cuerpo: JSON.stringify(r.cuerpo), tieneEspera: r.esperar !== null });
    }
    secuencias[etiqueta] = pasos;
  }
  assert(JSON.stringify(secuencias['existe']) === JSON.stringify(secuencias['no existe']),
    'una cuenta que existe y una que no se distinguen por la secuencia o el cuerpo:\n'
    + `  existe:    ${JSON.stringify(secuencias['existe'])}\n`
    + `  no existe: ${JSON.stringify(secuencias['no existe'])}`);
  assert(secuencias['existe'].at(-1).estado === 429 && secuencias['existe'].at(-1).tieneEspera,
    'el sexto intento contra un correo inexistente no trajo 429 con Retry-After');

  // --- D. Escribir el correo distinto no crea un contador nuevo ------------
  const correoMayusculas = await cuenta(correoDe('mayusculas'));
  const formas = [
    correoMayusculas,
    correoMayusculas.toUpperCase(),
    ` ${correoMayusculas} `,
    correoMayusculas.replace('sec6', 'SEC6'),
    correoMayusculas.toUpperCase(),
  ];
  for (const [indice, forma] of formas.entries()) {
    const r = await ingresar(forma, 'equivocada');
    assert(r.estado === 401,
      `la forma ${indice + 1} del correo respondio ${r.estado}: parece otro contador`);
  }
  const sextaForma = await ingresar(correoMayusculas.toUpperCase(), 'equivocada');
  assert(sextaForma.estado === 429,
    `cambiar mayusculas creo un contador aparte: el sexto respondio ${sextaForma.estado}`);

  // --- E. Los contratos vecinos, intactos ----------------------------------
  const correoPendiente = correoDe('pendiente');
  await apiRequest('/auth/register', {
    method: 'POST', body: { email: correoPendiente, password: CLAVE, full_name: 'Sin Confirmar' },
  });
  const pendiente = await ingresar(correoPendiente, CLAVE);
  assert(pendiente.estado === 403,
    `el ingreso sin confirmar respondio ${pendiente.estado} y tiene que seguir siendo 403`);
  // Y ese 403 no consume cupo: la contrasena estuvo bien. Cinco veces seguidas
  // siguen dando 403 y no un 429.
  for (let i = 0; i < 5; i += 1) {
    const r = await ingresar(correoPendiente, CLAVE);
    assert(r.estado === 403, `el 403 de cuenta sin confirmar paso a ${r.estado}: cuenta como fallo`);
  }
  const sesion = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  });
  assert(sesion.status === 200, 'una cuenta del seed dejo de poder ingresar');
  // El refresh lee su token del header Authorization, no del cuerpo.
  const renovado = await apiRequest('/auth/refresh', {
    method: 'POST', token: sesion.data.refresh_token,
  });
  assert(renovado.status === 200 && renovado.data.access_token,
    'el refresh dejo de funcionar');
  const salida = await apiRequest('/auth/logout', { method: 'POST', token: sesion.data.access_token });
  assert(salida.status === 200, 'el logout dejo de funcionar');

  // --- F. Reloj, limpieza y concurrencia, sobre la pieza de verdad ---------
  // El vencimiento de una ventana de quince minutos no se prueba esperando
  // quince minutos: el reloj se inyecta. Y la carrera se prueba con hilos de
  // verdad, que es lo que hay debajo de un endpoint `def` en Starlette.
  const guion = `
import json, threading
from app.services.limite_de_intentos import (
    VentanaDeslizante, FALLOS_POR_CORREO, VENTANA_CORREO_SEGUNDOS,
    FALLOS_POR_IP, VENTANA_IP_SEGUNDOS, clave_de_ip)
import app.core.config as configuracion
from starlette.datastructures import Headers

salida = {"politica": [FALLOS_POR_CORREO, VENTANA_CORREO_SEGUNDOS,
                       FALLOS_POR_IP, VENTANA_IP_SEGUNDOS]}

class Reloj:
    def __init__(self): self.t = 1000.0
    def __call__(self): return self.t
    def avanzar(self, s): self.t += s

reloj = Reloj()
v = VentanaDeslizante(FALLOS_POR_CORREO, VENTANA_CORREO_SEGUNDOS, reloj=reloj)
for _ in range(FALLOS_POR_CORREO):
    v.reservar("una@ejemplo.com")
espera, _ = v.reservar("una@ejemplo.com")
salida["espera_al_limite"] = espera
reloj.avanzar(VENTANA_CORREO_SEGUNDOS - 1)
espera, _ = v.reservar("una@ejemplo.com")
salida["espera_casi_vencida"] = espera
reloj.avanzar(2)
espera, _ = v.reservar("una@ejemplo.com")
salida["pasa_al_vencer"] = espera is None

barrido = VentanaDeslizante(FALLOS_POR_CORREO, VENTANA_CORREO_SEGUNDOS, reloj=reloj)
for i in range(300):
    barrido.reservar(f"correo{i}@ejemplo.com")
salida["claves_antes"] = barrido.claves()
reloj.avanzar(VENTANA_CORREO_SEGUNDOS + 1)
barrido.olvidar_vencidos()
salida["claves_despues"] = barrido.claves()

def cuantos_pasan(marcas_previas, simultaneos):
    ventana = VentanaDeslizante(FALLOS_POR_CORREO, VENTANA_CORREO_SEGUNDOS)
    for _ in range(marcas_previas):
        ventana.reservar("carrera@ejemplo.com")
    pasaron = []
    puerta = threading.Barrier(simultaneos)
    def intentar():
        puerta.wait()
        espera, _ = ventana.reservar("carrera@ejemplo.com")
        pasaron.append(espera is None)
    hilos = [threading.Thread(target=intentar) for _ in range(simultaneos)]
    for h in hilos: h.start()
    for h in hilos: h.join()
    return sum(pasaron)

salida["carrera_en_el_limite"] = cuantos_pasan(FALLOS_POR_CORREO, 8)
salida["carrera_al_borde"] = cuantos_pasan(FALLOS_POR_CORREO - 1, 8)

class Pedido:
    def __init__(self, headers):
        self.headers = Headers(raw=[(k.encode(), v.encode()) for k, v in headers])
        self.client = type("C", (), {"host": "10.0.0.1"})()

casos = {
    "sin headers": [],
    "x-real-ip": [("x-real-ip", "198.51.100.7")],
    "x-real-ip repetido": [("x-real-ip", "1.2.3.4"), ("x-real-ip", "198.51.100.7")],
    "x-forwarded-for": [("x-forwarded-for", "203.0.113.99")],
}
identidades = {}
for entorno in ("local", "production"):
    configuracion.settings.ENV = entorno
    identidades[entorno] = {n: clave_de_ip(Pedido(h)) for n, h in casos.items()}
configuracion.settings.ENV = "local"
salida["identidades"] = identidades
print(json.dumps(salida))
`;
  const medido = JSON.parse(execFileSync(
    'docker', ['exec', '-i', 'topgreen-api', 'python', '-c', guion],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim().split(/\r?\n/).at(-1));

  const [porCorreo, ventanaCorreo, porIp, ventanaIp] = medido.politica;
  assert(porCorreo === 5 && ventanaCorreo === 15 * 60,
    `la politica por correo cambio: ${porCorreo} en ${ventanaCorreo}s`);
  assert(porIp === 30 && ventanaIp === 10 * 60,
    `la politica por IP cambio: ${porIp} en ${ventanaIp}s`);
  assert(Math.round(medido.espera_al_limite) === ventanaCorreo,
    `la espera al llegar al limite es ${medido.espera_al_limite} y tenia que ser ${ventanaCorreo}`);
  assert(Math.round(medido.espera_casi_vencida) === 1,
    `a un segundo del vencimiento la espera es ${medido.espera_casi_vencida}`);
  assert(medido.pasa_al_vencer === true,
    'vencida la ventana el intento sigue limitado: el limite se volvio permanente');
  assert(medido.claves_antes === 300 && medido.claves_despues === 0,
    `la limpieza dejo ${medido.claves_despues} claves vencidas de ${medido.claves_antes}`);
  assert(medido.carrera_en_el_limite === 0,
    `con el contador en el limite, ${medido.carrera_en_el_limite} de 8 pedidos simultaneos pasaron`);
  assert(medido.carrera_al_borde === 1,
    `a un fallo del limite pasaron ${medido.carrera_al_borde} de 8 simultaneos: el umbral se cruza por una carrera`);

  // La identidad, distinguiendo Railway de local a proposito.
  const local = medido.identidades.local;
  const railway = medido.identidades.production;
  assert(local['sin headers'] === '10.0.0.1',
    `fuera del borde, sin headers, la identidad tendria que ser el par real: ${local['sin headers']}`);
  assert(local['x-real-ip'] === '10.0.0.1',
    'fuera del borde se le esta creyendo a X-Real-IP, que ahi no lo escribe nadie');
  assert(local['x-forwarded-for'] !== '203.0.113.99',
    'fuera del borde, un X-Forwarded-For inventado se convierte en identidad');
  assert(railway['x-real-ip'] === '198.51.100.7',
    `detras del borde no se esta usando X-Real-IP: ${railway['x-real-ip']}`);
  assert(railway['x-real-ip repetido'] !== '198.51.100.7'
    && railway['x-real-ip repetido'] !== '1.2.3.4',
    'un X-Real-IP repetido se toma como identidad valida');
  assert(railway['x-forwarded-for'] !== '203.0.113.99',
    'detras del borde, un X-Forwarded-For inventado se convierte en identidad');
  assert(railway['sin headers'] !== '10.0.0.1',
    'detras del borde se esta usando client.host, que ahi lo reescribe X-Forwarded-For');

  // --- G. El umbral por IP, de punta a punta y en su propia bolsa ----------
  // Va ultimo: deja esa bolsa limitada por diez minutos. Los treinta y un
  // intentos llevan un `X-Forwarded-For` DISTINTO cada uno; que igual choquen
  // contra el limite prueba a la vez el umbral y que el header inventado no
  // fabrica un contador nuevo por intento.
  const porIpCodigos = [];
  for (let i = 1; i <= porIp + 1; i += 1) {
    const r = await ingresar(`sec6-ip-${i}-${sufijo}@ejemplo.com`, 'equivocada',
      { 'X-Forwarded-For': `203.0.113.${i}` });
    porIpCodigos.push(r.estado);
  }
  const primeros = new Set(porIpCodigos.slice(0, porIp));
  assert(primeros.size === 1 && primeros.has(401),
    `los primeros ${porIp} intentos por IP no fueron todos 401: ${[...primeros].join(', ')}`);
  assert(porIpCodigos[porIp] === 429,
    `el intento ${porIp + 1} respondio ${porIpCodigos[porIp]} y tenia que ser 429`);

  return `Por cuenta: cinco 401 y el sexto 429 con Retry-After ${esperaSexto}s y cuerpo que no `
    + 'nombra la cuenta; ya limitada, la credencial correcta tambien recibe 429 sin emitir '
    + 'tokens ni tocar last_login. Un acierto previo limpia solo ese contador. Una cuenta que '
    + 'existe y una que no entregan secuencia y cuerpo identicos. Cambiar mayusculas o espacios '
    + `no crea otro contador. Por origen: ${porIp} veces 401 y la ${porIp + 1} 429, con un `
    + 'X-Forwarded-For distinto en cada intento. El 403 de cuenta sin confirmar no consume cupo, '
    + 'y refresh y logout siguen enteros. Con el reloj inyectado la ventana vence sola y la '
    + 'limpieza deja 0 claves de 300; con ocho pedidos simultaneos pasan 0 en el limite y '
    + 'exactamente 1 a un fallo del limite';
});

await runCase(135, 'Una caida de la base no gasta el cupo de ingresos de nadie', async () => {
  // El limite de SEC-6 reserva la marca ANTES de saber como termina el intento,
  // porque si no dos pedidos simultaneos cruzan el umbral por una carrera. Pero
  // las marcas se soltaban a mano en cada salida, y una salida a mano se olvida:
  // si la base se caia en medio de la consulta, la excepcion subia sin pasar por
  // ninguna de esas lineas y las dos marcas quedaban puestas. Seis caidas
  // seguidas terminaban en 429. O sea: un incidente de infraestructura le
  // bloqueaba la cuenta a alguien que nunca escribio mal su contrasena.
  //
  // Esta prueba no rompe la base de verdad —eso voltearia toda la suite—: corre
  // dentro del proceso de la aplicacion y le da al endpoint una sesion que falla
  // como falla una base caida. El endpoint es el real y la pila de middleware
  // tambien; lo unico simulado es la sesion.
  const guion = `
import json
from sqlalchemy.exc import OperationalError
from starlette.testclient import TestClient
from app.main import app
from app.db.base import get_db
from app.models.user import User
from app.services.limite_de_intentos import (
    POR_CORREO, POR_IP, FALLOS_POR_CORREO, clave_de_correo)

CORREO = "sec6r-caida@ejemplo.com"
salida = {}


class SesionRota:
    """Se cae en la consulta, que es donde se cae una base de verdad."""
    def query(self, *a, **k):
        raise OperationalError("SELECT 1", {}, Exception("conexion perdida"))
    def rollback(self): pass
    def commit(self): pass
    def close(self): pass


def contadores():
    return [POR_CORREO.fallos_de(clave_de_correo(CORREO)), POR_IP.claves()]


# --- A. Seis caidas seguidas ---------------------------------------------
POR_CORREO.vaciar(); POR_IP.vaciar()
app.dependency_overrides[get_db] = lambda: SesionRota()
with TestClient(app, raise_server_exceptions=False) as c:
    respuestas = [c.post("/api/auth/login",
                         json={"email": CORREO, "password": "loquesea"})
                  for _ in range(FALLOS_POR_CORREO + 1)]
salida["codigos_con_la_base_caida"] = [r.status_code for r in respuestas]
salida["cuerpos"] = sorted({r.text[:200] for r in respuestas})
salida["cookies"] = sorted({n for r in respuestas for n in r.cookies.keys()})
salida["tiene_token"] = any("access_token" in r.text for r in respuestas)
salida["contadores_tras_la_caida"] = contadores()
app.dependency_overrides.clear()

# --- B. Y con la base sana, los 401 SIGUEN consumiendo cupo --------------
# Si la correccion hubiera soltado tambien las marcas del 401, el limite se
# habria apagado sin que nadie se entere.
POR_CORREO.vaciar(); POR_IP.vaciar()
with TestClient(app, raise_server_exceptions=False) as c:
    codigos = []
    for _ in range(FALLOS_POR_CORREO + 1):
        r = c.post("/api/auth/login", json={"email": CORREO, "password": "mal"})
        codigos.append(r.status_code)
salida["codigos_con_la_base_sana"] = codigos
salida["contadores_tras_los_401"] = contadores()
salida["cuerpo_del_429"] = r.text[:200]
salida["retry_after"] = r.headers.get("retry-after")

# --- C. El exito y el 403 siguen sin consumir ----------------------------
POR_CORREO.vaciar(); POR_IP.vaciar()
with TestClient(app, raise_server_exceptions=False) as c:
    exito = c.post("/api/auth/login",
                   json={"email": "vendedor@ejemplo.com", "password": "vendedor123"})
salida["exito"] = exito.status_code
salida["contadores_tras_el_exito"] = [
    POR_CORREO.fallos_de(clave_de_correo("vendedor@ejemplo.com")), POR_IP.claves()]
POR_CORREO.vaciar(); POR_IP.vaciar()
print(json.dumps(salida))
`;
  const medido = JSON.parse(execFileSync(
    'docker', ['exec', '-i', 'topgreen-api', 'python', '-c', guion],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim().split(/\r?\n/).at(-1));

  // --- A. La caida conserva su 500 y no deja marcas ------------------------
  const conLaCaida = medido.codigos_con_la_base_caida;
  assert(conLaCaida.length === 6 && conLaCaida.every((c) => c === 500),
    `los seis intentos con la base caida dieron ${JSON.stringify(conLaCaida)} y tenian que ser seis 500`);
  const [marcasCorreo, clavesIp] = medido.contadores_tras_la_caida;
  assert(marcasCorreo === 0,
    `la caida dejo ${marcasCorreo} marcas por correo: un incidente gasta el cupo de la cuenta`);
  assert(clavesIp === 0,
    `la caida dejo ${clavesIp} claves por IP: un incidente gasta el cupo del origen`);

  // El 500 sigue siendo el generico y no cuenta nada de la excepcion.
  assert(medido.cuerpos.length === 1,
    `los seis 500 no dieron el mismo cuerpo: ${JSON.stringify(medido.cuerpos)}`);
  for (const filtracion of ['OperationalError', 'conexion perdida', 'Traceback',
    'sqlalchemy', 'SELECT', 'app/api/auth.py']) {
    assert(!medido.cuerpos[0].includes(filtracion),
      `el 500 expone "${filtracion}": ${medido.cuerpos[0]}`);
  }
  assert(medido.tiene_token === false, 'un 500 devolvio un token');
  assert(medido.cookies.length === 0,
    `un 500 dejo cookies: ${JSON.stringify(medido.cookies)}`);

  // --- B. Los 401 siguen contando, con el mismo 429 de siempre -------------
  const conLaBaseSana = medido.codigos_con_la_base_sana;
  assert(conLaBaseSana.slice(0, 5).every((c) => c === 401) && conLaBaseSana[5] === 429,
    `la secuencia con la base sana quedo ${JSON.stringify(conLaBaseSana)} en vez de cinco 401 y un 429`);
  assert(medido.contadores_tras_los_401[0] === 5,
    `cinco 401 dejaron ${medido.contadores_tras_los_401[0]} marcas por correo`);
  assert(medido.contadores_tras_los_401[1] === 1,
    `cinco 401 dejaron ${medido.contadores_tras_los_401[1]} claves por IP`);
  assert(medido.cuerpo_del_429.includes('Demasiados intentos'),
    `el cuerpo del 429 cambio: ${medido.cuerpo_del_429}`);
  const espera = Number(medido.retry_after);
  assert(Number.isInteger(espera) && espera > 0,
    `el 429 perdio su Retry-After: ${JSON.stringify(medido.retry_after)}`);

  // --- C. El exito sigue sin consumir --------------------------------------
  assert(medido.exito === 200, `el ingreso correcto respondio ${medido.exito}`);
  assert(medido.contadores_tras_el_exito[0] === 0 && medido.contadores_tras_el_exito[1] === 0,
    `un ingreso correcto dejo marcas: ${JSON.stringify(medido.contadores_tras_el_exito)}`);

  return `Con la base caida, seis intentos dan seis 500 con el mismo cuerpo generico —sin la `
    + `excepcion, sin tokens y sin cookies— y los contadores quedan en `
    + `${JSON.stringify(medido.contadores_tras_la_caida)}: un incidente de infraestructura ya no `
    + 'le gasta el cupo a nadie. Con la base sana los 401 siguen contando uno por dimension y el '
    + `sexto sigue siendo 429 con su Retry-After de ${espera}s; el ingreso correcto sigue sin `
    + 'consumir cupo';
});

await runCase(136, 'Backend y Frontend dicen de que commit son, y lo dicen igual', async () => {
  // Una interfaz nueva convivio con un Backend viejo sin ninguna senal: el health
  // devolvia una version fija —`1.0.0`, que es la comercial y no se mueve— y el
  // Frontend no publicaba nada. Ahora los dos publican la revision que les dio el
  // entorno, y la prueba es que sean LA MISMA, byte por byte.
  const SHA_SINTETICO = '0123456789abcdef0123456789abcdef01234567';
  assert(/^[0-9a-f]{40}$/.test(SHA_SINTETICO),
    'el SHA de la prueba tiene que ser 40 hexadecimales, como el que da Railway');

  // --- A. Sin la variable, un valor que se lee como lo que es --------------
  // El servidor que atiende la suite corre sin `RAILWAY_GIT_COMMIT_SHA`.
  const saludLocal = await apiRequest('/health');
  assert(saludLocal.status === 200, `el health respondio ${saludLocal.status}`);
  const revisionLocal = saludLocal.data.revision;
  assert(typeof revisionLocal === 'string' && revisionLocal.length > 0,
    'el health no publica ninguna revision');
  assert(!/^[0-9a-f]{40}$/i.test(revisionLocal),
    `sin variable el health publica algo con forma de SHA: ${revisionLocal}`);
  assert(/[^0-9a-f]/i.test(revisionLocal),
    `el valor sin revision podria confundirse con un commit: ${revisionLocal}`);

  // Y el health no perdio nada de lo que ya decia.
  for (const [clave, valor] of [['status', 'ok'], ['service', 'TopGreen Marketplace API']]) {
    assert(saludLocal.data[clave] === valor,
      `el health cambio ${clave}: ${JSON.stringify(saludLocal.data[clave])}`);
  }
  assert(saludLocal.data.version === '1.0.0',
    `la version comercial se movio sola: ${saludLocal.data.version}`);
  assert(typeof saludLocal.data.environment === 'string' && saludLocal.data.environment,
    'el health perdio el entorno');
  // Ni se llevo puesta ninguna otra variable del entorno.
  const clavesDelHealth = Object.keys(saludLocal.data).sort();
  assert(JSON.stringify(clavesDelHealth)
      === JSON.stringify(['environment', 'revision', 'service', 'status', 'version']),
    `el health expone claves de mas o de menos: ${JSON.stringify(clavesDelHealth)}`);
  const textoDelHealth = JSON.stringify(saludLocal.data);
  for (const secreto of ['JWT_SECRET', 'DATABASE_URL', 'SMTP', 'MP_', 'postgres', 'password']) {
    assert(!textoDelHealth.includes(secreto),
      `el health filtra ${secreto}: ${textoDelHealth}`);
  }
  // Y las cabeceras defensivas de SEC-3 siguen ahi.
  const cabecerasDelHealth = await fetch(`${API_URL}/health`);
  for (const cabecera of ['strict-transport-security', 'x-content-type-options',
    'x-frame-options', 'referrer-policy', 'permissions-policy']) {
    assert(cabecerasDelHealth.headers.get(cabecera),
      `el health perdio la cabecera ${cabecera}`);
  }

  // El Frontend, construido sin la variable, dice lo mismo.
  const revisionDelDocumento = (html) => {
    const etiqueta = html.match(
      /<meta[^>]*name=["']topgreen:revision["'][^>]*>/i);
    if (!etiqueta) return null;
    const contenido = etiqueta[0].match(/content=["']([^"']*)["']/i);
    return contenido ? contenido[1] : null;
  };

  // --- B. Con la variable puesta, las tres fuentes coinciden --------------
  // Se construye a una carpeta aparte para no pisar el `dist` que usa el caso
  // 131, que lo sirve con Nginx.
  const carpeta = mkdtempSync(`${tmpdir()}/topgreen-revision-`);
  const construccion = spawnSync(
    'npx', ['vite', 'build', '--outDir', carpeta, '--emptyOutDir'],
    { encoding: 'utf8', env: { ...process.env, RAILWAY_GIT_COMMIT_SHA: SHA_SINTETICO } },
  );
  assert(construccion.status === 0,
    `la construccion con la revision fallo: ${(construccion.stderr || '').slice(0, 300)}`);
  const revisionDelFrontend = revisionDelDocumento(
    readFileSync(`${carpeta}/index.html`, 'utf8'));
  assert(revisionDelFrontend === SHA_SINTETICO,
    `el artefacto publica ${JSON.stringify(revisionDelFrontend)} y no el SHA que recibio`);

  // El Backend, con la misma variable, por el health y por el log de arranque.
  const guion = `
import json, io, os, sys
import structlog
from starlette.testclient import TestClient

registro = io.StringIO()
structlog.configure(logger_factory=structlog.PrintLoggerFactory(file=registro))

from app.main import app

with TestClient(app) as c:
    salud = c.get("/api/health").json()
print(json.dumps({
    "salud": salud,
    "arranque": registro.getvalue(),
    "variable": os.environ.get("RAILWAY_GIT_COMMIT_SHA"),
}))
`;
  const crudo = execFileSync(
    'docker',
    ['exec', '-i', '-e', `RAILWAY_GIT_COMMIT_SHA=${SHA_SINTETICO}`,
      'topgreen-api', 'python', '-c', guion],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const medido = JSON.parse(crudo.trim().split(/\r?\n/).at(-1));
  const revisionDelBackend = medido.salud.revision;
  assert(revisionDelBackend === SHA_SINTETICO,
    `el health publica ${JSON.stringify(revisionDelBackend)} y no el SHA que recibio`);

  // El log de arranque la deja junto a version y entorno.
  assert(/starting_application/.test(medido.arranque),
    `no se capturo el log de arranque: ${JSON.stringify(medido.arranque.slice(0, 200))}`);
  assert(medido.arranque.includes(SHA_SINTETICO),
    `el log de arranque no trae la revision: ${JSON.stringify(medido.arranque.slice(0, 300))}`);
  for (const dato of ['version', 'env']) {
    assert(medido.arranque.includes(dato),
      `el log de arranque perdio ${dato}: ${JSON.stringify(medido.arranque.slice(0, 300))}`);
  }

  // --- C. Byte por byte, las tres iguales ---------------------------------
  const tres = [revisionDelFrontend, revisionDelBackend, medido.arranque.match(/[0-9a-f]{40}/)?.[0]];
  assert(new Set(tres).size === 1 && tres[0] === SHA_SINTETICO,
    `las tres representaciones no coinciden: ${JSON.stringify(tres)}`);
  assert(revisionDelBackend.length === 40,
    `la revision llego recortada a ${revisionDelBackend.length} caracteres`);

  // Y con la variable puesta el health sigue sin publicar nada mas.
  assert(JSON.stringify(Object.keys(medido.salud).sort()) === JSON.stringify(clavesDelHealth),
    `con la revision puesta el health cambio de forma: ${JSON.stringify(Object.keys(medido.salud))}`);

  rmSync(carpeta, { recursive: true, force: true });

  return `Sin la variable, las dos puntas dicen ${JSON.stringify(revisionLocal)}: se lee como lo `
    + 'que es y no puede aprobarse por error confundiendola con un commit. Con un SHA sintetico '
    + `de 40 hexadecimales, el artefacto del Frontend, /api/health y el log de arranque devuelven `
    + `los tres ${SHA_SINTETICO}, byte por byte y sin recortar. El health conserva estado, `
    + 'servicio, version comercial y entorno, no suma ninguna otra clave del entorno y mantiene '
    + 'las cinco cabeceras de SEC-3';
});


await runCase(137, 'La ubicacion que muestra una publicacion es la suya, no la de quien la publica', async () => {
  // La captura que abrio esto parecia un filtro roto y no lo era. El filtro por
  // provincia trabaja sobre `products.locality_id`; lo que estaba mal era la
  // representacion: la respuesta publica no traia la ubicacion de la publicacion,
  // asi que la tarjeta caia en `seller.location` —texto libre del perfil— y una
  // rastra de Balcarce, vendida por una cuenta de Cordoba, se leia «Cordoba»
  // aun filtrando Buenos Aires.
  //
  // Antes de tocar nada esto medía, sobre la base del seed, 23 de 30
  // publicaciones activas mostrando una provincia que no era la suya.

  // --- A. El caso exacto: publicacion en una provincia, vendedor en otra ----
  const [[nombre, localidad, provincia, ubicacionDelVendedor]] = queryRows(
    "SELECT p.name, l.name, l.province_name, u.location "
    + 'FROM products p JOIN localities l ON l.id = p.locality_id '
    + 'JOIN users u ON u.id = p.seller_id '
    + "WHERE p.status = 'ACTIVE' AND u.location NOT ILIKE '%' || l.province_name || '%' "
    + 'ORDER BY p.name LIMIT 1');
  assert(nombre && localidad && provincia,
    'el catalogo no tiene ninguna publicacion cuyo vendedor sea de otra provincia: '
    + 'sin ese caso esta prueba no mide nada');

  const buscado = await apiRequest(
    `/catalog/products?search=${encodeURIComponent(nombre.slice(0, 20))}`);
  const publicacion = buscado.data.items.find((i) => i.name === nombre);
  assert(publicacion, `la API no devolvio «${nombre}»`);
  assert(publicacion.publication_location,
    `«${nombre}» sale sin ubicacion de publicacion: la tarjeta va a mostrar la del vendedor`);
  assert(publicacion.publication_location.locality === localidad
    && publicacion.publication_location.province === provincia,
    `la API dice ${JSON.stringify(publicacion.publication_location)} y la base dice `
    + `${localidad}, ${provincia}`);
  assert(publicacion.seller.location === ubicacionDelVendedor,
    'el dato del vendedor dejo de viajar: es suyo y sigue siendo un dato distinto');
  assert(publicacion.publication_location.province !== ubicacionDelVendedor,
    'la prueba dejo de distinguir las dos ubicaciones');

  // El detalle dice lo mismo que el listado.
  const detalle = await apiRequest(`/catalog/products/${publicacion.id}`);
  assert(JSON.stringify(detalle.data.publication_location)
      === JSON.stringify(publicacion.publication_location),
    'el detalle y el listado no coinciden en la ubicacion de la publicacion');

  // --- B. Provincia por provincia, la API contra el SQL equivalente --------
  // No se fijan cantidades: se compara el CONJUNTO de identificadores, asi la
  // prueba no envejece cuando el catalogo cambie.
  const provincias = queryRows(
    'SELECT DISTINCT l.province_name FROM products p JOIN localities l ON l.id = p.locality_id '
    + "WHERE p.status = 'ACTIVE' ORDER BY 1").map(([p]) => p);
  assert(provincias.length >= 2,
    `hacen falta al menos dos provincias con publicaciones y hay ${provincias.length}`);
  const comparadas = [];
  for (const prov of provincias) {
    const porSql = queryRows(
      'SELECT p.id FROM products p JOIN localities l ON l.id = p.locality_id '
      + `WHERE p.status = 'ACTIVE' AND l.province_name = ${sqlLiteral(prov)} ORDER BY 1`)
      .map(([id]) => id);
    // Se pagina: con la suite completa una provincia pasa de cien publicaciones
    // y comparar una sola pagina compararia otra cosa.
    const items = [];
    let pagina = 1;
    let respuesta;
    do {
      respuesta = await apiRequest(
        `/catalog/products?province=${encodeURIComponent(prov)}&page_size=100&page=${pagina}`);
      items.push(...respuesta.data.items);
      pagina += 1;
    } while (items.length < respuesta.data.total && respuesta.data.items.length > 0);
    const porApi = items.map((i) => i.id).sort();
    assert(JSON.stringify(porApi) === JSON.stringify([...porSql].sort()),
      `en ${prov} la API devuelve ${porApi.length} publicaciones y el SQL ${porSql.length}`);
    assert(respuesta.data.total === porSql.length,
      `en ${prov} el total dice ${respuesta.data.total} y hay ${porSql.length}`);
    // Y cada elemento informa ESA provincia como suya.
    for (const item of items) {
      assert(item.publication_location && item.publication_location.province === prov,
        `filtrando ${prov}, «${item.name}» informa `
        + `${JSON.stringify(item.publication_location && item.publication_location.province)}`);
    }
    comparadas.push(`${prov}=${porSql.length}`);
  }

  // --- C. Privacidad: sale el lugar, no la puerta --------------------------
  const permitidas = ['locality_id', 'locality', 'province'];
  assert(JSON.stringify(Object.keys(publicacion.publication_location).sort())
      === JSON.stringify(permitidas.sort()),
    `la ubicacion expone ${JSON.stringify(Object.keys(publicacion.publication_location))}`);
  const textoDelDetalle = JSON.stringify(detalle.data);
  for (const prohibido of ['latitude', 'longitude', 'coordinates', 'department',
    'phone', 'whatsapp', 'email']) {
    assert(!textoDelDetalle.includes(`"${prohibido}"`),
      `el detalle expone ${prohibido}, que no hace falta para ubicar una operacion`);
  }

  // --- D. Sin una consulta por tarjeta ------------------------------------
  // La localidad viaja en la MISMA consulta del listado. Se mide contando
  // consultas con dos tamanos de pagina: si creciera con la pagina, seria N+1.
  const guion = `
import json
from sqlalchemy import event
from starlette.testclient import TestClient
from app.db.base import engine
from app.main import app

consultas = []
event.listen(engine, "before_cursor_execute", lambda *a, **k: consultas.append(a[2]))
medida = {}
with TestClient(app) as c:
    for tamano in (4, 20):
        consultas.clear()
        r = c.get(f"/api/catalog/products?page_size={tamano}")
        sobre_localities = sum(1 for q in consultas if "localities" in q.lower())
        medida[str(tamano)] = [len(r.json()["items"]), sobre_localities]
print(json.dumps(medida))
`;
  const medido = JSON.parse(execFileSync(
    'docker', ['exec', '-i', 'topgreen-api', 'python', '-c', guion],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim().split(/\r?\n/).at(-1));
  const [itemsChicos, consultasChicas] = medido['4'];
  const [itemsGrandes, consultasGrandes] = medido['20'];
  assert(itemsGrandes > itemsChicos,
    'las dos paginas trajeron lo mismo: la medicion de N+1 no compara nada');
  assert(consultasChicas === consultasGrandes,
    `las consultas sobre localidades pasan de ${consultasChicas} a ${consultasGrandes} `
    + 'al agrandar la pagina: hay una consulta por tarjeta');

  // --- E. Y lo que ve una persona ------------------------------------------
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let vistoEnLaTarjeta = '';
  try {
    // Se entra por URL directa con la provincia Y el nombre: la suite crea mas
    // de cien publicaciones, y sin acotar la busqueda esta tarjeta podria estar
    // en la pagina tres. Lo que se mide es que la URL hidrate y que la tarjeta
    // diga la ubicacion correcta, no en que pagina cae.
    await page.goto(
      `${FRONTEND_URL}/?section=marketplace&province=${encodeURIComponent(provincia)}`
      + `&q=${encodeURIComponent(nombre)}`,
      { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-province').waitFor({ state: 'visible', timeout: 20_000 });
    // El padron llega por la red: hasta que no estan las opciones, el selector
    // no puede tener elegida ninguna.
    await page.waitForFunction(
      () => document.querySelectorAll('#catalog-province option').length > 1,
      null, { timeout: 20_000 });
    await page.waitForFunction(
      () => (document.querySelector('#catalog-province') || {}).value !== '',
      null, { timeout: 20_000 });
    // La URL directa hidrata el selector, y lo hace con ESA provincia.
    const provinciaElegida = await page.locator('#catalog-province')
      .evaluate((s) => s.options[s.selectedIndex].textContent.trim());
    assert(provinciaElegida === provincia,
      `la URL pedia ${provincia} y el selector quedo en «${provinciaElegida}»`);
    await page.locator('article[class*="card"]').first().waitFor({ timeout: 25_000 });
    const tarjeta = page.locator('article[class*="card"]')
      .filter({ hasText: nombre }).first();
    await tarjeta.waitFor({ timeout: 20_000 });
    vistoEnLaTarjeta = (await tarjeta.innerText()).replace(/\s+/g, ' ');
    assert(vistoEnLaTarjeta.includes(`${localidad}, ${provincia}`),
      `la tarjeta no dice «${localidad}, ${provincia}»: ${vistoEnLaTarjeta.slice(0, 160)}`);
    assert(!vistoEnLaTarjeta.includes(ubicacionDelVendedor),
      `la tarjeta sigue mostrando la ubicacion del vendedor «${ubicacionDelVendedor}»`);

    // Cambiar de provincia: URL, consulta y tarjetas se mueven juntas, y una
    // localidad de la provincia anterior no sobrevive.
    const otra = provincias.find((p) => p !== provincia);
    const localidades = page.locator('#catalog-locality');
    if (await localidades.count()) {
      const opciones = await localidades.locator('option').count();
      if (opciones > 1) {
        await localidades.selectOption({ index: 1 });
        await page.waitForTimeout(1500);
        assert(/locality_id=/.test(page.url()), 'elegir una localidad no quedo en la URL');
      }
    }
    const buscador = page.locator('input[type="search"], input[placeholder*="Busc" i]').first();
    if (await buscador.count()) {
      await buscador.fill('');
      await page.waitForTimeout(1200);
    }
    await page.locator('#catalog-province').selectOption({ label: otra });
    await page.waitForTimeout(2500);
    assert(page.url().includes(encodeURIComponent(otra).replace(/%20/g, '+'))
      || decodeURIComponent(page.url()).includes(otra),
      `la URL no siguio al cambio de provincia: ${page.url()}`);
    assert(!/locality_id=/.test(page.url()),
      'quedo una localidad de la provincia anterior en la URL');
    await page.locator('article[class*="card"]').first().waitFor({ timeout: 25_000 });
    const enLaOtra = await page.locator('article[class*="card"]').allInnerTexts();
    assert(enLaOtra.length > 0, `filtrando ${otra} no quedo ninguna tarjeta`);
    for (const texto of enLaOtra) {
      assert(texto.includes(otra),
        `filtrando ${otra} hay una tarjeta que no la nombra: ${texto.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return `«${nombre}» es de ${localidad}, ${provincia} y su vendedor declara `
    + `«${ubicacionDelVendedor}»: la API informa la ubicacion de la publicacion, el detalle dice `
    + `lo mismo y la tarjeta muestra «${localidad}, ${provincia}» sin nombrar la del vendedor. `
    + `Provincia por provincia, los identificadores de la API coinciden con el SQL sobre `
    + `products.locality_id (${comparadas.join(', ')}) y cada elemento informa la provincia por la `
    + `que se filtro. La ubicacion lleva solo localidad y provincia. Las consultas sobre localities `
    + `no crecen con el tamano de pagina (${consultasChicas} con ${itemsChicos} y `
    + `${consultasGrandes} con ${itemsGrandes})`;
});


await runCase(138, 'Sin sesion, el detalle ofrece ingresar y vuelve a la misma publicacion', async () => {
  // El detalle detectaba bien que faltaba la sesion y ahi se terminaba: un aviso
  // que decia «tenes que ingresar» y nada mas. El Login ya existia y la cabecera
  // ya sabia abrirlo; la persona quedaba en un callejon sin salida.
  //
  // Se prueba lo que ve alguien sin sesion, no lo que hace el codigo: el rotulo,
  // que se abra el Login de verdad, que cancelar y completar vuelvan a la MISMA
  // publicacion, y que en ningun momento aparezca algo en el carrito.
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const erroresDePagina = [];
  page.on('pageerror', (e) => erroresDePagina.push(e.message));

  const enElCarrito = () => page.evaluate(() => {
    for (const clave of Object.keys(window.localStorage)) {
      if (!/cart|carrito/i.test(clave)) continue;
      try {
        const guardado = JSON.parse(window.localStorage.getItem(clave) || 'null');
        if (Array.isArray(guardado)) return guardado.length;
        if (guardado && Array.isArray(guardado.items)) return guardado.items.length;
      } catch { /* si no es JSON no es el carrito */ }
    }
    return 0;
  });
  const tituloDelDetalle = () => page.locator('#detalle-titulo').first().innerText();
  // Se cuentan las ordenes de esta cuenta antes y despues: en la suite completa
  // otros casos le crean ordenes, asi que «ninguna orden reciente» seria falso.
  const ordenesDelComprador = () => queryCount(
    'SELECT count(*) FROM orders o JOIN users u ON u.id = o.buyer_id '
    + "WHERE u.email = 'cliente@ejemplo.com'");
  const ordenesAntes = ordenesDelComprador();

  try {
    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('article[class*="card"]').first().waitFor({ timeout: 25_000 });
    await page.locator('article[class*="card"] h3').first().click();
    await page.locator('#detalle-titulo').waitFor({ timeout: 20_000 });
    const publicacion = (await tituloDelDetalle()).trim();

    // El rotulo dice cual es el paso siguiente.
    const cta = page.getByRole('dialog')
      .getByRole('button', { name: /Ingresar para continuar/ }).first();
    assert(await cta.count(),
      'sin sesion el detalle no ofrece ingresar: los botones son '
      + JSON.stringify(await page.getByRole('dialog').getByRole('button').allInnerTexts()));

    // --- Se cancela ---------------------------------------------------------
    await cta.click();
    await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
    assert(await enElCarrito() === 0, 'abrir el Login agrego algo al carrito');
    // Un solo dialogo: el detalle se aparta en vez de quedar debajo con su
    // propia trampa de foco peleando contra la del Login.
    assert(await page.getByRole('dialog').count() === 1,
      `con el Login abierto hay ${await page.getByRole('dialog').count()} dialogos superpuestos`);
    await page.getByRole('button', { name: 'Cerrar' }).first().click();
    await page.locator('#detalle-titulo').waitFor({ timeout: 20_000 });
    assert((await tituloDelDetalle()).trim() === publicacion,
      `tras cancelar se volvio a «${(await tituloDelDetalle()).trim()}» y no a «${publicacion}»`);
    assert(await enElCarrito() === 0, 'cancelar el Login dejo algo en el carrito');

    // --- Se completa --------------------------------------------------------
    await page.getByRole('dialog').getByRole('button', { name: /Ingresar para continuar/ })
      .first().click();
    await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
    await page.getByPlaceholder('tu@email.com').fill('cliente@ejemplo.com');
    await page.getByPlaceholder('••••••••').fill('cliente123');
    await page.locator('[class*="_submitButton_"][type="submit"]').click();
    await page.locator('#detalle-titulo').waitFor({ timeout: 25_000 });
    assert((await tituloDelDetalle()).trim() === publicacion,
      `tras ingresar se volvio a «${(await tituloDelDetalle()).trim()}» y no a «${publicacion}»`);
    await page.getByRole('button', { name: 'Mi cuenta' }).first()
      .waitFor({ timeout: 20_000 });

    // Con sesion el boton vuelve a decir lo que hace, y sigue sin haber pasado
    // nada por su cuenta: ni carrito, ni orden, ni reserva.
    const rotuloConSesion = (await page.getByRole('dialog').getByRole('button')
      .filter({ hasText: /Ingresar|Iniciar operaci|Agregar|Contratar/ }).first().innerText()).trim();
    assert(!/Ingresar para continuar/.test(rotuloConSesion),
      `ya con sesion el boton sigue diciendo «${rotuloConSesion}»`);
    assert(await enElCarrito() === 0,
      'ingresar agrego la publicacion al carrito sin que nadie la pidiera');
    const ordenesDespues = ordenesDelComprador();
    assert(ordenesDespues === ordenesAntes,
      `ingresar creo ${ordenesDespues - ordenesAntes} ordenes`);

    assert(erroresDePagina.length === 0,
      `el recorrido dejo errores de pagina: ${erroresDePagina[0]}`);
    return `Sin sesion el detalle de «${publicacion}» ofrece «Ingresar para continuar» y abre el `
      + 'Login real, con un solo dialogo a la vez. Cancelarlo vuelve a esa misma publicacion; '
      + `completarlo tambien, ya con sesion y con el boton diciendo «${rotuloConSesion}». En los `
      + 'tres momentos el carrito quedo en cero y no se creo ninguna orden';
  } finally {
    await context.close();
    await browser.close();
  }
});


await runCase(139, 'La misma puerta de ingreso en las tres paginas que dibujan tarjetas', async () => {
  // El detalle ya ofrecia ingresar, pero solo en el Mercado y solo desde el
  // detalle: la TARJETA agregaba al carrito en silencio —ni un aviso—, y las
  // vistas previas de Inicio y Servicios no tenian por donde abrir el Login.
  // Tres caminos a la misma accion, tres comportamientos distintos.
  //
  // Ademas «Iniciar operacion» prometia un inicio de operacion que no existe:
  // lo que hace es agregar al carrito, y ahora lo dice.

  const browser = await chromium.launch({ headless: true });
  const enElCarrito = (page) => page.evaluate(() => {
    for (const clave of Object.keys(window.localStorage)) {
      if (!/cart|carrito/i.test(clave)) continue;
      try {
        const guardado = JSON.parse(window.localStorage.getItem(clave) || 'null');
        if (Array.isArray(guardado)) return guardado.length;
        if (guardado && Array.isArray(guardado.items)) return guardado.items.length;
      } catch { /* si no es JSON no es el carrito */ }
    }
    return 0;
  });
  const recorridas = [];

  try {
    // --- C. Las tres pantallas, desde la tarjeta y desde el detalle ---------
    for (const seccion of ['Inicio', 'Mercado', 'Servicios']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      try {
        await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
        await page.locator('header').first()
          .getByRole('button', { name: seccion, exact: true }).first().click();
        await page.locator('article[class*="card"]').first().waitFor({ timeout: 25_000 });
        const tarjetasAlPrincipio = await page.locator('article[class*="card"]').count();

        // Desde la TARJETA: ofrece ingresar, no agrega en silencio.
        const enLaTarjeta = page.locator('article[class*="card"]')
          .getByRole('button', { name: 'Ingresar para continuar' }).first();
        assert(await enLaTarjeta.count(),
          `en ${seccion} ninguna tarjeta ofrece ingresar; los botones son `
          + JSON.stringify((await page.locator('article[class*="card"]')
            .getByRole('button').allInnerTexts()).slice(0, 6)));
        await enLaTarjeta.click();
        await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
        assert(await page.getByRole('dialog').count() === 1,
          `en ${seccion} hay ${await page.getByRole('dialog').count()} dialogos a la vez`);
        assert(await enElCarrito(page) === 0,
          `en ${seccion} la tarjeta agrego algo al carrito antes de la sesion`);

        // Cancelar deja la persona donde estaba, sin efectos.
        await page.getByRole('button', { name: 'Cerrar' }).first().click();
        await page.locator('article[class*="card"]').first().waitFor({ timeout: 20_000 });
        assert(await page.getByRole('dialog').count() === 0,
          `en ${seccion} quedo un dialogo abierto tras cancelar`);
        assert(await page.locator('article[class*="card"]').count() === tarjetasAlPrincipio,
          `cancelar en ${seccion} cambio la pagina`);
        assert(await enElCarrito(page) === 0,
          `cancelar en ${seccion} dejo algo en el carrito`);

        // Desde el DETALLE de una publicacion comprable de esa misma pagina.
        const tarjetaComprable = page.locator('article[class*="card"]')
          .filter({ has: page.getByRole('button', { name: 'Ingresar para continuar' }) }).first();
        await tarjetaComprable.locator('h3').click();
        await page.locator('#detalle-titulo').waitFor({ timeout: 20_000 });
        const publicacion = (await page.locator('#detalle-titulo').innerText()).trim();
        const enElDetalle = page.getByRole('dialog')
          .getByRole('button', { name: 'Ingresar para continuar' }).first();
        assert(await enElDetalle.count(),
          `en ${seccion}, el detalle de «${publicacion}» no ofrece ingresar`);
        await enElDetalle.click();
        await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
        assert(await page.getByRole('dialog').count() === 1,
          `en ${seccion} el Login quedo apilado sobre el detalle`);

        // En una de las tres se prueba ademas el ida y vuelta a Registro: saltar
        // entre los dos formularios es el mismo tramite y no puede perder la
        // continuidad. Se hace aca y no en las tres para no repetir lo mismo.
        if (seccion === 'Mercado') {
          await page.getByRole('button', { name: 'Regístrate aquí' }).first().click();
          await page.getByRole('heading', { name: /Crear cuenta|Regist/i })
            .first().waitFor({ timeout: 20_000 });
          assert(await page.getByRole('dialog').count() === 1,
            'el salto a Registro apilo un dialogo mas');
          await page.getByRole('button', { name: 'Inicia sesión aquí' }).first().click();
          await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
        }

        // Se completa el ingreso y se vuelve a la MISMA publicacion.
        await page.getByPlaceholder('tu@email.com').fill('cliente@ejemplo.com');
        await page.getByPlaceholder('••••••••').fill('cliente123');
        await page.locator('[class*="_submitButton_"][type="submit"]').click();
        await page.locator('#detalle-titulo').waitFor({ timeout: 25_000 });
        assert((await page.locator('#detalle-titulo').innerText()).trim() === publicacion,
          `en ${seccion} se volvio a otra publicacion`);
        assert(await enElCarrito(page) === 0,
          `en ${seccion} ingresar agrego la publicacion al carrito sin pedirlo`);

        // Y recien ahora, con un clic nuevo, la accion ocurre.
        const yaConSesion = page.getByRole('dialog').getByRole('button')
          .filter({ hasText: /Agregar al carrito|Agregar|Contratar/ }).first();
        const rotulo = (await yaConSesion.innerText()).trim();
        assert(!/Ingresar para continuar/.test(rotulo),
          `en ${seccion} el boton sigue pidiendo ingresar con la sesion abierta`);
        await yaConSesion.click();
        // Se espera la CONDICION, no el reloj. Aca habia un
        // `waitForTimeout(1200)` y eso no afirma nada sobre el carrito: afirma
        // que a ESTA maquina le alcanzo ese rato. Medido, el carrito se escribe
        // en menos de 1 ms aca —o sea que 1200 no es un margen, es un numero
        // que sobro— y con el carrito llegando a los 3 s, que es lo que ve una
        // maquina mas lenta, ese mismo codigo acusa al producto de no agregar
        // nada cuando el producto agrego bien.
        //
        // `esperarA` es la primitiva que ya usa el resto de la suite: pregunta
        // cada 50 ms y se rinde a los 20 s. En una maquina rapida devuelve al
        // instante; en una lenta espera lo que haga falta; y si el producto se
        // rompe de verdad, el caso sigue poniendose rojo.
        try {
          await esperarA(async () => await enElCarrito(page) === 1,
            `el carrito de ${seccion}`, 20_000);
        } catch {
          const quedo = await enElCarrito(page).catch(() => 'ilegible');
          throw new Error(
            `en ${seccion} el clic en «${rotulo}» con la sesion abierta no agrego `
            + `nada: el carrito quedo en ${quedo} despues de 20s `
            + '(antes del clic estaba en 0)');
        }
        recorridas.push(`${seccion}:«${rotulo}»`);
      } finally {
        await context.close();
      }
    }

    // --- D. Un ingreso posterior desde la cabecera no arrastra nada ---------
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.locator('article[class*="card"]').first().waitFor({ timeout: 25_000 });
      // Se pide ingresar desde una tarjeta y se cancela: la continuidad tiene
      // que morir ahi.
      await page.locator('article[class*="card"]')
        .getByRole('button', { name: 'Ingresar para continuar' }).first().click();
      await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Cerrar' }).first().click();
      await page.locator('article[class*="card"]').first().waitFor({ timeout: 20_000 });
      // Y ahora se ingresa desde la cabecera, que no viene de ninguna publicacion.
      await page.getByRole('button', { name: 'Ingresar', exact: true }).first().click();
      await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
      await page.getByPlaceholder('tu@email.com').fill('cliente@ejemplo.com');
      await page.getByPlaceholder('••••••••').fill('cliente123');
      await page.locator('[class*="_submitButton_"][type="submit"]').click();
      await page.getByRole('button', { name: 'Mi cuenta' }).first().waitFor({ timeout: 25_000 });
      assert(await page.locator('#detalle-titulo').count() === 0,
        'un ingreso desde la cabecera reabrio una publicacion: quedo un callback viejo');
      assert(await page.getByRole('dialog').count() === 0,
        'un ingreso desde la cabecera dejo un dialogo abierto');
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }

  // --- E. Y recien ahora, la forma del codigo ------------------------------
  // Va al final a proposito: lo que tiene que fallar primero es el recorrido
  // de una persona, no la forma del archivo. Si esto se rompiera solo, seria
  // una prueba que mira el codigo en vez de mirar el producto.
  // Si manana una cuarta pantalla dibuja tarjetas, este caso se pone en rojo
  // hasta que la cubran: es la unica forma de que «todas» siga siendo cierto.
  const dondeSeDibujanTarjetas = execFileSync(
    'grep', ['-rl', '<ProductCard', 'src'], { encoding: 'utf8' })
    .trim().split('\n')
    .filter((archivo) => !archivo.endsWith('ProductCard/ProductCard.tsx'))
    .sort();
  const cubiertas = [
    'src/components/Pages/HomePage.tsx',
    'src/components/Pages/ServicesPage.tsx',
    'src/components/ProductGrid/ProductGrid.tsx',
  ];
  assert(JSON.stringify(dondeSeDibujanTarjetas) === JSON.stringify(cubiertas),
    `ProductCard se dibuja en ${JSON.stringify(dondeSeDibujanTarjetas)} y esta prueba `
    + `recorre ${JSON.stringify(cubiertas)}`);

  // Y las tres reciben la MISMA funcion de App: un solo Login, no tres.
  const app = readFileSync('src/App.tsx', 'utf8');
  const veces = (app.match(/onSolicitarIngreso=\{abrirLoginYVolver\}/g) || []).length;
  assert(veces >= 3,
    `App pasa la continuidad ${veces} veces y hacen falta tres pantallas`);

  const acciones = readFileSync('src/utils/anatomia.ts', 'utf8');
  assert(!/etiqueta: 'Iniciar operación'/.test(acciones),
    'sigue existiendo el rotulo «Iniciar operación», que prometia otra cosa');
  assert(/case 'activo':[\s\S]{0,400}?etiqueta: 'Agregar al carrito'/.test(acciones),
    'el activo no dice «Agregar al carrito»');
  for (const [anatomia, etiqueta] of [["'insumo'", "'Agregar'"], ['default', "'Contratar'"]]) {
    assert(new RegExp(`${anatomia}:[\\s\\S]{0,400}?etiqueta: ${etiqueta}`).test(acciones),
      `${anatomia} dejo de decir ${etiqueta}`);
  }


  return `ProductCard se dibuja en ${dondeSeDibujanTarjetas.length} pantallas y las tres reciben la `
    + 'misma continuidad de App. En Inicio, Mercado y Servicios, sin sesion tanto la tarjeta como '
    + 'el detalle ofrecen «Ingresar para continuar» y abren el Login real con un solo dialogo a la '
    + 'vez; cancelar deja la pagina como estaba y completar vuelve a la misma publicacion, siempre '
    + `con el carrito en cero. Recien el clic siguiente agrega (${recorridas.join(', ')}). Un `
    + 'ingreso desde la cabecera no reabre nada. El activo dice «Agregar al carrito» y las otras '
    + 'anatomias conservan su rotulo';
});

await runCase(140, 'Nadie compra su propia publicacion, ni por la API ni por la pantalla', async () => {
  // Una cuenta autenticada podia agregar al carrito una publicacion cuyo
  // `seller_id` es su propio id, y llevarla hasta la orden de verdad: quedaba
  // una fila con `buyer_id = seller_id`, con su importe, su estado de espera de
  // comprobante y sus avisos. Comprador y vendedor la misma persona contamina
  // orden, stock, pago, calificacion y notificacion de una sola vez.
  //
  // La regla vive en el SERVIDOR y se aplica antes de escribir. La pantalla
  // ademas deja de ofrecerlo, pero la pantalla no decide: por eso este caso
  // ataca primero por la API —con URL directa, carrito viejo y llamada a
  // mano— y recien despues mira la interfaz.

  const ingresar = async (email, password) => {
    const { data } = await apiRequest('/auth/login', {
      method: 'POST', body: { email, password },
    });
    return { token: data.access_token, id: data.user.id, email };
  };
  const vendedor = await ingresar('vendedor@ejemplo.com', 'vendedor123');
  const admin = await ingresar('admin@topgreen.com', 'admin123');
  const fletero = await ingresar('transportista@ejemplo.com', 'transportista123');

  // --- Lo que hay publicado, leido del catalogo publico -------------------
  const publicaciones = [];
  for (let pagina = 1; pagina <= 20; pagina += 1) {
    const { data } = await apiRequest(`/catalog/products?page=${pagina}&page_size=100`);
    publicaciones.push(...data.items);
    if (!data.items.length || publicaciones.length >= data.total) break;
  }
  const comprable = (p) => Number(p.price) > 0 && (p.is_service || Number(p.stock) > 0);
  const de = (cuenta, extra = () => true) =>
    publicaciones.find((p) => p.seller?.id === cuenta.id && comprable(p) && extra(p));
  const propioProducto = de(vendedor, (p) => !p.is_service);
  const propioServicio = de(vendedor, (p) => p.is_service);
  const propioDelAdmin = de(admin);
  // La ajena se pide con stock para tres: el caso la sincroniza en esa cantidad
  // y un tope de una unidad taparia el rechazo real con un 400 de stock.
  const ajeno = publicaciones.find(
    (p) => p.seller?.id && p.seller.id !== vendedor.id && !p.is_service
      && comprable(p) && Number(p.stock) >= 3);
  assert(propioProducto && propioServicio && propioDelAdmin && ajeno,
    'el catalogo no tiene las publicaciones que este caso necesita comparar');

  // --- Instrumentos de medicion, todos sobre la base ----------------------
  const carritoDe = (userId) => queryRows(`
    SELECT ci.product_id, ci.quantity FROM cart_items ci
    JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${sqlLiteral(userId)} AND c.status = 'ACTIVE'
    ORDER BY ci.product_id
  `).map((fila) => fila.join('x')).join(', ');
  const estadoDelCarrito = (userId) => querySql(`
    SELECT status FROM carts WHERE user_id = ${sqlLiteral(userId)} AND status = 'ACTIVE'
  `);
  const ordenesDe = (userId) => queryCount(
    `SELECT COUNT(*) FROM orders WHERE buyer_id = ${sqlLiteral(userId)}`);
  const ordenesIncestuosas = () => queryCount(
    'SELECT COUNT(*) FROM orders WHERE buyer_id = seller_id');
  const pagos = () => queryCount('SELECT COUNT(*) FROM payments');
  const avisosDe = (userId) => queryCount(
    `SELECT COUNT(*) FROM notifications WHERE user_id = ${sqlLiteral(userId)}`);
  const reservado = (productId) => queryCount(
    `SELECT COALESCE(stock_reservado, 0) FROM products WHERE id = ${sqlLiteral(productId)}`);
  const carritosDe = (userId) => queryCount(
    `SELECT COUNT(*) FROM carts WHERE user_id = ${sqlLiteral(userId)}`);
  const itemsDe = (userId) => queryCount(`
    SELECT COUNT(*) FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${sqlLiteral(userId)}
  `);

  // `expectApiError` dice «la API no respondió HTTP 409» y no dice qué SÍ
  // respondió, que es justo lo que hace falta para entender el rojo: un 200 que
  // creó la fila no es lo mismo que un 400 por otra razón.
  const exigir409 = async (que, llamada) => {
    let respuesta;
    try {
      respuesta = await llamada();
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      assert(motivo.includes('HTTP 409'),
        `${que}: se esperaba 409 y respondio ${motivo}`);
      return motivo;
    }
    throw new Error(
      `${que}: se esperaba 409 y respondio HTTP ${respuesta.status} `
      + `${JSON.stringify(respuesta.data).slice(0, 200)}`);
  };

  const NO_ES_TUYO = /tu propia publicacion|tu propia publicación|publicacion propia|publicación propia/i;

  assert(ordenesIncestuosas() === 0,
    `la base arranca con ${ordenesIncestuosas()} ordenes donde comprador y vendedor son la `
    + 'misma cuenta; este caso no puede distinguir las suyas');

  // --- A. POST /cart/items ------------------------------------------------
  await apiRequest('/cart', { method: 'DELETE', token: vendedor.token });

  // Primero una publicacion AJENA, que tiene que seguir entrando: la regla es
  // sobre la identidad, no sobre el carrito.
  await apiRequest('/cart/items', {
    method: 'POST', token: vendedor.token,
    body: { product_id: ajeno.id, quantity: 2 },
  });
  const carritoLegitimo = carritoDe(vendedor.id);
  assert(carritoLegitimo === `${ajeno.id}x2`,
    `la publicacion ajena no entro al carrito: ${carritoLegitimo}`);

  for (const propia of [propioProducto, propioServicio]) {
    const motivo = await exigir409(`POST /cart/items con «${propia.name}»`, () =>
      apiRequest('/cart/items', {
        method: 'POST', token: vendedor.token,
        body: { product_id: propia.id, quantity: 1 },
      }));
    assert(NO_ES_TUYO.test(motivo),
      `«${propia.name}»: el rechazo no explica que la publicacion es suya: ${motivo}`);
    assert(!/[Qq]uitala del carrito/.test(motivo),
      `«${propia.name}»: al agregarla no hay nada que quitar y el mensaje lo pide: ${motivo}`);
    assert(carritoDe(vendedor.id) === carritoLegitimo,
      `el rechazo de «${propia.name}» toco el carrito: ${carritoDe(vendedor.id)}`);
  }

  // --- B. POST /cart/sync -------------------------------------------------
  // El carrito viejo no se reemplaza ni se vacia: se rechaza y queda como
  // estaba, para que la persona pueda sacar lo que sobra.
  const soloPropia = await exigir409('POST /cart/sync con una publicacion propia', () =>
    apiRequest('/cart/sync', {
      method: 'POST', token: vendedor.token,
      body: { items: [{ product_id: propioProducto.id, quantity: 1 }] },
    }));
  assert(NO_ES_TUYO.test(soloPropia), `sync propio: motivo inesperado: ${soloPropia}`);
  assert(/[Qq]uitala del carrito/.test(soloPropia),
    `sync propio: la publicacion ya esta en el carrito y el mensaje no dice que hay que `
    + `sacarla: ${soloPropia}`);
  assert(carritoDe(vendedor.id) === carritoLegitimo,
    `sync rechazado borro el carrito anterior: ${carritoDe(vendedor.id)}`);

  // Mixto: se rechaza ENTERO. No se compra parcialmente lo ajeno.
  const mixto = await exigir409('POST /cart/sync con un carrito mixto', () =>
    apiRequest('/cart/sync', {
      method: 'POST', token: vendedor.token,
      body: {
        items: [
          { product_id: ajeno.id, quantity: 3 },
          { product_id: propioProducto.id, quantity: 1 },
        ],
      },
    }));
  assert(NO_ES_TUYO.test(mixto), `sync mixto: motivo inesperado: ${mixto}`);
  assert(/[Qq]uitala del carrito/.test(mixto),
    `sync mixto: la publicacion ya esta en el carrito y el mensaje no dice que hay que `
    + `sacarla: ${mixto}`);
  assert(carritoDe(vendedor.id) === carritoLegitimo,
    `el sync mixto escribio la parte ajena: ${carritoDe(vendedor.id)}`);

  // Y sin la propia, el mismo sync pasa: lo que se cierra es la compra propia,
  // no el carrito.
  const limpio = await apiRequest('/cart/sync', {
    method: 'POST', token: vendedor.token,
    body: { items: [{ product_id: ajeno.id, quantity: 3 }] },
  });
  assert(limpio.status === 200 && carritoDe(vendedor.id) === `${ajeno.id}x3`,
    `sin la propia el carrito ajeno no se sincronizo: ${carritoDe(vendedor.id)}`);

  // --- C. El carrito heredado, el que ya esta contaminado -----------------
  // Se escribe donde vive la aplicacion, con sus modelos, porque por la API ya
  // no se puede: es exactamente el carrito de alguien que lo armo antes de que
  // existiera la regla.
  inyectarEnElCarrito(vendedor.email, propioProducto.id, 1);
  const carritoHeredado = carritoDe(vendedor.id);
  assert(carritoHeredado.includes(propioProducto.id),
    `no se pudo inyectar el carrito heredado: ${carritoHeredado}`);

  const destino = querySql('SELECT id FROM localities ORDER BY id LIMIT 1');
  const compraPropia = {
    shipping_address: 'Calle Falsa 123',
    shipping_locality_id: destino,
    shipping_postal_code: '7000',
    shipping_decisions: [
      { seller_id: vendedor.id, mode: 'self' },
      { seller_id: ajeno.seller.id, mode: 'self' },
    ],
    payment_decisions: [
      { seller_id: vendedor.id, method: 'transfer' },
      { seller_id: ajeno.seller.id, method: 'transfer' },
    ],
  };

  const ordenesAntes = ordenesDe(vendedor.id);
  const pagosAntes = pagos();
  const avisosAntes = avisosDe(vendedor.id);
  const reservadoAntes = reservado(propioProducto.id);

  // Los medios de pago no presentan a la propia cuenta como contraparte: antes
  // devolvia el CBU del vendedor para que se transfiriera a si mismo.
  const opciones = await exigir409('GET /orders/payment-options', () =>
    apiRequest('/orders/payment-options', { token: vendedor.token }));
  assert(NO_ES_TUYO.test(opciones), `payment-options: motivo inesperado: ${opciones}`);
  assert(/[Qq]uitala del carrito/.test(opciones),
    `payment-options: la publicacion ya esta en el carrito y el mensaje no dice que hay que `
    + `sacarla: ${opciones}`);

  for (const ruta of ['/orders/checkout/transfer', '/orders/checkout']) {
    const motivo = await exigir409(`POST ${ruta}`, () => apiRequest(ruta, {
      method: 'POST', token: vendedor.token, body: compraPropia,
    }));
    assert(NO_ES_TUYO.test(motivo), `${ruta}: motivo inesperado: ${motivo}`);
    assert(/[Qq]uitala del carrito/.test(motivo),
      `${ruta}: el mensaje no dice que hay que sacarla del carrito: ${motivo}`);
  }

  assert(ordenesDe(vendedor.id) === ordenesAntes,
    `el checkout con carrito heredado creo ordenes: ${ordenesAntes} -> ${ordenesDe(vendedor.id)}`);
  assert(ordenesIncestuosas() === 0,
    `quedaron ${ordenesIncestuosas()} ordenes donde comprador y vendedor son la misma cuenta`);
  assert(pagos() === pagosAntes, 'el checkout rechazado escribio una intencion de pago');
  assert(avisosDe(vendedor.id) === avisosAntes, 'el checkout rechazado dejo avisos');
  assert(reservado(propioProducto.id) === reservadoAntes,
    'el checkout rechazado reservo stock de la publicacion propia');
  assert(estadoDelCarrito(vendedor.id) === 'ACTIVE',
    'el carrito quedo convertido: la persona no puede sacar el item que sobra');
  assert(carritoDe(vendedor.id) === carritoHeredado,
    `el rechazo cambio el carrito heredado: ${carritoDe(vendedor.id)}`);

  // Y al quitar la propia, lo ajeno sigue su camino normal.
  await apiRequest('/cart/sync', {
    method: 'POST', token: vendedor.token,
    body: { items: [{ product_id: ajeno.id, quantity: 3 }] },
  });
  const yaSinLaPropia = await apiRequest('/orders/payment-options', { token: vendedor.token });
  assert(yaSinLaPropia.status === 200
    && yaSinLaPropia.data.some((o) => o.seller_id === ajeno.seller.id),
    'quitada la propia, el pedido ajeno dejo de tener formas de pago');
  assert(!yaSinLaPropia.data.some((o) => o.seller_id === vendedor.id),
    'las formas de pago siguen ofreciendo a la propia cuenta como contraparte');

  // --- D. No depende del rol ----------------------------------------------
  // Admin publica en el seed, asi que se prueba con lo que ya tiene. El
  // transportista no publica nada, asi que publica ahora por la API real y
  // despues se retira lo publicado.
  // Y de paso se mide lo otro que el rechazo no puede hacer: CREAR un carrito.
  // El admin no compra en toda la suite, asi que no tiene ninguno; si algun dia
  // lo tuviera, esta afirmacion lo dice y hay que buscar otra cuenta sin carrito.
  assert(carritosDe(admin.id) === 0,
    `el admin ya tiene ${carritosDe(admin.id)} carritos: este caso necesita una cuenta `
    + 'sin carrito para poder afirmar que el rechazo no crea uno');
  const negadoAlAdmin = await exigir409('POST /cart/items como admin', () =>
    apiRequest('/cart/items', {
      method: 'POST', token: admin.token,
      body: { product_id: propioDelAdmin.id, quantity: 1 },
    }));
  assert(NO_ES_TUYO.test(negadoAlAdmin), `admin: motivo inesperado: ${negadoAlAdmin}`);
  assert(carritosDe(admin.id) === 0,
    'el rechazo le creo un carrito al admin, que no tenia ninguno');

  const [categoria] = queryRows(`
    SELECT id FROM categories WHERE is_active = true AND is_service = false
    ORDER BY name LIMIT 1
  `);
  const delFletero = await apiRequest('/products', {
    method: 'POST', token: fletero.token,
    body: {
      name: `Smoke publicacion del transportista ${Date.now()}`,
      description: 'Publicacion de prueba para comprobar que la regla mira la identidad.',
      category_id: categoria[0],
      price: 1000,
      stock: 5,
      unit: 'unidad',
      locality_id: destino,
      publication_type: 'producto',
    },
  });
  try {
    // El transportista tampoco compra en toda la suite, asi que llega hasta
    // aca sin carrito. Eso lo vuelve la unica identidad con la que se puede
    // afirmar que un rechazo no CREA uno, y se prueba con los dos endpoints:
    // `/items` y `/sync` no comparten el codigo que decide cuando nace el
    // carrito, asi que medir uno no dice nada del otro. Antes se medía sólo
    // `/items`, y por eso este borde de `/sync` pasó sin verse.
    assert(carritosDe(fletero.id) === 0,
      `el transportista ya tiene ${carritosDe(fletero.id)} carritos: este caso necesita `
      + 'una cuenta sin ninguno para poder afirmar que el rechazo no crea uno');

    const negadoAlFletero = await exigir409('POST /cart/items como transportista', () =>
      apiRequest('/cart/items', {
        method: 'POST', token: fletero.token,
        body: { product_id: delFletero.data.id, quantity: 1 },
      }));
    assert(NO_ES_TUYO.test(negadoAlFletero),
      `transportista: motivo inesperado: ${negadoAlFletero}`);
    assert(carritosDe(fletero.id) === 0 && itemsDe(fletero.id) === 0,
      `/cart/items rechazado le dejo ${carritosDe(fletero.id)} carritos y `
      + `${itemsDe(fletero.id)} items a una cuenta que no tenia ninguno`);

    const syncDelFletero = await exigir409('POST /cart/sync como transportista sin carrito', () =>
      apiRequest('/cart/sync', {
        method: 'POST', token: fletero.token,
        body: { items: [{ product_id: delFletero.data.id, quantity: 1 }] },
      }));
    assert(NO_ES_TUYO.test(syncDelFletero),
      `transportista por sync: motivo inesperado: ${syncDelFletero}`);
    assert(carritosDe(fletero.id) === 0 && itemsDe(fletero.id) === 0,
      `/cart/sync rechazado le dejo ${carritosDe(fletero.id)} carritos y `
      + `${itemsDe(fletero.id)} items a una cuenta que no tenia ninguno: el freno tiene `
      + 'que ir ANTES de obtener o crear el carrito, no despues');

    // Y esto vale para CUALQUIER rechazo de sync, no solo el de publicacion
    // propia: al mover la creacion del carrito despues de validar, un sync que
    // rebota por otra razon tampoco deja una fila.
    const inexistente = await expectApiError(400, () => apiRequest('/cart/sync', {
      method: 'POST', token: fletero.token,
      body: { items: [{ product_id: 'no-existe-este-id', quantity: 1 }] },
    }));
    assert(/ya no existe/i.test(inexistente), `sync inexistente: motivo raro: ${inexistente}`);
    assert(carritosDe(fletero.id) === 0,
      `un sync rechazado por otra razon dejo ${carritosDe(fletero.id)} carritos`);

    // Lo que NO cambia, y se afirma para que sea deliberado: un sync VALIDO y
    // vacio sigue representando un carrito vacio. Mover la creacion del
    // carrito no volvio ambiguo ese caso; sigue naciendo, porque hay algo que
    // representar.
    const vacio = await apiRequest('/cart/sync', {
      method: 'POST', token: fletero.token, body: { items: [] },
    });
    assert(vacio.status === 200 && vacio.data.total_items === 0,
      `un sync vacio valido respondio ${vacio.status} con ${vacio.data?.total_items} items`);
    assert(carritosDe(fletero.id) === 1 && itemsDe(fletero.id) === 0,
      `un sync vacio valido dejo ${carritosDe(fletero.id)} carritos y `
      + `${itemsDe(fletero.id)} items; se esperaba 1 carrito vacio`);
  } finally {
    // La cuenta vuelve a no tener carrito, que es como llego, para que el caso
    // se pueda repetir sobre la misma base.
    vaciarCarritosDe(fletero.email);
    await apiRequest(`/products/${delFletero.data.id}`, {
      method: 'DELETE', token: fletero.token,
    });
  }

  // --- E. La pantalla, en las tres que dibujan tarjetas -------------------
  // Dos comprobaciones distintas y a proposito:
  //
  // 1. EXHAUSTIVA y sin dirigir: en Inicio, Mercado y Servicios se mira TODA
  //    tarjeta dibujada y se exige que el rotulo coincida con de quien es la
  //    publicacion. Es mas fuerte que «hay al menos una»: no hay tarjeta que se
  //    escape.
  // 2. DIRIGIDA: en el Mercado se busca por nombre una publicacion propia y una
  //    ajena. Eso no depende de que haya quedado en la vista previa, asi que la
  //    prueba no se vuelve vacia ni se pone roja porque el catalogo cambio de
  //    composicion —en la suite completa los casos anteriores publican decenas
  //    de productos y tapan el seed—.
  const datosDe = new Map();
  for (const p of publicaciones) {
    // Dos publicaciones distintas con el MISMO nombre no permiten decidir de
    // quien es la tarjeta que se ve. En vez de afirmar cualquier cosa, ese
    // nombre queda marcado y sus tarjetas no se cuentan.
    const anterior = datosDe.get(p.name);
    if (anterior !== undefined) {
      if (!anterior || anterior.dueno !== p.seller?.id) datosDe.set(p.name, null);
    } else {
      datosDe.set(p.name, p.seller?.id
        ? { dueno: p.seller.id, precio: Number(p.price) }
        : null);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const vistas = [];
  const detallesRevisados = [];
  let propiasTotales = 0;
  let ajenasTotales = 0;
  let sinPrecioTotales = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const enElCarrito = () => page.evaluate(() => {
      for (const clave of Object.keys(window.localStorage)) {
        if (!/cart|carrito/i.test(clave)) continue;
        try {
          const guardado = JSON.parse(window.localStorage.getItem(clave) || 'null');
          if (Array.isArray(guardado)) return guardado.length;
          if (guardado && Array.isArray(guardado.items)) return guardado.items.length;
        } catch { /* si no es JSON no es el carrito */ }
      }
      return 0;
    });

    // Recorre las tarjetas que haya en pantalla y exige que cada rotulo diga la
    // verdad sobre de quien es esa publicacion. Devuelve cuantas de cada una.
    const revisarLoQueSeVe = async (donde) => {
      const tarjetas = page.locator('article[class*="card"]');
      const cuantas = await tarjetas.count();
      let propias = 0;
      let ajenas = 0;
      let sinPrecio = 0;
      for (let i = 0; i < cuantas; i += 1) {
        const tarjeta = tarjetas.nth(i);
        const titulo = (await tarjeta.locator('h3').first().innerText()).trim();
        const datos = datosDe.get(titulo);
        if (!datos) continue;  // nombre repetido o publicacion que no esta en el catalogo
        // Se espera a que la tarjeta tenga sus botones antes de leerlos. Sin
        // esto se la puede leer entre el titulo y el pie y salen cero rotulos,
        // que no es lo que ofrece: es lo que todavia no dibujo.
        await tarjeta.getByRole('button').first().waitFor({ timeout: 20_000 });
        const rotulos = (await tarjeta.getByRole('button').allInnerTexts()).map((t) => t.trim());
        if (datos.dueno !== vendedor.id) {
          ajenas += 1;
          assert(!rotulos.includes('Tu publicación'),
            `en ${donde}, «${titulo}» no es del vendedor y dice «Tu publicación»`);
        } else if (datos.precio > 0) {
          propias += 1;
          assert(rotulos.includes('Tu publicación'),
            `en ${donde}, «${titulo}» es del vendedor y ofrece ${JSON.stringify(rotulos)}`);
          assert(await tarjeta.getByRole('button', { name: 'Tu publicación' }).first().isDisabled(),
            `en ${donde}, «Tu publicación» de «${titulo}» se puede apretar`);
        } else {
          // Propia y SIN precio publicado: sigue diciendo «Solicitar cotizacion»
          // y esta bien que lo diga. Pedir presupuesto no crea compra, orden ni
          // carrito, asi que ese camino queda como estaba. Se afirma para que la
          // excepcion sea deliberada y no un olvido.
          sinPrecio += 1;
          assert(!rotulos.includes('Tu publicación')
            && rotulos.includes('Solicitar cotización'),
            `en ${donde}, la propia sin precio «${titulo}» ofrece ${JSON.stringify(rotulos)}`);
        }
      }
      return { propias, ajenas, sinPrecio };
    };

    // Abre el detalle de una tarjeta propia y exige lo mismo que en la tarjeta:
    // los dos caminos llevan a la misma accion y tienen que decir lo mismo.
    const revisarElDetalle = async (donde) => {
      const propia = page.locator('article[class*="card"]')
        .filter({ has: page.getByRole('button', { name: 'Tu publicación' }) }).first();
      if (!await propia.count()) return false;
      await propia.locator('h3').click();
      await page.locator('#detalle-titulo').waitFor({ timeout: 20_000 });
      const publicacion = (await page.locator('#detalle-titulo').innerText()).trim();
      const boton = page.getByRole('dialog')
        .getByRole('button', { name: 'Tu publicación' }).first();
      assert(await boton.count(),
        `en ${donde}, el detalle de «${publicacion}» no dice «Tu publicación»: `
        + JSON.stringify(await page.getByRole('dialog').getByRole('button').allInnerTexts()));
      assert(await boton.isDisabled(),
        `en ${donde}, el detalle de «${publicacion}» deja apretar «Tu publicación»`);
      await page.getByRole('button', { name: 'Cerrar' }).first().click();
      await page.locator('article[class*="card"]').first().waitFor({ timeout: 20_000 });
      detallesRevisados.push(donde);
      return true;
    };

    try {
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Ingresar', exact: true }).first().click();
      await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 20_000 });
      await page.getByPlaceholder('tu@email.com').fill(vendedor.email);
      await page.getByPlaceholder('••••••••').fill('vendedor123');
      await page.locator('[class*="_submitButton_"][type="submit"]').click();
      await page.getByRole('button', { name: 'Mi cuenta' }).first().waitFor({ timeout: 25_000 });

      // 1. Las tres pantallas, enteras, tal como quedan.
      for (const seccion of ['Inicio', 'Mercado', 'Servicios']) {
        await page.locator('header').first()
          .getByRole('button', { name: seccion, exact: true }).first().click();
        await page.locator('article[class*="card"]').first().waitFor({ timeout: 25_000 });
        const { propias, ajenas, sinPrecio } = await revisarLoQueSeVe(seccion);
        propiasTotales += propias;
        ajenasTotales += ajenas;
        sinPrecioTotales += sinPrecio;
        await revisarElDetalle(seccion);
        vistas.push(`${seccion}:${propias}p/${ajenas}a${sinPrecio ? `/${sinPrecio} a cotizar` : ''}`);
      }

      // 2. Y en el Mercado, buscando cada una por su nombre, que no depende de
      //    lo que haya quedado arriba en la grilla.
      for (const [publicacion, mia] of [[propioProducto, true], [ajeno, false]]) {
        await page.goto(
          `${FRONTEND_URL}/?section=marketplace&q=${encodeURIComponent(publicacion.name)}`,
          { waitUntil: 'domcontentloaded' });
        const tarjeta = page.locator('article[class*="card"]')
          .filter({ has: page.getByRole('heading', { name: publicacion.name, exact: true }) })
          .first();
        await tarjeta.waitFor({ timeout: 25_000 });
        // Los rotulos se leen hasta que haya alguno, no una sola vez.
        //
        // `tarjeta` es un localizador: se vuelve a resolver en CADA uso. Si la
        // grilla se rearma entre la espera y la lectura —y se rearma, porque la
        // busqueda por nombre llega por la red—, la segunda resolucion puede
        // caer sobre un nodo a medio dibujar y devolver cero botones. Eso no es
        // «la tarjeta no ofrece nada»: es «todavia no la dibujo». Medido: dos
        // rojos de este caso en ocho corridas completas, siempre con `[]`.
        //
        // `esperarA` es la primitiva que ya usa el resto de la suite: pregunta
        // cada 50 ms y se rinde a los 25 s con un mensaje que dice que pasaba.
        let rotulos = [];
        await esperarA(async () => {
          rotulos = (await tarjeta.getByRole('button').allInnerTexts()).map((t) => t.trim());
          return rotulos.length > 0;
        }, `los botones de la tarjeta de «${publicacion.name}» en el Mercado`, 25_000);
        assert(rotulos.includes('Tu publicación') === mia,
          `buscando «${publicacion.name}» —${mia ? 'propia' : 'ajena'}— la tarjeta ofrece `
          + JSON.stringify(rotulos));
        if (mia) {
          propiasTotales += 1;
          assert(await tarjeta.getByRole('button', { name: 'Tu publicación' }).first().isDisabled(),
            `buscada por nombre, «Tu publicación» de «${publicacion.name}» se puede apretar`);
          assert(await revisarElDetalle('Mercado buscado'),
            `buscada por nombre, «${publicacion.name}» no abrio su detalle`);
        } else {
          ajenasTotales += 1;
          assert(rotulos.some((r) => /Agregar|Contratar|Ingresar para continuar/.test(r)),
            `la publicacion ajena «${publicacion.name}» perdio su accion: ${JSON.stringify(rotulos)}`);
        }
      }

      // Mirar publicaciones propias no puede haber tocado el carrito.
      const quedo = await enElCarrito();
      assert(quedo === 0, `recorrer las publicaciones propias dejo ${quedo} en el carrito`);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }

  assert(propiasTotales > 0 && ajenasTotales > 0,
    `se revisaron ${propiasTotales} tarjetas propias y ${ajenasTotales} ajenas: `
    + 'la comparacion no dice nada');
  assert(detallesRevisados.length > 0, 'no se llego a revisar ningun detalle propio');

  // --- F. Y recien ahora, la forma del codigo ------------------------------
  // Va al final, igual que en el caso 139: lo que tiene que fallar primero es
  // el recorrido, no el archivo. Lo que se afirma aca es que los cuatro
  // caminos que pueden escribir comparten UNA regla y no cuatro copias que se
  // van a separar; la que se olvide seria la que toca plata.
  const modulo = readFileSync('backend/app/services/propiedad.py', 'utf8');
  assert(/def es_propia\(/.test(modulo) && /HTTPException/.test(modulo),
    'la regla compartida no vive en app/services/propiedad.py');
  for (const archivo of ['backend/app/api/cart.py',
                         'backend/app/api/orders.py',
                         'backend/app/services/checkout.py']) {
    const texto = readFileSync(archivo, 'utf8');
    assert(/propiedad\.exigir_/.test(texto),
      `${archivo} no aplica la regla compartida de publicacion propia`);
  }

  await apiRequest('/cart', { method: 'DELETE', token: vendedor.token });

  return `El servidor responde 409 a /cart/items y /cart/sync con una publicacion propia `
    + `—producto y servicio—, no toca el carrito anterior y rechaza el sync mixto entero. `
    + `Un carrito heredado contaminado hace que payment-options y los dos checkouts respondan `
    + `409 antes de crear orden, reservar stock, escribir pago o avisar, y el carrito queda `
    + `activo; quitada la publicacion propia, la ajena sigue su camino. La regla no mira el rol: `
    + `admin y transportista reciben el mismo 409 con lo suyo. En pantalla se revisaron `
    + `${propiasTotales} tarjetas propias y ${ajenasTotales} ajenas (${vistas.join(', ')}), mas `
    + `otras ${sinPrecioTotales} propias sin precio publicado, que siguen diciendo «Solicitar `
    + `cotización» porque pedir presupuesto no crea compra. Tarjeta y detalle de una publicacion `
    + `propia dicen «Tu publicación» y el boton no se puede apretar —el detalle se abrio en `
    + `${detallesRevisados.join(', ')}—, y el carrito queda en cero. Ordenes con comprador igual `
    + `a vendedor: 0`;
});

await runCase(141, 'Una transferencia sin comprobante se retoma desde Mis compras', async () => {
  // El comprador confirma por transferencia, cierra el checkout sin adjuntar y
  // se va. La orden queda —bien— esperando el comprobante, pero «Mis compras»
  // solo le ofrecia CANCELAR: los datos bancarios y la carga del comprobante
  // vivian unicamente adentro del checkout, que ya no existe. O sea que la
  // unica forma de pagar una compra que ya esta hecha era no haber cerrado esa
  // ventana.
  //
  // Todo lo que hace falta ya lo manda el Backend en la orden del comprador
  // —`seller_cbu`, `seller_alias_bancario`, `seller_bank_holder`,
  // `payment_method`, `order_number`— y la ruta de carga ya existe. Esto
  // consume ese contrato; no crea otro.

  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const entrada = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const comprador = {
    token: entrada.data.access_token,
    refresco: entrada.data.refresh_token,
    id: entrada.data.user.id,
  };
  await apiRequest('/cart', { method: 'DELETE', token: comprador.token });

  const producto = productoConStock(vendedor.id, 1);
  const [[nombreDelProducto]] = queryRows(
    `SELECT name FROM products WHERE id = ${sqlLiteral(producto)}`);

  // Los datos bancarios del vendedor, para poder devolverlos como estaban.
  const [bancoOriginal] = queryRows(`
    SELECT COALESCE(cbu, ''), COALESCE(alias_bancario, ''), 'fin'
    FROM users WHERE id = ${sqlLiteral(vendedor.id)}`);
  assert(bancoOriginal[0] || bancoOriginal[1],
    'el vendedor del seed no tiene CBU ni alias: sin eso no hay transferencia que retomar');

  const ordenesDelComprador = () => queryRows(`
    SELECT order_number, status::text, COALESCE(transfer_receipt_url, ''), 'fin'
    FROM orders WHERE buyer_id = ${sqlLiteral(comprador.id)}
    ORDER BY created_at DESC`);

  const antes = ordenesDelComprador().length;
  const taller = mkdtempSync(`${tmpdir()}/topgreen-comprobante-`);
  const comprobante = `${taller}/comprobante.png`;
  writeFileSync(comprobante, RECIBO_PNG);

  const browser = await chromium.launch({ headless: true });
  let bancoCambiado = false;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
      window.localStorage.removeItem('agromarket_cart');
    }, { a: comprador.token, r: comprador.refresco });
    const page = await context.newPage();

    const abrirCompras = async () => {
      await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
      await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor({ timeout: 15_000 });
      await page.getByRole('button', { name: /Mis Compras/i }).click();
      await page.getByRole('heading', { name: 'Mis Compras' }).waitFor({ timeout: 15_000 });
    };

    try {
      // --- A. Comprar por transferencia y CERRAR sin adjuntar --------------
      await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
      await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
      const buscador = page.getByLabel('Buscar en el mercado');
      await buscador.fill(nombreDelProducto);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: nombreDelProducto, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await accionDeLaTarjeta(page, nombreDelProducto).click();

      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de env/i }).waitFor({ timeout: 15_000 });
      await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0141');
      await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 141');
      await page.getByPlaceholder('2000').fill('2700');
      await elegirDestino(page, 'Pergamino');
      await resolverTrasladoPropio(page);
      await page.locator('form:has(h2) button[type="submit"]').click();
      await elegirTransferencia(page);
      await page.getByRole('button', { name: /Confirmar y crear las órdenes/ }).click();
      await page.getByRole('heading', { name: /Tus órdenes/ }).waitFor({ timeout: 25_000 });

      // Y se va sin adjuntar nada, que es el momento que el defecto castigaba.
      await page.getByRole('button', { name: 'Cerrar' }).first().click();

      const creadas = ordenesDelComprador();
      assert(creadas.length === antes + 1,
        `se esperaba una orden nueva y hay ${creadas.length - antes}`);
      const [numero, estadoInicial, comprobanteInicial] = creadas[0];
      assert(estadoInicial === 'AWAITING_TRANSFER_RECEIPT',
        `la orden quedo en ${estadoInicial} y no esperando comprobante`);
      assert(comprobanteInicial === '',
        'la orden nacio con comprobante: el caso no probaria nada');

      // --- B. Recargar y volver: lo que el comprador necesita para pagar ---
      // Recarga COMPLETA a proposito: lo que se prueba es que la continuidad
      // no dependa de que el checkout siga vivo en memoria.
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await abrirCompras();
      const tarjeta = page.locator('[class*="_orderCard_"]').filter({ hasText: numero }).first();
      await tarjeta.waitFor({ timeout: 20_000 });

      const leer = async () => (await tarjeta.textContent() || '').replace(/\s+/g, ' ');
      let visto = await leer();

      assert(/Esperando Comprobante/i.test(visto),
        `la orden no se ve esperando comprobante: «${visto.slice(0, 200)}»`);
      // El titular y a donde va la plata, del SNAPSHOT de la orden.
      assert(visto.includes(bancoOriginal[0]) || visto.includes(bancoOriginal[1]),
        `Mis compras no muestra ni el CBU ni el alias del vendedor: «${visto.slice(0, 300)}»`);
      // El numero de orden como concepto: es lo que le permite al vendedor
      // reconocer el pago en su resumen.
      assert(visto.includes(numero),
        `Mis compras no dice que el concepto es ${numero}: «${visto.slice(0, 300)}»`);
      // Y el total, que es cuanto hay que transferir.
      const [[totalEnLaBase]] = queryRows(
        `SELECT total_amount FROM orders WHERE order_number = ${sqlLiteral(numero)}`);
      const enPesos = Number(totalEnLaBase).toLocaleString('es-AR', {
        minimumFractionDigits: 0, maximumFractionDigits: 0,
      });
      assert(visto.includes(enPesos),
        `Mis compras no muestra el total ${enPesos}: «${visto.slice(0, 300)}»`);
      // Y tiene por donde adjuntar.
      const entradaDeArchivo = tarjeta.locator('input[type="file"]');
      assert(await entradaDeArchivo.count() === 1,
        `la orden no ofrece adjuntar el comprobante: «${visto.slice(0, 300)}»`);

      // --- C. El snapshot esta congelado -----------------------------------
      // El vendedor cambia sus datos bancarios DESPUES de la orden. Lo que el
      // comprador tiene que seguir viendo es a donde acordo transferir, no a
      // donde el vendedor cobra hoy: si cambiara, pagaria a una cuenta que esa
      // orden nunca declaro.
      const cbuNuevo = '0000009000000000000999';
      await apiRequest('/auth/me', {
        method: 'PATCH', token: vendedor.token,
        body: { cbu: cbuNuevo, alias_bancario: 'alias.cambiado.despues' },
      });
      bancoCambiado = true;

      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await abrirCompras();
      const tarjetaOtraVez = page.locator('[class*="_orderCard_"]')
        .filter({ hasText: numero }).first();
      await tarjetaOtraVez.waitFor({ timeout: 20_000 });
      const conElCambio = (await tarjetaOtraVez.textContent() || '').replace(/\s+/g, ' ');
      assert(!conElCambio.includes(cbuNuevo) && !conElCambio.includes('alias.cambiado.despues'),
        `Mis compras mostro los datos bancarios de HOY y no los de la orden: «${conElCambio.slice(0, 300)}»`);
      assert(conElCambio.includes(bancoOriginal[0]) || conElCambio.includes(bancoOriginal[1]),
        `se perdio el snapshot bancario de la orden: «${conElCambio.slice(0, 300)}»`);

      // --- D. Adjuntar, y que la fuente real lo diga ------------------------
      await tarjetaOtraVez.locator('input[type="file"]').setInputFiles(comprobante);
      await tarjetaOtraVez.getByRole('button', { name: /Enviar comprobante/i }).click();

      await esperarA(async () => {
        const fila = ordenesDelComprador().find((o) => o[0] === numero);
        return fila && fila[1] === 'TRANSFER_RECEIPT_SUBMITTED' && fila[2] !== '';
      }, `la orden ${numero} no quedo con el comprobante enviado`, 25_000);

      // Y la pantalla tiene que decir lo mismo que la base, sin quedarse en el
      // estado viejo ni seguir pidiendo un comprobante que ya se mando.
      await esperarA(async () => /Comprobante a Revisar/i.test(
        (await tarjetaOtraVez.textContent() || '').replace(/\s+/g, ' ')),
      `la tarjeta de ${numero} no paso a «Comprobante a Revisar»`, 25_000);

      visto = (await tarjetaOtraVez.textContent() || '').replace(/\s+/g, ' ');
      assert(!/Esperando Comprobante/i.test(visto),
        `sigue diciendo que espera el comprobante: «${visto.slice(0, 200)}»`);
      assert(await tarjetaOtraVez.locator('input[type="file"]').count() === 0,
        'sigue ofreciendo adjuntar otro comprobante como si faltara');

      return `Confirmada por transferencia y cerrado el checkout sin adjuntar, la orden ${numero} `
        + 'queda esperando comprobante; despues de una recarga completa, «Mis compras» muestra '
        + 'titular, CBU/alias del snapshot, el numero de orden como concepto y el total, y deja '
        + 'adjuntar. Cambiar los datos bancarios del vendedor despues de la orden no cambia lo '
        + 'que ve el comprador. Al adjuntar, la base pasa a TRANSFER_RECEIPT_SUBMITTED con su '
        + 'archivo y la pantalla dice «Comprobante a Revisar» sin volver a pedirlo';
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
    rmSync(taller, { recursive: true, force: true });
    if (bancoCambiado) {
      // El vendedor vuelve a como estaba: los otros casos cuentan con eso.
      await apiRequest('/auth/me', {
        method: 'PATCH', token: vendedor.token,
        body: { cbu: bancoOriginal[0], alias_bancario: bancoOriginal[1] },
      });
    }
  }
});

await runCase(142, 'Una copia local de carrito inservible no voltea la aplicacion', async () => {
  // `CartContext` leia `agromarket_cart` y hacia `JSON.parse` sin captura. Con
  // un valor que no fuera un carrito, la excepcion subia hasta el
  // `ErrorBoundary`: la pantalla entera quedaba en «Ocurrio un error», y
  // «Recarga la pagina» volvia a caer, porque el dato seguia guardado. No habia
  // manera de salir sin vaciar el almacenamiento a mano.
  //
  // El caso mira lo que ve una persona —si el catalogo esta o no esta— y no el
  // texto de ninguna implementacion. Y comprueba las tres cosas juntas: que lo
  // inservible se descarte, que lo valido se conserve, y que recuperar la copia
  // local no toque el carrito del servidor.

  const entrada = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const comprador = {
    token: entrada.data.access_token,
    refresco: entrada.data.refresh_token,
    id: entrada.data.user.id,
  };
  const vendedor = (await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  })).data.user.id;

  // Una clave ajena al carrito, para probar que la recuperacion descarta ESA y
  // ninguna otra: los tokens y las preferencias no son asunto del carrito.
  const CLAVE_AJENA = 'topgreen_preferencia_smoke';
  const VALOR_AJENO = 'no me toques';

  const INSERVIBLES = [
    ['JSON malformado', '{no es json'],
    ['raiz que no es un arreglo', '{"items":[{"product_id":"x","quantity":1}]}'],
    ['arreglo con un item sin publicacion', '[{"quantity":2}]'],
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    const nuevaPagina = async (guardado) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addInitScript(({ v, a, r, ca, va }) => {
        // Ojo: esto corre en CADA navegacion, tambien en la recarga. Por eso el
        // carrito solo se escribe cuando se pide; si se reescribiera siempre, la
        // recarga taparia lo que hizo la aplicacion y la prueba se mentiria sola.
        if (v !== null) window.localStorage.setItem('agromarket_cart', v);
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
        window.localStorage.setItem(ca, va);
      }, {
        v: guardado, a: comprador.token, r: comprador.refresco,
        ca: CLAVE_AJENA, va: VALOR_AJENO,
      });
      const page = await context.newPage();
      return { context, page };
    };

    const seCayo = async (page) => await page
      .getByRole('heading', { name: /Ocurri[oó] un error/i }).count() > 0;
    const hayCatalogo = async (page) => await page.locator('#catalog-category').count() > 0;
    const loGuardado = (page) => page.evaluate((ajena) => ({
      carrito: window.localStorage.getItem('agromarket_cart'),
      ajena: window.localStorage.getItem(ajena),
      acceso: window.localStorage.getItem('access_token'),
    }), CLAVE_AJENA);
    const cuerpo = async (page) => ((await page.locator('body').textContent()) || '')
      .replace(/\s+/g, ' ');

    // --- A. lo inservible se descarta y la aplicacion sigue en pie ----------
    for (const [etiqueta, valor] of INSERVIBLES) {
      const { context, page } = await nuevaPagina(valor);
      try {
        await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
        // Sin espera fija: o aparece el catalogo, o aparece el cartel de caida.
        await esperarA(async () => await hayCatalogo(page) || await seCayo(page),
          `la pantalla no resolvio con ${etiqueta}`, 25_000);

        assert(!(await seCayo(page)),
          `con ${etiqueta} la aplicacion se cayo: «${(await cuerpo(page)).slice(0, 160)}»`);
        assert(await hayCatalogo(page),
          `con ${etiqueta} el catalogo no esta y no hay como navegar`);

        const quedo = await loGuardado(page);
        assert(quedo.carrito === null || quedo.carrito === '[]',
          `con ${etiqueta} la copia dañada sigue guardada: ${JSON.stringify(quedo.carrito)}`);
        assert(quedo.ajena === VALOR_AJENO,
          `con ${etiqueta} se borro una clave que no era el carrito: ${JSON.stringify(quedo.ajena)}`);
        assert(quedo.acceso === comprador.token,
          `con ${etiqueta} se perdio la sesion al recuperar el carrito`);

        // El carrito arranca vacio y se puede abrir sin romper nada.
        await page.getByRole('button', { name: /Carrito/ }).first().click();
        await page.getByRole('heading', { name: 'Mi carrito (0)' })
          .waitFor({ state: 'visible', timeout: 15_000 });
        assert((await cuerpo(page)).includes('Tu carrito está vacío'),
          `con ${etiqueta} el carrito no arranca vacio: «${(await cuerpo(page)).slice(0, 160)}»`);

        // Y la segunda mitad del defecto: recargar ya no repite la caida.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await esperarA(async () => await hayCatalogo(page) || await seCayo(page),
          `la recarga con ${etiqueta} no resolvio`, 25_000);
        assert(!(await seCayo(page)), `con ${etiqueta} la recarga vuelve a caer`);
      } finally {
        await context.close();
      }
    }

    // --- B. un carrito valido se conserva tal cual --------------------------
    // Se arma por el camino real, agregando desde el catalogo, y despues se
    // recarga la pagina entera. Lo guardado tiene que quedar identico y el
    // carrito tiene que seguir mostrando su publicacion.
    const producto = productoConStock(vendedor, 2);
    const [[nombreDelProducto]] = queryRows(
      `SELECT name FROM products WHERE id = ${sqlLiteral(producto)}`);
    let resumenValido = '';
    {
      const { context, page } = await nuevaPagina(null);
      try {
        await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
        await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 25_000 });

        const buscador = page.getByLabel('Buscar en el mercado');
        await buscador.fill(nombreDelProducto);
        await buscador.press('Enter');
        await page.getByRole('heading', { name: nombreDelProducto, exact: true, level: 3 })
          .waitFor({ state: 'visible', timeout: 20_000 });
        await accionDeLaTarjeta(page, nombreDelProducto).click();

        await esperarA(async () => {
          const guardado = (await loGuardado(page)).carrito;
          return Boolean(guardado) && guardado.includes(producto);
        }, 'el producto agregado no llego a la copia local', 15_000);
        const antes = (await loGuardado(page)).carrito;

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 25_000 });
        await esperarA(async () => (await loGuardado(page)).carrito !== null,
          'despues de recargar no quedo copia local ninguna', 15_000);

        const despues = (await loGuardado(page)).carrito;
        assert(despues === antes,
          `un carrito valido no sobrevivio la recarga: antes ${antes.length} caracteres, `
          + `despues ${JSON.stringify((despues || '').slice(0, 90))}`);

        // Y se ve, que es lo que le importa a quien compra.
        await page.getByRole('button', { name: /Carrito/ }).first().click();
        await page.getByRole('heading', { name: 'Mi carrito (1)' })
          .waitFor({ state: 'visible', timeout: 15_000 });
        assert((await cuerpo(page)).includes(nombreDelProducto),
          `el carrito no muestra «${nombreDelProducto}» despues de recargar`);
        resumenValido = `«${nombreDelProducto}» sobrevive con los mismos ${antes.length} caracteres`;
      } finally {
        await context.close();
      }
    }

    // --- C. el carrito del servidor no se toca ------------------------------
    // Con sesion y con un carrito en el servidor, recuperar una copia local
    // dañada no puede mandar un `sync` vacio: eso borraria del servidor lo que
    // esa cuenta tenia, y el servidor es la autoridad al entrar al checkout.
    let resumenServidor = '';
    {
      await apiRequest('/cart', { method: 'DELETE', token: comprador.token });
      await apiRequest('/cart/items', {
        method: 'POST', token: comprador.token, body: { product_id: producto, quantity: 2 },
      });
      const enElServidor = () => queryRows(`
        SELECT ci.product_id, ci.quantity::text
        FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
        WHERE c.user_id = ${sqlLiteral(comprador.id)}
        ORDER BY ci.product_id`);
      const antes = JSON.stringify(enElServidor());
      assert(antes.includes(producto), `el carrito del servidor no quedo armado: ${antes}`);

      const { context, page } = await nuevaPagina('{no es json');
      const sincronizaciones = [];
      page.on('request', (peticion) => {
        if (peticion.url().includes('/cart/sync')) sincronizaciones.push(peticion.postData() || '');
      });
      try {
        await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
        await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 25_000 });
        await page.getByRole('button', { name: /Carrito/ }).first().click();
        await page.getByRole('heading', { name: 'Mi carrito (0)' })
          .waitFor({ state: 'visible', timeout: 15_000 });

        const despues = JSON.stringify(enElServidor());
        assert(despues === antes,
          `recuperar la copia local cambio el carrito del servidor: antes ${antes}, despues ${despues}`);
        assert(sincronizaciones.length === 0,
          `la recuperacion mando ${sincronizaciones.length} sincronizacion(es): `
          + JSON.stringify(sincronizaciones).slice(0, 200));
        resumenServidor = `${enElServidor().length} item(s) intactos y 0 sync`;
      } finally {
        await context.close();
        await apiRequest('/cart', { method: 'DELETE', token: comprador.token });
      }
    }

    return `Con ${INSERVIBLES.length} copias locales inservibles la aplicacion sigue navegable, `
      + 'se descarta solo agromarket_cart —sesion y otra clave intactas—, el carrito abre vacio y '
      + `recargar no repite la caida; ${resumenValido}; y con carrito en el servidor: `
      + resumenServidor;
  } finally {
    await browser.close();
  }
});

await runCase(143, 'Pausar, reactivar o editar no le cambian la anatomia a una publicacion', async () => {
  // «Mis publicaciones» convertia la respuesta del backend en tres lugares
  // distintos —la carga inicial, la recarga despues de pausar/activar/eliminar
  // y la recarga despues de editar— y las tres copias no decian lo mismo. Dos
  // se olvidaban de `operation_kind`, `unit` y `pricing_type`, y ponian
  // «Agotado» con solo mirar stock 0.
  //
  // Lo que veia el vendedor: pausaba un servicio y la tarjeta pasaba a decir
  // «Agotado», «INSUMO ESTANDARIZADO», «Stock: 0» y a reservar lugar para una
  // fotografia. Y como el boton de pausar/activar no se dibuja sobre lo
  // agotado, el servicio quedaba SIN FORMA DE REACTIVARSE desde el panel: habia
  // que recargar la pagina entera para recuperarlo.
  //
  // El caso recorre eso en el navegador y contrasta cada paso con la API y con
  // la base, que nunca dejaron de decir que es un servicio.

  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const [categoriaDeServicio] = queryRows(
    "SELECT id, 'fin' FROM categories WHERE slug = 'acopio'");
  const [categoriaDeProducto] = queryRows(`
    SELECT id, 'fin' FROM categories
    WHERE is_service = false AND is_active = true ORDER BY name LIMIT 1`);
  assert(categoriaDeServicio && categoriaDeProducto,
    'faltan categorias de servicio y de producto para armar el caso');
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');

  // 1. Un servicio recien publicado por el camino real: la fila nace con stock
  //    0 —es el valor por omision de la columna— y eso es lo que disparaba el
  //    «Agotado».
  const nombreDelServicio = `Smoke servicio de estado ${Date.now()}`;
  const altaDelServicio = await apiRequest('/products', {
    method: 'POST', token: vendedor.token,
    body: {
      name: nombreDelServicio,
      description: 'Servicio de prueba para comprobar que el panel no le cambia la anatomia.',
      category_id: categoriaDeServicio[0],
      price: 48000,
      unit: 'hectárea',
      locality_id: localidad,
      publication_type: 'servicio',
      operation_kind: 'servicio',
      pricing_type: 'por_hectarea',
    },
  });
  assert(altaDelServicio.status < 400,
    `no se pudo publicar el servicio: HTTP ${altaDelServicio.status}`);
  const idDelServicio = altaDelServicio.data.id;

  // 2. Y el control: un producto de verdad sin unidades. Ese SI tiene que
  //    decir «Agotado», y tiene que seguir diciendolo despues de cada recarga.
  const nombreDelProducto = `Smoke producto agotado ${Date.now()}`;
  const altaDelProducto = await apiRequest('/products', {
    method: 'POST', token: vendedor.token,
    body: {
      name: nombreDelProducto,
      description: 'Producto de prueba sin unidades disponibles, para el control de «Agotado».',
      category_id: categoriaDeProducto[0],
      price: 12500,
      stock: 0,
      unit: 'kg',
      locality_id: localidad,
      publication_type: 'producto',
      operation_kind: 'insumo',
    },
  });
  assert(altaDelProducto.status < 400,
    `no se pudo publicar el producto de control: HTTP ${altaDelProducto.status}`);

  const enLaBase = () => {
    const [fila] = queryRows(`
      SELECT operation_kind, COALESCE(pricing_type, ''), COALESCE(stock::text, 'NULL'),
             status::text, 'fin'
      FROM products WHERE id = ${sqlLiteral(idDelServicio)}`);
    assert(fila, 'el servicio desaparecio de la base');
    return { anatomia: fila[0], modalidad: fila[1], stock: fila[2], estado: fila[3] };
  };
  const enLaApi = async () => {
    const { data } = await apiRequest('/products/my', { token: vendedor.token });
    const suyo = data.products.find((p) => p.id === idDelServicio);
    assert(suyo, 'el servicio no vuelve en /products/my');
    return suyo;
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    await contexto.addInitScript(({ a }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.removeItem('agromarket_cart');
    }, { a: vendedor.token });
    const page = await contexto.newPage();

    const abrirPublicaciones = async () => {
      await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
      await page.getByRole('button', { name: 'Mis publicaciones' }).click();
      await page.getByRole('heading', { name: 'Mis publicaciones' }).waitFor({ timeout: 20_000 });
    };
    const tarjeta = (nombre) => page
      .getByRole('heading', { name: nombre, exact: true, level: 3 })
      .locator('xpath=ancestor::*[contains(@class,"productCard")]');
    const textoDe = async (nombre) => {
      const donde = tarjeta(nombre);
      await donde.waitFor({ timeout: 20_000 });
      return (await donde.innerText()).replace(/\s+/g, ' ');
    };
    // Pausar y activar pasan por una confirmacion: se responde adentro de ella
    // y no en la tarjeta, que tiene un boton con el mismo rotulo.
    const confirmar = async (rotulo) => {
      const dialogo = page.locator('[class*="confirmModal"]');
      await dialogo.waitFor({ state: 'visible', timeout: 15_000 });
      await dialogo.getByRole('button', { name: rotulo, exact: true }).click();
      await dialogo.waitFor({ state: 'hidden', timeout: 15_000 });
    };

    // Lo que tiene que valer SIEMPRE para el servicio, mire cuando mire.
    const revisarElServicio = async (momento, estadoEsperado) => {
      const visto = await textoDe(nombreDelServicio);
      const base = enLaBase();
      const api = await enLaApi();

      assert(base.anatomia === 'servicio' && api.operation_kind === 'servicio',
        `${momento}: la base o la API dejaron de decir que es un servicio `
        + `(base ${base.anatomia}, API ${api.operation_kind})`);
      assert(!/Agotado/i.test(visto),
        `${momento}: el panel lo da por agotado, y un servicio no reserva unidades `
        + `(la base dice stock ${base.stock}, estado ${base.estado}): «${visto}»`);
      assert(/SERVICIO/i.test(visto) && !/INSUMO/i.test(visto),
        `${momento}: la tarjeta perdio la anatomia declarada: «${visto}»`);
      assert(/Por hectárea/i.test(visto),
        `${momento}: la tarjeta perdio la modalidad «${api.pricing_type}»: «${visto}»`);
      assert(!/Stock/i.test(visto),
        `${momento}: la tarjeta le inventa stock a un servicio: «${visto}»`);
      assert(await tarjeta(nombreDelServicio).locator('img, [role="img"]').count() === 0,
        `${momento}: la tarjeta reserva lugar para una fotografia que un servicio no tiene`);

      const rotuloEsperado = estadoEsperado === 'paused' ? 'Pausado' : 'Activo';
      assert(new RegExp(`(^|\\s)${rotuloEsperado}(\\s|$)`).test(visto),
        `${momento}: la tarjeta no dice «${rotuloEsperado}»: «${visto}»`);
      // Y sobre todo: se puede volver atras. El boton que falta es el defecto.
      const siguiente = estadoEsperado === 'paused' ? 'Activar' : 'Pausar';
      assert(await tarjeta(nombreDelServicio)
        .getByRole('button', { name: siguiente, exact: false }).count() === 1,
      `${momento}: la publicacion quedo sin boton para ${siguiente.toLowerCase()}la`);
      return visto;
    };

    // El control, en cada momento: un producto sin unidades sigue agotado.
    const revisarElControl = async (momento) => {
      const visto = await textoDe(nombreDelProducto);
      assert(/Agotado/i.test(visto),
        `${momento}: un producto con stock 0 dejo de mostrarse agotado: «${visto}»`);
      assert(/Stock: 0/i.test(visto),
        `${momento}: el producto perdio su stock formateado: «${visto}»`);
    };

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await abrirPublicaciones();

    // --- A. carga inicial ---------------------------------------------------
    await revisarElServicio('recien publicado', 'active');
    await revisarElControl('recien publicado');

    // --- B. pausar (recarga por accion) ------------------------------------
    await tarjeta(nombreDelServicio).getByRole('button', { name: /Pausar/ }).click();
    await confirmar('Pausar');
    await esperarA(async () => enLaBase().estado === 'PAUSED',
      'el servicio no quedo pausado en la base', 20_000);
    const pausado = await revisarElServicio('despues de pausar', 'paused');
    await revisarElControl('despues de pausar');

    // --- C. reactivar, que es lo que el defecto impedia ---------------------
    await tarjeta(nombreDelServicio).getByRole('button', { name: /Activar/ }).click();
    await confirmar('Activar');
    await esperarA(async () => enLaBase().estado === 'ACTIVE',
      'el servicio no volvio a activo en la base', 20_000);
    await revisarElServicio('despues de reactivar', 'active');

    // --- D. editar (recarga posterior a editar) -----------------------------
    await tarjeta(nombreDelServicio).getByRole('button', { name: /Editar/ }).click();
    const descripcion = page.locator('textarea').first();
    await descripcion.waitFor({ state: 'visible', timeout: 15_000 });
    const textoNuevo = 'Descripcion editada para forzar la recarga del panel.';
    await descripcion.fill(textoNuevo);
    await page.getByRole('button', { name: /Guardar cambios|Guardar/ }).last().click();
    await esperarA(async () => {
      const [fila] = queryRows(
        `SELECT description FROM products WHERE id = ${sqlLiteral(idDelServicio)}`);
      return fila && fila[0] === textoNuevo;
    }, 'la edicion no llego a la base', 25_000);
    await revisarElServicio('despues de editar', 'active');
    await revisarElControl('despues de editar');

    // --- E. y una carga nueva dice lo mismo que el panel --------------------
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await abrirPublicaciones();
    await revisarElServicio('despues de recargar la pagina', 'active');
    await revisarElControl('despues de recargar la pagina');

    await contexto.close();
    return `el servicio ${nombreDelServicio.slice(-13)} conserva anatomia, modalidad y estado `
      + 'en la carga inicial, al pausar, al reactivar, al editar y al recargar la pagina '
      + `—cuando estuvo pausado la tarjeta decia «${pausado.slice(0, 40)}…» y ofrecia activarlo—, `
      + 'mientras la API y la base siguen diciendo servicio; y el producto de control con '
      + 'stock 0 sigue mostrandose «Agotado» en los cuatro momentos';
  } finally {
    await browser.close();
  }
});

await runCase(144, 'Administracion: las acciones se entienden, guardan, y no rompen lo publicado', async () => {
  // Cinco cosas medidas contra `a038b56`:
  //   1. editar una categoria o una opcion mandaba PATCH y el Backend solo
  //      expone PUT: 405 y nada persistia;
  //   2. editar y eliminar eran botones VACIOS —sin texto ni nombre
  //      accesible—, y el resto decia «✕»/«✓»;
  //   3. se podia cambiar el valor interno de una opcion, que es la llave con
  //      la que ya quedaron guardadas las publicaciones;
  //   4. se podia dar vuelta Producto/Servicio en una categoria con
  //      publicaciones, reinterpretando el stock y la anatomia de todas;
  //   5. borrar una subcategoria referenciada la borraba igual y dejaba en
  //      NULL la subcategoria que el vendedor habia declarado.

  const admin = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'admin@topgreen.com', password: 'admin123' },
  });
  const token = admin.data.access_token;

  // Una categoria con publicaciones —la que no se puede dar vuelta— y una
  // recien creada, sin ninguna, que es donde se prueba que editar SI persiste.
  const [conPublicaciones] = queryRows(`
    SELECT c.id, c.name, c.is_service::text, COUNT(p.id)::text
    FROM categories c JOIN products p ON p.category_id = c.id
    WHERE p.status <> 'DELETED'
    GROUP BY c.id, c.name, c.is_service ORDER BY COUNT(p.id) DESC LIMIT 1`);
  assert(conPublicaciones, 'no hay ninguna categoria con publicaciones');

  const nombreDeLaNueva = `Categoria smoke ${Date.now()}`;
  const alta = await apiRequest('/admin/categories', {
    method: 'POST', token,
    body: {
      name: nombreDeLaNueva, description: 'Creada por el caso 144.',
      icon: '', is_service: false, display_order: 0,
    },
  });
  assert(alta.status < 400, `no se pudo crear la categoria: HTTP ${alta.status}`);
  const idDeLaNueva = alta.data.id;

  // Una subcategoria que alguna publicacion declara: es la que no se borra.
  const [subReferenciada] = queryRows(`
    SELECT s.id, s.name, s.category_id, COUNT(p.id)::text
    FROM subcategories s JOIN products p ON p.subcategory_id = s.id
    GROUP BY s.id, s.name, s.category_id ORDER BY COUNT(p.id) DESC LIMIT 1`);
  assert(subReferenciada, 'no hay ninguna subcategoria referenciada por publicaciones');
  const [[nombreDeSuCategoria]] = queryRows(
    `SELECT name FROM categories WHERE id = ${sqlLiteral(subReferenciada[2])}`);

  // Una opcion de formulario que las publicaciones ya usan.
  const [opcion] = queryRows(`
    SELECT o.id, o.value, o.label
    FROM form_options o
    WHERE o.option_type = 'unit' AND EXISTS (
      SELECT 1 FROM products p WHERE p.unit = o.value)
    ORDER BY o.display_order, o.label LIMIT 1`);
  assert(opcion, 'no hay ninguna opcion de unidad que alguna publicacion use');
  const usanLaOpcion = () => Number(queryCount(
    `SELECT COUNT(*) FROM products WHERE unit = ${sqlLiteral(opcion[1])}`));

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await contexto.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: token, r: admin.data.refresh_token });
    const page = await contexto.newPage();
    // El panel confirma con `window.confirm`; se acepta, que es lo que hace
    // quien lo usa. Reemplazarlo es otra tarea.
    page.on('dialog', (dialogo) => dialogo.accept());

    const abrirAdministracion = async () => {
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Admin' }).first().click();
      await page.getByRole('heading', { name: 'Panel de Administración' })
        .waitFor({ timeout: 20_000 });
    };
    const solapa = async (nombre) => {
      await page.getByRole('button', { name: nombre, exact: true }).click();
      await page.waitForTimeout(800);
    };
    const tarjeta = (nombre) => page
      .getByRole('heading', { name: nombre, exact: true, level: 3 })
      .locator('xpath=ancestor::*[contains(@class,"categoryCard")]');

    // Cada boton tiene que decir QUE hace. Se lee el nombre accesible como lo
    // leeria quien no ve la pantalla: texto visible o aria-label.
    const revisarLosBotones = async (donde, momento) => {
      const botones = page.locator(donde).locator('button');
      const cuantos = await botones.count();
      assert(cuantos > 0, `${momento}: no hay ningun boton donde mirar`);
      const anonimos = [];
      for (let i = 0; i < cuantos; i += 1) {
        const boton = botones.nth(i);
        const nombre = ((await boton.getAttribute('aria-label'))
          || (await boton.textContent()) || '').replace(/\s+/g, ' ').trim();
        // Un simbolo suelto no es un nombre: no dice ni la accion ni sobre que.
        if (!nombre || nombre.length < 4 || /^[^\wÁÉÍÓÚÑáéíóúñ]+$/.test(nombre)) {
          anonimos.push({ i, nombre, texto: (await boton.textContent() || '').trim() });
        }
      }
      assert(anonimos.length === 0,
        `${momento}: ${anonimos.length} de ${cuantos} acciones sin nombre que se entienda: `
        + JSON.stringify(anonimos));
      return cuantos;
    };

    await abrirAdministracion();
    await solapa('Categorías');
    await tarjeta(nombreDeLaNueva).waitFor({ timeout: 20_000 });

    // --- A. las acciones se entienden --------------------------------------
    const botonesDeCategoria = await revisarLosBotones(
      `[class*="categoryCard"]:has(h3:text-is("${nombreDeLaNueva}"))`, 'en la categoria');

    // --- B. editar una categoria persiste (antes: PATCH -> 405) ------------
    const descripcionNueva = `Editada por el caso 144 a las ${new Date().toISOString()}`;
    await tarjeta(nombreDeLaNueva).getByRole('button', { name: /^Editar/ }).click();
    const formulario = tarjeta(nombreDeLaNueva).locator('[class*="editCategoryForm"]');
    await formulario.waitFor({ state: 'visible', timeout: 15_000 });
    await formulario.locator('textarea').fill(descripcionNueva);
    await formulario.getByRole('button', { name: /Guardar/ }).click();

    await esperarA(async () => {
      const [fila] = queryRows(
        `SELECT description FROM categories WHERE id = ${sqlLiteral(idDeLaNueva)}`);
      return fila && fila[0] === descripcionNueva;
    }, 'la edicion de la categoria no llego a la base', 20_000);

    // Y sobrevive a volver a entrar, que es lo que mira quien administra: se
    // recarga la aplicacion entera, se vuelve a abrir el formulario y se lee EL
    // CAMPO. Antes esto era un `|| true` que no podia fallar; eso no probaba
    // nada y lo dejaba pasar aunque la pantalla mostrara lo viejo.
    await abrirAdministracion();
    await solapa('Categorías');
    await tarjeta(nombreDeLaNueva).waitFor({ timeout: 20_000 });
    await tarjeta(nombreDeLaNueva).getByRole('button', { name: /^Editar/ }).click();
    const formularioOtraVez = tarjeta(nombreDeLaNueva).locator('[class*="editCategoryForm"]');
    await formularioOtraVez.waitFor({ state: 'visible', timeout: 15_000 });
    const botonesDelFormulario = await revisarLosBotones(
      `[class*="categoryCard"]:has(h3:text-is("${nombreDeLaNueva}")) [class*="editCategoryForm"]`,
      'en el formulario de la categoria');
    const enElCampo = await formularioOtraVez.locator('textarea').inputValue();
    assert(enElCampo === descripcionNueva,
      `al volver a entrar el formulario no trae la descripcion guardada: «${enElCampo}»`);
    await formularioOtraVez.getByRole('button', { name: /^Cancelar/ }).click();

    const enLaApi = await apiRequest('/admin/categories', { token });
    const vuelta = enLaApi.data.find((c) => c.id === idDeLaNueva);
    assert(vuelta && vuelta.description === descripcionNueva,
      `la API no devuelve la descripcion editada: ${JSON.stringify(vuelta?.description)}`);

    // --- C. el tipo de una categoria con publicaciones no se da vuelta -----
    await tarjeta(conPublicaciones[1]).getByRole('button', { name: /^Editar/ }).click();
    const suFormulario = tarjeta(conPublicaciones[1]).locator('[class*="editCategoryForm"]');
    await suFormulario.waitFor({ state: 'visible', timeout: 15_000 });
    const selectorDeTipo = suFormulario.locator('#categoria-edita-tipo');
    assert(await selectorDeTipo.isDisabled(),
      `«${conPublicaciones[1]}» tiene ${conPublicaciones[3]} publicaciones y la pantalla `
      + 'todavia deja cambiarle el tipo');
    const textoDelFormulario = (await suFormulario.innerText()).replace(/\s+/g, ' ');
    assert(/no se puede cambiar/i.test(textoDelFormulario),
      `la pantalla bloquea el tipo pero no dice por que: «${textoDelFormulario.slice(0, 200)}»`);
    await suFormulario.getByRole('button', { name: /Cancelar/ }).click();

    // Y el servidor tampoco: la pantalla es cortesia, la regla vive en la API.
    const vueltaDelTipo = await pedirCrudo(`/admin/categories/${conPublicaciones[0]}`, {
      method: 'PUT', header: token,
      body: { is_service: conPublicaciones[2] !== 'true' },
    });
    assert(vueltaDelTipo.status === 409,
      `cambiar el tipo con ${conPublicaciones[3]} publicaciones respondio `
      + `${vueltaDelTipo.status}: ${JSON.stringify(vueltaDelTipo.datos).slice(0, 160)}`);
    const detalleDelTipo = String(vueltaDelTipo.datos?.detail || '');
    assert(detalleDelTipo.includes(conPublicaciones[3])
      && /publicacion|publicación/i.test(detalleDelTipo),
    `el error no dice cuantas publicaciones lo impiden: ${JSON.stringify(detalleDelTipo)}`);
    const [[tipoAhora]] = queryRows(
      `SELECT is_service::text FROM categories WHERE id = ${sqlLiteral(conPublicaciones[0])}`);
    assert(tipoAhora === conPublicaciones[2],
      `la categoria cambio de tipo igual: era ${conPublicaciones[2]} y quedo ${tipoAhora}`);

    // --- D. la subcategoria referenciada no se borra, y no se pierde nada --
    const publicacionesDeLaSub = () => queryRows(
      `SELECT id FROM products WHERE subcategory_id = ${sqlLiteral(subReferenciada[0])}`);
    const antesDeIntentar = publicacionesDeLaSub().length;
    assert(antesDeIntentar > 0, 'la subcategoria elegida ya no tiene publicaciones');

    await tarjeta(nombreDeSuCategoria).getByRole('button', { name: /^(Mostrar|Ocultar)/ }).click();
    const filaDeLaSub = tarjeta(nombreDeSuCategoria)
      .locator('[class*="subcategoryItem"]').filter({ hasText: subReferenciada[1] });
    await filaDeLaSub.waitFor({ state: 'visible', timeout: 15_000 });
    const botonesDeLaSub = await revisarLosBotones(
      `[class*="subcategoryItem"]:has-text("${subReferenciada[1]}")`, 'en la subcategoria');
    await filaDeLaSub.getByRole('button', { name: /^Eliminar/ }).click();

    await esperarA(async () => ((await page.locator('body').innerText()) || '')
      .includes('No se puede eliminar la subcategoría'),
    'la pantalla no dice por que no se puede eliminar la subcategoria', 20_000);
    const [siguePresente] = queryRows(
      `SELECT name FROM subcategories WHERE id = ${sqlLiteral(subReferenciada[0])}`);
    assert(siguePresente, `la subcategoria «${subReferenciada[1]}» se elimino igual`);
    assert(publicacionesDeLaSub().length === antesDeIntentar,
      `las publicaciones perdieron su subcategoria: eran ${antesDeIntentar} y quedaron `
      + `${publicacionesDeLaSub().length}`);

    // --- E. control: una subcategoria sin referencias si se elimina --------
    const nombreDeLaSubNueva = `Sub smoke ${Date.now()}`;
    await tarjeta(nombreDeLaNueva).getByRole('button', { name: /^(Mostrar|Ocultar)/ }).click();
    await tarjeta(nombreDeLaNueva).getByRole('button', { name: /^Agregar una subcategor/ })
      .click();
    const altaEnLinea = tarjeta(nombreDeLaNueva).locator('[class*="addSubcategoryForm"]');
    await altaEnLinea.waitFor({ state: 'visible', timeout: 15_000 });
    // Las dos acciones del alta —confirmar y cancelar— tambien se miden: eran
    // «✓» y «✕», que no dicen ni que hacen ni sobre que.
    const botonesDelAlta = await revisarLosBotones(
      `[class*="categoryCard"]:has(h3:text-is("${nombreDeLaNueva}")) [class*="addSubcategoryForm"]`,
      'en el alta de subcategoria');
    await altaEnLinea.getByPlaceholder('Nombre de subcategoría').fill(nombreDeLaSubNueva);
    await altaEnLinea.getByRole('button', { name: /^Agregar la subcategor/ }).click();
    await esperarA(async () => queryRows(
      `SELECT id FROM subcategories WHERE name = ${sqlLiteral(nombreDeLaSubNueva)}`).length === 1,
    'la subcategoria nueva no se creo', 20_000);

    const filaNueva = tarjeta(nombreDeLaNueva)
      .locator('[class*="subcategoryItem"]').filter({ hasText: nombreDeLaSubNueva });
    await filaNueva.waitFor({ state: 'visible', timeout: 15_000 });
    await filaNueva.getByRole('button', { name: /^Eliminar/ }).click();
    await esperarA(async () => queryRows(
      `SELECT id FROM subcategories WHERE name = ${sqlLiteral(nombreDeLaSubNueva)}`).length === 0,
    'una subcategoria sin publicaciones tampoco se pudo eliminar', 20_000);

    // --- F. las opciones: se editan, y el valor interno no se toca ---------
    await solapa('Configuración');
    // Las opciones se listan por tipo: se abre el de unidades, que es de donde
    // sale la unidad que las publicaciones copiaron.
    await page.getByRole('button', { name: 'Unidades' }).click();
    const fila = page.locator('[class*="optionItem"]').filter({ hasText: opcion[2] }).first();
    await fila.waitFor({ state: 'visible', timeout: 20_000 });
    const botonesDeOpcion = await revisarLosBotones(
      `[class*="optionItem"]:has-text("${opcion[2]}")`, 'en la opcion');

    await fila.getByRole('button', { name: /^Editar/ }).click();
    // En edicion la etiqueta pasa a vivir en el VALOR de un campo, y `hasText`
    // no ve valores: se toma el formulario abierto, que es uno solo.
    const edicion = page.locator('[class*="optionEditForm"]');
    await edicion.waitFor({ state: 'visible', timeout: 15_000 });
    const botonesDeLaEdicion = await revisarLosBotones(
      '[class*="optionEditForm"]', 'en el formulario de la opcion');
    const valorEnPantalla = edicion.locator('input').first();
    assert(await valorEnPantalla.inputValue() === opcion[1],
      'la pantalla no muestra el valor interno de la opcion');
    assert(await valorEnPantalla.getAttribute('readonly') !== null,
      'la pantalla todavia deja editar el valor interno de la opcion');

    const etiquetaNueva = `${opcion[2]} 144`;
    await edicion.locator('input').nth(1).fill(etiquetaNueva);
    await edicion.getByRole('button', { name: /^Guardar/ }).click();
    await esperarA(async () => {
      const [f] = queryRows(
        `SELECT label, value FROM form_options WHERE id = ${sqlLiteral(opcion[0])}`);
      return f && f[0] === etiquetaNueva;
    }, 'la etiqueta editada no llego a la base', 20_000);
    const [[etiquetaEnBase, valorEnBase]] = queryRows(
      `SELECT label, value FROM form_options WHERE id = ${sqlLiteral(opcion[0])}`);
    assert(valorEnBase === opcion[1],
      `guardar la etiqueta cambio el valor interno: ${valorEnBase}`);

    // Y el servidor rechaza el valor distinto aunque se lo pidan a mano.
    const usaban = usanLaOpcion();
    const intento = await pedirCrudo(`/admin/form-options/${opcion[0]}`, {
      method: 'PUT', header: token, body: { value: `${opcion[1]}_otro` },
    });
    assert(intento.status === 409,
      `cambiar el valor interno respondio ${intento.status}: `
      + JSON.stringify(intento.datos).slice(0, 160));
    const [[valorDespues]] = queryRows(
      `SELECT value FROM form_options WHERE id = ${sqlLiteral(opcion[0])}`);
    assert(valorDespues === opcion[1], `el valor interno cambio igual: ${valorDespues}`);
    assert(usanLaOpcion() === usaban,
      'las publicaciones que usaban esa unidad cambiaron de valor');

    // Y se ve al volver: se recarga la aplicacion entera, se vuelve a
    // Configuracion y se lee la fila en la pantalla. Recien despues se
    // restaura, para no estar comprobando lo que uno mismo acaba de deshacer.
    await abrirAdministracion();
    await solapa('Configuración');
    await page.getByRole('button', { name: 'Unidades' }).click();
    const filaEditada = page.locator('[class*="optionItem"]')
      .filter({ hasText: etiquetaNueva }).first();
    await filaEditada.waitFor({ state: 'visible', timeout: 20_000 });
    const textoDeLaFila = (await filaEditada.innerText()).replace(/\s+/g, ' ');
    assert(textoDeLaFila.includes(etiquetaNueva) && textoDeLaFila.includes(opcion[1]),
      `al volver, la fila no muestra la etiqueta guardada con su valor interno: `
      + `«${textoDeLaFila}»`);

    // Se deja la etiqueta como estaba: otros casos leen el catalogo.
    await apiRequest(`/admin/form-options/${opcion[0]}`, {
      method: 'PUT', token, body: { label: opcion[2] },
    });

    await contexto.close();
    const medidas = botonesDeCategoria + botonesDelFormulario + botonesDeLaSub
      + botonesDelAlta + botonesDeOpcion + botonesDeLaEdicion;
    return `en Administracion las ${medidas} acciones de los seis bloques —tarjeta y `
      + 'formulario de categoria, fila y alta de subcategoria, fila y formulario de '
      + 'opcion— tienen nombre propio; editar categoria y opcion persiste por PUT y se '
      + 'lee en la pantalla despues de recargar; con '
      + `${conPublicaciones[3]} publicaciones el tipo de «${conPublicaciones[1]}» no se da `
      + `vuelta —409 y la pantalla lo dice—; la subcategoria «${subReferenciada[1]}» no se `
      + `borra con ${antesDeIntentar} publicaciones que la declaran y ninguna las pierde; y `
      + 'como control se crea y se elimina una subcategoria sin referencias';
  } finally {
    await browser.close();
    // La categoria del caso se va con lo suyo.
    await apiRequest(`/admin/categories/${idDeLaNueva}`, { method: 'DELETE', token });
  }
});

await runCase(145, 'Las tres listas de Administracion pasan de la fila veinte', async () => {
  // Usuarios, Productos y Ordenes pedian su endpoint sin `page` ni `page_size`.
  // El servidor devuelve veinte filas por omision, asi que la pantalla mostraba
  // las primeras veinte y al pie el total entero —«Total: 164 productos»— sin
  // ningun control: no habia forma de llegar a la fila 21 desde la interfaz.
  //
  // Este caso arma sus propias filas, cruza lo que ve con lo que devuelve la
  // API y con la base, y recorre el panel real: pagina, filtra, vuelve a la
  // primera pagina y comprueba los dos extremos.

  const admin = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'admin@topgreen.com', password: 'admin123' },
  });
  const token = admin.data.access_token;
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const comprador = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const tokenComprador = comprador.data.access_token;

  const sello = Date.now();
  const marca = `Pag145 ${sello}`;
  const FILAS = 21;

  // --- las filas del caso, por las rutas de siempre -----------------------
  // 21 usuarios con la misma marca en el nombre: con la busqueda aplicada la
  // lista es exactamente la del caso, y el ultimo creado queda primero.
  for (let i = 1; i <= FILAS; i += 1) {
    const n = String(i).padStart(2, '0');
    const alta = await apiRequest('/admin/users', {
      method: 'POST', token,
      body: {
        email: `pag145.${sello}.${n}@ejemplo.com`,
        password: 'smoke145',
        full_name: `${marca} ${n}`,
        phone: '+54 11 5555 0145',
        role: 'user',
        is_active: true,
      },
    });
    assert(alta.status < 400, `no se pudo crear el usuario ${n}: HTTP ${alta.status}`);
  }

  const [categoria] = queryRows(`
    SELECT id, 'fin' FROM categories
    WHERE is_service = false AND is_active = true ORDER BY name LIMIT 1`);
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');
  for (let i = 1; i <= FILAS; i += 1) {
    const n = String(i).padStart(2, '0');
    const alta = await apiRequest('/products', {
      method: 'POST', token: vendedor.token,
      body: {
        name: `${marca} publicacion ${n}`,
        description: 'Publicacion del caso 145, para que la lista pase de veinte filas.',
        category_id: categoria[0],
        price: 1000 + i,
        stock: 3,
        unit: 'kg',
        locality_id: localidad,
        publication_type: 'producto',
        operation_kind: 'insumo',
      },
    });
    assert(alta.status < 400, `no se pudo publicar ${n}: HTTP ${alta.status}`);
  }

  // Un producto de cada estado del modelo, para que el filtro tenga qué
  // mostrar en todas sus opciones. Se usan los del propio caso —el 01 queda
  // intacto porque es el testigo de la pagina 2— y se cambian por la ruta real.
  const paraTenerEstado = queryRows(`
    SELECT id FROM products WHERE name LIKE ${sqlLiteral(`${marca} publicacion 0%`)}
    ORDER BY name OFFSET 1 LIMIT 3`).map(([id]) => id);
  assert(paraTenerEstado.length === 3, 'no quedaron publicaciones del caso para dar estados');
  const estadosSembrados = ['paused', 'sold_out', 'deleted'];
  for (let i = 0; i < estadosSembrados.length; i += 1) {
    const cambio = await apiRequest(`/admin/products/${paraTenerEstado[i]}/status`, {
      method: 'PATCH', token, body: { status: estadosSembrados[i] },
    });
    assert(cambio.status < 400,
      `no se pudo dejar una publicacion en ${estadosSembrados[i]}: HTTP ${cambio.status}`);
  }

  // 21 ordenes por transferencia: dos llamadas cada una, por el camino real.
  const productoParaComprar = productoConStock(vendedor.id, FILAS + 1);
  await apiRequest('/cart', { method: 'DELETE', token: tokenComprador });
  const ordenesDelCaso = [];
  for (let i = 1; i <= FILAS; i += 1) {
    await apiRequest('/cart/items', {
      method: 'POST', token: tokenComprador,
      body: { product_id: productoParaComprar, quantity: 1 },
    });
    const checkout = await apiRequest('/orders/checkout/transfer', {
      method: 'POST', token: tokenComprador,
      body: {
        shipping_address: `Ruta 145 km ${i}`,
        shipping_locality_id: localidad,
        shipping_postal_code: '2700',
        shipping_decisions: [{ seller_id: vendedor.id, mode: 'self' }],
      },
    });
    const [orden] = checkout.data.orders;
    assert(orden?.order_number, `la orden ${i} no salio: ${JSON.stringify(checkout.data)}`);
    ordenesDelCaso.push(orden.order_number);
  }

  // --- lo que dice el servidor, que es con lo que se contrasta -------------
  const enLaApi = async (ruta, extra = {}) => {
    const q = new URLSearchParams({ page: '1', page_size: '20', ...extra });
    const { data } = await apiRequest(`${ruta}?${q.toString()}`, { token });
    return data;
  };
  const testigoDePagina2 = async (ruta, clave, extra = {}) => {
    const q = new URLSearchParams({ page: '2', page_size: '20', ...extra });
    const { data } = await apiRequest(`${ruta}?${q.toString()}`, { token });
    assert(data[clave].length > 0, `${ruta} no tiene pagina 2`);
    return data[clave][0];
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await contexto.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: token, r: admin.data.refresh_token });
    const page = await contexto.newPage();

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('heading', { name: 'Panel de Administración' })
      .waitFor({ timeout: 20_000 });

    const solapa = async (nombre) => {
      await page.getByRole('button', { name: nombre, exact: true }).click();
      // Se espera a la tabla y no al paginador: si el paginador no existiera,
      // el caso tiene que decirlo con sus palabras y no morir esperandolo.
      await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 20_000 });
    };
    const paginaQueDice = async () => (await page.locator('[class*="paginaActual"]').innerText())
      .replace(/\s+/g, ' ').trim();
    const pieCompleto = async () => (await page.locator('[class*="pagination"]').innerText())
      .replace(/\s+/g, ' ').trim();
    const filas = async () => (await page.locator('tbody tr').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim());
    // La columna «Estado» de Publicaciones: es la sexta y trae el distintivo
    // con el estado crudo, sin los rotulos del selector de la fila.
    const estadoDeCadaFila = async () => (await page
      .locator('tbody tr td:nth-child(6)').allInnerTexts()).map((c) => c.trim());
    const anterior = (etiqueta) => page.getByRole('button', { name: `Página anterior de ${etiqueta}` });
    const siguiente = (etiqueta) => page.getByRole('button', { name: `Página siguiente de ${etiqueta}` });

    // Ir a la pagina 2 tiene que ser un pedido al servidor, no un corte en
    // memoria de las veinte filas que ya estaban.
    const irASiguiente = async (etiqueta, ruta) => {
      // El rotulo «Página 2 de N» cambia con el estado, apenas se hace clic; las
      // filas cambian cuando LLEGA la respuesta. Se espera la respuesta, que es
      // ademas lo que hay que demostrar: la pagina 2 se pide al servidor.
      const [respuesta] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(ruta)
          && r.url().includes('page=2') && r.url().includes('page_size=20')
          && r.status() === 200, { timeout: 20_000 }),
        siguiente(etiqueta).click(),
      ]);
      await esperarA(async () => (await paginaQueDice()).includes('Página 2 de'),
        `${etiqueta}: la pantalla no paso a la pagina 2`, 20_000);
      return respuesta.url().split('/api')[1];
    };

    const revisarLista = async ({ solapaNombre, etiqueta, ruta, clave, textoDelTestigo }) => {
      await solapa(solapaNombre);
      const datos = await enLaApi(ruta);
      const paginas = Math.max(1, Math.ceil(datos.total / 20));
      assert(datos.total >= 21, `${etiqueta}: el caso necesita mas de 20 filas y hay ${datos.total}`);

      const pie = await pieCompleto();
      assert(await siguiente(etiqueta).count() === 1 && await anterior(etiqueta).count() === 1,
        `${etiqueta}: no hay ningun control para pasar de pagina, y hay ${datos.total} filas; `
        + `el pie dice «${pie}»`);
      assert(pie.includes(`Total: ${datos.total} ${etiqueta}`),
        `${etiqueta}: el pie no dice el total del servidor (${datos.total}): «${pie}»`);
      assert((await paginaQueDice()) === `Página 1 de ${paginas}`,
        `${etiqueta}: la pantalla dice «${await paginaQueDice()}» y el servidor tiene `
        + `${datos.total} filas, o sea ${paginas} paginas`);
      assert(await anterior(etiqueta).isDisabled(),
        `${etiqueta}: en la primera pagina «Anterior» tendria que estar deshabilitado`);
      assert((await filas()).length === 20,
        `${etiqueta}: la primera pagina trae ${(await filas()).length} filas y no 20`);

      const testigo = await testigoDePagina2(ruta, clave);
      const texto = textoDelTestigo(testigo);
      assert(!(await filas()).some((f) => f.includes(texto)),
        `${etiqueta}: el testigo «${texto}» ya estaba en la primera pagina`);

      const pedido = await irASiguiente(etiqueta, ruta);
      await esperarA(async () => (await filas()).some((f) => f.includes(texto)),
        `${etiqueta}: «${texto}» no aparecio al pasar de pagina; se pidio ${pedido}`, 20_000);
      assert(await anterior(etiqueta).isEnabled(),
        `${etiqueta}: en la pagina 2 «Anterior» tendria que poder usarse`);
      return { total: datos.total, paginas, pedido, testigo: texto };
    };

    // --- A. las tres listas pasan de la fila veinte ------------------------
    const usuarios = await revisarLista({
      solapaNombre: 'Usuarios', etiqueta: 'usuarios',
      ruta: '/admin/users', clave: 'users',
      textoDelTestigo: (u) => u.email,
    });
    const productos = await revisarLista({
      solapaNombre: 'Productos', etiqueta: 'productos',
      ruta: '/admin/products', clave: 'products',
      textoDelTestigo: (p) => p.name,
    });
    const ordenes = await revisarLista({
      solapaNombre: 'Órdenes', etiqueta: 'órdenes',
      ruta: '/admin/orders', clave: 'orders',
      textoDelTestigo: (o) => o.order_number,
    });

    // Y el total de una de ellas se contrasta ademas contra la base.
    const enLaBase = Number(queryCount('SELECT COUNT(*) FROM users'));
    assert(enLaBase === usuarios.total,
      `usuarios: la base tiene ${enLaBase} y la API dijo ${usuarios.total}`);

    // --- B. Usuarios: buscar, rol y estado ---------------------------------
    await solapa('Usuarios');
    // Cada lista tiene SU pagina: se dejo Usuarios en la 2 al principio, se
    // pasearon las otras dos, y al volver sigue en la 2. Desde ahi se comprueba
    // que buscar devuelve a la primera.
    assert((await paginaQueDice()).startsWith('Página 2 de'),
      `Usuarios no conservo su propia pagina al volver: «${await paginaQueDice()}»`);
    const buscador = page.getByLabel('Buscar usuarios por nombre o email');
    await buscador.fill(marca);
    await page.getByRole('button', { name: 'Buscar usuarios' }).click();
    await esperarA(async () => (await pieCompleto()).includes(`Total: ${FILAS} usuarios`),
      `la busqueda por «${marca}» no dejo las ${FILAS} filas del caso: «${await pieCompleto()}»`,
      20_000);
    assert((await paginaQueDice()) === 'Página 1 de 2',
      `buscar no volvio a la primera pagina: «${await paginaQueDice()}»`);
    for (const fila of await filas()) {
      assert(fila.includes(marca) || fila.includes(`pag145.${sello}`),
        `la busqueda dejo una fila que no corresponde: «${fila}»`);
    }
    // El testigo de la busqueda: el primero que se creo quedo ultimo.
    const primeroCreado = `pag145.${sello}.01@ejemplo.com`;
    assert(!(await filas()).some((f) => f.includes(primeroCreado)),
      'con la busqueda aplicada el testigo ya estaba en la primera pagina');
    await irASiguiente('usuarios', '/admin/users');
    await esperarA(async () => (await filas()).some((f) => f.includes(primeroCreado)),
      `el testigo ${primeroCreado} no aparecio en la pagina 2 de la busqueda`, 20_000);
    assert(await siguiente('usuarios').isDisabled(),
      'en la ultima pagina «Siguiente» tendria que estar deshabilitado');

    // Cero resultados: pagina 1 de 1, sin filas y sin navegacion.
    await buscador.fill(`${marca} no existe ninguno`);
    await page.getByRole('button', { name: 'Buscar usuarios' }).click();
    await esperarA(async () => (await pieCompleto()).includes('Total: 0 usuarios'),
      `una busqueda sin resultados no dio cero: «${await pieCompleto()}»`, 20_000);
    assert((await paginaQueDice()) === 'Página 1 de 1',
      `sin resultados la pantalla dice «${await paginaQueDice()}»`);
    assert((await filas()).length === 0, 'sin resultados igual dibujo filas');
    assert(await anterior('usuarios').isDisabled() && await siguiente('usuarios').isDisabled(),
      'sin resultados la navegacion sigue habilitada');

    // Rol y estado, cada uno contra lo que muestra la fila.
    await buscador.fill('');
    await page.getByRole('button', { name: 'Buscar usuarios' }).click();
    await esperarA(async () => (await pieCompleto()).includes(`Total: ${usuarios.total} usuarios`),
      'vaciar la busqueda no devolvio la lista completa', 20_000);

    await page.getByLabel('Filtrar usuarios por rol').selectOption('admin');
    await esperarA(async () => {
      const datos = await enLaApi('/admin/users', { role: 'admin' });
      return (await pieCompleto()).includes(`Total: ${datos.total} usuarios`);
    }, 'el filtro por rol no coincide con el total del servidor', 20_000);
    assert((await paginaQueDice()).startsWith('Página 1 de'),
      `filtrar por rol no volvio a la primera pagina: «${await paginaQueDice()}»`);
    const rolesVisibles = await page.locator('tbody tr select[aria-label="Rol del usuario"]')
      .evaluateAll((nodos) => nodos.map((n) => n.value));
    assert(rolesVisibles.length > 0 && rolesVisibles.every((r) => r === 'admin'),
      `el filtro por rol dejo filas que no son admin: ${JSON.stringify(rolesVisibles)}`);
    await page.getByLabel('Filtrar usuarios por rol').selectOption('');

    await page.getByLabel('Filtrar usuarios por estado').selectOption('false');
    await esperarA(async () => {
      const datos = await enLaApi('/admin/users', { is_active: 'false' });
      return (await pieCompleto()).includes(`Total: ${datos.total} usuarios`);
    }, 'el filtro por estado no coincide con el total del servidor', 20_000);
    for (const fila of await filas()) {
      assert(/Inactivo/.test(fila),
        `«Solo inactivos» dejo una fila activa: «${fila}»`);
    }
    await page.getByLabel('Filtrar usuarios por estado').selectOption('');

    // --- C. Productos y Ordenes: el filtro por estado ----------------------
    await solapa('Productos');
    assert((await paginaQueDice()).startsWith('Página 2 de'),
      `Productos no conservo su propia pagina: «${await paginaQueDice()}»`);

    // Se recorren TODAS las opciones que ofrece el selector, no una elegida a
    // mano: una opcion que el dominio no admite es una accion falsa, y hasta
    // ahora ofrecia «Borradores», que el servidor contesta con un error.
    const selectorDeEstado = page.getByLabel('Filtrar publicaciones por estado');
    const ofrecidos = await selectorDeEstado.locator('option')
      .evaluateAll((nodos) => nodos.map((n) => n.value));
    assert(ofrecidos.length >= 2, `el selector no ofrece estados: ${JSON.stringify(ofrecidos)}`);
    for (const estado of ofrecidos) {
      const respuesta = await pedirCrudo(
        `/admin/products?page=1&page_size=20${estado ? `&status=${estado}` : ''}`,
        { header: token });
      assert(respuesta.status === 200,
        `el servidor contesto ${respuesta.status} al estado «${estado}» que ofrece la `
        + `pantalla: ${JSON.stringify(respuesta.datos).slice(0, 140)}`);
      // Se espera LA respuesta de ese estado y no un total: dos estados pueden
      // tener la misma cantidad de filas, y entonces el total no distingue si
      // las filas ya se cambiaron o son todavia las anteriores.
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/admin/products')
          && (estado ? r.url().includes(`status=${estado}`) : !r.url().includes('status='))
          && r.status() === 200, { timeout: 20_000 }),
        selectorDeEstado.selectOption(estado),
      ]);
      await esperarA(async () => (await pieCompleto())
        .includes(`Total: ${respuesta.datos.total} productos`),
      `el estado «${estado || 'todos'}» no coincide con el total del servidor `
      + `(${respuesta.datos.total})`, 20_000);
      assert((await paginaQueDice()).startsWith('Página 1 de'),
        `filtrar publicaciones no volvio a la primera pagina: «${await paginaQueDice()}»`);
      if (estado) {
        // Se mira la celda del estado y no la fila entera: la fila trae ademas
        // los rotulos del selector de cada publicacion —«Activo Pausado…»—, y
        // con eso cualquier filtro pareceria cumplirse.
        await esperarA(async () => {
          const celdas = await estadoDeCadaFila();
          return celdas.length > 0 && celdas.every((c) => c.toLowerCase() === estado);
        }, `el filtro «${estado}» dejo filas con otro estado: `
          + `${JSON.stringify(await estadoDeCadaFila())}`, 20_000);
      }
    }
    await selectorDeEstado.selectOption('');

    await solapa('Órdenes');
    assert((await paginaQueDice()).startsWith('Página 2 de'),
      `Órdenes no conservo su propia pagina: «${await paginaQueDice()}»`);
    await page.getByLabel('Filtrar órdenes por estado').selectOption('awaiting_transfer_receipt');
    await esperarA(async () => {
      const datos = await enLaApi('/admin/orders', { status: 'awaiting_transfer_receipt' });
      return (await pieCompleto()).includes(`Total: ${datos.total} órdenes`);
    }, 'el filtro de ordenes no coincide con el total del servidor', 20_000);
    assert((await paginaQueDice()).startsWith('Página 1 de'),
      `filtrar ordenes no volvio a la primera pagina: «${await paginaQueDice()}»`);
    for (const fila of await filas()) {
      assert(/awaiting_transfer_receipt/i.test(fila),
        `el filtro de ordenes dejo otro estado: «${fila}»`);
    }

    // --- D. una respuesta vieja no puede pisar el filtro vigente ----------
    // Al volver a una pestaña se siguen viendo las filas anteriores, asi que se
    // puede filtrar antes de que termine la carga que arranco al entrar. Se
    // retiene esa carga SIN filtro, se aplica el filtro, se deja terminar la
    // filtrada, y recien entonces se libera la vieja: si la vieja escribe,
    // vuelven el total y las filas de algo que ya nadie pidio.
    let liberarLaVieja = () => {};
    const laVieja = new Promise((seguir) => { liberarLaVieja = seguir; });
    let retenida = false;
    await page.route('**/api/admin/products*', async (ruta) => {
      if (!retenida && !ruta.request().url().includes('status=')) {
        retenida = true;
        await laVieja;
      }
      await ruta.continue();
    });

    await solapa('Usuarios');
    await page.getByRole('button', { name: 'Productos', exact: true }).click();
    await esperarA(async () => retenida,
      'no se llego a retener la carga sin filtro de publicaciones', 20_000);

    const pausadas = (await enLaApi('/admin/products', { status: 'paused' })).total;
    const respuestaVieja = page.waitForResponse((r) => r.url().includes('/admin/products')
      && !r.url().includes('status='), { timeout: 30_000 });
    await page.getByLabel('Filtrar publicaciones por estado').selectOption('paused');
    await esperarA(async () => (await pieCompleto()).includes(`Total: ${pausadas} productos`),
      'la respuesta filtrada no llego a la pantalla', 20_000);

    liberarLaVieja();
    await respuestaVieja;
    // Se le da a la vieja la oportunidad de escribir: si va a pisar, pisa ahora.
    await page.waitForTimeout(1500);
    const pieDespues = await pieCompleto();
    assert(pieDespues.includes(`Total: ${pausadas} productos`),
      `una respuesta vieja sin filtro piso lo que estaba pedido: «${pieDespues}»`);
    const estadosDespues = await estadoDeCadaFila();
    assert(estadosDespues.length > 0
      && estadosDespues.every((c) => c.toLowerCase() === 'paused'),
    `una respuesta vieja trajo filas que el filtro vigente no pidio: `
    + JSON.stringify(estadosDespues));
    await page.unroute('**/api/admin/products*');

    await contexto.close();
    return `con ${usuarios.total} usuarios, ${productos.total} publicaciones y `
      + `${ordenes.total} ordenes, las tres listas dicen «Página 1 de N» del total del `
      + `servidor y pasan de la fila veinte: al usar «Siguiente» piden ${usuarios.pedido} `
      + `y aparecen los testigos ${usuarios.testigo}, «${productos.testigo}» y `
      + `${ordenes.testigo}; buscar por «${marca}» deja ${FILAS} usuarios en 2 paginas y `
      + 'vuelve a la primera, sin resultados dice «Página 1 de 1» con la navegacion '
      + 'apagada, y los filtros de rol, estado y estado de publicacion/orden no dejan '
      + `ninguna fila que los contradiga; las ${ofrecidos.length} opciones del selector de `
      + 'publicaciones existen en el dominio y responden 200; y una respuesta vieja sin '
      + 'filtro, liberada despues de la filtrada, no pisa ni el total ni las filas';
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: tokenComprador });
  }
});

await runCase(146, 'El estado de una publicacion se cambia desde el panel y persiste', async () => {
  // El selector de estado de CADA FILA de Publicaciones ofrecia «Borrador»
  // —`draft`, que `ProductStatus` no tiene— y no ofrecia «Agotado». Elegir
  // «Borrador» era una accion falsa: el servidor contesta 400 y la publicacion
  // queda igual; y no habia forma de dejar una publicacion agotada desde
  // Administracion.
  //
  // El caso no lleva los estados escritos a mano: los saca del modelo y los
  // confronta con el tipo de la base. Despues exige que cada fila ofrezca
  // exactamente eso, ACCIONA el control real sobre publicaciones propias
  // mirando cada PATCH, y vuelve a entrar al panel para ver lo persistido.

  // --- el dominio, sacado de donde vive -----------------------------------
  const fuenteDelModelo = readFileSync('backend/app/models/product.py', 'utf8');
  const cuerpoDelEnum = (fuenteDelModelo.split(/^class\s+ProductStatus\b.*$/m)[1] || '')
    .split(/^class\s/m)[0];
  const dominio = [...cuerpoDelEnum.matchAll(/^\s+[A-Z_]+\s*=\s*['"]([a-z_]+)['"]/gm)]
    .map(([, valor]) => valor);
  assert(dominio.length >= 3,
    `no se pudo leer ProductStatus del modelo: ${JSON.stringify(dominio)}`);
  const enLaBase = queryRows(`
    SELECT e.enumlabel FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'productstatus'
    ORDER BY e.enumsortorder`).map(([etiqueta]) => etiqueta.toLowerCase());
  const ordenados = (lista) => [...lista].sort().join(',');
  assert(ordenados(dominio) === ordenados(enLaBase),
    `el modelo dice ${JSON.stringify(dominio)} y el tipo de la base `
    + `${JSON.stringify(enLaBase)}: el caso no sabria contra que dominio medir`);

  // --- las publicaciones del caso, por la ruta real -----------------------
  const admin = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'admin@topgreen.com', password: 'admin123' },
  });
  const token = admin.data.access_token;
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');

  const sello = Date.now();
  const [categoria] = queryRows(`
    SELECT id, 'fin' FROM categories
    WHERE is_service = false AND is_active = true ORDER BY name LIMIT 1`);
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');

  // Una publicacion por estado del dominio: cada una tiene que terminar en el
  // suyo, y se llega ahi por el control del panel y nunca por la API.
  const publicaciones = [];
  for (const estado of dominio) {
    const nombre = `Est146 ${sello} ${estado}`;
    const alta = await apiRequest('/products', {
      method: 'POST', token: vendedor.token,
      body: {
        name: nombre,
        description: 'Publicacion efimera del caso 146, para accionar su estado desde el panel.',
        category_id: categoria[0],
        price: 1460,
        stock: 2,
        unit: 'kg',
        locality_id: localidad,
        publication_type: 'producto',
        operation_kind: 'insumo',
      },
    });
    assert(alta.status < 400 && alta.data?.id,
      `no se pudo publicar «${nombre}»: HTTP ${alta.status} ${JSON.stringify(alta.data)}`);
    publicaciones.push({ nombre, estado, id: alta.data.id });
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await contexto.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: token, r: admin.data.refresh_token });
    const page = await contexto.newPage();

    const abrirPublicaciones = async () => {
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Admin' }).click();
      await page.getByRole('heading', { name: 'Panel de Administración' })
        .waitFor({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Productos', exact: true }).click();
      await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 20_000 });
    };
    const filaDe = (nombre) => page.locator('tbody tr').filter({ hasText: nombre });
    const selectorDe = (nombre) => filaDe(nombre)
      .locator('select[aria-label="Estado del producto"]');
    // La columna «Estado» es la sexta y trae el distintivo con el estado crudo;
    // el CSS lo dibuja en mayusculas, asi que se compara en minusculas.
    const celdaDe = async (nombre) => (await filaDe(nombre).locator('td:nth-child(6)')
      .innerText()).trim().toLowerCase();
    const esperarLaFila = async (nombre) => esperarA(
      async () => (await filaDe(nombre).count()) === 1,
      `«${nombre}» no aparecio en la primera pagina de Publicaciones`, 20_000);

    await abrirPublicaciones();
    for (const publicacion of publicaciones) await esperarLaFila(publicacion.nombre);

    // --- A. lo que ofrece el selector de cada fila -------------------------
    // No se comprueba una opcion elegida a mano: se enumeran TODAS las de TODAS
    // las filas dibujadas. Una opcion que el dominio no admite es una accion
    // falsa, y una del dominio que falta es una accion imposible.
    const porFila = await page.locator('tbody tr select[aria-label="Estado del producto"]')
      .evaluateAll((nodos) => nodos.map((nodo) => [...nodo.options].map((o) => o.value)));
    assert(porFila.length > 0, 'ninguna fila de Publicaciones ofrece el selector de estado');
    for (const ofrecidas of porFila) {
      const sobran = ofrecidas.filter((valor) => !dominio.includes(valor));
      const faltan = dominio.filter((valor) => !ofrecidas.includes(valor));
      assert(sobran.length === 0,
        `el selector de la fila ofrece estados que ProductStatus no tiene: `
        + `${JSON.stringify(sobran)} (ofrece ${JSON.stringify(ofrecidas)}, el dominio es `
        + `${JSON.stringify(dominio)})`);
      assert(faltan.length === 0,
        `el selector de la fila no ofrece estados del dominio: ${JSON.stringify(faltan)} `
        + `(ofrece ${JSON.stringify(ofrecidas)})`);
    }

    // --- B. por que «Borrador» no podia estar ------------------------------
    // Esto no reemplaza al control: es la medida del limite del dominio contra
    // el servidor real. El valor que la pantalla ofrecia hasta ahora es
    // rechazado, y la publicacion no cambia.
    const testigo = publicaciones[0];
    const antesDelRechazo = queryRows(
      `SELECT status::text FROM products WHERE id = ${sqlLiteral(testigo.id)}`)[0][0];
    const conDraft = await pedirCrudo(`/admin/products/${testigo.id}/status`, {
      method: 'PATCH', header: token, body: { status: 'draft' },
    });
    assert(conDraft.status === 400,
      `el servidor contesto ${conDraft.status} al estado «draft» que la pantalla ofrecia: `
      + `${JSON.stringify(conDraft.datos).slice(0, 140)}`);
    const despuesDelRechazo = queryRows(
      `SELECT status::text FROM products WHERE id = ${sqlLiteral(testigo.id)}`)[0][0];
    assert(antesDelRechazo === despuesDelRechazo,
      `«draft» fue rechazado pero la publicacion paso de ${antesDelRechazo} a ${despuesDelRechazo}`);

    // --- C. accionar el control real, un PATCH por vez ---------------------
    const cambiarDesdeElPanel = async (publicacion, estado) => {
      const [respuesta] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/admin/products/${publicacion.id}/status`)
          && r.request().method() === 'PATCH', { timeout: 20_000 }),
        selectorDe(publicacion.nombre).selectOption(estado),
      ]);
      const enviado = JSON.parse(respuesta.request().postData() || '{}');
      assert(enviado.status === estado,
        `se eligio «${estado}» en la fila de «${publicacion.nombre}» y el panel pidio `
        + `«${enviado.status}»`);
      assert(respuesta.status() === 200,
        `«${estado}» desde el control contesto ${respuesta.status()}: `
        + `${(await respuesta.text().catch(() => '')).slice(0, 140)}`);
      // La lista se vuelve a pedir sola: se espera a que la celda cambie, no un
      // tiempo fijo.
      await esperarA(async () => (await celdaDe(publicacion.nombre)) === estado,
        `la celda de Estado de «${publicacion.nombre}» no quedo en «${estado}» tras accionar `
        + `el control; muestra «${await celdaDe(publicacion.nombre)}»`, 20_000);
    };

    const accionados = [];
    for (const publicacion of publicaciones) {
      // Nace `active`: elegir el valor que ya tiene no dispara nada, asi que la
      // que tiene que terminar activa pasa antes por otro estado y vuelve.
      const inicial = await selectorDe(publicacion.nombre).inputValue();
      const pasos = inicial === publicacion.estado
        ? [dominio.find((estado) => estado !== publicacion.estado), publicacion.estado]
        : [publicacion.estado];
      for (const paso of pasos) {
        await cambiarDesdeElPanel(publicacion, paso);
        accionados.push(paso);
      }
    }
    for (const estado of dominio) {
      assert(accionados.includes(estado),
        `el caso no llego a accionar «${estado}» desde el control de la fila`);
    }

    // --- D. recargar y mirar lo persistido ---------------------------------
    await abrirPublicaciones();
    for (const publicacion of publicaciones) {
      await esperarLaFila(publicacion.nombre);
      const celda = await celdaDe(publicacion.nombre);
      assert(celda === publicacion.estado,
        `tras recargar, «${publicacion.nombre}» muestra «${celda}» en la celda de Estado y no `
        + `«${publicacion.estado}»`);
      const enElSelector = await selectorDe(publicacion.nombre).inputValue();
      assert(enElSelector === publicacion.estado,
        `tras recargar, el selector de «${publicacion.nombre}» quedo en «${enElSelector}»`);
      const enBase = queryRows(
        `SELECT status::text FROM products WHERE id = ${sqlLiteral(publicacion.id)}`)[0][0]
        .toLowerCase();
      assert(enBase === publicacion.estado,
        `en la base «${publicacion.nombre}» quedo en «${enBase}» y la pantalla dice «${celda}»`);
    }

    await contexto.close();
    return `cada fila de Publicaciones ofrece exactamente los ${dominio.length} estados de `
      + `ProductStatus (${dominio.join(', ')}), los mismos que el tipo de la base, y ninguna `
      + `ofrece «draft», que el servidor rechaza con ${conDraft.status} sin cambiar nada; los `
      + `${accionados.length} cambios se hicieron con el control real —un PATCH por vez, todos `
      + `200— y tras volver a entrar al panel las ${publicaciones.length} publicaciones muestran `
      + `en su celda de Estado lo que guardo la base: ${publicaciones
        .map((p) => p.estado).join(', ')}`;
  } finally {
    await browser.close();
  }
});

await runCase(147, 'La barra dice que seccion se mira, y Atras vuelve adonde estaba', async () => {
  // Toda navegacion se escribia con `replaceState`, sólo el Mercado se
  // serializaba, las pantallas de llegada conservaban su `pathname` y nadie
  // escuchaba `popstate`. Medido contra `49445fc`: cuatro clics en la cabecera
  // dejaban UNA sola entrada —el primer Atras salia del sitio—,
  // `?section=services|about|contact` dibujaba Inicio, el filtro del Mercado se
  // colaba en la URL de otra seccion y no volvia con Atras, salir de
  // /payment/* o de /verificar-correo por la cabecera dejaba el `pathname`
  // puesto —recargar revivia la pantalla— y el detalle no tenia entrada propia.
  //
  // Este caso recorre las cinco secciones por la interfaz y contrasta AL MISMO
  // TIEMPO lo que dice la barra, lo que marca la cabecera y lo que hay dibujado.

  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const sello = Date.now();
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');
  const [categoriaDeServicio] = queryRows(`
    SELECT id, 'fin' FROM categories
    WHERE is_service = true AND is_active = true ORDER BY name LIMIT 1`);
  const [categoriaDeProducto] = queryRows(`
    SELECT id, 'fin' FROM categories
    WHERE is_service = false AND is_active = true ORDER BY name LIMIT 1`);

  // Dos publicaciones propias: la de servicio encabeza la vista previa de
  // Servicios y la de producto —creada ultima— encabeza la de Inicio y es el
  // unico resultado de su propia busqueda en el Mercado.
  const servicio = `Nav147 servicio ${sello}`;
  const publicacion = `Nav147 publicacion ${sello}`;
  const altaDelServicio = await apiRequest('/products', {
    method: 'POST', token: vendedor.token,
    body: {
      name: servicio,
      description: 'Servicio efimero del caso 147, para abrir su detalle desde Servicios.',
      category_id: categoriaDeServicio[0],
      price: 0,
      unit: 'servicio',
      locality_id: localidad,
      publication_type: 'servicio',
      operation_kind: 'servicio',
      pricing_type: 'a_convenir',
    },
  });
  assert(altaDelServicio.status < 400, `no se pudo publicar el servicio: HTTP ${altaDelServicio.status}`);
  const altaDelProducto = await apiRequest('/products', {
    method: 'POST', token: vendedor.token,
    body: {
      name: publicacion,
      description: 'Publicacion efimera del caso 147, para abrir su detalle y filtrar por ella.',
      category_id: categoriaDeProducto[0],
      price: 1470,
      stock: 4,
      unit: 'kg',
      locality_id: localidad,
      publication_type: 'producto',
      operation_kind: 'insumo',
    },
  });
  assert(altaDelProducto.status < 400, `no se pudo publicar: HTTP ${altaDelProducto.status}`);

  const TITULO_DE = {
    home: /Equipos, insumos y servicios/,
    marketplace: /Operaciones disponibles/,
    services: /Encontrá quién resuelve/,
    about: /Información/,
    contact: /^Contacto$/,
  };
  const CELDA_DE = {
    home: 'Inicio',
    marketplace: 'Mercado',
    services: 'Servicios',
    about: 'Quiénes somos',
    contact: 'Contacto',
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    const page = await contexto.newPage();

    const barra = () => {
      const u = new URL(page.url());
      return `${u.pathname}${u.search}`;
    };
    const tituloVisible = async () => (await page.locator('h1').first().innerText()
      .catch(() => '')).replace(/\s+/g, ' ').trim();
    const celdaMarcada = async () => (await page
      .locator('nav[aria-label="Secciones del sitio"] [aria-current="page"]').allInnerTexts())
      .map((t) => t.trim());

    // Las tres cosas juntas: lo que hay dibujado, lo que marca la cabecera y lo
    // que dice la barra. Mirar una sola dejaria pasar justo lo que falla.
    const enLaSeccion = async (seccion, url, momento) => {
      await esperarA(async () => TITULO_DE[seccion].test(await tituloVisible()),
        `${momento}: se esperaba ${seccion} y hay «${await tituloVisible()}» con la barra `
        + `en «${barra()}»`, 20_000);
      assert(barra() === url,
        `${momento}: la pantalla es ${seccion} y la barra dice «${barra()}» en vez de «${url}»`);
      const marcada = await celdaMarcada();
      assert(marcada.length === 1 && marcada[0] === CELDA_DE[seccion],
        `${momento}: la cabecera marca ${JSON.stringify(marcada)} y la pantalla es ${seccion}`);
    };
    const celda = (texto) => page.getByRole('button', { name: texto, exact: true }).first();
    const irA = async (seccion, url, momento) => {
      await celda(CELDA_DE[seccion]).click();
      await enLaSeccion(seccion, url, momento);
    };

    // --- A. las cinco secciones, ida y vuelta -----------------------------
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await enLaSeccion('home', '/', 'al entrar');
    const RECORRIDO = [
      ['marketplace', '/?section=marketplace'],
      ['services', '/?section=services'],
      ['about', '/?section=about'],
      ['contact', '/?section=contact'],
    ];
    for (const [seccion, url] of RECORRIDO) await irA(seccion, url, `recorrido a ${seccion}`);

    // Elegir la seccion que ya esta no agrega una entrada: si agregara, el
    // Atras siguiente se quedaria en Contacto en vez de volver.
    await irA('contact', '/?section=contact', 'Contacto de nuevo');
    const vuelta = [
      ['about', '/?section=about'],
      ['services', '/?section=services'],
      ['marketplace', '/?section=marketplace'],
      ['home', '/'],
    ];
    for (const [seccion, url] of vuelta) {
      await page.goBack();
      await enLaSeccion(seccion, url, `Atras hasta ${seccion}`);
    }
    await page.goForward();
    await enLaSeccion('marketplace', '/?section=marketplace', 'Adelante');

    // --- B. las cinco URL canonicas, abiertas y recargadas -----------------
    for (const [seccion, url] of [['home', '/'], ...RECORRIDO]) {
      await page.goto(`${FRONTEND_URL}${url}`, { waitUntil: 'domcontentloaded' });
      await enLaSeccion(seccion, url, `enlace directo a ${url}`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await enLaSeccion(seccion, url, `recarga de ${url}`);
    }

    // --- C. los filtros del Mercado vuelven con su entrada -----------------
    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await enLaSeccion('marketplace', '/?section=marketplace', 'Mercado sin filtros');

    const titulosDeLasTarjetas = async () => (await page.locator('article h3').allInnerTexts())
      .map((t) => t.replace(/\s+/g, ' ').trim());
    const buscador = page.getByLabel('Buscar en el mercado');
    const tipo = page.locator('#catalog-type');

    await buscador.fill(publicacion);
    await buscador.press('Enter');
    await tipo.selectOption('productos');
    const conFiltros = `/?${new URLSearchParams({
      section: 'marketplace', q: publicacion, type: 'productos',
    }).toString()}`;
    await esperarA(async () => barra() === conFiltros,
      `los filtros no llegaron a la barra: «${barra()}»`, 20_000);
    await esperarA(async () => {
      const titulos = await titulosDeLasTarjetas();
      return titulos.length === 1 && titulos[0] === publicacion;
    }, `el filtro no dejo sola a «${publicacion}»: ${JSON.stringify(await titulosDeLasTarjetas())}`,
    20_000);

    await irA('services', '/?section=services', 'salir del Mercado filtrado');
    await page.goBack();
    await enLaSeccion('marketplace', conFiltros, 'volver al Mercado filtrado');
    // No alcanza con la direccion: los controles y los resultados tambien.
    await esperarA(async () => (await buscador.inputValue()) === publicacion,
      `al volver, el buscador dice «${await buscador.inputValue()}»`, 20_000);
    assert((await tipo.inputValue()) === 'productos',
      `al volver, el tipo quedo en «${await tipo.inputValue()}»`);
    await esperarA(async () => {
      const titulos = await titulosDeLasTarjetas();
      return titulos.length === 1 && titulos[0] === publicacion;
    }, `al volver, la lista es ${JSON.stringify(await titulosDeLasTarjetas())}`, 20_000);

    // --- D. las pantallas de llegada no reviven ----------------------------
    const LLEGADAS = [
      ['/payment/success', 'cabecera'],
      ['/payment/failure', 'cabecera'],
      ['/payment/pending', 'CTA'],
      ['/verificar-correo', 'CTA'],
    ];
    for (const [ruta, salida] of LLEGADAS) {
      await page.goto(`${FRONTEND_URL}${ruta}`, { waitUntil: 'domcontentloaded' });
      await esperarA(async () => (await tituloVisible()).length > 0
        && !TITULO_DE.home.test(await tituloVisible()),
      `${ruta} no dibujo su pantalla`, 20_000);
      assert(barra() === ruta, `${ruta}: la barra dice «${barra()}»`);
      assert((await celdaMarcada()).length === 0,
        `${ruta}: la cabecera marca ${JSON.stringify(await celdaMarcada())} y esto no es una seccion`);

      if (salida === 'cabecera') await celda('Inicio').click();
      else await celda('Volver al inicio').click();
      await enLaSeccion('home', '/', `salir de ${ruta} por ${salida}`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await enLaSeccion('home', '/', `recargar despues de salir de ${ruta}`);
    }

    // --- E. el detalle es una capa, no una ubicacion ------------------------
    const detalleAbierto = async () => (await page.locator('#detalle-titulo').count()) > 0;
    const tituloDelDetalle = async () => (await page.locator('#detalle-titulo').innerText()
      .catch(() => '(cerrado)')).trim();
    const abrirDetalleDe = async (nombre) => {
      const tarjeta = page.locator('article').filter({ hasText: nombre }).first();
      await tarjeta.waitFor({ state: 'visible', timeout: 20_000 });
      await tarjeta.click();
      await esperarA(async () => (await tituloDelDetalle()) === nombre,
        `no se abrio el detalle de «${nombre}»: ${await tituloDelDetalle()}`, 20_000);
    };

    // Desde Inicio y desde Servicios, sobre las vistas previas.
    for (const [seccion, url, nombre] of [
      ['home', '/', publicacion],
      ['services', '/?section=services', servicio],
    ]) {
      await page.goto(`${FRONTEND_URL}${url}`, { waitUntil: 'domcontentloaded' });
      await enLaSeccion(seccion, url, `${seccion} antes del detalle`);
      await abrirDetalleDe(nombre);
      assert(barra() === url,
        `abrir el detalle en ${seccion} cambio la barra a «${barra()}»`);
      await page.goBack();
      await esperarA(async () => !(await detalleAbierto()),
        `en ${seccion}, el primer Atras no cerro el detalle`, 20_000);
      await enLaSeccion(seccion, url, `${seccion} despues de cerrar con Atras`);
    }

    // Desde el Mercado filtrado: el primer Atras cierra el detalle y deja
    // intactos filtros y listado.
    await page.goto(`${FRONTEND_URL}${conFiltros}`, { waitUntil: 'domcontentloaded' });
    await enLaSeccion('marketplace', conFiltros, 'Mercado filtrado antes del detalle');
    await abrirDetalleDe(publicacion);
    await page.goBack();
    await esperarA(async () => !(await detalleAbierto()),
      'en el Mercado, el primer Atras no cerro el detalle', 20_000);
    await enLaSeccion('marketplace', conFiltros, 'Mercado despues de cerrar con Atras');
    assert((await buscador.inputValue()) === publicacion,
      `cerrar el detalle con Atras perdio el filtro: «${await buscador.inputValue()}»`);
    const trasElDetalle = await titulosDeLasTarjetas();
    assert(trasElDetalle.length === 1 && trasElDetalle[0] === publicacion,
      `cerrar el detalle con Atras cambio el listado: ${JSON.stringify(trasElDetalle)}`);

    // Y cerrar con la propia interfaz no deja una entrada fantasma: despues de
    // cerrar con Escape, UN Atras tiene que llevar a la seccion anterior.
    await irA('services', '/?section=services', 'ir a Servicios para el fantasma');
    await irA('marketplace', conFiltros, 'volver al Mercado para el fantasma');
    await abrirDetalleDe(publicacion);
    await page.keyboard.press('Escape');
    await esperarA(async () => !(await detalleAbierto()),
      'el detalle no se cerro con Escape', 20_000);
    await enLaSeccion('marketplace', conFiltros, 'Mercado despues de cerrar con Escape');
    await page.goBack();
    await enLaSeccion('services', '/?section=services',
      'un Atras despues de cerrar con la interfaz');

    await contexto.close();
    return 'las cinco secciones publicas se dicen en la barra —«/» y «?section=…»—, el '
      + 'recorrido por la cabecera deja cuatro entradas de verdad que Atras y Adelante '
      + 'recorren con la pantalla y la celda marcada, elegir la seccion activa no agrega '
      + 'ninguna, las cinco URL canonicas abren y recargan en su seccion, el Mercado '
      + `filtrado vuelve con Atras a «${conFiltros}» con el buscador, el tipo y su unico `
      + 'resultado, las cuatro pantallas de llegada normalizan el pathname al salir y no '
      + 'reviven al recargar, y el detalle abierto desde Inicio, Servicios y el Mercado se '
      + 'cierra con el primer Atras sin perder seccion ni filtros, sin dejar entrada '
      + 'fantasma cuando se cierra con Escape';
  } finally {
    await browser.close();
  }
});

await runCase(148, 'Cada capa se cierra sola y devuelve el foco a su disparador', async () => {
  // Dos bordes distintos.
  //
  // C1 —el foco vuelve al disparador del detalle— ya lo cerraba `useCapaModal`
  // cuando se escribio ese hook; se mide igual, porque una regresion que no
  // cubre lo que ya anda no avisa el dia que se rompe.
  //
  // ADM-8 estaba abierto: el detalle de una orden era un `div` suelto, sin
  // `role="dialog"` y fuera de la pila de capas. Medido contra `bcdd448`: con
  // el detalle abierto habia UN solo dialogo, el foco se quedaba afuera —en el
  // boton «Ver»—, Tab caminaba por la tabla de atras y el primer Escape cerraba
  // Administracion entera, con su pestaña, su filtro, su pagina y su scroll.

  const admin = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'admin@topgreen.com', password: 'admin123' },
  });
  const token = admin.data.access_token;
  const vendedor = await ingresarVendedor('vendedor@ejemplo.com', 'vendedor123');
  const comprador = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const tokenComprador = comprador.data.access_token;

  const sello = Date.now();
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');

  // Un servicio y un activo propios: los dos dibujan el boton «Ver detalle» en
  // su tarjeta —un insumo a la venta no lo dibuja—, y creados en este orden el
  // activo encabeza la vista previa de Inicio y el servicio la de Servicios.
  const [categoriaDeServicio] = queryRows(`
    SELECT id, 'fin' FROM categories
    WHERE is_service = true AND is_active = true ORDER BY name LIMIT 1`);
  const [categoriaDeActivos] = queryRows(`
    SELECT id, 'fin' FROM categories WHERE slug = 'maquinaria-agricola'`);
  const [categoriaDeProductos] = queryRows(`
    SELECT id, 'fin' FROM categories
    WHERE is_service = false AND is_active = true ORDER BY name LIMIT 1`);
  assert(categoriaDeActivos, 'no esta la categoria de maquinaria para publicar un activo');

  const servicio = `Capa148 servicio ${sello}`;
  const activo = `Capa148 activo ${sello}`;
  const altaDelServicio = await apiRequest('/products', {
    method: 'POST', token: vendedor.token,
    body: {
      name: servicio,
      description: 'Servicio efimero del caso 148, para abrir su detalle desde Servicios.',
      category_id: categoriaDeServicio[0],
      price: 0,
      unit: 'servicio',
      locality_id: localidad,
      publication_type: 'servicio',
      operation_kind: 'servicio',
      pricing_type: 'a_convenir',
    },
  });
  assert(altaDelServicio.status < 400,
    `no se pudo publicar el servicio: HTTP ${altaDelServicio.status}`);
  const altaDelActivo = await apiRequest('/products', {
    method: 'POST', token: vendedor.token,
    body: {
      name: activo,
      description: 'Publicacion efimera del caso 148, para abrir su detalle desde Inicio.',
      category_id: categoriaDeActivos[0],
      price: 14800,
      stock: 1,
      unit: 'unidad',
      locality_id: localidad,
      publication_type: 'producto',
      operation_kind: 'activo',
    },
  });
  assert(altaDelActivo.status < 400, `no se pudo publicar el activo: HTTP ${altaDelActivo.status}`);

  // Ordenes por transferencia, para que Administracion tenga un filtro con dos
  // paginas LLENAS: sin la segunda no se puede demostrar que la pagina se
  // conserva, y sin filas suficientes la tabla no se desplaza y no hay scroll
  // que conservar. Se cuenta lo que ya hay y se completa lo que falte.
  const ESTADO_DE_ORDEN = 'awaiting_transfer_receipt';
  const HACEN_FALTA = 41;
  const { data: yaHabia } = await apiRequest(
    `/admin/orders?page=1&page_size=1&status=${ESTADO_DE_ORDEN}`, { token });
  const ORDENES = Math.max(0, HACEN_FALTA - (yaHabia.total || 0));

  // El insumo del que se compra es del caso: asi no depende de que el seed
  // tenga una publicacion con stock suficiente.
  const insumo = `Capa148 insumo ${sello}`;
  const altaDelInsumo = await apiRequest('/products', {
    method: 'POST', token: vendedor.token,
    body: {
      name: insumo,
      description: 'Insumo efimero del caso 148, para armar las ordenes que llenan la tabla.',
      category_id: categoriaDeProductos[0],
      price: 148,
      stock: HACEN_FALTA + 5,
      unit: 'kg',
      locality_id: localidad,
      publication_type: 'producto',
      operation_kind: 'insumo',
    },
  });
  assert(altaDelInsumo.status < 400 && altaDelInsumo.data?.id,
    `no se pudo publicar el insumo: HTTP ${altaDelInsumo.status}`);
  const productoParaComprar = altaDelInsumo.data.id;

  await apiRequest('/cart', { method: 'DELETE', token: tokenComprador });
  const ordenesDelCaso = [];
  for (let i = 1; i <= ORDENES; i += 1) {
    await apiRequest('/cart/items', {
      method: 'POST', token: tokenComprador,
      body: { product_id: productoParaComprar, quantity: 1 },
    });
    const checkout = await apiRequest('/orders/checkout/transfer', {
      method: 'POST', token: tokenComprador,
      body: {
        shipping_address: `Ruta 148 km ${i}`,
        shipping_locality_id: localidad,
        shipping_postal_code: '2700',
        shipping_decisions: [{ seller_id: vendedor.id, mode: 'self' }],
      },
    });
    const [orden] = checkout.data.orders;
    assert(orden?.order_number, `la orden ${i} no salio: ${JSON.stringify(checkout.data)}`);
    ordenesDelCaso.push(orden.order_number);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await contexto.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: token, r: admin.data.refresh_token });
    const page = await contexto.newPage();

    const dialogos = () => page.locator('[role="dialog"]').count();
    const focoEn = (locator) => locator.evaluate((el) => el === document.activeElement);
    const focoDentroDe = (locator) => locator.evaluate((el) => el.contains(document.activeElement));
    const dondeEstaElFoco = () => page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '(el documento)';
      const nombre = activo.getAttribute('aria-label')
        || (activo.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return `<${activo.tagName.toLowerCase()}> «${nombre}»`;
    });

    // --- A. C1: el detalle devuelve el foco a SU disparador -----------------
    // El disparador se identifica por publicacion —la tarjeta que lo dibuja—,
    // no por «el primer boton que aparezca».
    const cerradas = [];
    const revisarElDetalle = async (pantalla, url, nombre) => {
      for (const forma of ['Escape', 'X', 'fondo']) {
        await page.goto(`${FRONTEND_URL}${url}`, { waitUntil: 'domcontentloaded' });
        const tarjeta = page.locator('article').filter({ hasText: nombre }).first();
        await tarjeta.waitFor({ state: 'visible', timeout: 20_000 });
        const disparador = tarjeta.getByRole('button', { name: 'Ver detalle' });
        // Se espera a que la tarjeta termine de dibujarse: en el Mercado la
        // grilla se rehace cuando llega la respuesta filtrada, y entre un
        // dibujo y el otro el boton no esta.
        await esperarA(async () => (await disparador.count()) === 1,
          `${pantalla}: la tarjeta de «${nombre}» no dibuja «Ver detalle»`, 20_000);

        await disparador.click();
        await esperarA(async () => (await page.locator('#detalle-titulo').count()) === 1,
          `${pantalla}: no se abrio el detalle de «${nombre}»`, 20_000);
        const capa = page.locator('[role="dialog"]').first();
        assert(await dialogos() === 1,
          `${pantalla}: con el detalle abierto hay ${await dialogos()} dialogos`);
        assert(await focoDentroDe(capa),
          `${pantalla}: el foco no entro en la capa, esta en ${await dondeEstaElFoco()}`);

        if (forma === 'Escape') await page.keyboard.press('Escape');
        else if (forma === 'X') await capa.getByRole('button', { name: 'Cerrar' }).click();
        else await page.mouse.click(5, 5);

        await esperarA(async () => (await dialogos()) === 0,
          `${pantalla}: cerrar con ${forma} no cerro la capa`, 20_000);
        await esperarA(() => focoEn(disparador),
          `${pantalla}: cerrar con ${forma} dejo el foco en ${await dondeEstaElFoco()} y no en el `
          + `«Ver detalle» de «${nombre}»`, 20_000);
        cerradas.push(`${pantalla}/${forma}`);
      }
    };
    await revisarElDetalle('Inicio', '/', activo);
    await revisarElDetalle('Mercado', `/?section=marketplace&q=${encodeURIComponent(activo)}`, activo);
    await revisarElDetalle('Servicios', '/?section=services', servicio);

    // --- B. la pila: detalle -> perfil del vendedor -------------------------
    // Control de lo que ya existia: un Escape cierra UN nivel, y el foco vuelve
    // nivel por nivel.
    await page.goto(`${FRONTEND_URL}/?section=services`, { waitUntil: 'domcontentloaded' });
    const tarjetaDelServicio = page.locator('article').filter({ hasText: servicio }).first();
    await tarjetaDelServicio.waitFor({ state: 'visible', timeout: 20_000 });
    const verDetalle = tarjetaDelServicio.getByRole('button', { name: 'Ver detalle' });
    await verDetalle.click();
    await esperarA(async () => (await page.locator('#detalle-titulo').count()) === 1,
      'no se abrio el detalle para la pila', 20_000);
    const verPerfil = page.getByRole('button', { name: 'Ver perfil del vendedor' });
    assert(await verPerfil.count() === 1, 'el detalle no ofrece el perfil del vendedor');
    await verPerfil.click();
    await esperarA(async () => (await dialogos()) === 2,
      `con el perfil abierto hay ${await dialogos()} dialogos y tendria que haber 2`, 20_000);
    const capaDelPerfil = page.locator('[role="dialog"]').last();
    assert(await focoDentroDe(capaDelPerfil),
      `el foco no entro en el perfil, esta en ${await dondeEstaElFoco()}`);
    await page.keyboard.press('Escape');
    await esperarA(async () => (await dialogos()) === 1,
      'el primer Escape no cerro solo el perfil', 20_000);
    await esperarA(() => focoEn(verPerfil),
      `cerrar el perfil dejo el foco en ${await dondeEstaElFoco()}`, 20_000);
    await page.keyboard.press('Escape');
    await esperarA(async () => (await dialogos()) === 0,
      'el segundo Escape no cerro el detalle', 20_000);
    await esperarA(() => focoEn(verDetalle),
      `cerrar el detalle dejo el foco en ${await dondeEstaElFoco()}`, 20_000);

    // --- C. ADM-8: el detalle de orden es una capa y no atraviesa nada ------
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    const botonAdmin = page.getByRole('button', { name: 'Admin' });
    await botonAdmin.click();
    await page.getByRole('heading', { name: 'Panel de Administración' })
      .waitFor({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Órdenes', exact: true }).click();
    await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 20_000 });

    const pestanaActiva = async () => (await page
      .locator('button[class*="_tab_"][class*="_active_"]').innerText()).replace(/\s+/g, ' ').trim();
    const filtroDeOrdenes = page.getByLabel('Filtrar órdenes por estado');
    const paginaQueDice = async () => (await page.locator('[class*="paginaActual"]').innerText())
      .replace(/\s+/g, ' ').trim();
    const contenido = page.locator('[class*="_content_"]').first();
    const scrollDelPanel = () => contenido.evaluate((el) => el.scrollTop);
    const numerosVisibles = async () => (await page.locator('tbody tr td:nth-child(1)')
      .allInnerTexts()).map((t) => t.trim());

    await filtroDeOrdenes.selectOption(ESTADO_DE_ORDEN);
    const { data: filtradas } = await apiRequest(
      `/admin/orders?page=1&page_size=20&status=${ESTADO_DE_ORDEN}`, { token });
    assert(filtradas.total > 20,
      `el caso necesita mas de una pagina con el filtro y hay ${filtradas.total} ordenes`);
    await esperarA(async () => (await page.locator('[class*="pagination"]').innerText())
      .includes(`Total: ${filtradas.total} órdenes`),
    'el filtro de ordenes no llego a la pantalla', 20_000);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/admin/orders')
        && r.url().includes('page=2') && r.status() === 200, { timeout: 20_000 }),
      page.getByRole('button', { name: 'Página siguiente de órdenes' }).click(),
    ]);
    await esperarA(async () => (await paginaQueDice()).startsWith('Página 2 de'),
      'Órdenes no paso a la pagina 2', 20_000);

    // Un desplazamiento real, con la rueda, para tener qué conservar.
    await contenido.hover();
    await page.mouse.wheel(0, 400);
    await esperarA(async () => (await scrollDelPanel()) > 0,
      'el panel no llego a desplazarse', 20_000);

    const antes = {
      pestana: await pestanaActiva(),
      filtro: await filtroDeOrdenes.inputValue(),
      pagina: await paginaQueDice(),
      scroll: await scrollDelPanel(),
      numeros: await numerosVisibles(),
    };
    assert(antes.numeros.length > 1,
      `la pagina 2 del filtro trae ${antes.numeros.length} fila(s) y el caso necesita elegir una`);
    // La fila del medio, identificada por SU numero de orden y no por posicion.
    const laOrden = antes.numeros[Math.floor(antes.numeros.length / 2)];
    const fila = page.locator('tbody tr').filter({ hasText: laOrden });
    const verLaOrden = fila.getByRole('button', { name: /^Ver/ });

    const revisarElDetalleDeOrden = async (forma) => {
      await verLaOrden.click();
      await esperarA(async () => (await dialogos()) === 2,
        `con el detalle de la orden abierto hay ${await dialogos()} dialogo(s) y tendria que `
        + 'haber 2: el panel y el detalle', 20_000);
      const capaDeLaOrden = page.locator('[role="dialog"][aria-labelledby="titulo-de-la-orden"]');
      assert(await capaDeLaOrden.count() === 1,
        'el detalle de la orden no es una capa con nombre accesible');
      const nombreAccesible = (await capaDeLaOrden.locator('#titulo-de-la-orden').innerText())
        .replace(/\s+/g, ' ').trim();
      assert(nombreAccesible.includes(laOrden),
        `la capa se llama «${nombreAccesible}» y la orden abierta es ${laOrden}`);
      assert((await capaDeLaOrden.getAttribute('aria-modal')) === 'true',
        'el detalle de la orden no se declara modal');
      assert((await page.evaluate(() => document.body.style.overflow)) === 'hidden',
        'el fondo no quedo trabado con el detalle de la orden abierto');
      assert(await focoDentroDe(capaDeLaOrden),
        `el foco no entro en el detalle de la orden, esta en ${await dondeEstaElFoco()}`);

      // La trampa: en los dos extremos el foco se queda adentro de la capa.
      await page.keyboard.press('Tab');
      assert(await focoDentroDe(capaDeLaOrden),
        `Tab se escapo del detalle de la orden a ${await dondeEstaElFoco()}`);
      await page.keyboard.press('Shift+Tab');
      assert(await focoDentroDe(capaDeLaOrden),
        `Shift+Tab se escapo del detalle de la orden a ${await dondeEstaElFoco()}`);

      if (forma === 'Escape') await page.keyboard.press('Escape');
      else if (forma === 'X') await capaDeLaOrden.getByRole('button', { name: 'Cerrar' }).click();
      else await page.mouse.click(5, 5);

      await esperarA(async () => (await dialogos()) === 1,
        `cerrar con ${forma} dejo ${await dialogos()} dialogo(s): tenia que cerrar solo el `
        + 'detalle de la orden', 20_000);
      assert(await page.getByRole('heading', { name: 'Panel de Administración' }).count() === 1,
        `cerrar el detalle con ${forma} cerro tambien Administracion`);
      await esperarA(() => focoEn(verLaOrden),
        `cerrar con ${forma} dejo el foco en ${await dondeEstaElFoco()} y no en el «Ver» de la `
        + `orden ${laOrden}`, 20_000);

      // Y el lugar donde estaba: pestaña, filtro, pagina, scroll y las filas.
      assert((await pestanaActiva()) === antes.pestana,
        `cerrar con ${forma} cambio la pestaña a «${await pestanaActiva()}»`);
      assert((await filtroDeOrdenes.inputValue()) === antes.filtro,
        `cerrar con ${forma} cambio el filtro a «${await filtroDeOrdenes.inputValue()}»`);
      assert((await paginaQueDice()) === antes.pagina,
        `cerrar con ${forma} cambio la pagina a «${await paginaQueDice()}»`);
      assert((await scrollDelPanel()) === antes.scroll,
        `cerrar con ${forma} movio el scroll de ${antes.scroll} a ${await scrollDelPanel()}`);
      const ahora = await numerosVisibles();
      assert(JSON.stringify(ahora) === JSON.stringify(antes.numeros),
        `cerrar con ${forma} cambio las filas: ${JSON.stringify(ahora)}`);
      assert(ahora.includes(laOrden),
        `la orden ${laOrden} ya no esta en la lista despues de cerrar con ${forma}`);
    };

    for (const forma of ['Escape', 'X', 'fondo']) await revisarElDetalleDeOrden(forma);

    // El segundo Escape —sin detalle abierto— sí cierra el panel, y el foco
    // vuelve al boton que lo abrio.
    await page.keyboard.press('Escape');
    await esperarA(async () => (await dialogos()) === 0,
      'el Escape sobre el panel sin capas encima no lo cerro', 20_000);
    await esperarA(() => focoEn(botonAdmin),
      `cerrar Administracion dejo el foco en ${await dondeEstaElFoco()}`, 20_000);

    await contexto.close();
    return `el detalle de una publicacion devuelve el foco a SU «Ver detalle» en las `
      + `${cerradas.length} combinaciones de pantalla y forma de cerrar (${cerradas.join(', ')}); `
      + 'la pila del perfil del vendedor cierra un nivel por Escape y devuelve el foco nivel por '
      + `nivel; y el detalle de la orden ${laOrden} es la segunda capa —con nombre accesible, `
      + 'foco adentro y Tab/Shift+Tab que no se escapan—, se cierra sola con Escape, X y fondo '
      + `dejando Administracion abierta en «${antes.pestana}» con el filtro «${antes.filtro}», `
      + `«${antes.pagina}», scroll ${antes.scroll} y las mismas ${antes.numeros.length} filas, y `
      + 'recien el Escape siguiente cierra el panel y devuelve el foco al boton Admin';
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: tokenComprador });
  }
});

await runCase(149, 'Cerrar un formulario con trabajo sin guardar pregunta una sola vez', async () => {
  // Medido contra `b07ebce`, y no falla igual en los cinco:
  //
  //   perfil de transportista + Escape  -> cerraba Mi Panel sin avisar y el
  //                                        radio volvia al ultimo guardado
  //   alta + clic en el fondo           -> cerraba sin avisar y el borrador
  //                                        REAPARECIA al volver a abrir
  //   edicion + X                       -> cerraba sin avisar y la descripcion
  //                                        volvia a la guardada
  //   checkout + Escape                 -> cerraba sin avisar y la direccion
  //                                        escrita se perdia
  //   calificacion + clic en el fondo   -> cerraba la calificacion Y Mi Panel
  //                                        entero, y el comentario se perdia
  //
  // Ahora los cinco pasan por la misma politica: limpio cierra derecho, sucio
  // pregunta una vez, y la pregunta es la capa de arriba.

  const sello = Date.now();
  const ingresoDelVendedor = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  });
  const vendedor = {
    token: ingresoDelVendedor.data.access_token,
    id: ingresoDelVendedor.data.user.id,
    datos: ingresoDelVendedor.data,
  };
  const comprador = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const tokenComprador = comprador.data.access_token;

  // Un transportista propio: el perfil con los datos de transporte es uno de
  // los cinco formularios y el seed no trae ninguno.
  const correoDelTransportista = `transportista.149.${sello}@example.com`;
  const claveDelTransportista = 'smoke149';
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');
  await registrarYVerificar({
    email: correoDelTransportista,
    password: claveDelTransportista,
    full_name: 'Transportista Del Caso 149',
    is_carrier: true,
    carrier_base_locality_id: localidad,
    carrier_transport: 'Camion del caso 149',
    carrier_transport_certified: true,
    carrier_certification_detail: 'RUTA, cargas generales, N.° 149',
    carrier_coverage_radius_km: 100,
  });
  const transportista = await apiRequest('/auth/login', {
    method: 'POST', body: { email: correoDelTransportista, password: claveDelTransportista },
  });
  assert(transportista.data?.user?.is_carrier === true, 'el transportista del caso no quedó marcado');

  // Una publicación propia para editar y un insumo con stock para comprar.
  const [categoriaDeProductos] = queryRows(`
    SELECT id, 'fin' FROM categories
    WHERE is_service = false AND is_active = true ORDER BY name LIMIT 1`);
  const publicable = async (nombre, stock) => {
    const alta = await apiRequest('/products', {
      method: 'POST', token: vendedor.token,
      body: {
        name: nombre,
        description: `Publicacion efimera del caso 149 (${nombre}).`,
        category_id: categoriaDeProductos[0],
        price: 1490,
        stock,
        unit: 'kg',
        locality_id: localidad,
        publication_type: 'producto',
        operation_kind: 'insumo',
      },
    });
    assert(alta.status < 400 && alta.data?.id, `no se pudo publicar «${nombre}»: HTTP ${alta.status}`);
    return alta.data.id;
  };
  const paraEditar = `Form149 para editar ${sello}`;
  const paraComprar = `Form149 para comprar ${sello}`;
  await publicable(paraEditar, 5);
  const idParaComprar = await publicable(paraComprar, 20);

  // Una orden entregada, para que exista «Calificar Vendedor». Se llega por las
  // rutas reales: transferencia aprobada, confirmada, despachada y recibida.
  await apiRequest('/cart', { method: 'DELETE', token: tokenComprador });
  await apiRequest('/cart/items', {
    method: 'POST', token: tokenComprador, body: { product_id: idParaComprar, quantity: 1 },
  });
  const checkoutDelCaso = await apiRequest('/orders/checkout/transfer', {
    method: 'POST', token: tokenComprador,
    body: {
      shipping_address: 'Ruta 149 km 1',
      shipping_locality_id: localidad,
      shipping_postal_code: '2700',
      shipping_decisions: [{ seller_id: vendedor.id, mode: 'self' }],
    },
  });
  const [ordenParaCalificar] = checkoutDelCaso.data.orders;
  assert(ordenParaCalificar?.order_id, 'no salió la orden que se va a calificar');
  const aprobacion = await apiRequest(`/orders/${ordenParaCalificar.order_id}/transfer-receipt`, {
    method: 'PATCH', token: vendedor.token, body: { decision: 'approve' },
  });
  assert(aprobacion.status < 400, `no se pudo aprobar la transferencia: HTTP ${aprobacion.status}`);
  for (const [estado, token] of [
    ['confirmed', vendedor.token], ['shipped', vendedor.token], ['delivered', tokenComprador],
  ]) {
    const paso = await apiRequest(`/orders/${ordenParaCalificar.order_id}/status`, {
      method: 'PATCH', token, body: { status: estado },
    });
    assert(paso.status < 400, `la orden no pasó a «${estado}»: HTTP ${paso.status}`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const sesion = async (datos) => {
      const contexto = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
      await contexto.addInitScript(({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
      }, { a: datos.access_token, r: datos.refresh_token });
      return contexto.newPage();
    };
    const pregunta = (page) => page.locator('[aria-labelledby="titulo-cambios-sin-guardar"]');
    const hayPregunta = async (page) => (await pregunta(page).count()) === 1;
    const dialogos = (page) => page.locator('[role="dialog"]').count();
    const seguirEditando = (page) => page.getByRole('button', { name: 'Seguir editando' }).click();
    const descartar = (page) => page.getByRole('button', { name: 'Descartar cambios' }).click();
    const panelAbierto = async (page) =>
      (await page.getByRole('heading', { name: 'Mi Panel' }).count()) === 1;
    const abrirPanel = async (page) => {
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Mi cuenta' }).click();
      await page.getByRole('heading', { name: 'Mi Panel' }).waitFor({ timeout: 20_000 });
    };
    const equisDelPanel = (page) =>
      page.locator('[aria-label="Mi cuenta"] > button[aria-label="Cerrar"]');
    const sinPregunta = async (page, momento) => {
      await esperarA(async () => !(await hayPregunta(page)),
        `${momento}: quedó una pregunta abierta`, 20_000);
    };
    const preguntoUnaSolaVez = async (page, momento) => {
      await esperarA(() => hayPregunta(page),
        `${momento}: no preguntó nada antes de cerrar`, 20_000);
      assert((await pregunta(page).count()) === 1,
        `${momento}: se abrieron ${await pregunta(page).count()} preguntas`);
    };
    const cerrados = [];

    // --- 1. PERFIL DE TRANSPORTISTA: limpio cierra; sucio pregunta ----------
    {
      const page = await sesion(transportista.data);
      await abrirPanel(page);
      // Limpio: entrar en edición y cerrar el panel no pregunta nada.
      await page.getByRole('button', { name: /editar/i }).first().click();
      const radio = page.locator('#perfil-radio');
      await radio.waitFor({ state: 'visible', timeout: 20_000 });
      const original = await radio.inputValue();
      await equisDelPanel(page).click();
      await esperarA(async () => !(await panelAbierto(page)),
        'perfil limpio: la X del panel no cerró', 20_000);
      await sinPregunta(page, 'perfil limpio');
      cerrados.push('perfil limpio/X del panel');

      // Sucio: el mismo camino pregunta, y «seguir editando» conserva todo.
      await abrirPanel(page);
      await page.getByRole('button', { name: /editar/i }).first().click();
      await radio.waitFor({ state: 'visible', timeout: 20_000 });
      await radio.fill('777');
      await equisDelPanel(page).click();
      await preguntoUnaSolaVez(page, 'perfil sucio + X del panel');
      assert(await panelAbierto(page), 'preguntar cerró el panel igual');
      assert((await dialogos(page)) === 2,
        `con la pregunta arriba hay ${await dialogos(page)} diálogos y tendrían que ser 2`);
      assert(await pregunta(page).evaluate((el) => el.contains(document.activeElement)),
        'el foco no entró en la pregunta');
      await seguirEditando(page);
      await sinPregunta(page, 'perfil: seguir editando');
      assert(await panelAbierto(page), 'seguir editando cerró el panel');
      assert((await radio.inputValue()) === '777',
        `seguir editando perdió lo escrito: «${await radio.inputValue()}»`);
      await esperarA(async () => (await equisDelPanel(page).evaluate(
        (el) => el === document.activeElement)),
      'seguir editando no devolvió el foco a la X que pidió cerrar', 20_000);

      // Cambiar de pestaña con el perfil sucio NO es un cierre: el formulario
      // sigue vivo y no se pierde nada, así que no pregunta. Lo que sí tiene
      // que seguir preguntando después es cerrar el panel.
      await page.getByRole('button', { name: /notificaciones/i }).first().click();
      await esperarA(async () => (await radio.count()) === 0,
        'la pestaña no cambió', 20_000);
      await sinPregunta(page, 'perfil sucio + cambio de pestaña');
      await page.getByRole('button', { name: 'Mi Perfil' }).first().click();
      await esperarA(async () => (await radio.count()) === 1,
        'no volvió el formulario del perfil', 20_000);
      assert((await radio.inputValue()) === '777',
        `cambiar de pestaña perdió lo escrito: «${await radio.inputValue()}»`);
      cerrados.push('perfil sucio/cambio de pestaña (no cierra: no pregunta)');

      // Cambiar y volver al valor original deja el formulario limpio otra vez.
      await radio.fill(original);
      await equisDelPanel(page).click();
      await esperarA(async () => !(await panelAbierto(page)),
        'con el valor revertido la X no cerró', 20_000);
      await sinPregunta(page, 'perfil revertido');
      cerrados.push('perfil revertido/X del panel');
      await page.context().close();
    }

    // --- 2. ALTA DE PUBLICACIÓN: fondo, y descartar limpia el borrador ------
    {
      const page = await sesion(vendedor.datos);
      const abrirAlta = async () => {
        await page.getByRole('button', { name: 'Vender' }).click();
        await page.locator('input[name="name"]').first()
          .waitFor({ state: 'visible', timeout: 20_000 });
      };
      const nombre = page.locator('input[name="name"]').first();
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await abrirAlta();
      await page.mouse.click(5, 5);
      await esperarA(async () => (await nombre.count()) === 0,
        'alta limpia: el fondo no cerró', 20_000);
      await sinPregunta(page, 'alta limpia');
      cerrados.push('alta limpia/fondo');

      await abrirAlta();
      const borrador = `Borrador del caso 149 ${sello}`;
      await nombre.fill(borrador);
      await page.mouse.click(5, 5);
      await preguntoUnaSolaVez(page, 'alta sucia + fondo');
      assert((await nombre.count()) === 1, 'preguntar cerró el alta igual');
      await descartar(page);
      await esperarA(async () => (await nombre.count()) === 0,
        'descartar no cerró el alta', 20_000);
      await abrirAlta();
      assert((await nombre.inputValue()) === '',
        `el borrador descartado volvió a aparecer: «${await nombre.inputValue()}»`);
      cerrados.push('alta sucia/fondo');
      await page.context().close();
    }

    // --- 3. EDICIÓN DE PUBLICACIÓN: Cancelar, y una sola capa se cierra -----
    {
      const page = await sesion(vendedor.datos);
      await abrirPanel(page);
      await page.getByRole('button', { name: /publicaciones/i }).first().click();
      const fila = page.locator('[class*="_productCard_"], article, li')
        .filter({ hasText: paraEditar }).first();
      await fila.waitFor({ state: 'visible', timeout: 20_000 });
      const editar = fila.getByRole('button', { name: /editar/i }).first();
      const descripcion = page.locator('textarea').first();
      const cancelar = page.getByRole('button', { name: 'Cancelar', exact: true }).first();

      await editar.click();
      await descripcion.waitFor({ state: 'visible', timeout: 20_000 });
      const guardada = await descripcion.inputValue();
      await cancelar.click();
      await esperarA(async () => (await page.locator('textarea').count()) === 0,
        'edición limpia: Cancelar no cerró', 20_000);
      await sinPregunta(page, 'edición limpia');
      cerrados.push('edición limpia/Cancelar');

      await editar.click();
      await descripcion.waitFor({ state: 'visible', timeout: 20_000 });
      await descripcion.fill(`Descripcion cambiada por el caso 149 ${sello}`);
      await cancelar.click();
      await preguntoUnaSolaVez(page, 'edición sucia + Cancelar');
      assert(await panelAbierto(page), 'preguntar cerró Mi Panel');
      await descartar(page);
      await esperarA(async () => (await page.locator('textarea').count()) === 0,
        'descartar no cerró la edición', 20_000);
      assert(await panelAbierto(page),
        'descartar cerró Mi Panel además de la edición: son dos capas y se pidió una');
      await editar.click();
      await descripcion.waitFor({ state: 'visible', timeout: 20_000 });
      assert((await descripcion.inputValue()) === guardada,
        `al reabrir quedó el borrador descartado: «${await descripcion.inputValue()}»`);
      cerrados.push('edición sucia/Cancelar');
      await page.context().close();
    }

    // --- 4. CALIFICACIÓN: el fondo, que antes se llevaba el panel entero ----
    {
      const page = await sesion(comprador.data);
      await abrirPanel(page);
      await page.getByRole('button', { name: /compras/i }).first().click();
      const calificar = page.getByRole('button', { name: 'Calificar Vendedor' }).first();
      await calificar.waitFor({ state: 'visible', timeout: 20_000 });
      const comentario = page.locator('textarea').first();

      await calificar.click();
      await comentario.waitFor({ state: 'visible', timeout: 20_000 });
      await page.mouse.click(5, 5);
      await esperarA(async () => (await page.locator('textarea').count()) === 0,
        'calificación limpia: el fondo no cerró', 20_000);
      await sinPregunta(page, 'calificación limpia');
      assert(await panelAbierto(page),
        'cerrar la calificación limpia se llevó puesto Mi Panel');
      cerrados.push('calificación limpia/fondo');

      await calificar.click();
      await comentario.waitFor({ state: 'visible', timeout: 20_000 });
      await comentario.fill('Comentario del caso 149');
      await page.mouse.click(5, 5);
      await preguntoUnaSolaVez(page, 'calificación sucia + fondo');
      assert(await panelAbierto(page), 'preguntar cerró Mi Panel');
      // Escape sobre la pregunta es «seguir editando»: cierra sólo la pregunta.
      await page.keyboard.press('Escape');
      await sinPregunta(page, 'calificación: Escape sobre la pregunta');
      assert((await comentario.inputValue()) === 'Comentario del caso 149',
        'Escape sobre la pregunta perdió el comentario');
      assert(await panelAbierto(page), 'Escape sobre la pregunta cerró el panel');
      await page.mouse.click(5, 5);
      await preguntoUnaSolaVez(page, 'calificación sucia + fondo, otra vez');
      await descartar(page);
      await esperarA(async () => (await page.locator('textarea').count()) === 0,
        'descartar no cerró la calificación', 20_000);
      assert(await panelAbierto(page), 'descartar la calificación cerró Mi Panel');
      cerrados.push('calificación sucia/fondo');
      await page.context().close();
    }

    // --- 5. CHECKOUT: antes y después de crear la orden ---------------------
    let ordenesDelCheckout = 0;
    {
      const page = await sesion(comprador.data);
      const abrirCheckout = async () => {
        await page.goto(`${FRONTEND_URL}/?section=marketplace&q=${encodeURIComponent(paraComprar)}`,
          { waitUntil: 'domcontentloaded' });
        const agregar = page.getByRole('button', { name: /Agregar|Contratar/ }).first();
        await agregar.waitFor({ state: 'visible', timeout: 20_000 });
        await agregar.click();
        await page.getByRole('button', { name: /carrito/i }).first().click();
        await page.getByRole('button', { name: 'Continuar compra' }).click();
        await direccion.waitFor({ state: 'visible', timeout: 20_000 });
      };
      const direccion = page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B');

      await abrirCheckout();
      await page.keyboard.press('Escape');
      await esperarA(async () => (await direccion.count()) === 0,
        'checkout limpio: Escape no cerró', 20_000);
      await sinPregunta(page, 'checkout limpio');
      cerrados.push('checkout limpio/Escape');

      await abrirCheckout();
      await direccion.fill('Calle del caso 149');
      await page.keyboard.press('Escape');
      await preguntoUnaSolaVez(page, 'checkout sucio + Escape');
      assert((await direccion.count()) === 1, 'preguntar cerró el checkout igual');
      await seguirEditando(page);
      await sinPregunta(page, 'checkout: seguir editando');
      assert((await direccion.inputValue()) === 'Calle del caso 149',
        'seguir editando perdió la dirección');
      cerrados.push('checkout sucio/Escape');

      // Y ahora la orden se crea de verdad. Lo que ya está guardado no es
      // «trabajo sin guardar»: cerrar no puede volver a preguntar por eso.
      const ordenesAntes = queryCount(
        `SELECT COUNT(*) FROM orders WHERE buyer_id = ${sqlLiteral(comprador.data.user.id)}`);
      await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 11 5555 0149');
      await page.getByLabel('Provincia *').selectOption({ index: 1 });
      await esperarA(async () => (await page.getByLabel('Localidad *')
        .locator('option').count()) > 1, 'no cargaron las localidades del destino', 20_000);
      await page.getByLabel('Localidad *').selectOption({ index: 1 });
      await page.getByPlaceholder('2000').fill('2700');
      await page.locator('form:has(h2) button[type="submit"]').click();
      await page.getByRole('heading', { name: /Traslado|Env[íi]o/i }).first()
        .waitFor({ timeout: 20_000 });
      await resolverTrasladoPropio(page);
      await page.locator('form:has(h2) button[type="submit"]').click();
      await elegirTransferencia(page);
      await page.getByRole('button', { name: /Confirmar y crear las órdenes/ }).click();
      await page.getByRole('heading', { name: /Tus órdenes/ }).waitFor({ timeout: 20_000 });
      ordenesDelCheckout = queryCount(
        `SELECT COUNT(*) FROM orders WHERE buyer_id = ${sqlLiteral(comprador.data.user.id)}`)
        - ordenesAntes;
      assert(ordenesDelCheckout === 1,
        `el checkout creó ${ordenesDelCheckout} órdenes y tenía que crear 1`);

      // Un comprobante elegido y todavía no enviado SÍ es trabajo local que se
      // pierde: cerrar ahí pregunta, aunque la orden ya esté creada.
      await page.locator('input[type="file"]').first().setInputFiles({
        name: 'comprobante-149.png', mimeType: 'image/png', buffer: RECIBO_PNG,
      });
      await page.keyboard.press('Escape');
      await preguntoUnaSolaVez(page, 'checkout con comprobante elegido + Escape');
      await seguirEditando(page);
      await sinPregunta(page, 'checkout: seguir editando con el comprobante elegido');
      cerrados.push('checkout con comprobante sin enviar/Escape');

      // Y una vez enviado deja de serlo: el archivo ya viajó.
      await page.getByRole('button', { name: 'Adjuntar comprobante' }).first().click();
      await esperarA(async () => ((await page.locator('body').innerText())
        .includes('Comprobante enviado')),
      'el comprobante no llegó a enviarse', 20_000);

      // Con la orden creada y el comprobante enviado, cerrar no pregunta.
      await page.getByRole('button', { name: 'Finalizar' }).click();
      await esperarA(async () => (await page.getByRole('heading', { name: /Tus órdenes/ })
        .count()) === 0, 'con la orden creada, «Finalizar» no cerró', 20_000);
      await sinPregunta(page, 'checkout con la orden creada');
      cerrados.push('checkout con orden creada/Finalizar');
      const despues = queryCount(
        `SELECT COUNT(*) FROM orders WHERE buyer_id = ${sqlLiteral(comprador.data.user.id)}`);
      assert(despues - ordenesAntes === 1,
        `cerrar el checkout dejó ${despues - ordenesAntes} órdenes: se duplicó algo`);
      await page.context().close();
    }

    return `los cinco formularios comparten una sola política, recorrida en `
      + `${cerrados.length} caminos de cierre (${cerrados.join(', ')}): limpios cierran derecho `
      + 'y sucios preguntan una sola vez, con la '
      + 'pregunta como capa de arriba —dos diálogos, foco adentro—; «seguir editando» y Escape '
      + 'sobre la pregunta conservan todo y devuelven el foco al control que pidió cerrar; '
      + 'descartar cierra UNA sola capa —Mi Panel queda abierto— y no revive el borrador; '
      + 'cambiar y revertir un valor deja el formulario limpio otra vez; y con la orden ya '
      + `creada el checkout cierra sin preguntar y sin duplicar (${ordenesDelCheckout} orden)`;
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: tokenComprador });
  }
});

await runCase(150, 'Escribir en un formulario no mueve el foco de su campo', async () => {
  // Medido contra `7741b91`: escribir «abc» tecla por tecla dejaba
  //
  //   alta de publicacion   valor="a"               foco="Cerrar"
  //   checkout              valor="a"               foco="Cerrar"
  //   Mi Panel (perfil)     valor="Juan Vendedora"  foco="Cerrar"
  //
  // La causa era una sola y estaba en la capa, no en los formularios: el
  // cierre que recibia `useCapaModal` cambiaba de identidad en cada render, su
  // efecto se desmontaba y volvia a montar con cada tecla, y montarlo significa
  // volver a enfocar el primer control de la capa. La primera letra entraba, la
  // segunda ya iba al boton Cerrar.
  //
  // Por eso este caso escribe TECLA POR TECLA y, despues de cada una, contrasta
  // el valor del campo y `document.activeElement`. Con `fill()` la edicion entra
  // de una sola vez y el defecto no se ve: por eso el 149 no lo detectaba.
  const sello = Date.now();
  const ingresoDelVendedor = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  });
  const vendedor = ingresoDelVendedor.data;
  assert(vendedor?.access_token, 'no se pudo entrar como vendedor');
  const ingresoDelComprador = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const comprador = ingresoDelComprador.data;
  assert(comprador?.access_token, 'no se pudo entrar como comprador');

  // Una publicacion propia con stock: el checkout necesita algo que comprar y
  // el caso no puede depender de lo que otro haya dejado en la base.
  const [categoria] = queryRows(`
    SELECT id, 'fin' FROM categories
    WHERE is_service = false AND is_active = true ORDER BY name LIMIT 1`);
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');
  const paraComprar = `Foco150 para comprar ${sello}`;
  const alta = await apiRequest('/products', {
    method: 'POST', token: vendedor.access_token,
    body: {
      name: paraComprar,
      description: 'Publicacion efimera del caso 150, para abrir el checkout.',
      category_id: categoria[0],
      price: 1500,
      stock: 20,
      unit: 'kg',
      locality_id: localidad,
      publication_type: 'producto',
      operation_kind: 'insumo',
    },
  });
  assert(alta.status < 400 && alta.data?.id,
    `no se pudo publicar el insumo del caso: HTTP ${alta.status}`);

  const browser = await chromium.launch({ headless: true });
  const recorridos = [];
  try {
    const sesion = async (datos) => {
      const contexto = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
      await contexto.addInitScript(({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
      }, { a: datos.access_token, r: datos.refresh_token });
      return contexto.newPage();
    };
    const dondeEstaElFoco = (page) => page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '(el documento)';
      const nombre = activo.getAttribute('aria-label')
        || activo.getAttribute('id')
        || activo.getAttribute('name')
        || (activo.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return `<${activo.tagName.toLowerCase()}> «${nombre}»`;
    });
    const esElActivo = (campo) => campo.evaluate((el) => el === document.activeElement);
    const pregunta = (page) => page.locator('[aria-labelledby="titulo-cambios-sin-guardar"]');

    // Una letra por vez, y despues de CADA una las dos cosas que el defecto
    // rompia: que la letra entro y que el foco sigue en el mismo campo.
    const escribirTeclaPorTecla = async (page, campo, texto, contenedor) => {
      await campo.click();
      // El cursor al final: `click()` lo deja donde cayo el clic y un campo
      // precargado —el nombre del perfil— no arranca vacio.
      await page.keyboard.press('End');
      const inicial = await campo.inputValue();
      let esperado = inicial;
      for (const letra of texto) {
        await page.keyboard.type(letra);
        esperado += letra;
        const numero = esperado.length - inicial.length;
        if (!(await esElActivo(campo))) {
          assert(false, `${contenedor}: en la tecla ${numero} de ${texto.length} («${letra}») el `
            + `foco se fue del campo a ${await dondeEstaElFoco(page)}`);
        }
        const ahora = await campo.inputValue();
        assert(ahora === esperado,
          `${contenedor}: tras la tecla ${numero} de ${texto.length} el campo dice «${ahora}» y `
          + `tendria que decir «${esperado}»`);
      }
      // Y la capa siguio siendo la misma capa: ni se duplico ni solto el fondo.
      const dialogos = await page.locator('[role="dialog"]').count();
      assert(dialogos === 1, `${contenedor}: escribir dejo ${dialogos} dialogo(s) y tendria que `
        + 'haber exactamente 1');
      assert((await page.evaluate(() => document.body.style.overflow)) === 'hidden',
        `${contenedor}: escribir solto la traba del scroll de fondo`);
      recorridos.push(`${contenedor}: ${texto.length} teclas`);
      return esperado;
    };

    // Escribir no puede haber desarmado la proteccion: con lo escrito, cerrar
    // pregunta una vez y «seguir editando» devuelve el foco al mismo campo.
    const preguntaYVuelve = async (page, campo, contenedor, esperado) => {
      await page.keyboard.press('Escape');
      await esperarA(async () => (await pregunta(page).count()) === 1,
        `${contenedor}: con lo escrito, Escape no pregunto nada antes de cerrar`, 20_000);
      await page.getByRole('button', { name: 'Seguir editando' }).click();
      await esperarA(async () => (await pregunta(page).count()) === 0,
        `${contenedor}: «seguir editando» no cerro la pregunta`, 20_000);
      assert((await campo.inputValue()) === esperado,
        `${contenedor}: «seguir editando» dejo el campo en «${await campo.inputValue()}» y tenia `
        + `que conservar «${esperado}»`);
      await esperarA(() => esElActivo(campo),
        `${contenedor}: «seguir editando» dejo el foco en ${await dondeEstaElFoco(page)} y no en `
        + 'el campo que pidio cerrar', 20_000);
    };

    // --- A. alta de publicacion --------------------------------------------
    {
      const page = await sesion(vendedor);
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Vender' }).click();
      const nombre = page.locator('input[name="name"]').first();
      await nombre.waitFor({ state: 'visible', timeout: 20_000 });
      const escrito = await escribirTeclaPorTecla(page, nombre, 'Alta150', 'alta de publicación');
      await preguntaYVuelve(page, nombre, 'alta de publicación', escrito);
      await page.context().close();
    }

    // --- B. checkout --------------------------------------------------------
    {
      const page = await sesion(comprador);
      await page.goto(`${FRONTEND_URL}/?section=marketplace&q=${encodeURIComponent(paraComprar)}`,
        { waitUntil: 'domcontentloaded' });
      const agregar = page.getByRole('button', { name: /Agregar|Contratar/ }).first();
      await agregar.waitFor({ state: 'visible', timeout: 20_000 });
      await agregar.click();
      await page.getByRole('button', { name: /carrito/i }).first().click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      const direccion = page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B');
      await direccion.waitFor({ state: 'visible', timeout: 20_000 });
      const escrito = await escribirTeclaPorTecla(page, direccion, 'Ruta150', 'checkout');
      await preguntaYVuelve(page, direccion, 'checkout', escrito);
      await page.context().close();
    }

    // --- C. Mi Panel: el perfil, que vive DENTRO de la capa del panel -------
    {
      const page = await sesion(vendedor);
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Mi cuenta' }).click();
      await page.getByRole('heading', { name: 'Mi Panel' }).waitFor({ timeout: 20_000 });
      await page.locator('[class*="sectionHeader"]').filter({ hasText: 'Mi Perfil' })
        .getByRole('button', { name: 'Editar' }).click();
      const campo = page.locator('#perfil-nombre');
      await campo.waitFor({ state: 'visible', timeout: 20_000 });
      const escrito = await escribirTeclaPorTecla(page, campo, 'Panel150', 'Mi Panel (perfil)');
      await preguntaYVuelve(page, campo, 'Mi Panel (perfil)', escrito);
      await page.context().close();
    }

    return `escribir tecla por tecla conserva el texto y el foco en los tres contenedores que la `
      + `política de cierre toca (${recorridos.join('; ')}): cada letra entra donde se escribió, `
      + '`document.activeElement` sigue siendo el mismo campo después de cada una, la capa no se '
      + 'duplica ni suelta la traba del scroll, y con lo escrito adentro cerrar sigue preguntando '
      + 'una sola vez y «seguir editando» devuelve el foco a ese campo';
  } finally {
    await browser.close();
    await apiRequest('/cart', { method: 'DELETE', token: comprador.access_token });
  }
});

await runCase(151, 'Un formulario no se contradice ni esconde su error', async () => {
  // Cinco bordes medidos contra `83dba0a`, uno por cada cosa que el formulario
  // hacia mal:
  //
  //   labels del Login   htmlFor=null en Email y Contrasena: el clic no enfocaba
  //   error del registro role=null, top=-381 en un alto de 400 (fuera de vista)
  //                      y el foco quedaba en «Crear cuenta»
  //   matriz de precio   la edicion guardo precio=0 en un servicio «por hora»,
  //                      que el alta no deja publicar
  //   imagen rechazada   413 en la subida y el aviso fue «Producto actualizado
  //                      exitosamente»
  //   tipos de carga     el catalogo fallo y el grupo quedo rotulado y vacio,
  //                      sin causa ni reintento
  const sello = Date.now();
  const ingreso = await apiRequest('/auth/login', {
    method: 'POST', body: { email: 'vendedor@ejemplo.com', password: 'vendedor123' },
  });
  const vendedor = ingreso.data;
  assert(vendedor?.access_token, 'no se pudo entrar como vendedor');

  const [categoriaDeServicios] = queryRows(`
    SELECT id, name FROM categories
    WHERE is_service = true AND is_active = true ORDER BY name LIMIT 1`);
  const [categoriaDeProductos] = queryRows(`
    SELECT id, name FROM categories
    WHERE is_service = false AND is_active = true ORDER BY name LIMIT 1`);
  const localidad = localidadDelPadron('Pergamino', 'Buenos Aires');
  const [provincia] = queryRows(`
    SELECT province_id::text, province_name FROM localities
    WHERE id = ${sqlLiteral(localidad)}`);

  const publicar = async (cuerpo) => {
    const alta = await apiRequest('/products', {
      method: 'POST', token: vendedor.access_token, body: cuerpo,
    });
    assert(alta.status < 400 && alta.data?.id,
      `no se pudo publicar «${cuerpo.name}»: HTTP ${alta.status}`);
    return alta.data.id;
  };
  const servicioPorHora = `Consistencia151 servicio ${sello}`;
  const productoConImagen = `Consistencia151 producto ${sello}`;
  const idDelServicio = await publicar({
    name: servicioPorHora,
    description: 'Servicio efimero del caso 151, para la matriz de precio.',
    category_id: categoriaDeServicios[0],
    price: 5000, stock: 0, locality_id: localidad,
    publication_type: 'servicio', operation_kind: 'servicio',
    pricing_type: 'por_hora', availability: 'inmediata',
  });
  await publicar({
    name: productoConImagen,
    description: 'Publicacion efimera del caso 151, para el guardado parcial.',
    category_id: categoriaDeProductos[0],
    price: 900, stock: 4, unit: 'kg', locality_id: localidad,
    publication_type: 'producto', operation_kind: 'insumo',
  });

  const precioEnLaBase = (id) => queryRows(
    `SELECT price::text, COALESCE(pricing_type::text, '-') FROM products WHERE id = ${sqlLiteral(id)}`)[0];

  const browser = await chromium.launch({ headless: true });
  const medidos = [];
  try {
    const sesionDelVendedor = async (viewport) => {
      const contexto = await browser.newContext({ viewport });
      await contexto.addInitScript(({ a, r }) => {
        window.localStorage.setItem('access_token', a);
        window.localStorage.setItem('refresh_token', r);
      }, { a: vendedor.access_token, r: vendedor.refresh_token });
      return contexto;
    };
    const dondeEstaElFoco = (page) => page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '(el documento)';
      const nombre = activo.getAttribute('id')
        || activo.getAttribute('aria-label')
        || (activo.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30);
      return `<${activo.tagName.toLowerCase()}> «${nombre}»`;
    });
    const esElActivo = (locator) => locator.evaluate((el) => el === document.activeElement);
    const abrirElRegistro = async (page) => {
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Ingresar' }).first().click();
      await page.getByRole('button', { name: 'Regístrate aquí' }).click();
      await page.locator('#registro-nombre').waitFor({ state: 'visible', timeout: 20_000 });
    };
    const abrirMisPublicaciones = async (page) => {
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Mi cuenta' }).click();
      await page.getByRole('heading', { name: 'Mi Panel' }).waitFor({ timeout: 20_000 });
      await page.getByRole('button', { name: /publicaciones/i }).first().click();
    };
    const editar = async (page, nombre) => {
      const tarjeta = page.locator('[class*="productCard"], [class*="publicacion"]')
        .filter({ hasText: nombre }).first();
      await tarjeta.waitFor({ state: 'visible', timeout: 20_000 });
      await tarjeta.getByRole('button', { name: /editar/i }).first().click();
    };

    // --- A. los labels del Login enfocan SU campo ---------------------------
    {
      const contexto = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const page = await contexto.newPage();
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Ingresar' }).first().click();
      const correo = page.getByPlaceholder('tu@email.com');
      await correo.waitFor({ state: 'visible', timeout: 20_000 });
      const clave = page.locator('input[type="password"]').first();
      for (const [texto, campo] of [['Email', correo], ['Contraseña', clave]]) {
        const etiqueta = page.locator('form label')
          .filter({ hasText: new RegExp(`^${texto}`) }).first();
        assert(await etiqueta.count() === 1, `el Login no tiene un label «${texto}»`);
        await etiqueta.click();
        await esperarA(() => esElActivo(campo),
          `el clic en el label «${texto}» dejo el foco en ${await dondeEstaElFoco(page)}`, 20_000);
        medidos.push(`label «${texto}» del Login`);
      }
      await contexto.close();
    }

    // --- B. el error del registro se ve, se anuncia y recibe el foco --------
    {
      // Una ventana baja: enviando desde el final, el aviso de arriba quedaba
      // fuera de la pantalla y nada avisaba que estaba.
      const contexto = await browser.newContext({ viewport: { width: 1200, height: 400 } });
      const page = await contexto.newPage();
      await abrirElRegistro(page);
      const nombre = page.locator('#registro-nombre');
      await nombre.fill('Consistencia Del Caso 151');
      await page.locator('#registro-email').fill(`consistencia.151.${sello}@example.com`);
      await page.locator('#registro-clave').fill('clave151');
      await page.locator('#registro-clave-2').fill('otra-clave');
      const enviar = page.getByRole('button', { name: 'Crear cuenta' });
      await enviar.scrollIntoViewIfNeeded();
      await enviar.click();

      const aviso = page.locator('[role="alert"]').filter({ hasText: /no coinciden/i });
      const dentroDeLaVentana = () => aviso.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      });
      await esperarA(async () => (await aviso.count()) === 1,
        'el error del registro no se anuncia como alerta', 20_000);
      await esperarA(dentroDeLaVentana,
        'el error del registro quedo fuera de la ventana', 20_000);
      await esperarA(() => esElActivo(aviso),
        `el error del registro no recibio el foco: esta en ${await dondeEstaElFoco(page)}`, 20_000);
      assert((await nombre.inputValue()) === 'Consistencia Del Caso 151',
        'avisar del error borro el nombre escrito');
      assert((await page.locator('#registro-clave').inputValue()) === 'clave151',
        'avisar del error borro la contraseña escrita');

      // Y otra vez, sin cambiar un solo valor. El texto del error es el mismo,
      // asi que el estado queda igual que antes: si el aviso dependiera solo de
      // el, el segundo intento no moveria nada y la alerta se quedaria arriba,
      // fuera de la pantalla. Primero se la saca de la vista a proposito, para
      // que volver a verla signifique algo.
      await enviar.scrollIntoViewIfNeeded();
      await enviar.focus();
      await esperarA(async () => !(await dentroDeLaVentana()),
        'no se pudo dejar la alerta fuera de la ventana antes del segundo intento', 20_000);
      assert(await esElActivo(enviar),
        `antes del segundo intento el foco estaba en ${await dondeEstaElFoco(page)}`);
      await enviar.click();
      await esperarA(dentroDeLaVentana,
        'el segundo intento con el mismo error dejo la alerta fuera de la ventana', 20_000);
      await esperarA(() => esElActivo(aviso),
        `el segundo intento con el mismo error dejo el foco en `
        + `${await dondeEstaElFoco(page)}`, 20_000);
      assert((await aviso.count()) === 1, 'el segundo intento duplico la alerta');
      assert((await nombre.inputValue()) === 'Consistencia Del Caso 151',
        'el segundo intento borro el nombre escrito');
      assert((await page.locator('#registro-clave').inputValue()) === 'clave151',
        'el segundo intento borro la contraseña escrita');
      medidos.push('error del registro anunciado, a la vista y con el foco en los dos intentos');
      await contexto.close();
    }

    // --- C. la misma matriz de precio en el alta y en la edicion ------------
    {
      const contexto = await sesionDelVendedor({ width: 1500, height: 1000 });
      const page = await contexto.newPage();

      // C1. La edicion de un servicio «por hora» no puede guardar precio cero.
      await abrirMisPublicaciones(page);
      await editar(page, servicioPorHora);
      const precioDelServicio = page.locator('#edit-precio-servicio');
      await precioDelServicio.waitFor({ state: 'visible', timeout: 20_000 });
      assert((await page.locator('#edit-tipo-precio').inputValue()) === 'por_hora',
        'la edicion no abrio con el tipo de precio «por hora»');
      await precioDelServicio.fill('0');
      await page.getByRole('button', { name: /^Guardar/i }).first().click();
      const rechazo = page.getByText(/Indicá un precio mayor a cero/i);
      await esperarA(async () => (await rechazo.count()) > 0,
        'la edicion acepto precio cero en un servicio «por hora» sin decir nada', 20_000);
      assert((await precioDelServicio.count()) === 1,
        'la edicion se cerro pese a rechazar el precio');
      const [precioGuardado] = precioEnLaBase(idDelServicio);
      assert(Number(precioGuardado) === 5000,
        `la edicion guardo ${precioGuardado} y tenia que dejar 5000 intacto`);
      medidos.push('edición: servicio «por hora» con precio 0 rechazado');

      // C2. Con «a convenir» ese mismo cero es valido, y se guarda.
      await page.locator('#edit-tipo-precio').selectOption('a_convenir');
      await page.getByRole('button', { name: /^Guardar/i }).first().click();
      await esperarA(async () => {
        const [precio, tipo] = precioEnLaBase(idDelServicio);
        return Number(precio) === 0 && tipo === 'a_convenir';
      }, 'con «a convenir» la edicion tampoco guardo el precio cero', 20_000);
      medidos.push('edición: el mismo cero aceptado con «a convenir»');

      // C3. El alta decide igual: sin precio no publica un servicio «por hora»,
      // y con «a convenir» sí.
      const servicioDelAlta = `Consistencia151 alta ${sello}`;
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Vender/i }).first().click();
      await page.getByRole('heading', { name: /Publicar un producto/i })
        .waitFor({ state: 'visible', timeout: 20_000 });
      await page.getByRole('button', { name: 'Servicio', exact: true }).click();
      await page.getByRole('heading', { name: /Publicar un servicio/i })
        .waitFor({ state: 'visible', timeout: 20_000 });
      await page.locator('#name').fill(servicioDelAlta);
      await esperarA(async () => (await page.locator('#category option').count()) > 1,
        'el alta no cargo las categorias de servicio', 20_000);
      await page.locator('#category').selectOption({ label: categoriaDeServicios[1] });
      await page.locator('#description')
        .fill('Servicio publicado por el caso 151 para comparar la matriz de precio.');
      await page.locator('#province').selectOption(provincia[0]);
      await esperarA(async () => (await page.locator('#locality option').count()) > 1,
        'el alta no cargo las localidades', 20_000);
      await page.locator('#locality').selectOption(localidad);
      assert((await page.locator('#pricingType').inputValue()) === 'por_hora',
        'el alta no abrio con el tipo de precio «por hora»');
      await page.locator('form button[type="submit"]').click();
      // Sin precio no publica: el formulario sigue abierto y el foco queda en
      // el campo que falta. No hace falta esperar «a que no pase nada».
      await esperarA(() => esElActivo(page.locator('#price')),
        `el alta acepto el servicio «por hora» sin precio: el foco quedo en `
        + `${await dondeEstaElFoco(page)}`, 20_000);
      assert(queryCount(
        `SELECT COUNT(*) FROM products WHERE name = ${sqlLiteral(servicioDelAlta)}`) === 0,
      'el alta publico el servicio «por hora» sin precio');
      medidos.push('alta: servicio «por hora» sin precio rechazado');

      await page.locator('#pricingType').selectOption('a_convenir');
      await page.locator('form button[type="submit"]').click();
      await esperarA(() => queryCount(
        `SELECT COUNT(*) FROM products WHERE name = ${sqlLiteral(servicioDelAlta)}`) === 1,
      'con «a convenir» y sin precio el alta tampoco publico', 20_000);
      medidos.push('alta: el mismo servicio publicado con «a convenir»');
      await contexto.close();
    }

    // --- D. una imagen rechazada al editar no es un exito ------------------
    {
      const contexto = await sesionDelVendedor({ width: 1500, height: 1000 });
      const page = await contexto.newPage();
      const motivo = 'La imagen supera el tamaño permitido (prueba controlada)';
      let intercepto = false;
      await page.route('**/api/products/*/images', async (ruta) => {
        if (ruta.request().method() !== 'POST') return ruta.continue();
        intercepto = true;
        await ruta.fulfill({
          status: 413, contentType: 'application/json', body: JSON.stringify({ detail: motivo }),
        });
      });

      await abrirMisPublicaciones(page);
      await editar(page, productoConImagen);
      const descripcion = page.locator('textarea').first();
      await descripcion.waitFor({ state: 'visible', timeout: 20_000 });
      const nuevaDescripcion = `Descripcion cambiada por el caso 151 ${sello}`;
      await descripcion.fill(nuevaDescripcion);
      await page.locator('input[type="file"]').first().setInputFiles({
        name: 'consistencia-151.png', mimeType: 'image/png', buffer: RECIBO_PNG,
      });
      await page.getByRole('button', { name: /^Guardar/i }).first().click();

      const parcial = page.getByText(/se actualizó, pero/i);
      await esperarA(async () => (await parcial.count()) > 0,
        'la edicion no informo el resultado parcial de la imagen', 20_000);
      const texto = (await parcial.first().innerText()).replace(/\s+/g, ' ').trim();
      assert(texto.includes(motivo), `el aviso no trae el motivo HTTP: «${texto}»`);
      assert(!/exitosamente/i.test(texto), `el aviso sigue diciendo que salio todo bien: «${texto}»`);
      assert(intercepto, 'Playwright no llego a interceptar la subida');

      // Lo guardado quedo guardado, la imagen no entro y no se duplico nada.
      const [fila] = queryRows(`
        SELECT p.description, COUNT(pi.id)::text
        FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
        WHERE p.name = ${sqlLiteral(productoConImagen)}
        GROUP BY p.id, p.description`);
      assert(fila, 'la publicacion del caso desaparecio de la base');
      assert(fila[0] === nuevaDescripcion,
        `los metadatos no quedaron guardados: «${fila[0]}»`);
      assert(Number(fila[1]) === 0, `quedaron ${fila[1]} imagenes y no tenia que entrar ninguna`);
      assert(queryCount(
        `SELECT COUNT(*) FROM products WHERE name = ${sqlLiteral(productoConImagen)}`) === 1,
      'la edicion creo una segunda publicacion');
      medidos.push('edición: imagen rechazada informada como resultado parcial');
      await contexto.close();
    }

    // --- E. el catalogo de cargas que falla se explica y se reintenta -------
    {
      const contexto = await browser.newContext({ viewport: { width: 1300, height: 900 } });
      const page = await contexto.newPage();
      let pedidos = 0;
      let caido = true;
      await page.route('**/api/logistics/cargo-types', async (ruta) => {
        pedidos += 1;
        if (!caido) return ruta.continue();
        await ruta.fulfill({
          status: 503, contentType: 'application/json',
          body: JSON.stringify({ detail: 'catalogo de cargas no disponible' }),
        });
      });

      await abrirElRegistro(page);
      const nombre = page.locator('#registro-nombre');
      await nombre.fill('Transportista Del Caso 151');
      await page.getByText('Quiero registrarme como transportista').click();

      const grupo = page.locator('[role="group"][aria-labelledby="registro-cargas"]');
      const explicacion = page.getByText(/No pudimos traer las cargas/i);
      await esperarA(async () => (await explicacion.count()) > 0,
        'el catalogo fallo y la pantalla no dijo nada', 20_000);
      assert((await explicacion.first().innerText()).includes('catalogo de cargas no disponible'),
        'la explicacion no trae el motivo que devolvio el servidor');
      assert((await grupo.count()) === 0,
        'el grupo de cargas quedo rotulado y vacio en vez de explicar el fallo');
      const reintentar = page.getByRole('button', { name: 'Reintentar' });
      assert((await reintentar.count()) === 1, 'no hay reintento');

      // Con la API recuperada, el reintento trae las opciones sin reiniciar nada.
      caido = false;
      await reintentar.click();
      await esperarA(async () => (await grupo.locator('input[type="checkbox"]').count()) > 0,
        'reintentar con la API sana no trajo las cargas', 20_000);
      assert(pedidos >= 2, `el reintento no volvio a pedir el catalogo (${pedidos} pedido/s)`);
      assert((await explicacion.count()) === 0, 'el aviso del fallo quedo despues de recuperarse');
      assert((await nombre.inputValue()) === 'Transportista Del Caso 151',
        'reintentar reinicio el registro y perdio lo escrito');
      medidos.push('registro: catálogo de cargas caído, explicado y reintentado');
      await contexto.close();
    }

    return `los cinco bordes quedaron cerrados sobre la interfaz real (${medidos.join('; ')}): `
      + 'los labels del Login enfocan su campo, el error del registro se anuncia como alerta y '
      + 'llega a la vista y al foco sin borrar lo escrito, el alta y la edición aplican la misma '
      + 'matriz de precio —explícito mayor a cero, «a convenir» puede ir en cero—, una imagen '
      + 'rechazada se informa con su motivo HTTP y sin declarar éxito total ni duplicar la '
      + 'publicación, y el catálogo de cargas caído explica el fallo y se reintenta sin reiniciar '
      + 'el registro';
  } finally {
    await browser.close();
  }
});

await runCase(152, 'La ubicación publicada tiene una sola verdad: el padrón', async () => {
  // Medido contra `042a3e3`, sobre la interfaz real:
  //
  //   /products/my traia location y NO locality_id, asi que la edicion partia
  //   ese texto por comas para adivinar de donde era la publicacion
  //   la provincia salia de una lista fija en el componente y la ciudad era un
  //   campo de texto libre
  //   el PATCH mandaba location="Rosario, Santa Fe" y NINGUN locality_id; el
  //   esquema de la edicion no acepta `location`, asi que se descartaba entero:
  //   despues de guardar la fila seguia con locality_id=06623100 y
  //   location=«Pergamino, Buenos Aires»
  //
  // O sea: cambiar lo que la pantalla llamaba ubicacion no cambiaba la
  // ubicacion publicada, y el aviso decia que se habia guardado.
  const sello = Date.now();
  const localidadPorNombre = (nombre, provincia) => {
    const [fila] = queryRows(`
      SELECT id, province_id, province_name FROM localities
      WHERE name = ${sqlLiteral(nombre)} AND province_name = ${sqlLiteral(provincia)} LIMIT 1`);
    assert(fila, `el padron no tiene ${nombre}, ${provincia}`);
    return { id: fila[0], provinciaId: fila[1], provincia: fila[2], nombre };
  };
  const pergamino = localidadPorNombre('Pergamino', 'Buenos Aires');
  const rosario = localidadPorNombre('Rosario', 'Santa Fe');

  // Un vendedor propio, cuyo PERFIL dice otra cosa que sus publicaciones: es
  // lo unico que permite distinguir de donde sale lo que muestra el editor.
  const correo = `ubicacion.152.${sello}@example.com`;
  const clave = 'smoke152';
  await registrarYVerificar({
    email: correo, password: clave, full_name: 'Vendedora Del Caso 152',
  });
  const ingreso = await apiRequest('/auth/login', {
    method: 'POST', body: { email: correo, password: clave },
  });
  const vendedora = ingreso.data;
  assert(vendedora?.access_token, 'no se pudo entrar como la vendedora del caso');
  // El domicilio del PERFIL, por la ruta real del perfil. Dice otra cosa que
  // sus publicaciones: es lo único que permite distinguir de dónde sale lo que
  // muestra el editor.
  const perfil = await apiRequest('/auth/me', {
    method: 'PATCH', token: vendedora.access_token,
    body: { location: 'Villa María, Córdoba' },
  });
  assert(perfil.status < 400 && perfil.data?.location === 'Villa María, Córdoba',
    `no se pudo dejar el domicilio del perfil: HTTP ${perfil.status}`);

  const [categoria] = queryRows(`
    SELECT id FROM categories
    WHERE is_service = false AND is_active = true ORDER BY name LIMIT 1`);
  const publicar = async (nombre, localityId) => {
    const alta = await apiRequest('/products', {
      method: 'POST', token: vendedora.access_token,
      body: {
        name: nombre,
        description: 'Publicacion efimera del caso 152, para la ubicacion oficial.',
        category_id: categoria[0], price: 1520, stock: 3, unit: 'kg',
        locality_id: localityId, publication_type: 'producto', operation_kind: 'insumo',
      },
    });
    assert(alta.status < 400 && alta.data?.id,
      `no se pudo publicar «${nombre}»: HTTP ${alta.status}`);
    return alta.data.id;
  };
  const conUbicacion = `Ubicacion152 oficial ${sello}`;
  const heredada = `Ubicacion152 heredada ${sello}`;
  const idOficial = await publicar(conUbicacion, pergamino.id);
  const idHeredada = await publicar(heredada, pergamino.id);

  const ubicacionEnLaBase = (id) => {
    const [fila] = queryRows(`
      SELECT COALESCE(locality_id, ''), COALESCE(location, '') FROM products
      WHERE id = ${sqlLiteral(id)}`);
    return { localityId: fila[0], texto: fila[1] };
  };

  const browser = await chromium.launch({ headless: true });
  const comprobados = [];
  try {
    const contexto = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await contexto.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: vendedora.access_token, r: vendedora.refresh_token });
    const page = await contexto.newPage();

    const provincia = page.locator('#edit-provincia');
    const localidad = page.locator('#edit-localidad');
    const abrirLaEdicion = async (nombre) => {
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Mi cuenta' }).click();
      await page.getByRole('heading', { name: 'Mi Panel' }).waitFor({ timeout: 20_000 });
      await page.getByRole('button', { name: /publicaciones/i }).first().click();
      const tarjeta = page.locator('[class*="productCard"], [class*="publicacion"]')
        .filter({ hasText: nombre }).first();
      await tarjeta.waitFor({ state: 'visible', timeout: 20_000 });
      await tarjeta.getByRole('button', { name: /editar/i }).first().click();
      await provincia.waitFor({ state: 'visible', timeout: 20_000 });
      await esperarA(async () => (await provincia.locator('option').count()) > 1,
        'el editor no cargo el padron de provincias', 20_000);
      // La localidad es un select del padron, no un campo libre: si no esta,
      // la ubicacion se sigue escribiendo a mano y no hay mas que medir.
      assert((await localidad.count()) === 1,
        'el editor no ofrece un select de localidad del padron');
    };
    const guardar = () => page.getByRole('button', { name: /^Guardar/i }).first().click();

    // --- A. el editor abre con la ubicacion DE LA PUBLICACION ---------------
    await abrirLaEdicion(conUbicacion);
    await esperarA(async () => (await localidad.locator('option').count()) > 1,
      'el editor no cargo las localidades de la provincia de la publicacion', 20_000);
    assert((await provincia.inputValue()) === pergamino.provinciaId,
      `el editor abrio en la provincia «${await provincia.inputValue()}» y la publicacion es de `
      + `${pergamino.provincia} (${pergamino.provinciaId}); el perfil dice Córdoba`);
    assert((await localidad.inputValue()) === pergamino.id,
      `el editor abrio en la localidad «${await localidad.inputValue()}» y la publicacion es de `
      + `${pergamino.nombre} (${pergamino.id})`);
    // Y no quedo ningun campo libre que parezca gobernar el catalogo.
    assert((await page.locator('#edit-ciudad').count()) === 0,
      'sigue habiendo un campo libre «Ciudad» en la edicion');
    const formulario = (await page.locator('[class*="editForm"], form').first().innerText())
      .replace(/\s+/g, ' ');
    assert(!/Villa María|Córdoba/i.test(formulario),
      'el editor muestra la ubicacion del perfil de quien publica');
    comprobados.push('el editor abre con la localidad de la publicación, no con la del perfil');

    // --- B. cambiar la seleccion manda el ID, y el Backend deriva el texto ---
    await provincia.selectOption(rosario.provinciaId);
    await esperarA(async () => (await localidad.locator('option').count()) > 1,
      'el editor no cargo las localidades de la provincia nueva', 20_000);
    await localidad.selectOption(rosario.id);
    const elPatch = page.waitForRequest(
      (r) => r.url().includes(`/products/${idOficial}`) && r.method() === 'PATCH',
      { timeout: 20_000 });
    await guardar();
    const cuerpo = JSON.parse((await elPatch).postData() || '{}');
    assert(cuerpo.locality_id === rosario.id,
      `el PATCH mando locality_id=${JSON.stringify(cuerpo.locality_id)} y se eligio ${rosario.id}`);
    assert(!('location' in cuerpo),
      `el PATCH sigue mandando un texto de ubicacion escrito a mano: ${JSON.stringify(cuerpo.location)}`);
    await esperarA(() => ubicacionEnLaBase(idOficial).localityId === rosario.id,
      'la base no quedo con la localidad elegida', 20_000);
    const guardada = ubicacionEnLaBase(idOficial);
    assert(guardada.texto === `${rosario.nombre}, ${rosario.provincia}`,
      `el texto derivado quedo «${guardada.texto}» y el Backend tenia que armar `
      + `«${rosario.nombre}, ${rosario.provincia}»`);
    comprobados.push('guardar manda el ID y el texto lo deriva el Backend');

    // --- C. recargar: editor, tarjeta, detalle y filtros dicen lo mismo -----
    await abrirLaEdicion(conUbicacion);
    await esperarA(async () => (await localidad.locator('option').count()) > 1,
      'al reabrir, el editor no cargo las localidades', 20_000);
    assert((await provincia.inputValue()) === rosario.provinciaId
      && (await localidad.inputValue()) === rosario.id,
    `al reabrir el editor quedo en ${await provincia.inputValue()}/${await localidad.inputValue()}`);

    await page.goto(`${FRONTEND_URL}/?section=marketplace&q=${encodeURIComponent(conUbicacion)}`,
      { waitUntil: 'domcontentloaded' });
    const tarjeta = page.locator('article').filter({ hasText: conUbicacion }).first();
    await tarjeta.waitFor({ state: 'visible', timeout: 20_000 });
    await esperarA(async () => (await tarjeta.innerText()).includes(rosario.nombre),
      `la tarjeta del Mercado no dice ${rosario.nombre}`, 20_000);
    await tarjeta.getByRole('button', { name: 'Ver detalle' }).click();
    await esperarA(async () => (await page.locator('#detalle-titulo').count()) === 1,
      'no se abrio el detalle de la publicacion', 20_000);
    const textoDelDetalle = (await page.locator('[role="dialog"]').first().innerText())
      .replace(/\s+/g, ' ');
    assert(textoDelDetalle.includes(rosario.nombre) && textoDelDetalle.includes(rosario.provincia),
      `el detalle no describe ${rosario.nombre}, ${rosario.provincia}`);
    await page.keyboard.press('Escape');

    // El filtro nuevo la incluye y el anterior la excluye.
    const filtro = page.locator('#catalog-province');
    await filtro.waitFor({ state: 'visible', timeout: 20_000 });
    await esperarA(async () => (await filtro.locator('option').count()) > 1,
      'el filtro de provincia no cargo el padron', 20_000);
    await filtro.selectOption(rosario.provinciaId);
    await esperarA(async () => (await page.locator('article')
      .filter({ hasText: conUbicacion }).count()) === 1,
    `filtrando por ${rosario.provincia} la publicacion no aparece`, 20_000);
    await filtro.selectOption(pergamino.provinciaId);
    await esperarA(async () => (await page.locator('article')
      .filter({ hasText: conUbicacion }).count()) === 0,
    `filtrando por ${pergamino.provincia} la publicacion sigue apareciendo`, 20_000);
    comprobados.push('editor, tarjeta, detalle y filtros describen la misma localidad');

    // --- D. una fila heredada no hereda la ubicacion de su vendedora --------
    //
    // El alta EXIGE `locality_id`, asi que una publicacion sin ubicacion
    // oficial no se puede crear por ninguna ruta real: solo existe heredada.
    // Y `scripts/lib/sql.mjs` dice que no fabrica escenarios. Entonces la fila
    // heredada se simula donde importa —en lo que el panel lee—: se intercepta
    // /products/my y se le quita la ubicacion oficial a ESA publicacion. Lo
    // que se mide es lo mismo: que la pantalla no invente una ubicacion cuando
    // la API dice que no hay.
    const ubicacionDelHeredado = { locality_id: null, locality: null, location: 'Un lugar viejo' };
    await page.route('**/api/products/my', async (ruta) => {
      const respuesta = await ruta.fetch();
      const cuerpoReal = await respuesta.json();
      const productos = (cuerpoReal.products || []).map((p) => (
        p.name === heredada ? { ...p, ...ubicacionDelHeredado } : p
      ));
      await ruta.fulfill({
        response: respuesta,
        contentType: 'application/json',
        body: JSON.stringify({ ...cuerpoReal, products: productos }),
      });
    });

    await abrirLaEdicion(heredada);
    assert((await provincia.inputValue()) === '',
      `la fila heredada abrio con la provincia «${await provincia.inputValue()}» preseleccionada`);
    assert((await localidad.inputValue()) === '',
      `la fila heredada abrio con la localidad «${await localidad.inputValue()}» preseleccionada`);
    const formularioHeredado = (await page.locator('[class*="editForm"], form').first().innerText())
      .replace(/\s+/g, ' ');
    assert(!/Villa María|Córdoba|Un lugar viejo/i.test(formularioHeredado),
      'la fila heredada muestra el texto libre o la ubicacion del perfil como si fuera suya');
    assert((await page.getByText(/no tiene ubicación oficial/i).count()) === 1,
      'la fila heredada no dice que no tiene ubicacion oficial');

    // Guardar OTRO campo no puede fabricarle una ubicacion por el costado.
    const antesDelHeredado = ubicacionEnLaBase(idHeredada);
    await page.locator('#edit-nombre').fill(`${heredada} corregida`);
    const patchDelHeredado = page.waitForRequest(
      (r) => r.url().includes(`/products/${idHeredada}`) && r.method() === 'PATCH',
      { timeout: 20_000 });
    await guardar();
    const cuerpoHeredado = JSON.parse((await patchDelHeredado).postData() || '{}');
    assert(!('locality_id' in cuerpoHeredado),
      `guardar otro campo le mando una ubicacion: ${JSON.stringify(cuerpoHeredado.locality_id)}`);
    assert(!('location' in cuerpoHeredado),
      `guardar otro campo le mando un texto de ubicacion: ${JSON.stringify(cuerpoHeredado.location)}`);
    await esperarA(() => queryRows(
      `SELECT name FROM products WHERE id = ${sqlLiteral(idHeredada)}`)[0][0]
      === `${heredada} corregida`, 'el cambio de nombre no llego a la base', 20_000);
    const despuesDelHeredado = ubicacionEnLaBase(idHeredada);
    assert(despuesDelHeredado.localityId === antesDelHeredado.localityId
      && despuesDelHeredado.texto === antesDelHeredado.texto,
    `guardar otro campo movio la ubicacion de ${antesDelHeredado.localityId} a `
      + `${despuesDelHeredado.localityId}`);
    await page.unroute('**/api/products/my');
    comprobados.push('la fila heredada se declara sin ubicación oficial y guardar otro campo no le inventa una');

    // --- E. la politica de suciedad sigue midiendo por el ID ---------------
    // Cambiar y volver deja limpio: cerrar no pregunta nada.
    await abrirLaEdicion(conUbicacion);
    await esperarA(async () => (await localidad.locator('option').count()) > 1,
      'el editor no cargo las localidades para la prueba de suciedad', 20_000);
    await provincia.selectOption(pergamino.provinciaId);
    await esperarA(async () => (await localidad.locator('option').count()) > 1,
      'no cargaron las localidades de la provincia intermedia', 20_000);
    await provincia.selectOption(rosario.provinciaId);
    await esperarA(async () => (await localidad.locator('option').count()) > 1,
      'no volvieron a cargar las localidades de la provincia original', 20_000);
    await localidad.selectOption(rosario.id);
    const pregunta = page.locator('[aria-labelledby="titulo-cambios-sin-guardar"]');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click();
    await esperarA(async () => (await provincia.count()) === 0,
      'volver a la localidad inicial dejo el formulario sucio: preguntó al cerrar', 20_000);
    assert((await pregunta.count()) === 0, 'cambiar y revertir la localidad no volvio a limpio');
    comprobados.push('cambiar y revertir la localidad vuelve a limpio');

    // Un cambio real sí queda protegido por la confirmación de FORM-DIRTY-1.
    await abrirLaEdicion(conUbicacion);
    await esperarA(async () => (await localidad.locator('option').count()) > 1,
      'el editor no cargo las localidades para el cambio real', 20_000);
    await provincia.selectOption(pergamino.provinciaId);
    await esperarA(async () => (await localidad.locator('option').count()) > 1,
      'no cargaron las localidades del cambio real', 20_000);
    await localidad.selectOption(pergamino.id);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click();
    await esperarA(async () => (await pregunta.count()) === 1,
      'cambiar la localidad de verdad no pidio confirmacion antes de cerrar', 20_000);
    await page.getByRole('button', { name: 'Descartar cambios' }).click();
    await esperarA(async () => (await provincia.count()) === 0,
      'descartar no cerro la edicion', 20_000);
    assert(ubicacionEnLaBase(idOficial).localityId === rosario.id,
      'descartar el cambio igual movio la ubicacion publicada');
    comprobados.push('un cambio real de localidad queda protegido y descartarlo no lo guarda');

    await contexto.close();
    return `la ubicación publicada sale del padrón y de ningún otro lado (${comprobados.join('; ')}); `
      + `«${conUbicacion}» pasó de ${pergamino.nombre} a ${rosario.nombre} mandando el `
      + `identificador ${rosario.id}, el Backend derivó «${guardada.texto}» y el catálogo, el `
      + 'detalle y los dos filtros coinciden';
  } finally {
    await browser.close();
  }
});

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;

console.log();
console.log('Resumen smoke tests');
console.log('-------------------');
for (const result of results) {
  console.log(
    `${result.passed ? 'PASS' : 'FAIL'} ${String(result.number).padStart(2, '0')} ${result.name}`,
  );
}
console.log('-------------------');
if (CASOS_PEDIDOS.length) {
  console.log(`CORRIDA FILTRADA (SMOKE_CASOS=${CASOS_PEDIDOS.join(',')}): NO es la suite completa`);
}
console.log(`${passed}/${results.length} pasaron; ${failed} fallaron`);

if (failed > 0) process.exitCode = 1;
