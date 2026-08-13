import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { chromium } from 'playwright';

import {
  DETALLE_CRUDO, SECRETO_DE_ACCESO, SECRETO_DE_REFRESCO, levantarDoble,
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
    const salida = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    const motivo = salida
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => /validation error|Extra inputs|Field required|^[A-Z][A-Z0-9_]*$/.test(linea))
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
cliente.post("/api/auth/login", json={
    "email": "vendedor@ejemplo.com", "password": "vendedor123"})

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
cliente.post("/api/auth/login", json={
    "email": "vendedor@ejemplo.com", "password": "vendedor123"})

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
cliente.post("/api/auth/login", json={
    "email": "vendedor@ejemplo.com", "password": "vendedor123"})

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
cliente.post("/api/auth/login", json={
    "email": "vendedor@ejemplo.com", "password": "vendedor123"})
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

async function runCase(number, name, callback) {
  const startedAt = Date.now();

  try {
    const observation = await callback();
    const elapsed = Date.now() - startedAt;
    results.push({ number, name, passed: true, observation, elapsed });
    console.log(`[PASS] ${String(number).padStart(2, '0')} ${name} — ${observation} (${elapsed} ms)`);
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
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
    },
  });

  assert(order.data?.id, 'checkout no devolvió una orden');
  assert(order.data.items?.length === 1, 'la orden no conserva el ítem del carrito');
  state.orderId = order.data.id;
  return `HTTP ${order.status}, order_id=${order.data.id}, status=${order.data.status}`;
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

  const opciones = await apiRequest('/orders/transfer-options', { token: state.buyerToken });
  const detalles = [];
  for (const [etiqueta, sellerId] of [['vendedor', state.sellerId], ['admin', adminId]]) {
    const opcion = opciones.data.find((candidate) => candidate.seller_id === sellerId);
    assert(opcion, `la API no ofrecio transferencia para el ${etiqueta}`);
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

await runCase(14, 'Transferencia exige CBU o alias del vendedor', async () => {
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
    const error = await expectApiError(400, () =>
      apiRequest('/orders/transfer-options', { token: state.buyerToken }),
    );
    assert(/no configuró CBU ni alias/i.test(error), `motivo inesperado: ${error}`);
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
  return 'HTTP 400 con motivo visible; estado bancario vaciado y restaurado por la prueba';
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
  const options = await apiRequest('/orders/transfer-options', {
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

    await page.getByRole('heading', { name: /Método de Pago/ }).waitFor();
    await page.locator('input[value="bank_transfer"]').check();
    await page
      .getByText(/TopGreen no recibe ni retiene el dinero/)
      .waitFor({ state: 'visible' });
    await page.getByText(new RegExp(databaseBank[1])).waitFor({ state: 'visible' });
    const bankDetails = await page.locator('form:has(h2)').textContent();
    assert(bankDetails?.includes(databaseBank[0]), 'la UI no muestra el CBU guardado en SQL');
    assert(bankDetails?.includes(databaseBank[1]), 'la UI no muestra el alias guardado en SQL');
    await page.getByRole('button', { name: /Crear orden y adjuntar comprobante/ }).click();

    await page.getByRole('heading', { name: /Transferencia bancaria/ }).waitFor();
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

await runCase(22, 'Registro de transportista desde la interfaz', async () => {
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
        l.name
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

    return `UI + API + DB, localidad=${databaseCarrier[9]}, radio=${databaseCarrier[7]} km, `
      + 'declaración con fecha del servidor';
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
  // El motivo tiene que venir de /orders/transfer-options y no del carrito.
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
    await page.locator('input[value="bank_transfer"]').check();
    const aviso = page.locator('[role="alert"]');
    await aviso.waitFor({ state: 'visible', timeout: 15_000 });
    const texto = (await aviso.textContent()) || '';
    assert(
      /no configuró CBU ni alias/i.test(texto),
      `no se ve el motivo de transfer-options, se ve: "${texto.trim()}"`,
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
    const datosBancarios = page.locator('[class*="_confirmationInfo_"]');
    await datosBancarios.getByRole('heading', { level: 3 }).first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    const pago = ((await datosBancarios.textContent()) || '').replace(/\s+/g, ' ');
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

await runCase(49, 'Cookie y Bearer contradictorios no eligen identidad', async () => {
  // Los endpoints protegidos leían la cookie primero y el header sólo si no
  // había cookie. Con el header de una cuenta y la cookie de otra, la API
  // trabajaba en silencio como la segunda. Dos credenciales distintas no son
  // una identidad: son dos, y quedarse con cualquiera es decidir por quien
  // mandó la petición.
  const otra = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const tokenA = state.buyerToken;
  const tokenB = otra.data.access_token;
  const [[idB]] = queryRows("SELECT id FROM users WHERE email = 'cliente@ejemplo.com'");

  const [productoX, productoY, productoZ] = queryRows(`
    SELECT p.id FROM products p
    WHERE p.status = 'ACTIVE' AND p.stock > 0 AND p.publication_type <> 'servicio'
    ORDER BY p.id LIMIT 3
  `).map((fila) => fila[0]);

  const carritoDe = (usuario) => queryRows(`
    SELECT ci.product_id, ci.quantity FROM cart_items ci
    JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${sqlLiteral(usuario)} AND c.status = 'ACTIVE'
    ORDER BY ci.product_id
  `).map((fila) => fila.join('x')).join('|');

  // Cada cuenta con su carrito, escrito con una sola credencial.
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

  // --- lectura: una sola credencial, y las dos iguales, siguen andando
  const correoDe = (id) => queryRows(
    `SELECT email FROM users WHERE id = ${sqlLiteral(id)}`)[0][0];
  const correoDeA = correoDe(state.buyerId);
  const correoDeB = correoDe(idB);

  const soloHeader = await pedirCrudo('/auth/me', { header: tokenA });
  assert(soloHeader.status === 200 && soloHeader.datos.email === correoDeA,
    `sólo header: HTTP ${soloHeader.status} para ${soloHeader.datos?.email}`);
  const soloCookie = await pedirCrudo('/auth/me', { cookie: `access_token=${tokenA}` });
  assert(soloCookie.status === 200 && soloCookie.datos.email === correoDeA,
    `sólo cookie: HTTP ${soloCookie.status} para ${soloCookie.datos?.email}`);
  const iguales = await pedirCrudo('/auth/me', {
    header: tokenA, cookie: `access_token=${tokenA}`,
  });
  assert(iguales.status === 200 && iguales.datos.email === correoDeA,
    `las dos iguales: HTTP ${iguales.status} para ${iguales.datos?.email}`);

  // --- lectura contradictoria, en los dos órdenes
  const contradictorias = [
    ['header A + cookie B', tokenA, tokenB],
    ['header B + cookie A', tokenB, tokenA],
  ];
  const motivos = new Set();
  for (const [etiqueta, header, cookie] of contradictorias) {
    const respuesta = await pedirCrudo('/auth/me', {
      header, cookie: `access_token=${cookie}`,
    });
    assert(respuesta.status === 401,
      `${etiqueta}: la API respondió HTTP ${respuesta.status} en vez de 401`);
    const detalle = String(respuesta.datos?.detail ?? respuesta.datos ?? '');
    assert(!detalle.includes(correoDeA) && !detalle.includes(correoDeB),
      `${etiqueta}: el rechazo nombra una cuenta ("${detalle}")`);
    assert(!detalle.includes(header.slice(0, 12)) && !detalle.includes(cookie.slice(0, 12)),
      `${etiqueta}: el rechazo devuelve parte de un token`);
    motivos.add(detalle);
  }
  assert(motivos.size === 1,
    `el motivo cambia según el orden y deja ver cuál valía: ${[...motivos].join(' / ')}`);

  // --- escritura contradictoria: 401 y ningún carrito tocado
  for (const [etiqueta, header, cookie] of contradictorias) {
    const respuesta = await pedirCrudo('/cart/sync', {
      method: 'POST',
      header,
      cookie: `access_token=${cookie}`,
      body: { items: [{ product_id: productoZ, quantity: 7 }] },
    });
    assert(respuesta.status === 401,
      `${etiqueta} escribiendo: HTTP ${respuesta.status} en vez de 401`);
    assert(carritoDe(state.buyerId) === antesDeA,
      `${etiqueta}: se escribió sobre el carrito de la primera cuenta`);
    assert(carritoDe(idB) === antesDeB,
      `${etiqueta}: se escribió sobre el carrito de la segunda cuenta`);
  }

  // --- la dependencia opcional no elige identidad: queda anónima
  const opcional = JSON.parse(correrEnLaApi(PROBAR_OPCIONAL, JSON.stringify({
    a: tokenA, b: tokenB,
  })));
  assert(opcional.solo_cookie === correoDeA,
    `la dependencia opcional dejó de reconocer la cookie: ${opcional.solo_cookie}`);
  assert(opcional.iguales === correoDeA,
    `la dependencia opcional no reconoce las dos iguales: ${opcional.iguales}`);
  assert(opcional.conflicto === null && opcional.conflicto_invertido === null,
    `la dependencia opcional eligió identidad: ${JSON.stringify(opcional)}`);

  return 'sólo header, sólo cookie y las dos iguales conservan identidad; '
    + 'contradictorias dan 401 en los dos órdenes, con el mismo motivo, sin nombrar '
    + 'cuenta ni token, sin escribir ningún carrito y sin personalizar lo opcional';
});

await runCase(50, 'La misma regla vale para el refresco, sin emitir ni tocar cookies', async () => {
  // El refresco leía su cookie primero y el header después. Un refresco
  // contradictorio no puede emitir tokens ni mover cookies de sesión.
  const otra = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'cliente@ejemplo.com', password: 'cliente123' },
  });
  const refrescoA = state.buyerRefreshToken;
  const refrescoB = otra.data.refresh_token;
  const [[idB]] = queryRows("SELECT id FROM users WHERE email = 'cliente@ejemplo.com'");
  const correoDeA = queryRows(
    `SELECT email FROM users WHERE id = ${sqlLiteral(state.buyerId)}`)[0][0];
  const correoDeB = queryRows(
    `SELECT email FROM users WHERE id = ${sqlLiteral(idB)}`)[0][0];

  const emite = (respuesta) => Boolean(respuesta.datos?.access_token);

  const soloHeader = await pedirCrudo('/auth/refresh', { method: 'POST', header: refrescoA });
  assert(soloHeader.status === 200 && emite(soloHeader)
    && soloHeader.datos.user.email === correoDeA,
    `sólo header: HTTP ${soloHeader.status}`);
  const soloCookie = await pedirCrudo('/auth/refresh', {
    method: 'POST', cookie: `refresh_token=${refrescoA}`,
  });
  assert(soloCookie.status === 200 && emite(soloCookie)
    && soloCookie.datos.user.email === correoDeA,
    `sólo cookie: HTTP ${soloCookie.status}`);
  const iguales = await pedirCrudo('/auth/refresh', {
    method: 'POST', header: refrescoA, cookie: `refresh_token=${refrescoA}`,
  });
  assert(iguales.status === 200 && emite(iguales) && iguales.datos.user.email === correoDeA,
    `las dos iguales: HTTP ${iguales.status}`);

  for (const [etiqueta, header, cookie] of [
    ['header A + cookie B', refrescoA, refrescoB],
    ['header B + cookie A', refrescoB, refrescoA],
  ]) {
    const respuesta = await pedirCrudo('/auth/refresh', {
      method: 'POST', header, cookie: `refresh_token=${cookie}`,
    });
    assert(respuesta.status === 401,
      `${etiqueta}: HTTP ${respuesta.status} en vez de 401`);
    assert(!emite(respuesta), `${etiqueta}: el rechazo igual emitió tokens`);
    assert(respuesta.galletas.length === 0,
      `${etiqueta}: el rechazo movió cookies de sesión (${respuesta.galletas.length})`);
    const detalle = String(respuesta.datos?.detail ?? respuesta.datos ?? '');
    assert(!detalle.includes(correoDeA) && !detalle.includes(correoDeB),
      `${etiqueta}: el rechazo nombra una cuenta ("${detalle}")`);
  }

  return 'refresco con una sola credencial y con las dos iguales emite normalmente; '
    + 'contradictorio da 401 en los dos órdenes, sin emitir tokens y sin tocar cookies';
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
    await page.getByRole('heading', { name: /M.todo de Pago/ }).waitFor({ timeout: 20_000 });
    await page.locator('input[value="bank_transfer"]').check();
    await page.getByRole('button', { name: /Crear orden/ }).click();
    await page.getByRole('heading', { name: /Transferencia bancaria/ })
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
    await page.route('**/api/orders/checkout/transfer', async (ruta) => {
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
    await page.getByRole('heading', { name: /M.todo de Pago/ }).waitFor({ timeout: 20_000 });
    await page.locator('input[value="bank_transfer"]').check();
    await page.getByRole('button', { name: /Crear orden/ }).click();
    await page.getByRole('heading', { name: /Transferencia bancaria/ })
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
    ['mercadopago', '/orders/checkout'],
  ]) {
    await apiRequest('/cart', { method: 'DELETE', token: state.buyerToken });
    const carrito = await apiRequest('/cart/sync', {
      method: 'POST', token: state.buyerToken,
      body: { items: [{ product_id: productoId, quantity: cantidad }] },
    });
    const [linea] = carrito.data.items;

    const opciones = (await apiRequest('/orders/transfer-options',
      { token: state.buyerToken })).data;
    const opcion = opciones.find((o) => o.seller_id === vendedorId);
    assert(opcion, 'transfer-options no trajo al vendedor de la publicación');

    const respuesta = await apiRequest(endpoint, {
      method: 'POST', token: state.buyerToken,
      body: {
        shipping_address: 'Ruta 8 km 220',
        shipping_locality_id: localidadDeEnvio(),
        shipping_postal_code: '2700',
        shipping_decisions: [{ seller_id: vendedorId, mode: 'self' }],
      },
    });

    const ordenId = camino === 'transferencia'
      ? respuesta.data.orders[0].order_id
      : respuesta.data.id;
    visto[camino] = {
      carritoLinea: linea.subtotal,
      carritoTotal: carrito.data.total_amount,
      opcion: opcion.amount,
      respuesta: camino === 'transferencia'
        ? respuesta.data.orders[0].amount
        : respuesta.data.total_amount,
      subtotalApi: camino === 'transferencia' ? null : respuesta.data.subtotal,
      enBase: montosDeLaOrden(ordenId),
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
      ['la opción de transferencia', datos.opcion],
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
      ['la opción de transferencia', datos.opcion],
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
  const opciones = (await apiRequest('/orders/transfer-options',
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
  const vinculo = rutas.filter((ruta) => ruta.includes('mp-oauth')).sort();
  assert(vinculo.length === 5,
    `el vínculo publica ${vinculo.length} rutas: ${vinculo.join(', ')}`);

  return `manual-link responde ${aMano.status}, las tres rutas de cobro 404, y el esquema `
    + 'publica exactamente las 5 del vínculo y ninguna de pagos';
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
  const bajada = correrAlembic('downgrade -1');
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
console.log(`${passed}/${results.length} pasaron; ${failed} fallaron`);

if (failed > 0) process.exitCode = 1;
