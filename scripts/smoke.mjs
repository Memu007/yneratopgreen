import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
ruta = os.path.join(tempfile.mkdtemp(), "plantilla.env")
with open(ruta, "w", encoding="utf-8") as archivo:
    archivo.write(sys.stdin.read())
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
      .filter((linea) => /validation error|Extra inputs|Field required|Value error|^[A-Z][A-Z0-9_]*$/.test(linea))
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
  await page.getByRole('heading', { name: /M.todo de Pago/ }).waitFor({ timeout: 20_000 });
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
      .getByRole('heading', { name: /Agregar Nuevo Producto/i })
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
      .getByRole('heading', { name: /Agregar Nuevo Producto/i })
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
    await page.getByRole('button', { name: /Agregar/ }).first().click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();

    await page.getByRole('heading', { name: /Datos de Envío/ }).waitFor();
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
      .getByText(/Comprobante enviado\. Esperando validación del vendedor/)
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
      await sellerPage.locator('button').filter({ hasText: '👤' }).first().click();
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

await runCase(21, 'Respaldo de imágenes en el recorrido de demostración', async () => {
  const browser = await chromium.launch({ headless: true });
  let blockedSeedImages = 0;
  const blockSeedImages = (page) =>
    page.route('https://picsum.photos/**', (route) => {
      blockedSeedImages += 1;
      return route.fulfill({ status: 404, body: 'imagen rota por smoke' });
    });

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
      .getByPlaceholder('Buscar productos, semillas, maquinaria...')
      .fill(productName);
    await buyerPage
      .getByPlaceholder('Buscar productos, semillas, maquinaria...')
      .press('Enter');
    const productHeading = buyerPage.getByRole('heading', {
      name: productName,
      exact: true,
      level: 3,
    });
    await productHeading.waitFor({ state: 'visible' });
    const productCard = productHeading.locator('xpath=ancestor::div[contains(@class,\"card\")]');
    const addButton = productCard.getByRole('button', { name: /Agregar/ });

    await productHeading.click();
    const detailHeading = buyerPage.getByRole('heading', {
      name: productName,
      exact: true,
      level: 2,
    });
    await detailHeading.waitFor({ state: 'visible' });
    const detailModal = detailHeading.locator('xpath=ancestor::div[contains(@class,\"modal\")]');
    await detailModal.getByRole('img', { name: productName, exact: true }).first().waitFor();
    await detailModal.getByRole('button', { name: 'Cerrar' }).click();

    await addButton.click();
    await buyerPage.getByRole('button', { name: /Carrito/ }).click();
    const cartHeading = buyerPage.getByRole('heading', { name: /Mi Carrito/ });
    await cartHeading.waitFor();
    const cartModal = cartHeading.locator('xpath=ancestor::div[contains(@class,\"modal\")]');
    await cartModal.getByRole('img', { name: productName, exact: true }).waitFor();
    await cartModal.getByRole('button', { name: 'Continuar compra' }).click();
    const shippingHeading = buyerPage.getByRole('heading', { name: /Datos de Envío/ });
    const checkoutModal = shippingHeading.locator('xpath=ancestor::div[contains(@class,\"modal\")]');
    await checkoutModal.getByRole('img', { name: productName, exact: true }).waitFor();
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
    await sellerPage.locator('button').filter({ hasText: '👤' }).first().click();
    await sellerPage.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
    await sellerPage.getByRole('button', { name: 'Mis Productos' }).click();
    await sellerPage.getByRole('heading', { name: 'Mis Productos' }).waitFor();
    await sellerPage.getByRole('img').first().waitFor();
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
    await adminPage.getByRole('button', { name: '⚙️ Admin' }).click();
    await adminPage.getByRole('heading', { name: 'Panel de Administración' }).waitFor();
    await adminPage.getByRole('button', { name: '📦 Productos' }).click();
    const table = adminPage.locator('table');
    await table.waitFor();
    await table.getByRole('img').first().waitFor();
    await adminContext.close();

    assert(blockedSeedImages > 0, 'Playwright no forzó ninguna URL de picsum.photos a HTTP 404');
    return 'URLs rotas reemplazadas en detalle, carrito, checkout, vendedor y administración';
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
    await page.getByRole('button', { name: 'Ingresar' }).click();
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
    await page.getByPlaceholder('Buscar productos, semillas, maquinaria...').fill(nombre);
    await page.getByPlaceholder('Buscar productos, semillas, maquinaria...').press('Enter');
    const tarjeta = page.getByRole('heading', { name: nombre, exact: true, level: 3 });
    await tarjeta.waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Agregar/ }).first().click();

    // recién ahora se desactiva: el carrito local ya lo tiene
    await apiRequest(`/products/${productoId}`, {
      method: 'PATCH', token: state.sellerToken, body: { status: 'paused' },
    });

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Envío/ }).waitFor();
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
    await page.getByRole('heading', { name: /Datos de Envío/ }).waitFor({ state: 'visible' });
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
    await page.getByPlaceholder('Buscar productos, semillas, maquinaria...').fill(state.product.name);
    await page.getByPlaceholder('Buscar productos, semillas, maquinaria...').press('Enter');
    await page
      .getByRole('heading', { name: state.product.name, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Agregar/ }).first().click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Envío/ }).waitFor();
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
    await elegirDestino(page, 'Pergamino');
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');
    await resolverTrasladoPropio(page);
    await page.locator('form:has(h2) button[type="submit"]').click();

    await page.getByRole('heading', { name: /Método de Pago/ }).waitFor();
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
    await page.getByRole('button', { name: 'Ingresar' }).click();
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
    await page.getByRole('button', { name: 'Ingresar' }).click();
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
    await page.getByRole('button', { name: 'Ingresar' }).click();
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
    await page.getByRole('button', { name: 'Ingresar' }).click();
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
    await page.locator('button').filter({ hasText: '👤' }).first().click();
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
    await page.locator('button').filter({ hasText: '👤' }).first().click();
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
      await page.locator('button').filter({ hasText: '👤' }).first().click();
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
    await page.locator('#perfil-nombre').waitFor({ state: 'detached' });

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
      const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
      await buscador.fill(nombreB);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: nombreB, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Agregar/ }).first().click();

      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de Env/ }).waitFor();
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
      const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
      await buscador.fill(producto.nombre);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: producto.nombre, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Agregar/ }).first().click();
    };

    const abrirCheckout = async () => {
      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15_000 });
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
    await page.getByRole('heading', { name: /Datos de Env/ })
      .waitFor({ state: 'hidden', timeout: 15_000 });

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('heading', { name: /Mi Carrito/ }).waitFor({ timeout: 15_000 });
    await page.locator('button[title="Eliminar"]:visible').first().click();
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
    await page.getByRole('button', { name: /Continuar al Pago/ }).click();
    await page.getByRole('heading', { name: /M.todo de Pago/ }).waitFor({ timeout: 15_000 });
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
    await page.getByRole('button', { name: /Agregar/ }).first().click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Env/ }).waitFor();

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
      const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
      await buscador.fill(nombreDelProducto);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: nombreDelProducto, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Agregar/ }).first().click();
    };

    const comprarHastaElDestino = async () => {
      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15_000 });
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
    await page.getByRole('button', { name: 'Salir' }).click();
    await page.getByRole('button', { name: 'Ingresar' }).waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Ingresar' }).click();
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
      const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
      await buscador.fill(producto.nombre);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: producto.nombre, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Agregar/ }).first().click();
    };

    const comprarHastaElDestino = async () => {
      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15_000 });
      await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0303');
      await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
      await page.getByPlaceholder('2000').fill('2700');
      await elegirDestino(page, 'Pergamino');
    };

    const cerrarModal = () => page.locator('button[aria-label="Cerrar"]:visible').first().click();

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
    await page.getByRole('button', { name: 'Ingresar' }).waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Ingresar' }).click();
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

  // 1. Con la cabecera renueva, y las cookies que emite son Lax.
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
      const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
      await buscador.fill(pedido.nombre);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: pedido.nombre, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Agregar/ }).first().click();
    }

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15_000 });
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
    await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ state: 'visible' });
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
    const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
    await buscador.fill(pedidoA.nombre);
    await buscador.press('Enter');
    await page.getByRole('heading', { name: pedidoA.nombre, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Agregar/ }).first().click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15_000 });
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
      await page.locator('button').filter({ hasText: '👤' }).first().click();
      await page.getByRole('button', { name: /Mis Operaciones/ })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Mis Operaciones/ }).click();
      await page.getByRole('heading', { name: 'Mis Operaciones' })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByText(/Operación #/).first().waitFor({ state: 'visible', timeout: 15_000 });
      const visto = ((await page.locator('body').textContent()) || '').replace(/\s+/g, ' ');
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
    const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
    await buscador.fill(pedidoA.nombre);
    await buscador.press('Enter');
    await page.getByRole('heading', { name: pedidoA.nombre, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Agregar/ }).first().click();

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15_000 });
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
    await page.locator('button').filter({ hasText: '👤' }).first().click();
    await page.getByRole('button', { name: /Mis Operaciones/ })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Mis Operaciones/ }).click();
    await page.getByText(/Operación #/).first().waitFor({ state: 'visible', timeout: 15_000 });
    const visto = ((await page.locator('body').textContent()) || '').replace(/\s+/g, ' ');
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
  const [categoria] = queryRows('SELECT id FROM categories ORDER BY name LIMIT 1');
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
        await page.getByRole('button', { name: 'Ingresar' }).click();
        await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
        await page.getByPlaceholder('tu@email.com').fill('vendedor@ejemplo.com');
        await page.getByPlaceholder('••••••••').fill('vendedor123');
        await page.locator('[class*="_submitButton_"][type="submit"]').click();
        await page.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });

        const abrirPanel = async () => {
          await page.locator('button').filter({ hasText: '👤' }).first().click();
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
      const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
      await buscador.fill(item.nombre);
      await buscador.press('Enter');
      await page.getByRole('heading', { name: item.nombre, exact: true, level: 3 })
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('button', { name: /Agregar/ }).first().click();
    }

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0808');
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');
    await elegirDestino(page, 'Pergamino');
    await resolverTrasladoPropio(page);
    await page.locator('form:has(h2) button[type="submit"]').click();

    // --- lo que la pantalla dice ANTES de confirmar
    await page.getByRole('heading', { name: /M.todo de Pago/ }).waitFor({ timeout: 20_000 });
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
      await page.locator('button').filter({ hasText: '👤' }).first().click();
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

