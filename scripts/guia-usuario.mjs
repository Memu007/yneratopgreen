#!/usr/bin/env node
/**
 * Recorre la guía de uso en el navegador y comprueba que dice la verdad.
 *
 *   node scripts/guia-usuario.mjs                     escritorio y celular
 *   node scripts/guia-usuario.mjs --anchos escritorio sólo uno
 *   node scripts/guia-usuario.mjs --guia <ruta>       otra copia de la guía
 *   node scripts/guia-usuario.mjs --hasta 5           sólo hasta el paso 5
 *
 * La guía es `docs/USER_MANUAL.md`, para quien compra, vende y transporta.
 * Cada paso lleva un comentario `<!-- recorrido: id -->`, y acá hay un
 * recorrido con ese id que hace lo que el paso dice. Se comprueban tres cosas,
 * como en `scripts/guia-admin.mjs`:
 *
 *   1. Cada texto entre «» del paso aparece en la pantalla durante su
 *      recorrido. «…» dentro de una cita vale por cualquier texto.
 *   2. Lo que el paso dice que pasa después, pasa. Cada comprobación va
 *      dentro de `v.afirma(frase, …)`, con la frase de la guía que describe
 *      lo que comprueba. Si la guía ya no dice esa frase, el paso falla aunque
 *      la comprobación pase.
 *   3. Nada de lo que se ve queda sin nombrar. Los botones y los campos de
 *      cada pantalla que recorre un paso tienen que estar citados en la
 *      sección de la guía que la explica.
 *
 * Lo que no se puede comprobar está al final de la guía, en «Lo que el
 * programa no comprueba», con cada frase entre “ ”. Antes de abrir el
 * navegador se mira que cada una siga escrita donde dice la lista.
 *
 * Los correos de confirmación se leen del outbox de desarrollo
 * (`backend/outbox`): se busca el enlace del correo dirigido a la cuenta, no
 * se manda nada de verdad.
 *
 * Si algo no coincide, falla y nombra el paso. Salida: 0 si la guía y el
 * sitio coinciden; 1 si algún paso no coincide; 2 si no se pudo correr.
 *
 * Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra
 * demo. Crea sus propias cuentas, publicaciones y órdenes, todas con un sello
 * en el nombre.
 */
import { chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryRows, sqlLiteral } from './lib/sql.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.SMOKE_API_URL || 'http://localhost:8000/api';
const WEB = process.env.SMOKE_FRONTEND_URL || 'http://localhost:5173';
const ANCHOS = {
  escritorio: { width: 1440, height: 900 },
  celular: { width: 390, height: 844 },
};
const ADMIN = { email: 'admin@topgreen.com', password: 'admin123' };
const CLAVE = 'GuiaDeUso1';

const argumentos = process.argv.slice(2);
const opcion = (nombre) => {
  const i = argumentos.indexOf(nombre);
  return i >= 0 ? argumentos[i + 1] : undefined;
};
const RUTA_DE_LA_GUIA = resolve(opcion('--guia') || join(RAIZ, 'docs/USER_MANUAL.md'));
const ANCHOS_PEDIDOS = (opcion('--anchos') || 'escritorio,celular').split(',');
const HASTA = Number(opcion('--hasta') || Infinity);

// --- La guía -----------------------------------------------------------------