function documentosEnDisco() {
  try {
    return readdirSync(CARPETA_DOCUMENTOS).filter((n) => n.endsWith('.pdf')).length;
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
  assert(!existsSync(`${CARPETA_DOCUMENTOS}/${rutaVieja}`),
    `el archivo anterior sigue en disco: ${rutaVieja}`);
  assert(existsSync(`${CARPETA_DOCUMENTOS}/${despues.ruta}`),
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
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('tu@email.com').fill(credenciales.email);
    await page.getByPlaceholder('••••••••').fill(credenciales.password);
    await page.locator('[class*="_submitButton_"][type="submit"]').click();
    await page.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });

    await page.locator('button').filter({ hasText: '👤' }).first().click();
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
    await page.locator('button').filter({ hasText: '👤' }).first().click();
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
    await pa.getByRole('button', { name: 'Ingresar' }).click();
    await pa.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
    await pa.getByPlaceholder('tu@email.com').fill('admin@topgreen.com');
    await pa.getByPlaceholder('••••••••').fill('admin123');
    await pa.locator('[class*="_submitButton_"][type="submit"]').click();
    await pa.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });

    await pa.locator('button').filter({ hasText: '⚙️' }).first().click();
    await pa.getByRole('heading', { name: 'Panel de Administración' }).waitFor({ timeout: 15_000 });
    await pa.getByRole('button', { name: /📄 Documentación/ }).click();

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
    await pp.getByPlaceholder('Buscar productos, semillas, maquinaria...').fill(nombreProducto);
    await pp.getByPlaceholder('Buscar productos, semillas, maquinaria...').press('Enter');
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

  const casos = [
    ['la misma carpeta', 'UPLOAD_DIR=uploads\nDOCUMENTOS_DIR=uploads'],
    ['una subcarpeta', 'UPLOAD_DIR=uploads\nDOCUMENTOS_DIR=uploads/constancias'],
    ['dando la vuelta con ..', 'UPLOAD_DIR=uploads\nDOCUMENTOS_DIR=documentos/../uploads/privado'],
    ['con rutas absolutas', 'UPLOAD_DIR=/data/uploads\nDOCUMENTOS_DIR=/data/uploads/docs'],
  ];

  const rechazos = [];
  for (const [etiqueta, extra] of casos) {
    const salida = cargarConSettings(`${base}\n${extra}\n`);
    assert(!salida.includes('CARGA_OK'),
      `«${etiqueta}»: la aplicación arrancó con las constancias adentro de lo público`);
    rechazos.push(etiqueta);
  }

  // El mensaje tiene que servirle a quien configura, no sólo decir que no.
  const detalle = cargarConSettings(`${base}\nUPLOAD_DIR=uploads\nDOCUMENTOS_DIR=uploads/constancias\n`);
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
    await pt.getByRole('button', { name: 'Ingresar' }).click();
    await pt.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
    await pt.getByPlaceholder('tu@email.com').fill(transportistas.amplio.email);
    await pt.getByPlaceholder('••••••••').fill(transportistas.amplio.password);
    await pt.locator('[class*="_submitButton_"][type="submit"]').click();
    await pt.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });
    await pt.locator('button').filter({ hasText: '👤' }).first().click();
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
    const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
    await buscador.fill(pedidoA.nombre);
    await buscador.press('Enter');
    await page.getByRole('heading', { name: pedidoA.nombre, exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /Agregar/ }).first().click();

    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15_000 });
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

  const [[productoDelVendedor]] = queryRows(`
    SELECT id FROM products WHERE seller_id = ${sqlLiteral(vendedor.id)}
    ORDER BY id LIMIT 1`);
  assert(productoDelVendedor, 'el vendedor del seed no tiene publicaciones');
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
    `con cabecera la imagen no entró: HTTP ${imagenConCabecera.status}`);
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

    // 1. Entrar guarda las dos cookies, y salen Lax.
    const entrada = await page.evaluate(async (api) => (await fetch(`${api}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email: 'vendedor@ejemplo.com', password: 'vendedor123' }),
    })).json(), apiCruzada);
    const guardadas = await deSesion();
    assert(guardadas.length === 2,
      `el navegador guardó ${guardadas.length} cookies de sesión en vez de 2`);
    // `None` y no `Lax`: está medido que entre sitios distintos el navegador
    // DESCARTA un `Set-Cookie` marcado `Lax`, así que con `Lax` esta cookie no
    // llegaría a existir y la vuelta de Mercado Pago se quedaría sin a quién
    // reconocer. Que la cookie sea ambiental ya no habilita nada: ninguna ruta
    // que mute la acepta.
    for (const galleta of guardadas) {
      assert(galleta.sameSite === 'None',
        `${galleta.name} quedó SameSite=${galleta.sameSite}: entre sitios no se guardaría`);
      assert(galleta.httpOnly, `${galleta.name} dejó de ser HttpOnly`);
      assert(galleta.secure, `${galleta.name} dejó de ser Secure`);
    }
    const primeras = Object.fromEntries(guardadas.map((c) => [c.name, c.value]));

    // 2. Renovar con la cabecera las reemplaza: siguen Lax y cambian de valor.
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