const normalizar = (texto) => texto.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
const citasDe = (texto) => [...texto.matchAll(/«([^»]+)»/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
// Una frase se busca como se lee: sin negritas ni código, y sin que importen
// los cortes de línea ni las mayúsculas.
const limpio = (texto) => normalizar(texto.replace(/\*\*|`/g, ''));
const dice = (region, frase) => limpio(region).includes(limpio(frase));
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Las citas de un paso, con el ancho en que se ven. Una cita en una frase que
// habla del celular («En el celular …», «(en el celular dice …)») se busca
// sólo ahí, y una en una frase que habla de la computadora, sólo ahí; la que
// va justo antes de «(en el celular …)» también es de la computadora. Las
// demás, en los dos.
function citasConAncho(texto) {
  return [...texto.matchAll(/«([^»]+)»/g)].map((m) => {
    const frase = texto.slice(0, m.index).split(/[.()]|\n\s*\n|\n\s*[-\d]/).at(-1);
    const despues = texto.slice(m.index + m[0].length);
    let ancho = null;
    if (/en\s+el\s+celular/i.test(frase)) ancho = 'celular';
    else if (/en\s+la\s+computadora/i.test(frase) || /^\s*\(en\s+el\s+celular/i.test(despues)) ancho = 'escritorio';
    return { texto: m[1].replace(/\s+/g, ' ').trim(), ancho };
  });
}

function leerLaGuia(ruta) {
  const texto = readFileSync(ruta, 'utf8');
  // Las secciones `## …`. Las numeradas, `## N. Título`, agrupan los pasos de
  // un tema; las otras son el principio y el final de la guía.
  const secciones = [];
  for (const m of texto.matchAll(/^## (?:(\d+)\. )?(.+)\n([\s\S]*?)(?=^#{1,2} |(?![\s\S]))/gm)) {
    secciones.push({ numerada: Boolean(m[1]), titulo: m[2].trim(), texto: m[3], citas: citasDe(m[3]) });
  }
  const pasos = [];
  const patron = /^### Paso (\d+)\. (.+)\n<!-- recorrido: ([\w-]+) -->\n([\s\S]*?)(?=^#{1,3} |^---\s*$|(?![\s\S]))/gm;
  for (const m of texto.matchAll(patron)) {
    pasos.push({
      numero: Number(m[1]), titulo: m[2].trim(), id: m[3], bloque: m[0], texto: m[4], citas: citasConAncho(m[4]),
      seccion: secciones.find((s) => s.texto.includes(m[0])),
    });
  }
  let resto = texto;
  for (const paso of pasos) resto = resto.replace(paso.bloque, '');
  // Lo que está después de «Cómo se comprueba esta guía» habla del programa,
  // no del sitio: sus citas no se buscan en la pantalla.
  resto = resto.split(/^## Cómo se comprueba esta guía\n/m)[0];
  return {
    pasos, citasDeAfuera: citasDe(resto), secciones,
    limites: secciones.find((s) => s.titulo.startsWith('Antes de empezar')),
    sinComprobar: loQueNoSeComprueba(texto, pasos, secciones),
  };
}

// La lista «Lo que el programa no comprueba», del final de la guía. Cada
// frase entre “ ” va después de un rótulo que dice dónde está: `Paso N:` o el
// nombre de una sección, como `Antes de empezar:`.
function loQueNoSeComprueba(texto, pasos, secciones) {
  const [, lista] = texto.split(/^### Lo que el programa no comprueba\n/m);
  if (!lista) return null;
  const lugares = new Map();
  for (const s of secciones) lugares.set(s.titulo.split(':')[0].trim(), { nombre: `la sección «${s.titulo}»`, texto: s.texto });
  for (const p of pasos) lugares.set(`Paso ${p.numero}`, { nombre: `Paso ${p.numero}. ${p.titulo}`, texto: p.texto });
  const claves = [...lugares.keys()].sort((a, b) => b.length - a.length);
  const patron = new RegExp(`(${claves.map(escapar).join('|')}):|“([^”]+)”`, 'g');
  const frases = [];
  let lugar = null;
  for (const m of lista.matchAll(patron)) {
    if (m[1]) lugar = lugares.get(m[1]);
    else frases.push({ frase: m[2].replace(/\s+/g, ' '), lugar });
  }
  return frases;
}

// Una cita está en lo visto si aparece tal cual. «…» vale por cualquier texto.
const aparece = (cita, vistos) => {
  const partes = normalizar(cita).split('…').map((p) => p.trim()).filter(Boolean);
  const patron = new RegExp(partes.map(escapar).join('[\\s\\S]*?'));
  return vistos.some((visto) => patron.test(visto));
};

// Lo que una persona ve: el texto, lo que dicen los campos vacíos, las
// opciones de los selectores, lo que aparece al pasar el puntero, y el nombre
// de los botones que son sólo un dibujo, como la papelera.
const TEXTOS_VISIBLES = () => {
  const partes = [document.body.innerText];
  for (const el of document.querySelectorAll('[placeholder], [title], option, button[aria-label], a[aria-label]')) {
    const visible = el.tagName === 'OPTION'
      ? (el.parentElement?.getClientRects().length ?? 0) > 0
      : el.getClientRects().length > 0;
    if (!visible) continue;
    if (el.tagName === 'OPTION') partes.push(el.textContent || '');
    for (const atributo of ['placeholder', 'title']) {
      const valor = el.getAttribute(atributo);
      if (valor) partes.push(valor);
    }
    if (el.matches('button, a') && !/\p{L}/u.test(el.textContent || '')) partes.push(el.getAttribute('aria-label') || '');
  }
  return partes.join('\n');
};

// Los botones, enlaces y campos de una parte de la pantalla, con el nombre
// que se ve. De cada campo, su rótulo; si el rótulo no se ve, lo que dice el
// campo vacío. Las opciones de los selectores no cuentan: son datos, como las
// provincias o las marcas.
const CONTROLES = (raiz, { desde = null, fuera = [] } = {}) => {
  // `desde`: sólo lo que viene después de ese elemento. `fuera`: los bloques
  // cuyo título es uno de ésos no cuentan.
  const inicio = desde ? raiz.querySelector(desde) : null;
  const afuera = (el) => {
    if (inicio && !(inicio.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return true;
    for (let padre = el.parentElement; padre && padre !== raiz.parentElement; padre = padre.parentElement) {
      const titulo = padre.querySelector(':scope > h2, :scope > h3, :scope > div > h2');
      if (titulo && fuera.includes((titulo.textContent || '').trim())) return true;
    }
    return false;
  };
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const primeraLinea = (el) => (el.innerText || el.textContent || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
  const sinMarcas = (texto) => texto.replace(/\*/g, '').replace(/\((opcional)\)/gi, '').replace(/\s+/g, ' ').trim();
  const nombres = [];
  for (const el of raiz.querySelectorAll('button, a[href]')) {
    if (!visible(el)) continue;
    // El pie de página es el contacto de la empresa; el título de una
    // publicación es un dato.
    if (el.closest('footer') || el.matches('[data-ficha-enlace="titulo"]') || afuera(el)) continue;
    nombres.push({ texto: primeraLinea(el), alternativo: el.getAttribute('aria-label') || '' });
  }
  for (const el of raiz.querySelectorAll('input, select, textarea')) {
    if (el.type === 'hidden' || el.type === 'file' || el.closest('footer') || afuera(el)) continue;
    const marco = (el.type === 'checkbox' || el.type === 'radio') ? el.closest('label') || el : el;
    if (!visible(marco)) continue;
    // Un rótulo sin `for` también nombra el campo que tiene al lado: es lo
    // que ve quien mira la pantalla.
    const rotulo = el.labels?.[0] || el.parentElement?.querySelector(':scope > label') || null;
    let texto = '';
    let lineas = [];
    if (el.type === 'checkbox' || el.type === 'radio') {
      // Una opción grande dice varias cosas —un título y una ayuda—: vale
      // que la guía nombre cualquiera de sus renglones.
      lineas = rotulo ? (rotulo.innerText || '').split('\n').map((l) => l.trim()).filter(Boolean) : [];
      texto = rotulo ? (rotulo.querySelector('strong')?.textContent || primeraLinea(rotulo)) : '';
      if (!/\p{L}/u.test(texto)) texto = el.closest('fieldset')?.querySelector('legend')?.textContent || '';
    } else if (rotulo && rotulo.getClientRects().length > 0 && rotulo.getBoundingClientRect().width > 2) {
      texto = rotulo.textContent || '';
    } else {
      texto = el.getAttribute('placeholder') || el.getAttribute('aria-label') || '';
    }
    nombres.push({ texto: sinMarcas(texto), alternativo: '', lineas });
  }
  return nombres;
};

// --- Lo que se mira en un paso -----------------------------------------------

class Vista {
  constructor(ancho, guia, paso) {
    this.ancho = ancho;
    this.guia = guia;
    this.paso = paso;
    this.vistos = [];
    this.atadas = 0;
    this.sinFrase = [];
    this.huecos = [];
  }

  // Una comprobación atada a la frase de la guía que describe lo que
  // comprueba. La frase va sola, y entonces es del paso, o por lugar:
  // `{ paso, seccion, limites }`, donde `seccion` es la sección del paso y
  // `limites` es «Antes de empezar». Si la guía ya no dice una de esas
  // frases en su lugar, el paso falla aunque la comprobación pase.
  async afirma(frases, comprobar) {
    const porLugar = typeof frases === 'string' || Array.isArray(frases) ? { paso: frases } : frases;
    const lugares = {
      paso: { texto: this.paso.texto, nombre: 'la guía' },
      seccion: { texto: this.paso.seccion?.texto || '', nombre: `la sección «${this.paso.seccion?.titulo}»` },
      limites: { texto: this.guia.limites?.texto || '', nombre: 'la sección «Antes de empezar»' },
    };
    const todas = [];
    for (const [donde, lista] of Object.entries(porLugar)) {
      for (const frase of [lista].flat()) {
        todas.push(frase);
        if (!dice(lugares[donde].texto, frase)) this.sinFrase.push(`${lugares[donde].nombre} ya no dice “${frase}”, que este paso comprueba`);
      }
    }
    this.atadas += todas.length;
    try {
      await comprobar();
    } catch (error) {
      if (error instanceof Falla) throw new Falla(`la guía dice “${todas[0]}” y no pasa: ${error.message}`);
      throw error;
    }
  }

  async mirar(page) {
    this.vistos.push(normalizar(await page.evaluate(TEXTOS_VISIBLES)));
  }

  // Los controles de una parte de la pantalla, contra las citas de la sección
  // que la explica (la del paso, si no se dice otra). Los nombres propios —de
  // cuentas y publicaciones— y los números son datos: se reemplazan por «…».
  async inventario(pantalla, raiz, tituloDeLaSeccion, opciones = {}) {
    await this.mirar(raiz.page());
    const seccion = tituloDeLaSeccion
      ? this.guia.secciones.find((s) => s.titulo === tituloDeLaSeccion)
      : this.paso.seccion;
    if (!seccion) {
      this.huecos.push(`la guía no tiene la sección «${tituloDeLaSeccion}» que explica ${pantalla}`);
      return;
    }
    const citas = seccion.citas.map((cita) => sinDatos(cita)).filter(Boolean);
    const nombres = datosConocidos();
    const vistos = new Set();
    for (const { texto, alternativo, lineas = [] } of await raiz.evaluate(CONTROLES, opciones)) {
      let nombre = sinDatos(texto, nombres);
      if (!nombre) nombre = sinDatos(alternativo, nombres);
      if (!nombre || !/\p{L}/u.test(nombre) || vistos.has(nombre)) continue;
      vistos.add(nombre);
      // Un control se nombra por lo que dice o por su nombre accesible, como
      // la papelera, «Eliminar …»; una opción grande, por cualquier renglón.
      const alternativas = [alternativo, ...lineas].map((a) => sinDatos(a, nombres)).filter(Boolean);
      if (alternativas.some((a) => citas.includes(a))) continue;
      if (!citas.includes(nombre)) {
        const visto = (texto && sinDatos(texto, nombres) ? texto : alternativo).replace(/\s+/g, ' ').trim();
        this.huecos.push(`${pantalla} muestra «${visto}» y la sección «${seccion.titulo}» de la guía no lo nombra`);
      }
    }
  }
}

class Falla extends Error {}
const exigir = (condicion, mensaje) => { if (!condicion) throw new Falla(mensaje); };

// Los nombres de cuentas y publicaciones de la base, del más largo al más
// corto: en un control, son datos y no parte de su nombre.
function datosConocidos() {
  return queryRows(`SELECT full_name, 'fin' FROM users UNION SELECT name, 'fin' FROM products`)
    .map(([nombre]) => normalizar(nombre || '')).filter((n) => n.length > 2)
    .sort((a, b) => b.length - a.length);
}

// Un nombre de control sin sus datos: sin nombres propios, sin números, sin
// contadores y sin «…». Así «Seleccionar a Carlos», «Todos (3)» y
// «Seleccionar a …» se comparan igual.
function sinDatos(texto, nombres = datosConocidos()) {
  let n = normalizar(texto || '').replace(/\(opcional\)/g, ' ').replace(/\(ej\.?:?[^)]*\)/g, ' ');
  for (const nombre of nombres) if (n.includes(nombre)) n = n.split(nombre).join(' ');
  return n.replace(/^[▸▾]\s*/, '').replace(/\((\d+ activos?|\d+)\)/g, ' ').replace(/ord-\S+/g, ' ')
    .replace(/[\d.,$]+/g, ' ').replace(/…/g, ' ').replace(/\s+/g, ' ').trim();
}

// --- La API ------------------------------------------------------------------

async function pedir(ruta, { method = 'GET', token, body, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const respuesta = await fetch(`${API}${ruta}`, {
    method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const crudo = await respuesta.text();
  let data = null;
  try { data = crudo ? JSON.parse(crudo) : null; } catch { data = crudo; }
  return { status: respuesta.status, data };
}

async function exigirApi(promesa, que) {
  const r = await promesa;
  if (r.status >= 400) throw new Error(`${que}: HTTP ${r.status} ${JSON.stringify(r.data?.detail ?? r.data).slice(0, 200)}`);
  return r.data;
}

async function entrar(email, password = CLAVE) {
  return exigirApi(pedir('/auth/login', { method: 'POST', body: { email, password } }), `entrar como ${email}`);
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
// Otra foto, distinta: dos iguales el formulario las toma como la misma.
const OTRO_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n% guia de uso\ntrailer<</Root 1 0 R>>\n%%EOF\n');

async function subirComprobante(sesion, ordenId) {
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'comprobante.png');
  return exigirApi(pedir(`/orders/${ordenId}/transfer-receipt`, { method: 'POST', token: sesion.access_token, form }),
    'subir el comprobante');
}

// Una compra por transferencia hecha por la API, con traslado propio: es el
// escenario de un paso, no lo que el paso recorre.
async function comprarPorApi(c, compradora, producto, cantidad = 1) {
  // El carrito del servidor queda con esto solo: lo que haya quedado de antes
  // no se compra de rebote.
  await exigirApi(pedir('/cart/sync', {
    method: 'POST', token: compradora.access_token, body: { items: [{ product_id: producto.id, quantity: cantidad }] },
  }), 'armar el carrito');
  const r = await exigirApi(pedir('/orders/checkout/transfer', {
    method: 'POST', token: compradora.access_token,
    body: {
      shipping_address: 'Ruta 8 km 221', shipping_locality_id: c.pergamino, shipping_postal_code: '2700',
      notes: 'Orden de la guía de uso.',
      shipping_decisions: [{ seller_id: producto.seller_id, mode: 'self' }],
      payment_decisions: [{ seller_id: producto.seller_id, method: 'transfer' }],
    },
  }), 'comprar por transferencia');
  return { id: r.orders[0].order_id, numero: r.orders[0].order_number };
}

const decidirComprobante = (vendedora, orden, decision, reason) => exigirApi(pedir(`/orders/${orden.id}/transfer-receipt`, {
  method: 'PATCH', token: vendedora.access_token, body: { decision, reason },
}), `decidir el comprobante (${decision})`);
const cambiarEstado = (sesion, orden, status) => exigirApi(pedir(`/orders/${orden.id}/status`, {
  method: 'PATCH', token: sesion.access_token, body: { status },
}), `pasar la orden a ${status}`);

// Una orden llevada por la API hasta un estado: `pagada`, `confirmada`,
// `enviada` o `entregada`.
async function ordenEn(c, estado, producto = c.insumo) {
  const orden = await comprarPorApi(c, c.compradora, producto);
  if (estado === 'esperando') return orden;
  await subirComprobante(c.compradora, orden.id);
  if (estado === 'a-revisar') return orden;
  await decidirComprobante(c.vendedora, orden, 'approve');
  if (estado === 'pagada') return orden;
  await cambiarEstado(c.vendedora, orden, 'confirmed');
  if (estado === 'confirmada') return orden;
  await cambiarEstado(c.vendedora, orden, 'shipped');
  if (estado === 'enviada') return orden;
  await cambiarEstado(c.compradora, orden, 'delivered');
  return orden;
}

// Quién cubre un viaje, dicho como lo dice la guía: su localidad base está,
// en línea recta, dentro de su radio del destino y de cada origen. Sólo
// cuentan las cuentas que pueden usarse: activas, confirmadas y con los datos
// de transportista completos.
function transportistasQueCubren(destino, origenes) {
  const dentro = (otra) => `ST_DWithin(b.coordinates, (SELECT coordinates FROM localities WHERE id = ${sqlLiteral(otra)}),
    u.carrier_coverage_radius_km::float * 1000.0)`;
  return queryRows(`SELECT u.full_name, 'fin' FROM users u JOIN localities b ON b.id = u.carrier_base_locality_id
    WHERE u.is_carrier AND u.is_active AND u.is_verified AND u.carrier_transport_certified
      AND btrim(coalesce(u.carrier_transport, '')) <> '' AND btrim(coalesce(u.carrier_certification_detail, '')) <> ''
      AND coalesce(u.carrier_coverage_radius_km, 0) > 0
      AND ${[destino, ...origenes].map(dentro).join(' AND ')}`).map(([nombre]) => nombre).sort();
}

const estadoDe = (orden) => queryRows(`SELECT lower(status::text), 'fin' FROM orders WHERE id = ${sqlLiteral(orden.id)}`)[0][0];
const stockDe = (id) => Number(queryRows(`SELECT stock, 'fin' FROM products WHERE id = ${sqlLiteral(id)}`)[0][0]);
const enElMercado = async (nombre) => {
  const r = await pedir(`/catalog/products?search=${encodeURIComponent(nombre)}`);
  return (r.data?.items || []).some((p) => p.name === nombre);
};

// Los correos que recibió una dirección, en el outbox de desarrollo, del más
// viejo al más nuevo.
const CARPETA_OUTBOX = join(RAIZ, 'backend/outbox');
function transporteDeCorreo() {
  if (process.env.EMAIL_TRANSPORT) return process.env.EMAIL_TRANSPORT.trim().toLowerCase();
  try {
    const linea = readFileSync(join(RAIZ, 'backend/.env'), 'utf8').match(/^EMAIL_TRANSPORT=(.*)$/m);
    if (linea) return linea[1].trim().replace(/^["']|["']$/g, '').toLowerCase();
  } catch { /* sin .env: vale la omisión */ }
  return 'outbox';
}
// Una variable de `backend/.env`, la última vez que aparece: es la que vale.
function variableDelBackend(nombre) {
  try {
    const lineas = [...readFileSync(join(RAIZ, 'backend/.env'), 'utf8').matchAll(new RegExp(`^${nombre}=(.*)$`, 'gm'))];
    return lineas.at(-1)?.[1].trim().replace(/^["']|["']$/g, '') || null;
  } catch {
    return null;
  }
}
function correosPara(email) {
  const transporte = transporteDeCorreo();
  if (transporte !== 'outbox') throw new Error(`el correo sale por «${transporte}», no por el outbox: esto no se puede mirar`);
  if (!existsSync(CARPETA_OUTBOX)) return [];
  const para = new RegExp(`^To: ${escapar(email)}\\s*$`, 'mi');
  return readdirSync(CARPETA_OUTBOX).filter((nombre) => nombre.endsWith('.eml'))
    .map((nombre) => ({ ruta: join(CARPETA_OUTBOX, nombre), cuando: statSync(join(CARPETA_OUTBOX, nombre)).mtimeMs }))
    .filter(({ ruta }) => para.test(readFileSync(ruta, 'utf8').split(/\r?\n\r?\n/)[0]))
    .sort((a, b) => a.cuando - b.cuando)
    .map(({ ruta }) => readFileSync(ruta, 'utf8'));
}
// El enlace de confirmación del último correo a esa dirección. El cuerpo puede
// venir en quoted-printable: se deshace antes de buscarlo.
function enlaceDeConfirmacion(email) {
  const ultimo = correosPara(email).at(-1) || '';
  const cuerpo = ultimo.replace(/=\r?\n/g, '').replace(/=3D/gi, '=');
  const enlace = cuerpo.match(/https?:\/\/\S*verificar-correo#token=[A-Za-z0-9_-]+/);
  exigir(enlace, `el último correo a ${email} no trae el enlace de confirmación`);
  return enlace[0];
}

// --- El navegador ------------------------------------------------------------

async function contextoCon(browser, viewport, sesion) {
  const contexto = await browser.newContext({ viewport });
  contexto.setDefaultTimeout(10_000);
  if (sesion) {
    await contexto.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: sesion.access_token, r: sesion.refresh_token });
  }
  return contexto;
}

// Una pestaña de la sesión de alguien, abierta de cero.
async function sesionEn(c, sesion) {
  const contexto = await contextoCon(c.browser, c.viewport, sesion);
  const page = await contexto.newPage();
  return { contexto, page };
}

async function abrirCuenta(page, pestana) {
  await page.goto(`${WEB}/?section=account`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Mi cuenta', exact: true }).waitFor({ timeout: 20_000 });
  await page.getByRole('button', { name: new RegExp(`^${escapar(pestana)}`) }).first().click();
  await page.getByRole('heading', { name: pestana, exact: true }).first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
}

const tarjetaDeOrden = (page, numero) => page.locator('[class*="_orderCard_"]').filter({ hasText: numero }).first();
const textoDe = async (locator) => (await locator.innerText()).replace(/\s+/g, ' ');
const dialogo = (page, nombre) => page.getByRole('dialog', { name: nombre });
const cabecera = (page) => page.locator('header').first();

async function irAlMercado(page) {
  await page.goto(`${WEB}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
  await page.locator('article[class*="card"]').first().waitFor({ state: 'visible', timeout: 25_000 });
}

// El panel de filtros. En el celular está plegado detrás de «Filtros».
async function abrirFiltros(c, page) {
  const boton = page.getByRole('button', { name: /^Filtros/ });
  if (await boton.isVisible().catch(() => false) && (await boton.getAttribute('aria-expanded')) !== 'true') {
    await boton.click();
  }
  await page.locator('#panel-de-filtros').getByText('Qué buscás').waitFor({ timeout: 10_000 });
}

const titulosDelMercado = async (page) => (await page.locator('article[class*="card"] h3').allInnerTexts()).map((t) => t.trim());

async function esperarResultados(page) {
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

// «Salir» y volver a ingresar con la ventana de ingreso, como una persona.
async function salirYVolverAEntrar(page, email) {
  const barra = cabecera(page);
  await barra.getByRole('button', { name: 'Salir', exact: true }).click();
  await barra.getByRole('button', { name: 'Ingresar', exact: true }).waitFor({ timeout: 5_000 })
    .catch(async () => { await page.getByRole('button', { name: 'Salir', exact: true }).last().click(); });
  await barra.getByRole('button', { name: 'Ingresar', exact: true }).click();
  const ingreso = dialogo(page, 'Ingresar');
  await ingreso.getByLabel(/^Email/).fill(email);
  await ingreso.getByLabel(/^Contraseña/).fill(CLAVE);
  await ingreso.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await ingreso.waitFor({ state: 'hidden', timeout: 15_000 });
}

async function confirmarEnDialogo(page, boton) {
  await page.getByRole('button', { name: boton, exact: true }).last().click();
}

// Un error del navegador, dicho en términos de la guía: si no encontró un
// control, cuál; si no, la primera línea.
function porQueNoSePudo(error) {
  const esperando = error.message.split('\n').find((linea) => /waiting for/.test(linea)) || '';
  const nombres = [...esperando.matchAll(/name: ['"/]([^'"/]+)['"/]/g)].map((m) => m[1]);
  if (nombres.length) return `el sitio no muestra «${nombres.at(-1)}», que el recorrido tenía que tocar`;
  return `no se pudo hacer: ${error.message.split('\n')[0]}`;
}

// --- Los recorridos ----------------------------------------------------------
//
// Uno por paso de la guía, con el mismo id. Reciben el estado de la corrida
// (`c`) y la vista del paso (`v`), y lanzan `Falla` con lo que no coincide.

const RECORRIDOS = {
  // --- Parte 1. Quien compra ---------------------------------------------------

  async 'crear-cuenta'(c, v) {
    c.compra = await sesionEn(c, null);
    const { page } = c.compra;
    const { email, nombre } = c.nuevaCompradora;
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await cabecera(page).getByRole('button', { name: 'Ingresar', exact: true }).click();
    await dialogo(page, 'Ingresar').waitFor();
    await v.mirar(page);
    await dialogo(page, 'Ingresar').getByRole('button', { name: 'Registrate acá' }).click();
    const alta = dialogo(page, 'Crear cuenta');
    await alta.waitFor();
    await v.inventario('la ventana «Crear cuenta»', alta);
    await alta.getByLabel(/Nombre completo/).fill(nombre);
    await alta.getByLabel(/^Email/).fill(email);
    await alta.locator('#registro-clave').fill(CLAVE);
    await alta.locator('#registro-clave-2').fill(CLAVE);
    await v.afirma('«Mostrar» deja ver la contraseña que escribiste', async () => {
      await alta.getByRole('button', { name: 'Mostrar contraseña' }).click();
      exigir(await alta.locator('#registro-clave').getAttribute('type') === 'text', 'la contraseña sigue oculta');
    });
    await v.afirma('«Iniciá sesión» vuelve a la ventana de ingreso', async () => {
      await alta.getByRole('button', { name: 'Iniciá sesión' }).click();
      await dialogo(page, 'Ingresar').waitFor().catch(() => { throw new Falla('no se abrió la ventana de ingreso'); });
      await dialogo(page, 'Ingresar').getByRole('button', { name: 'Registrate acá' }).click();
      await alta.waitFor();
    });
    // Volver a la otra ventana conserva lo escrito o no: se completa de nuevo.
    await alta.getByLabel(/Nombre completo/).fill(nombre);
    await alta.getByLabel(/^Email/).fill(email);
    await alta.locator('#registro-clave').fill(CLAVE);
    await alta.locator('#registro-clave-2').fill(CLAVE);
    await alta.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await alta.getByText('Te mandamos un correo a').waitFor({ timeout: 15_000 });
    await v.mirar(page);
    await v.afirma('te llega un correo con un enlace para confirmarlo', async () => {
      await c.esperarA(async () => correosPara(email).length === 1, `llegaron ${correosPara(email).length} correos a ${email}`);
      enlaceDeConfirmacion(email);
    });
    await v.afirma('«Reenviar el correo» manda otro', async () => {
      await alta.getByRole('button', { name: 'Reenviar el correo' }).click();
      await c.esperarA(async () => correosPara(email).length === 2, `después de reenviar hay ${correosPara(email).length} correos`);
    });
    await v.mirar(page);
    await v.afirma('«Ir a iniciar sesión» vuelve a la ventana de ingreso', async () => {
      await alta.getByRole('button', { name: 'Ir a iniciar sesión' }).click();
      await dialogo(page, 'Ingresar').waitFor().catch(() => { throw new Falla('no se abrió la ventana de ingreso'); });
    });
    const ingreso = dialogo(page, 'Ingresar');
    await v.inventario('la ventana de ingreso', ingreso);
    await v.afirma('Sin confirmar el correo no podés ingresar', async () => {
      await ingreso.getByLabel(/^Email/).fill(email);
      await ingreso.getByLabel(/^Contraseña/).fill(CLAVE);
      await ingreso.getByRole('button', { name: 'Ingresar', exact: true }).click();
      await ingreso.getByRole('alert').filter({ hasText: 'Tu cuenta todavía no está confirmada.' }).waitFor()
        .catch(() => { throw new Falla('la ventana no dice que la cuenta no está confirmada'); });
      await v.mirar(page);
      const r = await pedir('/auth/login', { method: 'POST', body: { email, password: CLAVE } });
      exigir(r.status === 403, `la API deja entrar sin confirmar: HTTP ${r.status}`);
    });
    await v.afirma('Para cerrar cualquiera de las dos ventanas, tocá la cruz «×»', async () => {
      await ingreso.getByRole('button', { name: 'Cerrar' }).click();
      await ingreso.waitFor({ state: 'hidden' }).catch(() => { throw new Falla('la cruz no cerró la ventana de ingreso'); });
      await cabecera(page).getByRole('button', { name: 'Ingresar', exact: true }).click();
      await ingreso.getByRole('button', { name: 'Registrate acá' }).click();
      await alta.getByRole('button', { name: 'Cerrar' }).click();
      await alta.waitFor({ state: 'hidden' }).catch(() => { throw new Falla('la cruz no cerró «Crear cuenta»'); });
    });
  },

  async 'confirmar-e-ingresar'(c, v) {
    const { page } = c.compra;
    const { email, nombre } = c.nuevaCompradora;
    const enlace = enlaceDeConfirmacion(email);
    await page.goto(enlace, { waitUntil: 'domcontentloaded' });
    await v.afirma('La página dice «Correo confirmado».', async () => {
      await page.getByRole('heading', { name: 'Correo confirmado' }).waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('la página no dice «Correo confirmado»'); });
    });
    await v.mirar(page);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    const ingreso = dialogo(page, 'Ingresar');
    await ingreso.waitFor();
    await v.mirar(page);
    await v.afirma('«Escribinos por Contacto» te lleva al formulario de contacto', async () => {
      await ingreso.getByRole('button', { name: 'Escribinos por Contacto' }).click();
      await page.getByRole('heading', { name: 'Contacto', exact: true }).waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('no se abrió la página de contacto'); });
    });
    await cabecera(page).getByRole('button', { name: 'Ingresar', exact: true }).click();
    await ingreso.waitFor();
    await ingreso.getByLabel(/^Email/).fill(email);
    await ingreso.getByLabel(/^Contraseña/).fill(CLAVE);
    await ingreso.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await ingreso.waitFor({ state: 'hidden', timeout: 15_000 });
    await v.afirma(['en la cabecera aparecen tu nombre, «Vender», «Carrito» y «Salir»',
      'En el celular, en lugar de tu nombre dice «Cuenta».'], async () => {
      const barra = cabecera(page);
      for (const boton of ['Vender', 'Carrito', 'Salir']) {
        await barra.getByRole('button', { name: new RegExp(`^${boton}`) }).first().waitFor({ timeout: 15_000 })
          .catch(() => { throw new Falla(`la cabecera no muestra «${boton}»`); });
      }
      const cuenta = (await barra.getByRole('button', { name: 'Mi cuenta' }).innerText()).trim();
      const esperado = c.ancho === 'celular' ? 'Cuenta' : nombre;
      exigir(cuenta === esperado, `el botón de la cuenta dice «${cuenta}» y tenía que decir «${esperado}»`);
    });
    await v.mirar(page);
    await v.afirma('El enlace sirve una sola vez', async () => {
      const otra = await c.compra.contexto.newPage();
      await otra.goto(enlace, { waitUntil: 'domcontentloaded' });
      await otra.getByText('Este enlace ya se usó.').waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('al abrirlo otra vez no dice que ya se usó'); });
      await otra.getByRole('button', { name: 'Reenviar el enlace' }).waitFor();
      await v.mirar(otra);
      await v.afirma('«Volver al inicio» lleva a la página principal', async () => {
        await otra.getByRole('button', { name: 'Volver al inicio' }).click();
        await c.esperarA(async () => !otra.url().includes('verificar-correo')
          && await cabecera(otra).getByRole('button', { name: 'Inicio', exact: true }).getAttribute('aria-current') === 'page',
        `después de «Volver al inicio» la dirección es ${otra.url()}`);
      });
      await otra.close();
    });
    c.compradora = await entrar(email);
  },

  async cabecera(c, v) {
    const { page } = c.compra;
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    const barra = cabecera(page);
    await barra.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15_000 });
    await v.inventario('la cabecera', barra);
    const actual = async (seccion) => barra.getByRole('button', { name: seccion, exact: true }).getAttribute('aria-current');
    await v.afirma('«Mercado» abre las publicaciones', async () => {
      await barra.getByRole('button', { name: 'Mercado', exact: true }).click();
      await page.locator('article[class*="card"]').first().waitFor({ timeout: 20_000 })
        .catch(() => { throw new Falla('no aparecen publicaciones'); });
    });
    await v.afirma('«AgroBoeda» e «Inicio» llevan a la página principal', async () => {
      await barra.getByRole('button', { name: 'AgroBoeda' }).click();
      await c.esperarA(async () => await actual('Inicio') === 'page', '«AgroBoeda» no llevó al inicio');
      await barra.getByRole('button', { name: 'Mercado', exact: true }).click();
      await barra.getByRole('button', { name: 'Inicio', exact: true }).click();
      await c.esperarA(async () => await actual('Inicio') === 'page', '«Inicio» no llevó al inicio');
    });
    await v.afirma('«Vender» abre el formulario para publicar', async () => {
      await barra.getByRole('button', { name: 'Vender', exact: true }).click();
      await page.getByRole('heading', { name: 'Publicar un producto' }).waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('no se abrió el formulario'); });
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('heading', { name: 'Publicar un producto' }).waitFor({ state: 'hidden' });
    });
    await v.afirma('«Carrito» abre tu carrito', async () => {
      await barra.getByRole('button', { name: /^Carrito/ }).click();
      await dialogo(page, 'Mi carrito').waitFor().catch(() => { throw new Falla('no se abrió el carrito'); });
      await dialogo(page, 'Mi carrito').getByRole('button', { name: 'Cerrar' }).click();
    });
    await v.afirma('abre «Mi cuenta»', async () => {
      await barra.getByRole('button', { name: 'Mi cuenta' }).click();
      await page.getByRole('heading', { name: 'Mi cuenta', exact: true }).waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('no se abrió «Mi cuenta»'); });
    });
    await page.getByRole('heading', { name: 'Mi Perfil', exact: true }).waitFor({ timeout: 15_000 });
    await v.inventario('las pestañas de «Mi cuenta»', page.locator('main [class*="_tabs_"]').first());
    await v.afirma(['«Vender» y «Salir» aparecen sólo con la sesión iniciada',
      'Después de «Salir», la cabecera vuelve a mostrar «Ingresar».'], async () => {
      await barra.getByRole('button', { name: 'Salir', exact: true }).click();
      const confirmar = page.getByRole('button', { name: 'Salir', exact: true }).last();
      await barra.getByRole('button', { name: 'Ingresar', exact: true }).waitFor({ timeout: 5_000 })
        .catch(async () => { await confirmar.click(); });
      await barra.getByRole('button', { name: 'Ingresar', exact: true }).waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('después de «Salir» no aparece «Ingresar»'); });
      for (const boton of ['Vender', 'Salir']) {
        exigir(!(await barra.getByRole('button', { name: boton, exact: true }).isVisible()),
          `sin sesión, la cabecera sigue mostrando «${boton}»`);
      }
    });
    await v.mirar(page);
    await c.compra.contexto.close();
    c.compra = await sesionEn(c, c.compradora);
  },

  async buscar(c, v) {
    const { page } = c.compra;
    await irAlMercado(page);
    const buscador = page.locator('form[role="search"]');
    await v.inventario('el buscador del Mercado', buscador);
    await v.mirar(page);
    const buscar = async (texto) => {
      await page.getByLabel('Buscar en el mercado').fill(texto);
      await buscador.getByRole('button', { name: 'Buscar', exact: true }).click();
      await esperarResultados(page);
      return titulosDelMercado(page);
    };
    await v.afirma(['El buscador encuentra la palabra en el nombre, en la descripción y en el modelo',
      'sin importar mayúsculas y minúsculas'], async () => {
      const casos = [
        ['el nombre', `TRACTOR USO ${c.sello.toUpperCase()}`, c.tractor.name],
        ['la descripción', c.palabraDeLaDescripcion.toLowerCase(), c.tractorSinAnio.name],
        ['el modelo', c.modelo.toLowerCase(), c.tractor.name],
      ];
      for (const [donde, texto, esperado] of casos) {
        const titulos = await buscar(texto);
        exigir(titulos.includes(esperado), `buscar «${texto}», que está en ${donde}, no trajo «${esperado}»: trajo ${titulos.length}`);
      }
    });
    await v.afirma('El modelo se busca así: no tiene un filtro propio.', async () => {
      await abrirFiltros(c, page);
      await page.locator('#panel-de-filtros').locator('#catalog-category').selectOption('Maquinaria agrícola');
      await esperarResultados(page);
      const rotulos = await page.locator('#panel-de-filtros label').allInnerTexts();
      exigir(!rotulos.some((r) => /modelo/i.test(r)), `el panel tiene un filtro de modelo: ${rotulos.join(', ')}`);
    });
  },

  async filtrar(c, v) {
    const { page } = c.compra;
    await irAlMercado(page);
    await abrirFiltros(c, page);
    const panel = page.locator('#panel-de-filtros');
    await v.mirar(page);
    const masFiltros = panel.getByRole('button', { name: /Más filtros/ });
    await v.afirma('«Más filtros» abre dos filtros más', async () => {
      exigir(!(await panel.getByText('Solo con stock disponible').isVisible()), 'los filtros de «Más filtros» ya se ven');
      await masFiltros.click();
      await panel.getByText('Solo con stock disponible').waitFor().catch(() => { throw new Falla('no se abrieron'); });
      exigir(await panel.getByLabel('Calificación mínima del vendedor').isVisible(), 'falta «Calificación mínima del vendedor»');
    });
    await v.inventario('el panel de filtros', page.locator('aside').filter({ has: panel }));
    // «24 de 28» cuando la página no las muestra todas: vale el total.
    const total = async () => Number((await page.locator('[class*="_conteo_"] strong').innerText())
      .split(' de ').at(-1).replace(/\D/g, ''));
    await v.afirma('Si alguno está puesto, el botón dice cuántos, como «(1 activo)».', async () => {
      await panel.getByLabel('Solo con stock disponible').check();
      await c.esperarA(async () => (await masFiltros.innerText()).includes('(1 activo)'),
        `con un filtro puesto, el botón dice «${(await masFiltros.innerText()).trim()}»`);
    });
    await v.mirar(page);
    await v.afirma('Cada filtro que ponés cambia las publicaciones enseguida.', async () => {
      await panel.locator('#catalog-province').selectOption('06');
      await esperarResultados(page);
      const esperado = (await pedir('/catalog/products?province=Buenos%20Aires&in_stock=true')).data.total;
      await c.esperarA(async () => await total() === esperado,
        `con «Buenos Aires» el Mercado dice ${await total()} y la API tiene ${esperado}`);
    });
    await v.afirma('«Dónde»: «Provincia» y, con una provincia elegida, «Localidad».', async () => {
      exigir(await panel.locator('#catalog-locality').isEnabled(), 'con una provincia elegida, «Localidad» sigue apagada');
    });
    await v.afirma('Al elegir una categoría aparece «Subcategoría».', async () => {
      exigir(!(await panel.locator('#catalog-subcategory').isVisible()), 'sin categoría ya se ve «Subcategoría»');
      await panel.locator('#catalog-category').selectOption('Insumos agrícolas');
      await panel.locator('#catalog-subcategory').waitFor({ timeout: 10_000 })
        .catch(() => { throw new Falla('al elegir una categoría no aparece «Subcategoría»'); });
    });
    await v.mirar(page);
    await v.afirma('«Limpiar filtros» saca todos los filtros.', async () => {
      await panel.getByRole('button', { name: 'Limpiar filtros' }).click();
      await esperarResultados(page);
      const todas = (await pedir('/catalog/products')).data.total;
      await c.esperarA(async () => await total() === todas, `después de limpiar el Mercado dice ${await total()} y hay ${todas}`);
      exigir(!(await panel.getByLabel('Solo con stock disponible').isChecked().catch(() => false)), 'sigue puesto «Solo con stock disponible»');
      exigir(await panel.locator('#catalog-province').inputValue() === '', 'sigue puesta la provincia');
    });
    if (c.ancho === 'celular') {
      await v.afirma('o «Ver 1 resultado» si hay uno solo', async () => {
        await page.getByLabel('Buscar en el mercado').fill(c.agotable.name);
        await page.locator('form[role="search"]').getByRole('button', { name: 'Buscar', exact: true }).click();
        await esperarResultados(page);
        await abrirFiltros(c, page);
        await panel.getByRole('button', { name: 'Ver 1 resultado', exact: true }).waitFor({ timeout: 10_000 })
          .catch(() => { throw new Falla('con un solo resultado, el botón no dice «Ver 1 resultado»'); });
        await v.mirar(page);
        await page.getByLabel('Buscar en el mercado').fill('');
        await page.locator('form[role="search"]').getByRole('button', { name: 'Buscar', exact: true }).click();
        await esperarResultados(page);
        await abrirFiltros(c, page);
      });
      await v.afirma('al terminar tocá «Ver … resultados»', async () => {
        await panel.getByRole('button', { name: /^Ver \d+ resultados?$/ }).click();
        await c.esperarA(async () => (await page.getByRole('button', { name: /^Filtros/ }).getAttribute('aria-expanded')) === 'false',
          '«Ver … resultados» no cerró el panel');
      });
    }
    const barra = page.locator('[class*="_barra_"]').first();
    await v.inventario('la barra de resultados', barra);
    const paginador = page.getByRole('navigation', { name: 'Paginación del mercado' });
    await v.inventario('el paginador', paginador);
    await v.afirma('«Ordenar por» las ordena', async () => {
      await barra.locator('#catalog-sort').selectOption({ label: 'Menor precio' });
      await esperarResultados(page);
      const precios = (await page.locator('article[class*="card"] [class*="_cifra_"]').allInnerTexts())
        .filter((p) => /\d/.test(p)).map((p) => Number(p.replace(/[^\d,]/g, '').replace(',', '.')));
      exigir(precios.length > 1 && precios.every((p, i) => i === 0 || precios[i - 1] <= p),
        `con «Menor precio» los precios quedan ${precios.slice(0, 6).join(', ')}`);
      await barra.locator('#catalog-sort').selectOption({ index: 0 });
      await esperarResultados(page);
    });
    await v.afirma('«Vista» elige «Cuadrícula» o «Lista»', async () => {
      await barra.getByLabel('Lista', { exact: true }).check({ force: true });
      await page.locator('[class*="_resultados_"] > [class*="_renglones_"]').waitFor({ timeout: 10_000 })
        .catch(() => { throw new Falla('«Lista» no cambió la vista'); });
      await barra.getByLabel('Cuadrícula', { exact: true }).check({ force: true });
      await page.locator('[class*="_resultados_"] > [class*="_grilla_"]').waitFor({ timeout: 10_000 })
        .catch(() => { throw new Falla('«Cuadrícula» no volvió a la grilla'); });
    });
    await v.afirma('Si hay más de una página, se pasa con «Anterior» y «Siguiente».', async () => {
      await paginador.getByRole('button', { name: /siguiente/i }).click();
      await paginador.getByText(/Página 2 de \d+/).waitFor({ timeout: 10_000 })
        .catch(() => { throw new Falla('«Siguiente» no pasó a la página 2'); });
      await v.mirar(page);
      await paginador.getByRole('button', { name: /anterior/i }).click();
      await paginador.getByText(/Página 1 de \d+/).waitFor({ timeout: 10_000 })
        .catch(() => { throw new Falla('«Anterior» no volvió a la página 1'); });
    });
  },

  async 'filtrar-maquinaria'(c, v) {
    const { page } = c.compra;
    await irAlMercado(page);
    // Sólo las publicaciones de esta corrida, para saber qué tiene que quedar.
    await page.getByLabel('Buscar en el mercado').fill(`uso ${c.sello}`);
    await page.locator('form[role="search"]').getByRole('button', { name: 'Buscar', exact: true }).click();
    await esperarResultados(page);
    await abrirFiltros(c, page);
    const panel = page.locator('#panel-de-filtros');
    await panel.locator('#catalog-category').selectOption('Maquinaria agrícola');
    await esperarResultados(page);
    await panel.locator('#catalog-brand').waitFor({ timeout: 10_000 });
    await v.inventario('el panel de filtros con «Maquinaria agrícola»', page.locator('aside').filter({ has: panel }));
    const quedan = async () => (await titulosDelMercado(page)).filter((t) => t.includes(c.sello)).sort();
    await v.afirma('«Marca», con cuántas publicaciones tiene cada una con los otros filtros que pusiste.', async () => {
      const opcion = (await panel.locator('#catalog-brand option').allInnerTexts()).find((o) => o.startsWith('John Deere'));
      const conMarca = (await pedir(`/catalog/products?category=${c.maquinaria.id}`
        + `&search=${encodeURIComponent(`uso ${c.sello}`)}&brand=john-deere`)).data.total;
      exigir(opcion === `John Deere (${conMarca})`, `la opción dice «${opcion}» y hay ${conMarca}`);
    });
    await v.afirma(['Se puede poner uno solo.', 'Una publicación que no declaró el año, por ejemplo, no aparece al filtrar por año.'], async () => {
      await panel.getByPlaceholder('Desde').fill('2010');
      await esperarResultados(page);
      await c.esperarA(async () => JSON.stringify(await quedan()) === JSON.stringify([c.tractor.name]),
        `con «Desde» 2010 quedan ${JSON.stringify(await quedan())}`);
      await panel.getByPlaceholder('Desde').fill('');
      await esperarResultados(page);
    });
    await v.afirma('Un filtro de estos trae sólo las publicaciones que declararon ese dato.', async () => {
      await panel.locator('#catalog-origin').selectOption({ label: 'Dueño directo' });
      await esperarResultados(page);
      await c.esperarA(async () => JSON.stringify(await quedan()) === JSON.stringify([c.tractor.name]),
        `con «Dueño directo» quedan ${JSON.stringify(await quedan())}`);
      await panel.locator('#catalog-origin').selectOption('');
      await panel.locator('#catalog-condition').selectOption({ label: 'Nuevo' });
      await esperarResultados(page);
      await c.esperarA(async () => JSON.stringify(await quedan()) === JSON.stringify([c.cosechadora.name]),
        `con «Nuevo» quedan ${JSON.stringify(await quedan())}`);
      await panel.locator('#catalog-condition').selectOption({ index: 0 });
      await esperarResultados(page);
    });
    await v.mirar(page);
    await v.afirma('Al elegir la subcategoría aparece uno más: «Potencia» en «Tractores», y «Tipo» en las que tienen tipos, como «Cosecha».', async () => {
      exigir(!(await panel.locator('#catalog-power').isVisible()) && !(await panel.locator('#catalog-subtype').isVisible()),
        'sin subcategoría ya se ven «Potencia» o «Tipo»');
      await panel.locator('#catalog-subcategory').selectOption('Tractores');
      await panel.locator('#catalog-power').waitFor({ timeout: 10_000 }).catch(() => { throw new Falla('con «Tractores» no aparece «Potencia»'); });
      await v.inventario('el panel de filtros con «Tractores»', page.locator('aside').filter({ has: panel }));
      await panel.locator('#catalog-subcategory').selectOption('Cosecha');
      await panel.locator('#catalog-subtype').waitFor({ timeout: 10_000 }).catch(() => { throw new Falla('con «Cosecha» no aparece «Tipo»'); });
      exigir(!(await panel.locator('#catalog-power').isVisible()), 'con «Cosecha» sigue «Potencia»');
      await v.inventario('el panel de filtros con «Cosecha»', page.locator('aside').filter({ has: panel }));
    });
    await v.mirar(page);
  },

  async ficha(c, v) {
    const { page } = c.compra;
    await irAlMercado(page);
    await page.getByLabel('Buscar en el mercado').fill(`uso ${c.sello}`);
    await page.locator('form[role="search"]').getByRole('button', { name: 'Buscar', exact: true }).click();
    await esperarResultados(page);
    const tarjeta = (nombre) => page.locator('article[class*="card"]').filter({ has: page.getByRole('heading', { name: nombre, exact: true }) });
    await v.afirma('Los mismos botones aparecen en las publicaciones del Mercado.', async () => {
      for (const [producto, boton] of [[c.tractor, 'Agregar al carrito'], [c.insumo, 'Agregar'], [c.agotable, 'Sin stock']]) {
        await tarjeta(producto.name).getByRole('button', { name: boton, exact: true }).waitFor({ timeout: 10_000 })
          .catch(() => { throw new Falla(`la publicación «${producto.name}» no muestra «${boton}»`); });
      }
    });
    await v.inventario('las publicaciones del Mercado', page.locator('[class*="_resultados_"]').last()
      .locator('[class*="_grilla_"], [class*="_renglones_"]').first());
    // El tractor, por su nombre.
    await tarjeta(c.tractor.name).locator('[data-ficha-enlace="titulo"]').click();
    await page.locator('main dl[class*="_datos_"]').waitFor({ timeout: 15_000 });
    const datos = async () => Object.fromEntries(await page.locator('main dl[class*="_datos_"] > div').evaluateAll((filas) => filas
      .map((f) => [f.querySelector('dt')?.textContent?.trim(), f.querySelector('dd')?.innerText?.replace(/\s+/g, ' ').trim()])));
    await v.afirma({
      paso: ['Se abre su página, con el precio, dónde está y lo que declaró quien vende', 'El origen lleva «declarado por quien vende».'],
      limites: 'Por eso, donde aparece, dice «declarado por quien vende».',
    }, async () => {
      const d = await datos();
      const esperados = { Potencia: '140 HP', Modelo: c.modelo, Año: '2016', Condición: 'Usado' };
      for (const [rotulo, valor] of Object.entries(esperados)) exigir(d[rotulo] === valor, `«${rotulo}» dice «${d[rotulo]}» y tenía que decir «${valor}»`);
      exigir(/Dueño directo\s*declarado por quien vende/i.test(d['Origen'] || ''), `«Origen» dice «${d['Origen']}»`);
      const cuerpo = await page.locator('main').innerText();
      exigir(cuerpo.includes('45.000.000') && cuerpo.includes('Pergamino, Buenos Aires'), 'no se ven el precio o la ubicación');
    });
    await v.inventario('la página de una publicación', page.locator('main'));
    await v.mirar(page);
    await v.afirma('«Ver perfil del vendedor» muestra sus ventas y sus «Opiniones de compradores».', async () => {
      await page.getByRole('button', { name: 'Ver perfil del vendedor' }).click();
      const perfil = page.getByRole('dialog').filter({ hasText: 'Opiniones de compradores' });
      await perfil.waitFor({ timeout: 15_000 }).catch(() => { throw new Falla('no se abrió el perfil'); });
      exigir((await perfil.innerText()).includes(c.vendedora.user.full_name) && (await perfil.innerText()).includes('Ventas'),
        'el perfil no muestra el nombre y las ventas de quien vende');
      await v.mirar(page);
      await perfil.getByRole('button', { name: 'Cerrar' }).click();
    });
    await v.afirma('«Volver al Mercado» vuelve a la búsqueda que tenías.', async () => {
      await page.getByRole('button', { name: 'Volver al Mercado' }).click();
      await page.locator('article[class*="card"]').first().waitFor({ timeout: 15_000 });
      exigir(await page.getByLabel('Buscar en el mercado').inputValue() === `uso ${c.sello}`, 'el buscador perdió lo que decía');
      await c.esperarA(async () => (await titulosDelMercado(page)).every((t) => t.includes(c.sello)), 'el Mercado no volvió a la búsqueda');
    });
    // La cosechadora, por «Ver detalle»: el tipo.
    await tarjeta(c.cosechadora.name).getByRole('link', { name: 'Ver detalle' }).click();
    await page.locator('main dl[class*="_datos_"]').waitFor({ timeout: 15_000 });
    await v.afirma('En el Mercado, tocá el nombre de una publicación o «Ver detalle».', async () => {
      const d = await datos();
      exigir(d['Tipo'] === c.cosecha.tipos[0].label, `«Tipo» dice «${d['Tipo']}»`);
    });
    await v.mirar(page);
    const ficha = async (producto, sesion = c.compra) => {
      await sesion.page.goto(`${WEB}/?section=product&id=${producto.id}`, { waitUntil: 'domcontentloaded' });
      await sesion.page.getByRole('button', { name: 'Ver perfil del vendedor' }).waitFor({ timeout: 15_000 });
      await v.mirar(sesion.page);
      return sesion.page.locator('main [class*="_acciones_"]').getByRole('button').first();
    };
    await v.afirma('En los insumos elegís antes la «Cantidad».', async () => {
      const boton = await ficha(c.insumo);
      exigir((await boton.innerText()).trim() === 'Agregar', `el botón dice «${(await boton.innerText()).trim()}»`);
      await page.getByLabel('Cantidad').waitFor().catch(() => { throw new Falla('no hay «Cantidad»'); });
    });
    await v.afirma('«Sin stock»: no se puede comprar.', async () => {
      const boton = await ficha(c.agotable);
      exigir((await boton.innerText()).trim() === 'Sin stock' && await boton.isDisabled(), 'una publicación sin stock se puede agregar');
    });
    await v.afirma('«Contratar»: un servicio con precio, que también va al carrito.', async () => {
      const boton = await ficha(c.servicioConPrecio);
      exigir((await boton.innerText()).trim() === 'Contratar', `un servicio con precio dice «${(await boton.innerText()).trim()}»`);
    });
    await v.afirma('«Solicitar cotización»: una publicación sin precio. Te lleva a «Contacto».', async () => {
      const boton = await ficha(c.servicioSinPrecio);
      exigir((await boton.innerText()).trim() === 'Solicitar cotización', `una publicación sin precio dice «${(await boton.innerText()).trim()}»`);
      await boton.click();
      await page.getByRole('heading', { name: 'Contacto', exact: true }).waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('no llevó a «Contacto»'); });
    });
    await v.afirma('«Tu publicación»: es tuya, y nadie se compra a sí mismo.', async () => {
      c.venta = c.venta || await sesionEn(c, c.vendedora);
      const boton = await ficha(c.tractor, c.venta);
      exigir((await boton.innerText()).trim() === 'Tu publicación' && await boton.isDisabled(),
        `en su propia publicación, quien vende ve «${(await boton.innerText()).trim()}»`);
    });
    await v.afirma('Sin sesión iniciada, el botón dice «Ingresar para continuar».', async () => {
      const anonima = await sesionEn(c, null);
      const boton = await ficha(c.insumo, anonima);
      const dice = (await boton.innerText()).trim();
      await anonima.contexto.close();
      exigir(dice === 'Ingresar para continuar', `sin sesión dice «${dice}»`);
    });
  },

  async carrito(c, v) {
    const { page } = c.compra;
    const barra = cabecera(page);
    const carrito = dialogo(page, 'Mi carrito');
    const abrirCarrito = async () => {
      if (await carrito.isVisible().catch(() => false)) return;
      await barra.getByRole('button', { name: /^Carrito/ }).click();
      await carrito.waitFor();
    };
    const renglon = (producto) => carrito.locator('[class*="_cartItem_"]').filter({ hasText: producto.name }).first();
    const cantidad = async (producto) => ((await renglon(producto).count()) === 0 ? 0
      : Number(await renglon(producto).locator('[class*="_quantityValue_"]').innerText()));
    const agregar = async (producto) => {
      await page.goto(`${WEB}/?section=product&id=${producto.id}`, { waitUntil: 'domcontentloaded' });
      await page.locator('main [class*="_acciones_"]').getByRole('button').first().click();
      await abrirCarrito();
      await c.esperarA(async () => await cantidad(producto) > 0, `«${producto.name}» no llegó al carrito`);
      await carrito.getByRole('button', { name: 'Cerrar' }).click();
    };
    await v.afirma('Al tocar «Salir», se vacía.', async () => {
      await agregar(c.insumo);
      await salirYVolverAEntrar(page, c.nuevaCompradora.email);
      await abrirCarrito();
      await c.esperarA(async () => await cantidad(c.insumo) === 0, 'después de «Salir» el carrito sigue con lo que tenía');
      await carrito.getByRole('button', { name: 'Cerrar' }).click();
    });
    await agregar(c.insumo);
    await agregar(c.cosechadora);
    await abrirCarrito();
    await v.inventario('el carrito', carrito);
    await v.mirar(page);
    await v.afirma('«+» y «-» cambian la cantidad.', async () => {
      await renglon(c.insumo).getByRole('button', { name: '+', exact: true }).click();
      await c.esperarA(async () => await cantidad(c.insumo) === 2, '«+» no subió la cantidad');
      await renglon(c.insumo).getByRole('button', { name: '-', exact: true }).click();
      await c.esperarA(async () => await cantidad(c.insumo) === 1, '«-» no bajó la cantidad');
    });
    await v.afirma('«Quitar» saca esa publicación.', async () => {
      await renglon(c.cosechadora).getByRole('button', { name: /^Quitar/ }).click();
      await c.esperarA(async () => await cantidad(c.cosechadora) === 0, '«Quitar» no la sacó');
      exigir(await cantidad(c.insumo) === 1, '«Quitar» sacó también otra publicación');
    });
    await v.afirma('«Vaciar carrito» saca todo, después de confirmar con «Sí, vaciar».', async () => {
      await carrito.getByRole('button', { name: 'Vaciar carrito' }).click();
      await v.mirar(page);
      await confirmarEnDialogo(page, 'Sí, vaciar');
      await c.esperarA(async () => await cantidad(c.insumo) === 0, '«Vaciar carrito» no lo vació');
    });
    await v.mirar(page);
    await page.keyboard.press('Escape');
    await agregar(c.insumo);
    await agregar(c.deOtroVendedor);
    await agregar(c.cosechadora);
    await v.afirma('El carrito queda guardado en este navegador: si recargás la página, sigue ahí.', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await abrirCarrito();
      for (const producto of [c.insumo, c.deOtroVendedor, c.cosechadora]) {
        await c.esperarA(async () => await cantidad(producto) === 1, `después de recargar falta «${producto.name}»`);
      }
    });
    await v.mirar(page);
    await v.afirma('«Continuar compra» sigue a la compra.', async () => {
      await carrito.getByRole('button', { name: 'Continuar compra' }).click();
      await dialogo(page, 'Checkout').getByText('Datos de envío').waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('no se abrió la compra'); });
    });
  },

  async envio(c, v) {
    const { page } = c.compra;
    const compra = dialogo(page, 'Checkout');
    await compra.getByText('Datos de envío').waitFor();
    await v.mirar(page);
    await v.afirma('Para salir de la compra, tocá la cruz «×».', async () => {
      await compra.getByRole('button', { name: 'Cerrar' }).first().click();
      await compra.waitFor({ state: 'hidden' }).catch(() => { throw new Falla('la cruz no cerró la compra'); });
      await cabecera(page).getByRole('button', { name: /^Carrito/ }).click();
      await dialogo(page, 'Mi carrito').getByRole('button', { name: 'Continuar compra' }).click();
      await compra.getByText('Datos de envío').waitFor();
    });
    await compra.getByPlaceholder('Juan Pérez').fill(c.nuevaCompradora.nombre);
    await compra.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 2477 000000');
    const destino = async (provincia, localidad) => {
      await compra.locator('#checkout-provincia').selectOption(provincia);
      await c.esperarA(async () => (await compra.locator('#checkout-localidad option').count()) > 1, 'no cargaron las localidades');
      await compra.locator('#checkout-localidad').selectOption(localidad);
      await compra.getByText('Cómo se traslada cada pedido').waitFor({ timeout: 15_000 });
      await page.waitForTimeout(800);
    };
    await destino('06', c.pergamino);
    await compra.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 222');
    await compra.getByPlaceholder('2000').fill('2700');
    await v.inventario('la compra, en «Envío»', compra);
    const grupo = compra.locator('[class*="_fleteGrupo_"]').filter({ hasText: c.vendedora.user.full_name });
    await grupo.getByText('Necesito flete', { exact: true }).click();
    await grupo.locator('[class*="_fleteLista_"]').waitFor({ timeout: 15_000 });
    await v.inventario('la lista de transportistas', grupo);
    await v.mirar(page);
    await v.afirma('Un transportista aparece si la localidad desde donde trabaja está, en línea recta, dentro de su radio de cobertura tanto del origen como del destino.', async () => {
      const vistos = (await grupo.locator('[class*="_fleteNombre_"]').allInnerTexts()).map((t) => t.trim()).sort();
      const esperados = transportistasQueCubren(c.pergamino, [c.pergamino]);
      exigir(esperados.length > 0 && JSON.stringify(vistos) === JSON.stringify(esperados),
        `aparecen ${JSON.stringify(vistos)} y cubren el viaje ${JSON.stringify(esperados)}`);
    });
    const total = async () => ((await textoDe(compra)).match(/Total:\s*\$\s*([\d.,]+)/) || [])[1];
    const antes = await total();
    await grupo.getByRole('button', { name: /^Seleccionar a / }).first().click();
    await grupo.getByText('Transportista elegido').waitFor({ timeout: 15_000 });
    await v.mirar(page);
    await v.inventario('el transportista elegido', grupo);
    await v.afirma({
      paso: 'El precio del flete se acuerda con el transportista: no se suma a la compra.',
      limites: 'Muestra qué transportistas declaran cubrir el viaje.',
    }, async () => {
      const despues = await total();
      exigir(antes && despues === antes, `el total pasó de ${antes} a ${despues} al elegir el transportista`);
    });
    await v.afirma('«Quitar del pedido» lo saca.', async () => {
      await grupo.getByRole('button', { name: 'Quitar del pedido' }).click();
      await grupo.getByRole('button', { name: /^Seleccionar a / }).first().waitFor({ timeout: 10_000 })
        .catch(() => { throw new Falla('después de «Quitar del pedido» no vuelve la lista'); });
      exigir(!(await grupo.getByText('Transportista elegido').isVisible()), 'sigue el transportista elegido');
    });
    await v.afirma('Si ninguno cubre el viaje, dice «Ningún transportista declara cubrir este destino y este origen.».', async () => {
      const [ushuaia] = queryRows("SELECT id, 'fin' FROM localities WHERE province_id = '94' AND name = 'Ushuaia' LIMIT 1")[0];
      exigir(transportistasQueCubren(ushuaia, [c.pergamino]).length === 0, 'el escenario no sirve: alguien cubre Ushuaia');
      await destino('94', ushuaia);
      await grupo.getByText('Necesito flete', { exact: true }).click();
      await grupo.getByText('Ningún transportista declara cubrir este destino y este origen.').waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('con un destino que nadie cubre no lo dice'); });
    });
    await v.mirar(page);
    await destino('06', c.pergamino);
    await v.afirma('En «Resumen del Pedido», «Quitar del carrito» saca una publicación.', async () => {
      await compra.locator('[class*="_summaryItem_"]').filter({ hasText: c.cosechadora.name })
        .getByRole('button', { name: 'Quitar del carrito' }).click();
      await c.esperarA(async () => !(await compra.innerText()).includes(c.cosechadora.name), 'la publicación sigue en la compra');
      exigir((await compra.innerText()).includes(c.insumo.name), 'se fue también otra publicación');
    });
    await v.mirar(page);
    await compra.getByText('Cómo se traslada cada pedido').waitFor({ timeout: 15_000 });
    await page.waitForTimeout(800);
    for (const g of await compra.locator('[class*="_fleteGrupo_"]').all()) {
      await g.getByText('Coordino el traslado por mi cuenta', { exact: true }).click();
    }
    await compra.getByRole('button', { name: 'Continuar al pago' }).click();
    await compra.getByText('Medio de pago').waitFor({ timeout: 15_000 });
  },

  async pagar(c, v) {
    const { page } = c.compra;
    const compra = dialogo(page, 'Checkout');
    await compra.getByText('Medio de pago').waitFor();
    const elegirTransferencias = async () => {
      for (const opcion of await compra.locator('label[class*="_paymentOption_"]').filter({ hasText: 'Transferencia bancaria' }).all()) {
        await opcion.click();
      }
    };
    await elegirTransferencias();
    await v.inventario('la compra, en «Pago»', compra);
    await v.mirar(page);
    const [cbu, alias] = queryRows(`SELECT cbu, alias_bancario FROM users WHERE id = ${sqlLiteral(c.vendedora.user.id)}`)[0];
    await v.afirma('Debajo aparecen el CBU y el alias de quien vende.', async () => {
      const bloque = await textoDe(compra);
      exigir(bloque.includes(`CBU: ${cbu}`) && bloque.includes(`Alias: ${alias}`), 'no se ven el CBU y el alias de la vendedora');
    });
    await v.afirma('«Volver» regresa a los datos de envío.', async () => {
      await compra.getByRole('button', { name: 'Volver', exact: true }).click();
      await compra.getByText('Datos de envío').waitFor({ timeout: 10_000 }).catch(() => { throw new Falla('no volvió a «Envío»'); });
      await compra.getByRole('button', { name: 'Continuar al pago' }).click();
      await compra.getByText('Medio de pago').waitFor({ timeout: 15_000 });
      await elegirTransferencias();
    });
    const antes = Number(queryRows(`SELECT count(*), 'fin' FROM orders WHERE buyer_id = ${sqlLiteral(c.compradora.user.id)}`)[0][0]);
    await compra.getByRole('button', { name: 'Confirmar y crear las órdenes' }).click();
    await compra.getByRole('heading', { name: 'Tus órdenes' }).waitFor({ timeout: 20_000 });
    await v.mirar(page);
    await v.inventario('la compra, en «Órdenes»', compra);
    const tarjetas = compra.locator('[class*="_infoCard_"]');
    const deLaVendedora = tarjetas.filter({ hasText: c.vendedora.user.full_name });
    await v.afirma('Se crea una orden por cada vendedor, y cada una se paga por separado.', async () => {
      const creadas = Number(queryRows(`SELECT count(*), 'fin' FROM orders WHERE buyer_id = ${sqlLiteral(c.compradora.user.id)}`)[0][0]) - antes;
      const referencias = (await tarjetas.allInnerTexts()).map((t) => (t.replace(/\s+/g, ' ').match(/Referencia de pago:\s*(\S+)/) || [])[1]);
      exigir(creadas === 2 && referencias.length === 2 && referencias[0] !== referencias[1],
        `con dos vendedores se crearon ${creadas} órdenes y se ven ${referencias.length} referencias`);
    });
    await v.afirma({
      paso: 'La cuenta que aparece es la de quien vende: AgroBoeda no recibe ese dinero.',
      limites: ['AgroBoeda no cobra, no recibe ni guarda el dinero de las ventas.',
        'Quien compra le paga directamente a quien vende, a la cuenta de quien vende.', 'Nada de ese dinero pasa por AgroBoeda.'],
    }, async () => {
      const texto = await textoDe(deLaVendedora);
      exigir(texto.includes(`CBU: ${cbu}`) && texto.includes(`Alias: ${alias}`) && texto.includes(`Titular: ${c.vendedora.user.full_name}`),
        'la orden no muestra la cuenta de la vendedora');
      const [cbuDelOtro] = queryRows(`SELECT cbu, 'fin' FROM users WHERE id = ${sqlLiteral(c.deOtroVendedor.seller_id)}`)[0];
      exigir((await textoDe(tarjetas.filter({ hasNotText: c.vendedora.user.full_name }))).includes(`CBU: ${cbuDelOtro}`),
        'la otra orden no muestra la cuenta de su vendedor');
    });
    c.conComprobante = { numero: ((await textoDe(deLaVendedora)).match(/Referencia de pago:\s*(\S+)/) || [])[1] };
    c.conComprobante.id = queryRows(`SELECT id, 'fin' FROM orders WHERE order_number = ${sqlLiteral(c.conComprobante.numero)}`)[0][0];
    const delOtro = tarjetas.filter({ hasNotText: c.vendedora.user.full_name });
    c.sinComprobante = { numero: ((await textoDe(delOtro)).match(/Referencia de pago:\s*(\S+)/) || [])[1] };
    c.sinComprobante.id = queryRows(`SELECT id, 'fin' FROM orders WHERE order_number = ${sqlLiteral(c.sinComprobante.numero)}`)[0][0];
    await v.afirma('Tocá «Adjuntar comprobante» y elegí la imagen o el PDF del comprobante', async () => {
      await deLaVendedora.locator('input[type="file"]').setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: PNG });
      await deLaVendedora.getByRole('button', { name: 'Adjuntar comprobante' }).click();
      await c.esperarA(async () => estadoDe(c.conComprobante) === 'transfer_receipt_submitted',
        `después de adjuntarlo la orden está en ${estadoDe(c.conComprobante)}`);
    });
    await v.mirar(page);
    await compra.getByRole('button', { name: 'Finalizar' }).click();
    await compra.waitFor({ state: 'hidden', timeout: 15_000 });
    await v.afirma('o hacelo después desde «Mis Compras»', async () => {
      await abrirCuenta(page, 'Mis Compras');
      await tarjetaDeOrden(page, c.sinComprobante.numero).getByRole('button', { name: 'Enviar comprobante' })
        .waitFor({ timeout: 15_000 }).catch(() => { throw new Falla('la orden sin comprobante no ofrece enviarlo en «Mis Compras»'); });
      await v.mirar(page);
    });
  },

  async 'mis-compras'(c, v) {
    const { page } = c.compra;
    c.ordenes = {};
    for (const estado of ['pagada', 'confirmada', 'enviada', 'entregada']) c.ordenes[estado] = await ordenEn(c, estado);
    c.ordenes.aCancelar = await ordenEn(c, 'esperando');
    await abrirCuenta(page, 'Mis Compras');
    const tarjeta = (orden) => tarjetaDeOrden(page, orden.numero);
    await tarjeta(c.ordenes.entregada).waitFor({ timeout: 15_000 });
    await v.inventario('«Mis Compras»', page.locator('main [class*="_section_"]').first());
    await v.mirar(page);
    const estados = [[c.sinComprobante, 'Esperando comprobante'], [c.conComprobante, 'Comprobante a revisar'],
      [c.ordenes.pagada, 'Pagado'], [c.ordenes.confirmada, 'Confirmado'], [c.ordenes.enviada, 'En tránsito'],
      [c.ordenes.entregada, 'Entregado']];
    await v.afirma('Cada compra muestra su estado, lo que compraste, el total y el «Traslado».', async () => {
      for (const [orden, estado] of estados) {
        const texto = (await textoDe(tarjeta(orden))).toLowerCase();
        exigir(texto.includes(estado.toLowerCase()) && texto.includes('traslado') && texto.includes('total:'),
          `la compra ${orden.numero} no dice «${estado}», su total y su traslado`);
      }
    });
    await v.afirma('Elegí el archivo del comprobante y tocá «Enviar comprobante».', async () => {
      const t = tarjeta(c.sinComprobante);
      await t.locator('input[type="file"]').setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: PNG });
      await t.getByRole('button', { name: 'Enviar comprobante' }).click();
      await c.esperarA(async () => estadoDe(c.sinComprobante) === 'transfer_receipt_submitted',
        `después de enviarlo la orden está en ${estadoDe(c.sinComprobante)}`);
      await c.esperarA(async () => (await textoDe(tarjeta(c.sinComprobante))).toLowerCase().includes('comprobante a revisar'),
        'la tarjeta no pasó a «Comprobante a revisar»');
    });
    await v.afirma('Mientras tanto no tenés que hacer nada.', async () => {
      const botones = await tarjeta(c.conComprobante).getByRole('button').allInnerTexts();
      exigir(botones.length === 0, `con el comprobante a revisar, la compra ofrece ${botones.join(', ')}`);
    });
    await v.afirma('Mientras la compra no salió, «Cancelar Pedido» la cancela.', async () => {
      exigir(!(await tarjeta(c.ordenes.enviada).getByRole('button', { name: 'Cancelar Pedido' }).isVisible()),
        'una compra en tránsito ofrece «Cancelar Pedido»');
      await tarjeta(c.ordenes.aCancelar).getByRole('button', { name: 'Cancelar Pedido' }).click();
      await confirmarEnDialogo(page, 'Cancelar pedido');
      await c.esperarA(async () => estadoDe(c.ordenes.aCancelar) === 'cancelled', `la orden quedó en ${estadoDe(c.ordenes.aCancelar)}`);
    });
    await v.afirma('Desde «Confirmado», la compra muestra «Información de contacto del vendedor» y «Contactar por WhatsApp».', async () => {
      for (const orden of [c.ordenes.confirmada, c.ordenes.enviada]) {
        const t = tarjeta(orden);
        exigir((await textoDe(t)).toLowerCase().includes('información de contacto del vendedor')
          && await t.getByRole('link', { name: 'Contactar por WhatsApp' }).isVisible(), `la compra ${orden.numero} no muestra el contacto`);
      }
      exigir(!(await textoDe(tarjeta(c.ordenes.pagada))).toLowerCase().includes('información de contacto del vendedor'),
        'una compra pagada y sin confirmar ya muestra el contacto');
    });
    await v.mirar(page);
    await v.afirma('Arriba, «Todos», «Pendientes», «En tránsito» y «Entregados» filtran las compras.', async () => {
      await page.getByRole('button', { name: /^En tránsito/ }).click();
      await c.esperarA(async () => {
        const visibles = await page.locator('[class*="_orderCard_"] h3').allInnerTexts();
        return visibles.length === 1 && visibles[0].includes(c.ordenes.enviada.numero);
      }, 'con «En tránsito» no queda sólo la compra en tránsito');
      await page.getByRole('button', { name: /^Todos/ }).click();
      await tarjeta(c.ordenes.entregada).waitFor();
    });
  },

  async calificar(c, v) {
    const { page } = c.compra;
    const orden = c.ordenes.enviada;
    const t = tarjetaDeOrden(page, orden.numero);
    await t.getByRole('button', { name: 'Confirmar Recepción' }).click();
    await v.mirar(page);
    await confirmarEnDialogo(page, 'Confirmar recepción');
    await v.afirma('La compra pasa a «Entregado» y aparece «Calificar Vendedor».', async () => {
      await c.esperarA(async () => estadoDe(orden) === 'delivered', `la orden quedó en ${estadoDe(orden)}`);
      await t.getByRole('button', { name: 'Calificar Vendedor' }).waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('no aparece «Calificar Vendedor» sin recargar la página'); });
    });
    await t.getByRole('button', { name: 'Calificar Vendedor' }).click();
    const modal = page.getByRole('dialog').filter({ hasText: 'Calificar a' });
    await modal.waitFor();
    await v.inventario('la calificación', modal);
    await v.mirar(page);
    const comentario = `Buena compra ${c.sello}`;
    await modal.locator('input[name="calificacion-puntaje"][value="4"]').check({ force: true });
    await modal.getByLabel(/Comentario/).fill(comentario);
    await modal.getByRole('button', { name: 'Enviar calificación' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 15_000 });
    await v.afirma('Tu calificación queda pública en el perfil de quien te vendió, en «Opiniones de compradores».', async () => {
      const anonima = await sesionEn(c, null);
      await anonima.page.goto(`${WEB}/?section=product&id=${c.insumo.id}`, { waitUntil: 'domcontentloaded' });
      await anonima.page.getByRole('button', { name: 'Ver perfil del vendedor' }).click();
      const perfil = anonima.page.getByRole('dialog').filter({ hasText: 'Opiniones de compradores' });
      await perfil.getByText(comentario).waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('el perfil de la vendedora no muestra la calificación'); });
      await v.mirar(anonima.page);
      await anonima.contexto.close();
    });
    await v.afirma('Cada compra se califica una sola vez.', async () => {
      await c.esperarA(async () => !(await t.getByRole('button', { name: 'Calificar Vendedor' }).isVisible()),
        'después de calificar sigue «Calificar Vendedor»');
      const otra = await pedir('/ratings/', { method: 'POST', token: c.compradora.access_token, body: { order_id: orden.id, score: 1, comment: 'otra vez' } });
      exigir(otra.status >= 400, `la API aceptó una segunda calificación: HTTP ${otra.status}`);
    });
  },

  // --- Parte 2. Quien vende ----------------------------------------------------

  async 'cobro-transferencia'(c, v) {
    c.venta = c.venta || await sesionEn(c, c.vendedora);
    const { page } = c.venta;
    // Una compra de antes del cambio, que espera la transferencia.
    const deAntes = await ordenEn(c, 'esperando');
    const [cbuViejo, aliasViejo] = queryRows(`SELECT cbu, alias_bancario FROM users WHERE id = ${sqlLiteral(c.vendedora.user.id)}`)[0];
    await abrirCuenta(page, 'Mi Perfil');
    const perfil = page.locator('main [class*="_section_"]').filter({ has: page.getByRole('heading', { name: 'Mi Perfil', exact: true }) });
    await v.mirar(page);
    await perfil.getByRole('button', { name: 'Editar', exact: true }).click();
    await perfil.getByLabel('Alias bancario').waitFor();
    await v.inventario('«Mi Perfil» al editar', perfil, null, { fuera: ['Mercado Pago — dónde cobrás', 'Documentación fiscal'] });
    await v.afirma('El «Email» no se cambia.', async () => {
      exigir(await perfil.getByLabel('Email', { exact: true }).count() === 0 && await perfil.locator('input[type="email"]').count() === 0,
        'al editar, el correo se puede cambiar');
    });
    await v.afirma('«Cancelar» deja todo como estaba: si cambiaste algo, pregunta antes, con «Descartar cambios» o «Seguir editando».', async () => {
      await perfil.getByLabel('Alias bancario').fill('otro.alias.que.no.queda');
      await perfil.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('button', { name: 'Descartar cambios' }).waitFor({ timeout: 5_000 })
        .catch(() => { throw new Falla('no pregunta antes de descartar'); });
      await v.mirar(page);
      await page.getByRole('button', { name: 'Descartar cambios' }).click();
      const [, alias] = queryRows(`SELECT cbu, alias_bancario FROM users WHERE id = ${sqlLiteral(c.vendedora.user.id)}`)[0];
      exigir(alias === aliasViejo, `después de «Cancelar» el alias es «${alias}»`);
    });
    c.aliasNuevo = `guia.nuevo.${c.sello}`;
    await perfil.getByRole('button', { name: 'Editar', exact: true }).click();
    await perfil.getByLabel('Alias bancario').fill(c.aliasNuevo);
    await perfil.getByRole('button', { name: 'Guardar', exact: true }).click();
    await c.esperarA(async () => queryRows(`SELECT alias_bancario, 'fin' FROM users WHERE id = ${sqlLiteral(c.vendedora.user.id)}`)[0][0] === c.aliasNuevo,
      '«Guardar» no guardó el alias');
    await v.mirar(page);
    await v.afirma('Cada orden guarda los datos del momento de la compra: si después los cambiás, las órdenes anteriores siguen mostrando los de antes.', async () => {
      await abrirCuenta(c.compra.page, 'Mis Compras');
      const texto = await textoDe(tarjetaDeOrden(c.compra.page, deAntes.numero));
      exigir(texto.includes(`Alias: ${aliasViejo}`) && !texto.includes(c.aliasNuevo), 'la compra de antes no muestra el alias de antes');
    });
    await v.afirma(['Sin CBU ni alias, quien compra no puede elegir la transferencia para tus publicaciones.',
      'Con alguno de los dos, la transferencia aparece en la compra con tu cuenta.'], async () => {
      const sinCuenta = await c.crear('SinCuenta');
      const suya = await c.publicar(sinCuenta, { name: `Semilla sin cuenta uso ${c.sello}` });
      const medios = async () => {
        await exigirApi(pedir('/cart/sync', { method: 'POST', token: c.compradora.access_token,
          body: { items: [{ product_id: suya.id, quantity: 1 }] } }), 'armar el carrito');
        return (await exigirApi(pedir('/orders/payment-options', { token: c.compradora.access_token }), 'pedir los medios'))[0];
      };
      const sin = await medios();
      exigir(!sin.methods.includes('transfer'), `sin CBU ni alias se ofrece: ${sin.methods.join(', ')}`);
      await exigirApi(pedir('/auth/me', { method: 'PATCH', token: sinCuenta.access_token, body: { alias_bancario: `solo.alias.${c.sello}` } }), 'cargar el alias');
      const con = await medios();
      exigir(con.methods.includes('transfer') && con.alias_bancario === `solo.alias.${c.sello}`, 'con alias no se ofrece la transferencia con esa cuenta');
      await exigirApi(pedir('/cart/sync', { method: 'POST', token: c.compradora.access_token, body: { items: [] } }), 'vaciar el carrito');
    });
    c.ordenes.deAntes = deAntes;
    void cbuViejo;
  },

  async 'mercado-pago'(c, v) {
    const { page } = c.venta;
    await abrirCuenta(page, 'Mi Perfil');
    const seccion = page.locator('main [class*="_mpSection_"]');
    await seccion.getByText('Cuenta no vinculada').waitFor({ timeout: 15_000 });
    await v.mirar(page);
    await v.inventario('«Mercado Pago — dónde cobrás»', seccion);
    await v.afirma('Te lleva a Mercado Pago para que autorices la conexión', async () => {
      const base = variableDelBackend('MP_AUTH_BASE_URL') || 'https://auth.mercadopago.com';
      let pedido = null;
      await page.route(`${base}/**`, async (ruta) => { pedido = ruta.request().url(); await ruta.abort(); });
      await seccion.getByRole('button', { name: /Vincular Mercado Pago/ }).click();
      await c.esperarA(async () => pedido !== null, 'el botón no llevó a Mercado Pago');
      const url = new URL(pedido);
      exigir(url.pathname.endsWith('/authorization') && url.searchParams.get('response_type') === 'code'
        && url.searchParams.get('client_id') && url.searchParams.get('redirect_uri'),
      `llevó a ${url.origin}${url.pathname}, que no es la autorización de Mercado Pago`);
      await page.unroute(`${base}/**`);
    });
  },

  async publicar(c, v) {
    const { page } = c.venta;
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    const titulo = page.getByRole('heading', { name: 'Publicar un producto' });
    const formulario = page.locator('form').filter({ has: page.locator('#operation-kind') });
    const cuantas = () => Number(queryRows(`SELECT count(*), 'fin' FROM products WHERE seller_id = ${sqlLiteral(c.vendedora.user.id)}`)[0][0]);
    const antes = cuantas();
    await cabecera(page).getByRole('button', { name: 'Vender', exact: true }).click();
    await titulo.waitFor({ timeout: 15_000 });
    await v.mirar(page);
    await v.afirma('«Cancelar» cierra el formulario sin publicar.', async () => {
      await formulario.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await titulo.waitFor({ state: 'hidden' }).catch(() => { throw new Falla('«Cancelar» no cerró el formulario'); });
      exigir(cuantas() === antes, 'después de «Cancelar» hay una publicación más');
    });
    await v.afirma('o «+ Publicar» en «Mis publicaciones»', async () => {
      await abrirCuenta(page, 'Mis publicaciones');
      await page.getByRole('button', { name: '+ Publicar', exact: true }).click();
      await titulo.waitFor({ timeout: 15_000 }).catch(() => { throw new Falla('«+ Publicar» no abrió el formulario'); });
    });
    const nombre = `Tractor publicado uso ${c.sello}`;
    const modelo = `PB${Date.now().toString().slice(-6)}`;
    await formulario.locator('#name').fill(nombre);
    await formulario.locator('#category').selectOption('Maquinaria agrícola');
    await formulario.locator('#subcategory').selectOption('Cosecha');
    await formulario.locator('#subcategory-type').waitFor();
    // Características y etiquetas no se guardan: la guía no las describe
    // (consulta a la PM, USER-GUIDE-1).
    const sinGuardar = { fuera: ['Características del Producto', 'Etiquetas'] };
    await v.inventario('el formulario con «Cosecha»', formulario, null, sinGuardar);
    await formulario.locator('#subcategory').selectOption('Tractores');
    await formulario.locator('#power-hp').waitFor();
    await v.afirma('Ninguno es obligatorio', async () => {
      for (const campo of ['#condition', '#brand', '#model', '#year', '#origin', '#power-hp', '#subcategory']) {
        exigir(!(await formulario.locator(campo).evaluate((el) => el.required)), `${campo} es obligatorio`);
      }
    });
    await formulario.locator('#operation-kind').selectOption('activo');
    await formulario.locator('#power-hp').fill('150');
    await formulario.locator('#condition').selectOption('usado');
    await formulario.locator('#brand').selectOption('john-deere');
    await formulario.locator('#model').fill(modelo);
    await formulario.locator('#year').fill('2019');
    await formulario.locator('#origin').selectOption('concesionaria');
    await formulario.locator('#description').fill('Tractor publicado desde el formulario por la guía de uso.');
    await formulario.locator('input[type="file"]').setInputFiles([
      { name: 'tractor.png', mimeType: 'image/png', buffer: PNG },
      { name: 'tractor-2.png', mimeType: 'image/png', buffer: OTRO_PNG },
    ]);
    const fotos = formulario.locator('[class*="_imagePreview_"]');
    await c.esperarA(async () => (await fotos.count()) === 2, 'no se cargaron las dos fotos');
    await v.mirar(page);
    await v.afirma('en otra foto, «Principal» la vuelve principal, y «Quitar» saca una', async () => {
      // Una sola es la principal; la otra ofrece «Principal».
      const principal = fotos.filter({ has: page.locator('[class*="_mainImageBadge_"]') });
      const otra = fotos.filter({ has: page.getByRole('button', { name: 'Usar como imagen principal' }) });
      exigir(await principal.count() === 1 && await otra.count() === 1, 'con dos fotos no hay una sola principal');
      const src = await otra.locator('img').getAttribute('src');
      await otra.getByRole('button', { name: 'Usar como imagen principal' }).click();
      await c.esperarA(async () => await principal.locator('img').getAttribute('src') === src, '«Principal» no la volvió principal');
      await fotos.filter({ has: page.getByRole('button', { name: 'Usar como imagen principal' }) })
        .getByRole('button', { name: 'Quitar esta imagen' }).click();
      await c.esperarA(async () => (await fotos.count()) === 1, '«Quitar» no sacó la foto');
    });
    await formulario.locator('#price').first().fill('52000000');
    await formulario.locator('#stock').fill('1');
    await formulario.locator('#unit').selectOption('unidad');
    await formulario.locator('#province').selectOption('06');
    await c.esperarA(async () => (await formulario.locator('#locality option').count()) > 1, 'no cargaron las localidades');
    await formulario.locator('#locality').selectOption(c.pergamino);
    await v.mirar(page);
    await v.inventario('el formulario con «Tractores»', formulario, null, sinGuardar);
    await formulario.getByRole('button', { name: 'Publicar producto' }).click();
    await titulo.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => { throw new Falla('el formulario no se cerró al publicar'); });
    const [id] = queryRows(`SELECT id, 'fin' FROM products WHERE name = ${sqlLiteral(nombre)}`)[0] || [];
    exigir(id, 'la publicación no quedó guardada');
    c.publicado = { id, name: nombre, seller_id: c.vendedora.user.id };
    await v.afirma('Al publicar, la publicación aparece enseguida en el Mercado.', async () => {
      exigir(await enElMercado(nombre), 'no está en el Mercado');
    });
    await page.goto(`${WEB}/?section=product&id=${id}`, { waitUntil: 'domcontentloaded' });
    await page.locator('main dl[class*="_datos_"]').waitFor({ timeout: 15_000 });
    await v.mirar(page);
    await v.afirma(['Los datos que cargás aparecen en la página de la publicación', 'El origen se muestra con «declarado por quien vende».'], async () => {
      const d = Object.fromEntries(await page.locator('main dl[class*="_datos_"] > div').evaluateAll((filas) => filas
        .map((f) => [f.querySelector('dt')?.textContent?.trim(), f.querySelector('dd')?.innerText?.replace(/\s+/g, ' ').trim()])));
      const esperados = { Potencia: '150 HP', Modelo: modelo, Año: '2019', Condición: 'Usado' };
      for (const [rotulo, valor] of Object.entries(esperados)) exigir(d[rotulo] === valor, `«${rotulo}» dice «${d[rotulo]}» y se cargó «${valor}»`);
      exigir(/Agencia \/ Concesionaria\s*declarado por quien vende/i.test(d['Origen'] || ''), `«Origen» dice «${d['Origen']}»`);
    });
    await v.afirma('sirven para los filtros del Mercado; la marca se usa en el filtro «Marca»', async () => {
      const buscar = `search=${encodeURIComponent(nombre)}`;
      for (const filtro of ['brand=john-deere', 'year_from=2019', 'origin=concesionaria', 'condition=usado']) {
        const total = (await pedir(`/catalog/products?${buscar}&${filtro}`)).data.total;
        exigir(total === 1, `con ${filtro} el Mercado no la trae`);
      }
      exigir((await pedir(`/catalog/products?${buscar}&brand=case`)).data.total === 0, 'con otra marca también aparece');
    });
    await v.afirma('En «Fotografías del producto (opcional)» podés subir fotos', async () => {
      const fotos = Number(queryRows(`SELECT count(*), 'fin' FROM product_images WHERE product_id = ${sqlLiteral(id)}`)[0][0]);
      exigir(fotos === 1, `la publicación quedó con ${fotos} fotos`);
    });
  },

  async 'mis-publicaciones'(c, v) {
    const { page } = c.venta;
    await abrirCuenta(page, 'Mis publicaciones');
    const tarjeta = (producto) => page.locator('[class*="_productCard_"]').filter({ hasText: producto.name });
    await tarjeta(c.publicado).waitFor({ timeout: 15_000 });
    await v.inventario('«Mis publicaciones»', page.locator('main [class*="_section_"]').first());
    await v.mirar(page);
    const edicion = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Editar Producto/ }) });
    await tarjeta(c.publicado).getByRole('button', { name: 'Editar' }).click();
    await edicion.waitFor({ timeout: 15_000 });
    await edicion.locator('#edit-potencia').waitFor({ timeout: 10_000 });
    await v.inventario('«Editar Producto»', edicion);
    await v.mirar(page);
    await v.afirma('La «Categoría» y la marca no se cambian desde acá.', async () => {
      exigir(await edicion.getByLabel('Categoría', { exact: true }).isDisabled(), 'la categoría se puede cambiar');
      const rotulos = await edicion.locator('label').allInnerTexts();
      exigir(!rotulos.some((r) => /^marca/i.test(r.trim())), 'la marca se puede cambiar');
    });
    await v.afirma('«Cancelar» cierra sin guardar', async () => {
      await edicion.getByLabel('Precio ($)').fill('1');
      await edicion.getByRole('button', { name: 'Cancelar', exact: true }).click();
      const descartar = page.getByRole('button', { name: 'Descartar cambios' });
      if (await descartar.isVisible({ timeout: 3_000 }).catch(() => false)) await descartar.click();
      await edicion.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { throw new Falla('«Cancelar» no cerró la edición'); });
      exigir(Number(queryRows(`SELECT price, 'fin' FROM products WHERE id = ${sqlLiteral(c.publicado.id)}`)[0][0]) === 52000000,
        'después de «Cancelar» el precio cambió');
      // El «Tipo» aparece en una subcategoría con tipos, como «Cosecha».
      await tarjeta(c.cosechadora).getByRole('button', { name: 'Editar' }).click();
      await edicion.locator('#edit-tipo').waitFor({ timeout: 10_000 });
      await v.mirar(page);
      await edicion.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await edicion.waitFor({ state: 'hidden', timeout: 10_000 });
      await tarjeta(c.publicado).getByRole('button', { name: 'Editar' }).click();
      await edicion.waitFor({ timeout: 15_000 });
    });
    await v.afirma('«Guardar Cambios» guarda', async () => {
      await edicion.getByLabel('Precio ($)').fill('51000000');
      await edicion.getByRole('button', { name: /Guardar Cambios/ }).click();
      await edicion.waitFor({ state: 'hidden', timeout: 15_000 });
      await c.esperarA(async () => Number(queryRows(`SELECT price, 'fin' FROM products WHERE id = ${sqlLiteral(c.publicado.id)}`)[0][0]) === 51000000,
        'el precio nuevo no quedó guardado');
    });
    await v.afirma(['«Pausar» la saca del Mercado sin borrarla.', 'Una publicación pausada no se ve en el Mercado.'], async () => {
      await tarjeta(c.publicado).getByRole('button', { name: 'Pausar' }).click();
      await confirmarEnDialogo(page, 'Pausar');
      await c.esperarA(async () => (await textoDe(tarjeta(c.publicado))).includes('Pausado'), 'la tarjeta no dice «Pausado»');
      exigir(!(await enElMercado(c.publicado.name)), 'pausada, sigue en el Mercado');
      exigir(queryRows(`SELECT lower(status::text), 'fin' FROM products WHERE id = ${sqlLiteral(c.publicado.id)}`)[0][0] === 'paused',
        'pausarla no la dejó guardada como pausada');
    });
    await v.mirar(page);
    await v.afirma('«Activar» la vuelve a mostrar.', async () => {
      await tarjeta(c.publicado).getByRole('button', { name: 'Activar' }).click();
      await confirmarEnDialogo(page, 'Activar');
      await c.esperarA(async () => (await textoDe(tarjeta(c.publicado))).includes('Activo'), 'la tarjeta no dice «Activo»');
      exigir(await enElMercado(c.publicado.name), 'activada, no vuelve al Mercado');
    });
    await v.afirma(['Cuando el stock llega a cero, dice «Agotado»', 'en el Mercado aparece con «Sin stock» y nadie la puede comprar'], async () => {
      exigir((await textoDe(tarjeta(c.agotable))).includes('Agotado'), 'sin stock, no dice «Agotado»');
      // La ve alguien que no la vendió: para quien vende, dice «Tu publicación».
      const mercado = await c.compra.contexto.newPage();
      await irAlMercado(mercado);
      await mercado.getByLabel('Buscar en el mercado').fill(c.agotable.name);
      await mercado.locator('form[role="search"]').getByRole('button', { name: 'Buscar', exact: true }).click();
      await mercado.locator('article[class*="card"]').filter({ hasText: c.agotable.name })
        .getByRole('button', { name: 'Sin stock', exact: true }).waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('en el Mercado no aparece con «Sin stock»'); });
      await v.mirar(mercado);
      await mercado.close();
      const r = await pedir('/cart/items', { method: 'POST', token: c.compradora.access_token, body: { product_id: c.agotable.id, quantity: 1 } });
      exigir(r.status >= 400, `sin stock, se pudo agregar al carrito: HTTP ${r.status}`);
    });
    await v.afirma('Para volver a venderla, editá el stock.', async () => {
      await tarjeta(c.agotable).getByRole('button', { name: 'Editar' }).click();
      await edicion.waitFor({ timeout: 15_000 });
      await edicion.getByLabel('Stock', { exact: true }).fill('5');
      await edicion.getByRole('button', { name: /Guardar Cambios/ }).click();
      await edicion.waitFor({ state: 'hidden', timeout: 15_000 });
      await c.esperarA(async () => (await textoDe(tarjeta(c.agotable))).includes('Activo'), 'con stock nuevo no vuelve a «Activo»');
      await exigirApi(pedir('/cart/sync', { method: 'POST', token: c.compradora.access_token,
        body: { items: [{ product_id: c.agotable.id, quantity: 1 }] } }), 'con stock nuevo no se puede comprar');
      await exigirApi(pedir('/cart/sync', { method: 'POST', token: c.compradora.access_token, body: { items: [] } }), 'vaciar el carrito');
    });
    await v.afirma('El botón de la papelera la elimina, después de confirmar con «Eliminar».', async () => {
      const descartable = await c.publicar(c.vendedora, { name: `Semilla descartable uso ${c.sello}` });
      await abrirCuenta(page, 'Mis publicaciones');
      await tarjeta(descartable).getByRole('button', { name: `Eliminar ${descartable.name}` }).click();
      await v.mirar(page);
      await confirmarEnDialogo(page, 'Eliminar');
      await c.esperarA(async () => (await tarjeta(descartable).count()) === 0, 'sigue en «Mis publicaciones»');
      exigir(!(await enElMercado(descartable.name)), 'sigue en el Mercado');
    });
  },

  async 'revisar-comprobante'(c, v) {
    const { page } = c.venta;
    const aRechazar = await ordenEn(c, 'a-revisar');
    await abrirCuenta(page, 'Mis Ventas');
    const tarjeta = (orden) => tarjetaDeOrden(page, orden.numero);
    await tarjeta(c.conComprobante).waitFor({ timeout: 15_000 });
    await v.inventario('«Mis Ventas»', page.locator('main [class*="_section_"]').first());
    await v.mirar(page);
    await v.afirma('la venta aparece en «Mi cuenta», «Mis Ventas», con la «Información del comprador» y el «Traslado»', async () => {
      const texto = (await textoDe(tarjeta(c.conComprobante))).toLowerCase();
      exigir(texto.includes('información del comprador') && texto.includes(c.nuevaCompradora.nombre.toLowerCase())
        && texto.includes('el comprador coordina el traslado por su cuenta.'), 'la venta no muestra a quien compró y el traslado');
      exigir(await tarjeta(c.conComprobante).getByRole('link', { name: 'Ver comprobante' }).isVisible(), 'no se puede ver el comprobante');
    });
    await v.afirma({
      paso: 'La venta pasa a «Pagado», y las unidades vendidas se descuentan de tu stock.',
      limites: 'La transferencia la confirma quien vende.',
    }, async () => {
      exigir(estadoDe(c.conComprobante) === 'transfer_receipt_submitted', `antes de aprobar, la orden está en ${estadoDe(c.conComprobante)}`);
      const stock = stockDe(c.insumo.id);
      await tarjeta(c.conComprobante).getByRole('button', { name: 'Aprobar comprobante' }).click();
      await c.esperarA(async () => estadoDe(c.conComprobante) === 'paid', `después de aprobar la orden está en ${estadoDe(c.conComprobante)}`);
      await c.esperarA(async () => (await textoDe(tarjeta(c.conComprobante))).toLowerCase().includes('pagado'), 'la venta no dice «Pagado»');
      exigir(stockDe(c.insumo.id) === stock - 1, `el stock pasó de ${stock} a ${stockDe(c.insumo.id)}`);
    });
    await v.mirar(page);
    await v.afirma('podés decidir mirando tu cuenta, aunque no haya comprobante', async () => {
      const sinComprobante = c.ordenes.deAntes;
      const t = tarjeta(sinComprobante);
      exigir((await textoDe(t)).toLowerCase().includes('esperando comprobante'), 'la venta sin comprobante no dice «Esperando comprobante»');
      await t.getByRole('button', { name: 'Rechazar transferencia' }).waitFor();
      await t.getByRole('button', { name: 'Aprobar transferencia' }).click();
      await c.esperarA(async () => estadoDe(sinComprobante) === 'paid', `sin comprobante, aprobar la dejó en ${estadoDe(sinComprobante)}`);
    });
    await v.mirar(page);
    const motivo = `El importe no llegó ${c.sello}`;
    await tarjeta(aRechazar).getByRole('button', { name: 'Rechazar comprobante' }).click();
    const rechazo = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Rechazar el comprobante' }) });
    await rechazo.waitFor();
    await v.inventario('el rechazo del comprobante', rechazo);
    await v.mirar(page);
    await rechazo.getByLabel('Motivo del rechazo').fill(motivo);
    await rechazo.getByRole('button', { name: 'Confirmar rechazo' }).click();
    await v.afirma('La venta queda «Rechazado», y quien compra la ve así, con el motivo.', async () => {
      await c.esperarA(async () => estadoDe(aRechazar) === 'rejected', `la orden quedó en ${estadoDe(aRechazar)}`);
      await c.esperarA(async () => (await textoDe(tarjeta(aRechazar))).toLowerCase().includes('rechazado'), 'la venta no dice «Rechazado»');
      await abrirCuenta(c.compra.page, 'Mis Compras');
      const suya = (await textoDe(tarjetaDeOrden(c.compra.page, aRechazar.numero))).toLowerCase();
      exigir(suya.includes('rechazado') && suya.includes(motivo.toLowerCase()), 'quien compra no la ve rechazada y con el motivo');
    });
  },

  async 'confirmar-y-enviar'(c, v) {
    const { page } = c.venta;
    const pagadaARechazar = await ordenEn(c, 'pagada');
    const confirmadaACancelar = await ordenEn(c, 'confirmada');
    await abrirCuenta(page, 'Mis Ventas');
    const tarjeta = (orden) => tarjetaDeOrden(page, orden.numero);
    const orden = c.conComprobante;
    await tarjeta(orden).waitFor({ timeout: 15_000 });
    await v.afirma('Pasa a «Confirmado».', async () => {
      await tarjeta(orden).getByRole('button', { name: 'Confirmar Pedido' }).click();
      await v.mirar(page);
      await confirmarEnDialogo(page, 'Confirmar');
      await c.esperarA(async () => estadoDe(orden) === 'confirmed', `la orden quedó en ${estadoDe(orden)}`);
      await c.esperarA(async () => (await textoDe(tarjeta(orden))).toLowerCase().includes('confirmado'), 'la venta no dice «Confirmado»');
    });
    await v.inventario('una venta confirmada', tarjeta(orden));
    await v.afirma('Pasa a «En tránsito».', async () => {
      await tarjeta(orden).getByRole('button', { name: 'Marcar como Enviado' }).click();
      await v.mirar(page);
      await confirmarEnDialogo(page, 'Marcar enviado');
      await c.esperarA(async () => estadoDe(orden) === 'shipped', `la orden quedó en ${estadoDe(orden)}`);
      await c.esperarA(async () => (await textoDe(tarjeta(orden))).toLowerCase().includes('en tránsito'), 'la venta no dice «En tránsito»');
      await v.mirar(page);
    });
    await v.afirma('Cuando quien compra confirma que lo recibió, pasa a «Entregado».', async () => {
      await cambiarEstado(c.compradora, orden, 'delivered');
      await abrirCuenta(page, 'Mis Ventas');
      await c.esperarA(async () => (await textoDe(tarjeta(orden))).toLowerCase().includes('entregado'), 'la venta no dice «Entregado»');
    });
    await v.mirar(page);
    await v.afirma('Si no podés cumplir, «Rechazar» (en «Pagado») o «Cancelar Venta» (en «Confirmado») la cancelan, y las unidades vuelven a tu stock.', async () => {
      for (const [otra, boton] of [[pagadaARechazar, 'Rechazar'], [confirmadaACancelar, 'Cancelar Venta']]) {
        const stock = stockDe(c.insumo.id);
        await tarjeta(otra).getByRole('button', { name: boton, exact: true }).click();
        await v.mirar(page);
        await confirmarEnDialogo(page, 'Rechazar');
        await c.esperarA(async () => ['cancelled', 'rejected'].includes(estadoDe(otra)), `con «${boton}» la orden quedó en ${estadoDe(otra)}`);
        exigir(stockDe(c.insumo.id) === stock + 1, `con «${boton}» el stock pasó de ${stock} a ${stockDe(c.insumo.id)}`);
      }
    });
  },

  async documentacion(c, v) {
    const { page } = c.venta;
    await abrirCuenta(page, 'Mi Perfil');
    const seccion = page.locator('main [class*="_docSection_"]');
    await seccion.getByText('Sin presentar').waitFor({ timeout: 15_000 });
    await v.afirma('Presentarla es opcional. No hace falta para publicar, vender ni cobrar.', async () => {
      const vendidas = Number(queryRows(`SELECT count(*), 'fin' FROM orders WHERE seller_id = ${sqlLiteral(c.vendedora.user.id)}
        AND lower(status::text) IN ('paid', 'confirmed', 'shipped', 'delivered')`)[0][0]);
      exigir(vendidas > 0, 'sin documentación, la vendedora no llegó a vender');
    });
    await v.mirar(page);
    await seccion.getByRole('button', { name: 'Presentar documentación' }).click();
    await seccion.locator('#doc-cuit').waitFor();
    await v.inventario('«Documentación fiscal»', seccion);
    await seccion.locator('#doc-cuit').fill('30-71009999-1');
    await seccion.locator('#doc-razon-social').fill(`Vendedora Uso ${c.sello} SRL`);
    await seccion.locator('#doc-archivo').setInputFiles({ name: 'constancia.pdf', mimeType: 'application/pdf', buffer: PDF });
    await seccion.getByRole('button', { name: 'Enviar para revisión' }).click();
    await v.afirma('El estado pasa de «Sin presentar» a «Pendiente de revisión».', async () => {
      await seccion.getByText('Pendiente de revisión').waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('el estado no pasó a «Pendiente de revisión»'); });
    });
    await v.mirar(page);
    await v.afirma('Si la administración la aprueba, en tus publicaciones aparece «Documentación revisada».', async () => {
      const cola = await exigirApi(pedir('/admin/documentacion?estado=pendiente', { token: c.admin.access_token }), 'leer la cola');
      const suya = (cola.items || cola).find((d) => d.user_id === c.vendedora.user.id || d.email === c.vendedora.user.email
        || d.user?.id === c.vendedora.user.id);
      exigir(suya, 'la presentación no está en la cola de la administración');
      await exigirApi(pedir(`/admin/documentacion/${suya.id}/decidir`, { method: 'POST', token: c.admin.access_token,
        body: { decision: 'aprobada', presentado_el: suya.presentado_el } }), 'aprobar la documentación');
      await page.goto(`${WEB}/?section=product&id=${c.insumo.id}`, { waitUntil: 'domcontentloaded' });
      await page.getByText('Documentación revisada').waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('la publicación no muestra «Documentación revisada»'); });
      await v.mirar(page);
    });
  },

  // --- Parte 3. Quien transporta -----------------------------------------------

  async 'alta-transportista'(c, v) {
    c.transporte = await sesionEn(c, null);
    const { page } = c.transporte;
    const t = c.nuevoTransportista;
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await cabecera(page).getByRole('button', { name: 'Ingresar', exact: true }).click();
    await dialogo(page, 'Ingresar').getByRole('button', { name: 'Registrate acá' }).click();
    const alta = dialogo(page, 'Crear cuenta');
    await alta.getByLabel(/Nombre completo/).fill(t.nombre);
    await alta.getByLabel(/^Email/).fill(t.email);
    await alta.getByText('Quiero registrarme como transportista').click();
    const datos = alta.getByRole('group', { name: 'Datos de transportista' });
    await datos.waitFor();
    await v.mirar(page);
    await datos.locator('#registro-provincia').selectOption('06');
    await c.esperarA(async () => (await datos.locator('#registro-localidad option').count()) > 1, 'no cargaron las localidades');
    await datos.locator('#registro-localidad').selectOption(c.pergamino);
    await datos.locator('#registro-transporte').fill(t.transporte);
    await datos.locator('#registro-modelo').fill('Scania uso');
    await datos.locator('#registro-dominio').fill(t.dominio);
    await datos.getByText('Granos a granel').click();
    await datos.getByText('Declaro que el transporte está habilitado').click();
    await datos.locator('#registro-detalle').fill(t.habilitacion);
    await datos.locator('#registro-radio').fill('300');
    await datos.locator('#registro-capacidad').fill('Hasta 30 toneladas');
    await v.inventario('«Datos de transportista» en el alta', datos);
    await alta.locator('#registro-clave').fill(CLAVE);
    await alta.locator('#registro-clave-2').fill(CLAVE);
    await alta.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await alta.getByText('Te mandamos un correo a').waitFor({ timeout: 15_000 });
    await page.goto(enlaceDeConfirmacion(t.email), { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Correo confirmado' }).waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    const ingreso = dialogo(page, 'Ingresar');
    await ingreso.getByLabel(/^Email/).fill(t.email);
    await ingreso.getByLabel(/^Contraseña/).fill(CLAVE);
    await ingreso.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await ingreso.waitFor({ state: 'hidden', timeout: 15_000 });
    c.transportista = await entrar(t.email);
    await v.afirma('Al ingresar, «Mi cuenta» tiene la pestaña «Mis Operaciones».', async () => {
      await abrirCuenta(page, 'Mi Perfil');
      await page.getByRole('button', { name: /^Mis Operaciones/ }).waitFor({ timeout: 10_000 })
        .catch(() => { throw new Falla('no está la pestaña «Mis Operaciones»'); });
    });
    await v.mirar(page);
    await v.afirma('Tu cuenta sirve también para comprar y vender.', async () => {
      for (const pestana of ['Mis Compras', 'Mis Ventas', 'Mis publicaciones']) {
        exigir(await page.getByRole('button', { name: new RegExp(`^${pestana}`) }).first().isVisible(), `no está «${pestana}»`);
      }
      exigir(await cabecera(page).getByRole('button', { name: 'Vender', exact: true }).isVisible(), 'no puede publicar');
    });
  },

  async 'perfil-transportista'(c, v) {
    const { page } = c.transporte;
    const t = c.nuevoTransportista;
    await abrirCuenta(page, 'Mi Perfil');
    const perfil = page.locator('main [class*="_section_"]').filter({ has: page.getByRole('heading', { name: 'Mi Perfil', exact: true }) });
    await perfil.getByText('Datos de transportista').waitFor({ timeout: 15_000 });
    await v.mirar(page);
    await v.afirma('«Datos de transportista» muestra lo que declaraste', async () => {
      const texto = await textoDe(perfil);
      for (const dato of ['Pergamino', t.transporte, t.dominio, '300 km', 'Hasta 30 toneladas', 'Granos a granel', t.habilitacion]) {
        exigir(texto.includes(dato), `no muestra «${dato}»`);
      }
    });
    await v.afirma({
      paso: 'La declaración de habilitación queda con su fecha, y dice «AgroBoeda no verifica esta habilitación.».',
      limites: 'La habilitación de un transportista es una declaración suya.',
    }, async () => {
      const hoy = new Date().toLocaleDateString('es-AR');
      exigir((await textoDe(perfil)).includes(`Declarado el ${hoy}. AgroBoeda no verifica esta habilitación.`),
        'no dice la fecha de la declaración y que no se verifica');
    });
    await v.afirma('El dominio es privado: no aparece en el listado de transportistas.', async () => {
      await exigirApi(pedir('/cart/sync', { method: 'POST', token: c.compradora.access_token,
        body: { items: [{ product_id: c.insumo.id, quantity: 1 }] } }), 'armar el carrito');
      const listado = await exigirApi(pedir(`/logistics/compatible-carriers?destination_locality_id=${c.pergamino}`,
        { token: c.compradora.access_token }), 'pedir el listado');
      const texto = JSON.stringify(listado);
      exigir(texto.includes(t.nombre), 'el escenario no sirve: el transportista no está en el listado');
      exigir(!texto.includes(t.dominio), 'el listado trae el dominio');
    });
    await perfil.getByRole('button', { name: 'Editar', exact: true }).click();
    await perfil.getByLabel('Radio de cobertura (km)').waitFor();
    await v.inventario('«Datos de transportista» al editar', perfil, null, {
      desde: '[class*="_carrierHeading_"]', fuera: ['Mercado Pago — dónde cobrás', 'Documentación fiscal'] });
    await v.afirma('Con «Editar» cambiás cualquiera de esos datos, igual que en el alta, y «Guardar» los guarda.', async () => {
      await perfil.getByLabel('Radio de cobertura (km)').fill('280');
      await perfil.getByRole('button', { name: 'Guardar', exact: true }).click();
      await c.esperarA(async () => Number(queryRows(`SELECT carrier_coverage_radius_km, 'fin' FROM users
        WHERE id = ${sqlLiteral(c.transportista.user.id)}`)[0][0]) === 280, 'el radio nuevo no quedó guardado');
    });
    await v.mirar(page);
  },

  async operaciones(c, v) {
    const { page } = c.transporte;
    const t = c.nuevoTransportista;
    await v.afirma('Mientras no te elijan, dice «Todavía no te eligieron para ningún viaje».', async () => {
      await abrirCuenta(page, 'Mis Operaciones');
      await page.getByText('Todavía no te eligieron para ningún viaje').waitFor({ timeout: 15_000 })
        .catch(() => { throw new Falla('sin viajes, no lo dice'); });
    });
    await v.mirar(page);
    await v.afirma('No hay un directorio público de transportistas.', async () => {
      const r = await pedir(`/logistics/compatible-carriers?destination_locality_id=${c.pergamino}`);
      exigir(r.status === 401 || r.status === 403, `sin sesión, el listado responde HTTP ${r.status}`);
    });
    // Quien compra, con una publicación de Pergamino y destino Pergamino.
    const compra = c.compra.page;
    await compra.goto(`${WEB}/?section=product&id=${c.insumo.id}`, { waitUntil: 'domcontentloaded' });
    await compra.locator('main [class*="_acciones_"]').getByRole('button').first().click();
    await cabecera(compra).getByRole('button', { name: /^Carrito/ }).click();
    await dialogo(compra, 'Mi carrito').getByRole('button', { name: 'Continuar compra' }).click();
    const checkout = dialogo(compra, 'Checkout');
    await checkout.getByPlaceholder('Juan Pérez').fill(c.nuevaCompradora.nombre);
    await checkout.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 2477 000000');
    await checkout.locator('#checkout-provincia').selectOption('06');
    await c.esperarA(async () => (await checkout.locator('#checkout-localidad option').count()) > 1, 'no cargaron las localidades');
    await checkout.locator('#checkout-localidad').selectOption(c.pergamino);
    await checkout.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 223');
    await checkout.getByPlaceholder('2000').fill('2700');
    const grupo = checkout.locator('[class*="_fleteGrupo_"]').first();
    await grupo.getByText('Necesito flete', { exact: true }).click();
    await grupo.locator('[class*="_fleteLista_"]').waitFor({ timeout: 15_000 });
    await v.mirar(compra);
    const candidato = grupo.locator('[class*="_fleteTarjeta_"]').filter({ hasText: t.nombre });
    await v.afirma('Aparecés en la compra de otra persona, en «Necesito flete», cuando tu localidad base está dentro de tu radio de cobertura tanto del origen como del destino del viaje.', async () => {
      await candidato.waitFor({ timeout: 15_000 }).catch(() => { throw new Falla('el transportista no aparece para un viaje que cubre'); });
      exigir(transportistasQueCubren(c.pergamino, [c.pergamino]).includes(t.nombre), 'el escenario no sirve: no cubre el viaje');
    });
    await v.afirma(['Quien compra ve tu nombre, tu base y tu radio, tu transporte y tu declaración.', 'No ve tu dominio hasta que te elige.'], async () => {
      const texto = await textoDe(candidato);
      for (const dato of ['Pergamino', 'radio declarado 280 km', t.transporte, t.habilitacion]) exigir(texto.includes(dato), `no ve «${dato}»`);
      exigir(!texto.includes(t.dominio), 've el dominio antes de elegirlo');
      await candidato.getByRole('button', { name: `Seleccionar a ${t.nombre}` }).click();
      await grupo.getByText('Transportista elegido').waitFor({ timeout: 15_000 });
      exigir((await textoDe(grupo)).includes(`Dominio: ${t.dominio}`), 'después de elegirlo no ve el dominio');
    });
    await checkout.getByRole('button', { name: 'Continuar al pago' }).click();
    await checkout.getByText('Medio de pago').waitFor({ timeout: 15_000 });
    await checkout.locator('label[class*="_paymentOption_"]').filter({ hasText: 'Transferencia bancaria' }).first().click();
    await checkout.getByRole('button', { name: 'Confirmar y crear las órdenes' }).click();
    await checkout.getByRole('heading', { name: 'Tus órdenes' }).waitFor({ timeout: 20_000 });
    const numero = ((await textoDe(checkout)).match(/Referencia de pago:\s*(\S+)/) || [])[1];
    await checkout.getByRole('button', { name: 'Finalizar' }).click();
    await v.afirma('Cuando te elige y crea la orden, la operación aparece en «Mis Operaciones», con el «Recorrido»: dónde se retira y dónde se entrega.', async () => {
      await abrirCuenta(page, 'Mis Operaciones');
      const operacion = page.locator('[class*="_orderCard_"]').filter({ hasText: numero });
      await operacion.waitFor({ timeout: 15_000 }).catch(() => { throw new Falla(`la operación ${numero} no aparece`); });
      exigir((await textoDe(operacion)).includes('Retiro en Pergamino, Buenos Aires — entrega en Pergamino, Buenos Aires'),
        'no dice dónde se retira y dónde se entrega');
    });
    await v.mirar(page);
    await v.inventario('«Mis Operaciones»', page.locator('main [class*="_section_"]').first());
  },
};

// --- La corrida --------------------------------------------------------------

async function prepararLaCorrida(browser, ancho) {
  const viewport = ANCHOS[ancho];
  const sello = `${ancho[0]}${Date.now().toString(36).slice(-5)}`;
  const admin = await entrar(ADMIN.email, ADMIN.password);
  const crear = async (nombre) => {
    const email = `guia.uso.${nombre.toLowerCase()}.${sello}@example.com`;
    await exigirApi(pedir('/admin/users', {
      method: 'POST', token: admin.access_token,
      body: { email, password: CLAVE, full_name: `${nombre} Uso ${sello}`, phone: '', role: 'user' },
    }), `crear la cuenta ${email}`);
    return entrar(email);
  };
  const vendedora = await crear('Vendedora');
  const alias = `guia.uso.${sello}`;
  await exigirApi(pedir('/auth/me', {
    method: 'PATCH', token: vendedora.access_token,
    body: { alias_bancario: alias, cbu: '0000003100000000000001' },
  }), 'cargar los datos bancarios de la vendedora');
  const categorias = (await pedir('/catalog/categories')).data;
  const maquinaria = categorias.find((cat) => cat.name === 'Maquinaria agrícola');
  const insumos = categorias.find((cat) => cat.name === 'Insumos agrícolas');
  const tractores = maquinaria.subcategories.find((s) => s.name === 'Tractores');
  const cosecha = maquinaria.subcategories.find((s) => s.name === 'Cosecha');
  const localidades = (await pedir('/catalog/localities?province_id=06')).data;
  const pergamino = localidades.find((l) => l.name === 'Pergamino').id;
  const publicar = async (sesion, datos) => ({
    ...(await exigirApi(pedir('/products', {
      method: 'POST', token: sesion.access_token,
      body: {
        description: 'Publicación de la guía de uso.', price: 1000, stock: 50, unit: 'kg',
        locality_id: pergamino, publication_type: 'producto', operation_kind: 'insumo',
        category_id: insumos.id, ...datos,
      },
    }), `publicar «${datos.name}»`)),
    seller_id: sesion.user.id,
  });
  const insumo = await publicar(vendedora, { name: `Semilla uso ${sello}` });
  const modelo = `UZ${Date.now().toString().slice(-6)}`;
  const tractor = await publicar(vendedora, {
    name: `Tractor uso ${sello}`, description: 'Tractor de la guía de uso, con todos sus datos declarados.',
    category_id: maquinaria.id, subcategory_id: tractores.id, operation_kind: 'activo', unit: 'unidad',
    price: 45_000_000, stock: 1, condition: 'usado', brand: 'john-deere', model: modelo, year: 2016,
    origin: 'dueno_directo', power_hp: 140,
  });
  const palabraDeLaDescripcion = `QD${Date.now().toString().slice(-7)}`;
  const tractorSinAnio = await publicar(vendedora, {
    name: `Tractor sin año uso ${sello}`,
    description: `Tractor de la guía de uso que no declara el año. Palabra ${palabraDeLaDescripcion}.`,
    category_id: maquinaria.id, subcategory_id: tractores.id, operation_kind: 'activo', unit: 'unidad',
    price: 38_000_000, stock: 1, condition: 'usado', brand: 'john-deere', power_hp: 140,
  });
  const cosechadora = await publicar(vendedora, {
    name: `Cosechadora uso ${sello}`, description: 'Cosechadora de la guía de uso.',
    category_id: maquinaria.id, subcategory_id: cosecha.id, subcategory_type: cosecha.tipos[0].value,
    operation_kind: 'activo', unit: 'unidad', price: 90_000_000, stock: 1, condition: 'nuevo',
    origin: 'concesionaria',
  });
  // Una publicación sin stock: se vende su única unidad antes de empezar.
  const agotable = await publicar(vendedora, { name: `Semilla agotada uso ${sello}`, stock: 1 });
  const otra = await crear('Otra');
  const previa = await comprarPorApi({ pergamino }, otra, agotable);
  await subirComprobante(otra, previa.id);
  await decidirComprobante(vendedora, previa, 'approve');
  // Lo que ya está en la base demo: un servicio con precio, uno sin precio y
  // un insumo de otro vendedor, con sus datos bancarios.
  const deLaBase = (condicion) => {
    const fila = queryRows(`SELECT p.id, p.name, p.seller_id FROM products p JOIN users u ON u.id = p.seller_id
      WHERE p.status = 'ACTIVE' AND ${condicion} ORDER BY p.created_at LIMIT 1`)[0];
    if (!fila) throw new Error(`la base demo no tiene ${condicion}`);
    return { id: fila[0], name: fila[1], seller_id: fila[2] };
  };
  const servicioConPrecio = deLaBase("p.operation_kind = 'servicio' AND p.price > 0");
  const servicioSinPrecio = deLaBase('coalesce(p.price, 0) = 0');
  const deOtroVendedor = deLaBase("u.email = 'vendedor@ejemplo.com' AND p.operation_kind = 'insumo' AND p.price > 0 AND p.stock > 20");
  const contexto = await browser.newContext({ viewport });
  contexto.setDefaultTimeout(10_000);
  return {
    browser, viewport, ancho, sello, admin, vendedora, alias, pergamino, maquinaria, insumos, tractores, cosecha,
    insumo, tractor, tractorSinAnio, cosechadora, modelo, publicar, crear, palabraDeLaDescripcion, agotable,
    servicioConPrecio, servicioSinPrecio, deOtroVendedor,
    nuevaCompradora: { email: `guia.uso.compradora.${sello}@example.com`, nombre: `Compradora Uso ${sello}` },
    nuevoTransportista: {
      email: `guia.uso.transportista.${sello}@example.com`, nombre: `Transportista Uso ${sello}`,
      transporte: `Camión con acoplado uso ${sello}`, dominio: `GU ${Date.now().toString().slice(-3)} IA`,
      habilitacion: `RUTA de la guía de uso ${sello}`,
    },
    esperarA: async (condicion, mensaje, limite = 15_000) => {
      const hasta = Date.now() + limite;
      while (Date.now() < hasta) {
        if (await condicion()) return;
        await new Promise((listo) => { setTimeout(listo, 250); });
      }
      throw new Falla(mensaje);
    },
    contextos: [contexto],
  };
}

async function main() {
  const guia = leerLaGuia(RUTA_DE_LA_GUIA);
  const fallas = [];
  const ids = guia.pasos.map((p) => p.id);
  for (const id of ids) {
    if (!RECORRIDOS[id]) fallas.push(`la guía tiene el paso «${id}» y no hay un recorrido que lo haga`);
  }
  for (const id of Object.keys(RECORRIDOS)) {
    if (!ids.includes(id)) fallas.push(`el recorrido «${id}» no está en la guía: un paso sin describir`);
  }
  const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (repetidos.length) fallas.push(`recorridos repetidos en la guía: ${repetidos.join(', ')}`);
  for (const falla of fallas) console.log(`[FALLA] ${falla}`);
  console.log(`Guía: ${RUTA_DE_LA_GUIA.replace(`${RAIZ}/`, '')}, ${guia.pasos.length} pasos, `
    + `${guia.pasos.reduce((s, p) => s + p.citas.length, 0)} textos citados, `
    + `${guia.sinComprobar?.length ?? 0} frases declaradas sin comprobar`);

  if (!guia.sinComprobar?.length) {
    fallas.push('la guía no tiene la lista «Lo que el programa no comprueba», o la lista no cita ninguna frase');
    console.log(`[FALLA] ${fallas.at(-1)}`);
  }
  for (const { frase, lugar } of guia.sinComprobar || []) {
    if (lugar && dice(lugar.texto, frase)) continue;
    const falla = lugar
      ? `${lugar.nombre}: la lista de lo que no se comprueba cita “${frase}” y ahí ya no lo dice`
      : `la lista de lo que no se comprueba cita “${frase}” sin decir dónde está`;
    fallas.push(falla);
    console.log(`[FALLA] ${falla}`);
  }

  const browser = await chromium.launch({ headless: true });
  const todoLoVisto = [];
  try {
    for (const ancho of ANCHOS_PEDIDOS) {
      if (!ANCHOS[ancho]) throw new Error(`ancho desconocido: ${ancho}`);
      console.log(`\n== ${ancho} ${ANCHOS[ancho].width}×${ANCHOS[ancho].height} ==`);
      const c = await prepararLaCorrida(browser, ancho);
      for (const paso of guia.pasos) {
        if (paso.numero > HASTA) break;
        const nombre = `Paso ${paso.numero}. ${paso.titulo}`;
        const recorrido = RECORRIDOS[paso.id];
        if (!recorrido) continue;
        const v = new Vista(ancho, guia, paso);
        const motivos = [];
        try {
          await recorrido(c, v);
          const faltan = paso.citas.filter((cita) => !cita.ancho || cita.ancho === ancho)
            .map((cita) => cita.texto).filter((cita) => !aparece(cita, v.vistos));
          if (faltan.length) motivos.push(`la guía nombra ${faltan.map((f) => `«${f}»`).join(', ')} `
            + 'y el sitio no lo mostró en este paso');
        } catch (error) {
          motivos.push(error instanceof Falla ? error.message : porQueNoSePudo(error));
          if (process.env.GUIA_DEPURAR) {
            console.error(error);
            for (const [quien, sesion] of Object.entries({ compra: c.compra, venta: c.venta, transporte: c.transporte })) {
              for (const pagina of sesion?.contexto.pages() || []) {
                await pagina.screenshot({ path: join(process.env.GUIA_DEPURAR, `${ancho}-${paso.numero}-${quien}.png`), fullPage: true })
                  .catch(() => {});
              }
            }
          }
        }
        motivos.unshift(...v.sinFrase);
        motivos.push(...v.huecos);
        if (motivos.length) {
          fallas.push(`${ancho}, ${nombre}: ${motivos.join('; ')}`);
          console.log(`[FALLA] ${nombre}: ${motivos.join('; ')}`);
        } else {
          console.log(`[OK] ${nombre} (${v.atadas} frases de resultado)`);
        }
        todoLoVisto.push(...v.vistos);
      }
      for (const sesion of [c.compra, c.venta, c.transporte]) await sesion?.contexto.close().catch(() => {});
      for (const contexto of c.contextos) await contexto.close().catch(() => {});
    }
    if (HASTA === Infinity) {
      const sueltas = guia.citasDeAfuera.filter((cita) => !aparece(cita, todoLoVisto));
      for (const cita of sueltas) fallas.push(`fuera de los pasos, la guía nombra «${cita}» y ningún paso lo mostró`);
    }
  } finally {
    await browser.close();
  }

  console.log('\n-------------------');
  if (fallas.length) {
    console.log(`LA GUÍA Y EL SITIO NO COINCIDEN: ${fallas.length}`);
    for (const falla of fallas) console.log(`  - ${falla}`);
    return 1;
  }
  console.log(`LA GUÍA Y EL SITIO COINCIDEN: ${guia.pasos.length} pasos en ${ANCHOS_PEDIDOS.join(' y ')}`);
  return 0;
}

main().then((codigo) => process.exit(codigo)).catch((error) => {
  console.error(`no se pudo correr: ${error.stack || error.message}`);
  process.exit(2);
});
