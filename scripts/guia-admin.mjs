#!/usr/bin/env node
/**
 * Recorre la guía del panel de administración en el navegador y comprueba que
 * dice la verdad.
 *
 *   node scripts/guia-admin.mjs                     escritorio y celular
 *   node scripts/guia-admin.mjs --anchos escritorio sólo uno
 *   node scripts/guia-admin.mjs --capturas          además rehace las imágenes
 *   node scripts/guia-admin.mjs --guia <ruta>       otra copia de la guía
 *
 * La guía es `docs/GUIA-PANEL-ADMIN.md`. Cada paso lleva un comentario
 * `<!-- recorrido: id -->`, y acá hay un recorrido con ese id que hace lo que
 * el paso dice. Se comprueban tres cosas:
 *
 *   1. Cada texto entre «» del paso aparece en la pantalla durante su
 *      recorrido. «…» dentro de una cita vale por cualquier texto.
 *   2. Lo que el paso dice que pasa después, pasa. Cada comprobación va
 *      dentro de `v.afirma(frase, …)`, con la frase de la guía que describe
 *      lo que comprueba: quién puede entrar, qué se ve en el Mercado, qué ve
 *      quien vende. Si la guía ya no dice esa frase en ese lugar, el paso
 *      falla aunque la comprobación pase.
 *   3. Nada del panel queda sin nombrar. Los controles que se ven en cada
 *      pestaña tienen que estar citados en su sección de la guía.
 *
 * Lo que no se puede comprobar está listado al final de la guía, en «Lo que
 * el programa no comprueba», con cada frase entre “ ”. Antes de abrir el
 * navegador se mira que cada una siga escrita donde dice la lista.
 *
 * Si algo no coincide, falla y nombra el paso. Salida: 0 si la guía y el
 * panel coinciden; 1 si algún paso no coincide; 2 si no se pudo correr.
 *
 * Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra
 * demo. Crea sus propias cuentas, publicaciones, una categoría y una opción,
 * todas con un sello en el nombre; lo que la guía elimina, se elimina.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryRows } from './lib/sql.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.SMOKE_API_URL || 'http://localhost:8000/api';
const WEB = process.env.SMOKE_FRONTEND_URL || 'http://localhost:5173';
const CARPETA_DE_CAPTURAS = join(RAIZ, 'docs/guia-panel-admin');
const ANCHOS = {
  escritorio: { width: 1440, height: 900 },
  celular: { width: 390, height: 844 },
};
const ADMIN = { email: 'admin@topgreen.com', password: 'admin123' };

const argumentos = process.argv.slice(2);
const opcion = (nombre) => {
  const i = argumentos.indexOf(nombre);
  return i >= 0 ? argumentos[i + 1] : undefined;
};
const RUTA_DE_LA_GUIA = resolve(opcion('--guia') || join(RAIZ, 'docs/GUIA-PANEL-ADMIN.md'));
const CAPTURAS = argumentos.includes('--capturas');
const ANCHOS_PEDIDOS = (opcion('--anchos') || 'escritorio,celular').split(',');

// --- La guía -----------------------------------------------------------------

const normalizar = (texto) => texto.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
const citasDe = (texto) => [...texto.matchAll(/«([^»]+)»/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
// Una frase se busca como se lee: sin negritas ni código, y sin que importen
// los cortes de línea ni las mayúsculas.
const limpio = (texto) => normalizar(texto.replace(/\*\*|`/g, ''));
const dice = (region, frase) => limpio(region).includes(limpio(frase));
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function leerLaGuia(ruta) {
  const texto = readFileSync(ruta, 'utf8');
  // Las secciones `## …`. Las numeradas, `## N. Título`, agrupan los pasos de
  // una pestaña; las otras son el principio y el final de la guía.
  const secciones = [];
  for (const m of texto.matchAll(/^## (?:(\d+)\. )?(.+)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)) {
    secciones.push({ numerada: Boolean(m[1]), titulo: m[2].trim(), texto: m[3], citas: citasDe(m[3]).map(normalizar) });
  }
  const pasos = [];
  const patron = /^### Paso (\d+)\. (.+)\n<!-- recorrido: ([\w-]+) -->\n([\s\S]*?)(?=^### |^## |^---\s*$|(?![\s\S]))/gm;
  for (const m of texto.matchAll(patron)) {
    pasos.push({
      numero: Number(m[1]), titulo: m[2].trim(), id: m[3], bloque: m[0], texto: m[4], citas: citasDe(m[4]),
      seccion: secciones.find((s) => s.texto.includes(m[0])),
    });
  }
  let resto = texto;
  for (const paso of pasos) resto = resto.replace(paso.bloque, '');
  const imagenes = [...texto.matchAll(/\]\((guia-panel-admin\/([\w-]+)-(escritorio|celular)\.png)\)/g)]
    .map((m) => ({ ruta: m[1], nombre: m[2], ancho: m[3] }));
  return {
    pasos, citasDeAfuera: citasDe(resto), secciones, imagenes,
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
  const patron = new RegExp(`(${[...lugares.keys()].map(escapar).join('|')}):|“([^”]+)”`, 'g');
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
  const patron = new RegExp(partes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]*?'));
  return vistos.some((visto) => patron.test(visto));
};

// Lo que una persona ve: el texto, lo que dicen los campos vacíos, las
// opciones de los selectores y lo que aparece al pasar el puntero.
const TEXTOS_VISIBLES = () => {
  const partes = [document.body.innerText];
  for (const el of document.querySelectorAll('[placeholder], [title], option')) {
    const visible = el.tagName === 'OPTION'
      ? (el.parentElement?.getClientRects().length ?? 0) > 0
      : el.getClientRects().length > 0;
    if (!visible) continue;
    if (el.tagName === 'OPTION') partes.push(el.textContent || '');
    for (const atributo of ['placeholder', 'title']) {
      const valor = el.getAttribute(atributo);
      if (valor) partes.push(valor);
    }
  }
  return partes.join('\n');
};

// --- Lo que se mira en un paso -----------------------------------------------

class Vista {
  constructor(ancho, guia, paso) {
    this.ancho = ancho;
    this.imagenes = guia.imagenes;
    this.guia = guia;
    this.paso = paso;
    this.vistos = [];
    this.producidas = new Set();
    this.atadas = 0;
    this.sinFrase = [];
  }

  // Una comprobación atada a la frase de la guía que describe lo que
  // comprueba. La frase va sola, y entonces es del paso, o por lugar:
  // `{ paso, seccion, limites }`, donde `seccion` es la sección del paso y
  // `limites` es «Antes de empezar»; cada uno, una frase o varias. Si la guía
  // ya no dice una de esas frases en su lugar, el paso falla aunque la
  // comprobación pase. Si la comprobación falla, la falla cita la frase.
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

  // La captura se toma si la guía la muestra. `ocultar` tapa lo que no tiene
  // que quedar en una imagen, como una contraseña.
  async captura(nombre, page, ocultar = []) {
    await this.mirar(page);
    const referida = this.imagenes.some((i) => i.nombre === nombre && i.ancho === this.ancho);
    if (!referida) return;
    this.producidas.add(`${nombre}-${this.ancho}`);
    if (!CAPTURAS) return;
    mkdirSync(CARPETA_DE_CAPTURAS, { recursive: true });
    await page.waitForTimeout(300);
    // Los avisos de pasos anteriores no son parte de lo que se muestra: se
    // ocultan sólo en la imagen, sin tocar la aplicación.
    await page.screenshot({
      path: join(CARPETA_DE_CAPTURAS, `${nombre}-${this.ancho}.png`),
      mask: ocultar,
      animations: 'disabled',
      style: '[class*="_toastContainer_"] { visibility: hidden !important; }',
    });
  }
}

class Falla extends Error {}
const exigir = (condicion, mensaje) => { if (!condicion) throw new Falla(mensaje); };

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

async function entrar(email, password) {
  const r = await pedir('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`no se pudo entrar como ${email}: HTTP ${r.status}`);
  return r.data;
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n% guia del panel\ntrailer<</Root 1 0 R>>\n%%EOF\n');

async function presentarDocumentacion(token, cuit, razonSocial) {
  const form = new FormData();
  form.append('cuit', cuit);
  form.append('razon_social', razonSocial);
  form.append('archivo', new Blob([PDF], { type: 'application/pdf' }), 'constancia.pdf');
  const r = await pedir('/documentacion', { method: 'POST', token, form });
  if (r.status !== 201) throw new Error(`no se pudo presentar documentación: HTTP ${r.status}`);
}

// --- El navegador ------------------------------------------------------------

const esperarTexto = (page, texto, timeout = 15_000) =>
  page.getByText(texto, { exact: false }).first().waitFor({ state: 'visible', timeout });

async function contextoCon(browser, viewport, sesion) {
  const contexto = await browser.newContext({ viewport });
  if (sesion) {
    await contexto.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: sesion.access_token, r: sesion.refresh_token });
  }
  return contexto;
}

const elPanel = (page) => page.getByRole('dialog', { name: 'Administración' });

async function abrirElPanel(page) {
  if (await elPanel(page).isVisible().catch(() => false)) return elPanel(page);
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.getByRole('heading', { name: 'Panel de Administración' }).waitFor({ timeout: 15_000 });
  return elPanel(page);
}

async function pestana(page, nombre) {
  const panel = await abrirElPanel(page);
  await panel.getByRole('button', { name: nombre, exact: true }).click();
  return panel;
}

async function confirmar(page, titulo, boton, vista) {
  const capa = page.getByRole('dialog', { name: titulo });
  await capa.waitFor({ state: 'visible', timeout: 10_000 });
  if (vista) await vista.mirar(page);
  await capa.getByRole('button', { name: boton, exact: true }).click();
  await capa.waitFor({ state: 'hidden', timeout: 15_000 });
}

// «Mis publicaciones» de quien vende, en otra sesión.
async function misPublicaciones(browser, viewport, sesion, vista) {
  const contexto = await contextoCon(browser, viewport, sesion);
  const page = await contexto.newPage();
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
  await page.getByRole('button', { name: /Mis publicaciones/i }).first().click();
  await page.getByRole('heading', { name: 'Mis publicaciones' }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await vista.mirar(page);
  return { page, contexto };
}

const enElMercado = async (nombre) => {
  const r = await pedir(`/catalog/products?search=${encodeURIComponent(nombre)}`);
  return (r.data?.items || []).some((p) => p.name === nombre);
};
const suEnlaceAbre = async (id) => (await pedir(`/catalog/products/${id}`)).status === 200;
const contar = (sql) => Number(queryRows(sql)[0][0]);
const totalQueDice = async (panel) => Number(((await panel.innerText()).match(/Total: (\d+)/) || [])[1]);

// Los correos que recibió una dirección, en el outbox de desarrollo. Se lee
// sólo el encabezado `To:`, no el cuerpo.
const CARPETA_OUTBOX = join(RAIZ, 'backend/outbox');
function correosPara(email) {
  if (!existsSync(CARPETA_OUTBOX)) {
    throw new Falla('no existe backend/outbox: con otro transporte de correo esto no se puede mirar');
  }
  const para = new RegExp(`^To: ${escapar(email)}\\s*$`, 'mi');
  return readdirSync(CARPETA_OUTBOX).filter((nombre) => nombre.endsWith('.eml'))
    .filter((nombre) => para.test(readFileSync(join(CARPETA_OUTBOX, nombre), 'utf8').split(/\r?\n\r?\n/)[0]))
    .length;
}

// --- Los recorridos ----------------------------------------------------------
//
// Uno por paso de la guía, con el mismo id. Reciben el estado de la corrida
// (`c`) y la vista del paso (`v`), y lanzan `Falla` con lo que no coincide.

const RECORRIDOS = {
  async entrar(c, v) {
    const { page } = c;
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await v.mirar(page);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15_000 });
    await page.getByPlaceholder('tu@email.com').fill(ADMIN.email);
    await page.getByPlaceholder('••••••••').fill(ADMIN.password);
    await page.locator('[class*="_submitButton_"][type="submit"]').click();
    await page.getByRole('button', { name: 'Admin', exact: true }).waitFor({ timeout: 15_000 });
    await v.mirar(page);
    const panel = await abrirElPanel(page);
    await v.captura('entrar', page);
    const pestanas = panel.locator('[class*="_tabs_"] button');
    await v.afirma('con siete pestañas', async () => {
      const cuantas = await pestanas.count();
      exigir(cuantas === 7, `el panel tiene ${cuantas} pestañas`);
    });
    await v.afirma('En el celular es igual: las siete pestañas entran en la pantalla.', async () => {
      const fuera = await pestanas.evaluateAll((botones, ancho) => botones
        .filter((b) => b.getBoundingClientRect().left < 0 || b.getBoundingClientRect().right > ancho + 0.5)
        .map((b) => b.textContent.trim()), c.viewport.width);
      exigir(fuera.length === 0, `con ${c.viewport.width} px de ancho quedan fuera de la pantalla: ${fuera.join(', ')}`);
    });
    await v.afirma('o apretá la tecla Escape', async () => {
      await page.keyboard.press('Escape');
      await elPanel(page).waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {
        throw new Falla('Escape no cerró el panel');
      });
    });
    await abrirElPanel(page);
    await v.afirma('tocá la cruz «×»', async () => {
      await elPanel(page).getByRole('button', { name: 'Cerrar' }).first().click();
      await elPanel(page).waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {
        throw new Falla('la cruz «×» no cerró el panel');
      });
    });
    await v.afirma('El botón «Admin» sólo aparece para cuentas de administración.', async () => {
      const otro = await contextoCon(c.browser, c.viewport, c.vendedora);
      const suya = await otro.newPage();
      await suya.goto(WEB, { waitUntil: 'domcontentloaded' });
      await suya.getByRole('button', { name: 'Mi cuenta' }).first().waitFor({ timeout: 15_000 });
      const loVe = await suya.getByRole('button', { name: 'Admin', exact: true }).count() > 0;
      await otro.close();
      exigir(!loVe, 'una cuenta que no es de administración ve el botón «Admin»');
    });
  },

  async resumen(c, v) {
    const { page } = c;
    let panel;
    await v.afirma('La pestaña «Dashboard» es la que se abre primero.', async () => {
      if (await elPanel(page).isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        await elPanel(page).waitFor({ state: 'hidden', timeout: 10_000 });
      }
      panel = await abrirElPanel(page);
      await panel.getByText('Total de usuarios').waitFor({ timeout: 15_000 }).catch(() => {
        throw new Falla('al abrir el panel no se ve el resumen');
      });
    });
    await v.captura('resumen', page);
    await v.afirma('Muestra ocho números', async () => {
      const cuantos = await panel.locator('[class*="statCard"]').count();
      exigir(cuantos === 8, `muestra ${cuantos}`);
    });
    const valorDe = async (rotulo) => {
      const tarjeta = panel.locator('[class*="statCard"]').filter({ hasText: rotulo });
      return (await tarjeta.locator('[class*="statValue"]').innerText()).trim();
    };
    // Cada número, con lo que la guía dice que cuenta y la misma cuenta en SQL.
    const NUMEROS = [
      ['Total de usuarios', 'todas las cuentas, activas o no', 'SELECT count(*) FROM users'],
      ['Usuarios comunes', 'las cuentas que no son de administración', "SELECT count(*) FROM users WHERE role = 'USER'"],
      ['Administradores', 'las cuentas de administración.', "SELECT count(*) FROM users WHERE role = 'ADMIN'"],
      ['Productos Activos', 'las publicaciones que hoy se ven en el Mercado',
        "SELECT count(*) FROM products WHERE status = 'ACTIVE'"],
      ['Órdenes Totales', 'todas las órdenes, en cualquier estado', 'SELECT count(*) FROM orders'],
      ['Órdenes en proceso',
        'las que están pedidas, confirmadas, esperando o revisando un comprobante, pagadas o enviadas',
        `SELECT count(*) FROM orders WHERE status IN
          ('PLACED','CONFIRMED','AWAITING_TRANSFER_RECEIPT','TRANSFER_RECEIPT_SUBMITTED','PAID','SHIPPED')`],
      ['Completadas', 'las entregadas', "SELECT count(*) FROM orders WHERE status = 'DELIVERED'"],
    ];
    for (const [rotulo, frase, sql] of NUMEROS) {
      await v.afirma(frase, async () => {
        const visto = Number(await valorDe(rotulo));
        const cantidad = contar(sql);
        exigir(visto === cantidad, `«${rotulo}» dice ${visto} y en la base son ${cantidad}`);
      });
    }
    await v.afirma('la suma de las órdenes pagadas, enviadas o entregadas', async () => {
      const volumen = Number(queryRows(`SELECT COALESCE(round(sum(total_amount)), 0) FROM orders
        WHERE status IN ('PAID','SHIPPED','DELIVERED')`)[0][0]);
      const vistoVolumen = Number((await valorDe('Volumen vendido')).replace(/[^\d]/g, ''));
      exigir(vistoVolumen === volumen,
        `«Volumen vendido» dice ${vistoVolumen} y la suma de las pagadas, enviadas y entregadas es ${volumen}`);
    });
  },

  async 'usuarios-buscar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Usuarios');
    await panel.locator('tbody tr').first().waitFor({ timeout: 15_000 });
    await v.mirar(page);
    // La imagen, con las cuentas de la base de prueba.
    await panel.getByPlaceholder('Buscar por nombre o email').fill('ejemplo.com');
    await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    await c.esperarA(async () => (await panel.locator('tbody tr').allInnerTexts())
      .every((fila) => fila.includes('ejemplo.com')), 'buscar «ejemplo.com» dejó otras cuentas');
    await v.captura('usuarios', page);
    const buscar = async (texto) => {
      await panel.getByPlaceholder('Buscar por nombre o email').fill(texto);
      await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    };
    await v.afirma('Si ninguna cuenta coincide, dice', async () => {
      await buscar(`nadie-${Date.now()}`);
      await esperarTexto(page, 'No hay usuarios que coincidan con el filtro.');
      exigir(await panel.locator('tbody tr').count() === 0, 'sin coincidencias, la tabla muestra filas');
    });
    await v.mirar(page);
    await v.afirma('escribí parte del nombre o del correo', async () => {
      // Con el correo entero, y con una parte del nombre: queda sólo esa cuenta.
      for (const texto of [c.vendedora.user.email, c.vendedora.user.full_name.slice(0, -2)]) {
        await buscar(texto);
        await c.esperarA(async () => (await panel.locator('tbody tr').count()) === 1
          && (await panel.locator('tbody tr').first().innerText()).includes(c.vendedora.user.email),
        `buscar «${texto}» no dejó sólo esa cuenta`);
      }
    });
    await v.mirar(page);
    await buscar('');
    await v.afirma('por rol: «Todos los roles», «Administradores» o «Usuarios»', async () => {
      await panel.getByLabel('Filtrar usuarios por rol').selectOption('admin');
      await c.esperarA(async () => {
        const roles = await panel.getByLabel('Rol del usuario').evaluateAll((s) => s.map((e) => e.value));
        return roles.length > 0 && roles.every((rol) => rol === 'admin');
      }, 'filtrar «Administradores» dejó cuentas que no son de administración');
    });
    await v.mirar(page);
    await panel.getByLabel('Filtrar usuarios por rol').selectOption('');
    await v.afirma('por estado: «Activos e inactivos», «Solo activos» o «Solo inactivos»', async () => {
      await panel.getByLabel('Filtrar usuarios por estado').selectOption('true');
      await c.esperarA(async () => {
        const filas = await panel.locator('tbody tr').allInnerTexts();
        return filas.length > 0 && filas.every((fila) => /\bActivo\b/.test(fila));
      }, 'filtrar «Solo activos» dejó cuentas inactivas');
      await panel.getByLabel('Filtrar usuarios por estado').selectOption('false');
      await page.waitForTimeout(800);
      const filas = await panel.locator('tbody tr').allInnerTexts();
      exigir(filas.every((fila) => /Inactivo/.test(fila)), 'filtrar «Solo inactivos» dejó cuentas activas');
    });
    await v.mirar(page);
    // Sin filtros, la primera página de todas las cuentas.
    const [pedido] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/api/admin/users?')),
      panel.getByLabel('Filtrar usuarios por estado').selectOption(''),
    ]);
    await page.waitForTimeout(800);
    await v.mirar(page);
    const total = contar('SELECT count(*) FROM users');
    await v.afirma('Muestra veinte cuentas por página.', async () => {
      const porPagina = new URL(pedido.url()).searchParams.get('page_size');
      exigir(porPagina === '20', `el panel pide ${porPagina} cuentas por página`);
      const filas = await panel.locator('tbody tr').count();
      exigir(filas === Math.min(20, total), `hay ${total} cuentas y la primera página muestra ${filas}`);
      const paginas = Math.max(1, Math.ceil(total / 20));
      exigir((await panel.innerText()).includes(`Página 1 de ${paginas}`), `con ${total} cuentas no dice «Página 1 de ${paginas}»`);
    });
    await v.afirma('Abajo dice el total', async () => {
      const visto = await totalQueDice(panel);
      exigir(visto === total, `dice «Total: ${visto}» y en la base son ${total}`);
    });
  },

  async 'usuarios-crear'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Usuarios');
    await panel.getByRole('button', { name: '+ Crear Usuario' }).click();
    await panel.getByRole('heading', { name: 'Crear Nuevo Usuario' }).waitFor();
    await v.captura('usuarios-crear', page);
    const crear = () => panel.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
    const cuentasCon = (email) => contar(`SELECT count(*) FROM users WHERE email = '${email}'`);
    await v.afirma('que son obligatorios', async () => {
      await crear();
      await esperarTexto(page, 'Completá el email, la contraseña y el nombre: son obligatorios.');
    });
    await v.mirar(page);
    await v.afirma('Si falta algo, el formulario lo dice y no crea nada', async () => {
      await panel.getByPlaceholder('Email *').fill(c.nueva.email);
      await panel.getByPlaceholder('Nombre Completo *').fill(c.nueva.nombre);
      await panel.getByPlaceholder('Contraseña *').fill('abc');
      await crear();
      await esperarTexto(page, 'La contraseña necesita al menos 6 caracteres.');
      await v.mirar(page);
      // Un correo que ya tiene cuenta.
      await panel.getByPlaceholder('Email *').fill(c.vendedora.user.email);
      await panel.getByPlaceholder('Contraseña *').fill(c.nueva.clave);
      await crear();
      await esperarTexto(page, 'El email ya está registrado');
      await v.mirar(page);
      exigir(cuentasCon(c.nueva.email) === 0, 'un alta rechazada creó la cuenta igual');
    });
    // Ahora sí, sin teléfono y con el rol «Usuario».
    await panel.getByPlaceholder('Email *').fill(c.nueva.email);
    await panel.getByLabel('Rol del nuevo usuario').selectOption('user');
    await crear();
    await esperarTexto(page, 'Usuario creado exitosamente');
    await v.mirar(page);
    await v.afirma(['«Teléfono» es opcional', 'Elegí el rol: «Usuario» o «Administrador».'], async () => {
      const [fila] = queryRows(`SELECT role, coalesce(phone, '') = '' FROM users WHERE email = '${c.nueva.email}'`);
      exigir(fila && fila[0] === 'USER' && fila[1] === 't', `la cuenta quedó con rol y sin teléfono: ${JSON.stringify(fila)}`);
    });
    await v.afirma('la cuenta se agrega a la lista', async () => {
      await panel.locator('tbody tr', { hasText: c.nueva.email }).waitFor({ timeout: 10_000 }).catch(() => {
        throw new Falla('la cuenta nueva no está en la lista');
      });
    });
    await v.afirma('Puede entrar enseguida con ese correo y esa contraseña: no tiene que confirmar el correo.', async () => {
      const r = await pedir('/auth/login', { method: 'POST', body: { email: c.nueva.email, password: c.nueva.clave } });
      exigir(r.status === 200, `la cuenta recién creada no puede entrar: HTTP ${r.status}`);
    });
    await v.afirma('Para no crearla, tocá «Cancelar».', async () => {
      const otra = c.nueva.email.replace('guia.nueva.', 'guia.cancelada.');
      await panel.getByRole('button', { name: '+ Crear Usuario' }).click();
      await panel.getByPlaceholder('Email *').fill(otra);
      await panel.getByRole('button', { name: 'Cancelar', exact: true }).click();
      exigir(!(await panel.getByRole('heading', { name: 'Crear Nuevo Usuario' }).isVisible()),
        '«Cancelar» no cerró el formulario de alta');
      exigir(cuentasCon(otra) === 0, '«Cancelar» creó la cuenta igual');
    });
  },

  async 'usuarios-desactivar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Usuarios');
    await panel.getByPlaceholder('Buscar por nombre o email').fill(c.nueva.email);
    await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    const fila = panel.locator('tbody tr', { hasText: c.nueva.email });
    await fila.waitFor({ timeout: 15_000 });
    // Una sesión abierta de esa persona, para ver que se corta, y una
    // publicación suya, para ver que sigue.
    const suSesion = await entrar(c.nueva.email, c.nueva.clave);
    const suPublicacion = await c.publicar(suSesion, `Guía de la nueva ${c.sello}`);
    const correosAntes = correosPara(c.nueva.email);
    await fila.getByRole('button', { name: 'Desactivar' }).click();
    const capa = page.getByRole('dialog', { name: 'Desactivar la cuenta' });
    await capa.waitFor();
    await v.captura('usuarios-desactivar', page);
    await v.afirma('o tocá «Cancelar»', async () => {
      await capa.getByRole('button', { name: 'Cancelar' }).click();
      exigir(contar(`SELECT count(*) FROM users WHERE email = '${c.nueva.email}' AND is_active`) === 1,
        '«Cancelar» desactivó la cuenta igual');
    });
    await fila.getByRole('button', { name: 'Desactivar' }).click();
    await confirmar(page, 'Desactivar la cuenta', 'Desactivar la cuenta', v);
    await v.afirma('El estado pasa a «Inactivo».', async () => {
      await fila.getByText('Inactivo').waitFor({ timeout: 10_000 }).catch(() => {
        throw new Falla('la fila no dice «Inactivo»');
      });
      exigir(contar(`SELECT count(*) FROM users WHERE email = '${c.nueva.email}' AND NOT is_active`) === 1,
        'en la base la cuenta sigue activa');
    });
    await v.mirar(page);
    await v.afirma('La persona no puede entrar.', async () => {
      const otro = await contextoCon(c.browser, c.viewport);
      const suya = await otro.newPage();
      await suya.goto(WEB, { waitUntil: 'domcontentloaded' });
      await suya.getByRole('button', { name: 'Ingresar', exact: true }).click();
      await suya.getByPlaceholder('tu@email.com').fill(c.nueva.email);
      await suya.getByPlaceholder('••••••••').fill(c.nueva.clave);
      await suya.locator('[class*="_submitButton_"][type="submit"]').click();
      await esperarTexto(suya, 'Usuario inactivo. Contacte al administrador.');
      await v.mirar(suya);
      await otro.close();
      const r = await pedir('/auth/login', { method: 'POST', body: { email: c.nueva.email, password: c.nueva.clave } });
      exigir(r.status >= 400, `desactivada, entra igual: HTTP ${r.status}`);
    });
    await v.afirma('Si tenía la sesión abierta, se le corta.', async () => {
      const conSesion = await pedir('/auth/me', { token: suSesion.access_token });
      exigir(conSesion.status >= 400, `la sesión abierta sigue sirviendo: /auth/me respondió ${conSesion.status}`);
    });
    await v.afirma('Sus publicaciones siguen en el Mercado', async () => {
      exigir(await enElMercado(suPublicacion.nombre), 'desactivada la cuenta, su publicación salió del Mercado');
    });
    // Y se vuelve a activar.
    await fila.getByRole('button', { name: 'Activar' }).click();
    await confirmar(page, 'Activar la cuenta', 'Activar la cuenta', v);
    await v.afirma('El estado vuelve a «Activo»', async () => {
      await fila.getByText('Activo', { exact: true }).waitFor({ timeout: 10_000 }).catch(() => {
        throw new Falla('la fila no vuelve a decir «Activo»');
      });
    });
    await v.mirar(page);
    await v.afirma('entra con su contraseña de siempre', async () => {
      const otraVez = await pedir('/auth/login', { method: 'POST', body: { email: c.nueva.email, password: c.nueva.clave } });
      exigir(otraVez.status === 200, `reactivada, no puede entrar con su contraseña: HTTP ${otraVez.status}`);
    });
    await v.afirma({
      limites: ['Nadie recibe un aviso de lo que se cambia desde el panel.',
        'Si pausás una publicación o desactivás una cuenta, la persona no recibe ningún mensaje.'],
    }, async () => {
      const recibidos = correosPara(c.nueva.email) - correosAntes;
      exigir(recibidos === 0, `desactivada y reactivada, recibió ${recibidos} correo(s)`);
    });
    // La publicación era de la corrida.
    await pedir(`/admin/products/${suPublicacion.id}/status`, { method: 'PATCH', token: c.admin.access_token, body: { status: 'deleted' } });
  },

  async 'usuarios-clave'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Usuarios');
    await panel.getByPlaceholder('Buscar por nombre o email').fill(c.nueva.email);
    await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    const fila = panel.locator('tbody tr', { hasText: c.nueva.email });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByRole('button', { name: 'Restablecer contraseña' }).click();
    await confirmar(page, 'Restablecer la contraseña', 'Generar contraseña nueva', v);
    const ventana = page.getByRole('dialog', { name: /^Contraseña nueva de/ });
    await ventana.waitFor({ timeout: 15_000 });
    await v.mirar(page);
    const nueva = (await ventana.locator('code').innerText()).trim();
    await ventana.getByRole('button', { name: 'Ya la anoté, cerrar' }).click();
    await ventana.waitFor({ state: 'hidden' });
    await v.afirma('Se muestra una sola vez.', async () => {
      exigir(!(await page.locator('body').innerText()).includes(nueva), 'cerrada la ventana, la contraseña sigue a la vista');
    });
    await v.afirma('La contraseña anterior deja de funcionar en ese momento.', async () => {
      const vieja = await pedir('/auth/login', { method: 'POST', body: { email: c.nueva.email, password: c.nueva.clave } });
      exigir(vieja.status === 401, `la contraseña anterior sigue sirviendo: HTTP ${vieja.status}`);
    });
    await v.afirma('Aparece la ventana «Contraseña nueva de …» con la contraseña.', async () => {
      const conLaNueva = await pedir('/auth/login', { method: 'POST', body: { email: c.nueva.email, password: nueva } });
      exigir(conLaNueva.status === 200, `la contraseña que mostró no sirve: HTTP ${conLaNueva.status}`);
    });
    c.nueva.clave = nueva;
  },

  async 'usuarios-rol'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Usuarios');
    await panel.getByPlaceholder('Buscar por nombre o email').fill(c.nueva.email);
    await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    const fila = panel.locator('tbody tr', { hasText: c.nueva.email });
    await fila.waitFor({ timeout: 15_000 });
    await v.mirar(page);
    await fila.getByLabel('Rol del usuario').selectOption('admin');
    await confirmar(page, 'Dar acceso de administrador', 'Dar acceso de Admin', v);
    await esperarTexto(page, 'Rol actualizado correctamente');
    await v.mirar(page);
    const suSesion = await entrar(c.nueva.email, c.nueva.clave);
    await v.afirma('Esa cuenta puede hacer todo lo que explica esta guía.', async () => {
      // Lo que lee cada pestaña, y un cambio.
      for (const ruta of ['/admin/dashboard', '/admin/users', '/admin/products', '/admin/orders',
        '/admin/categories', '/admin/documentacion', '/admin/form-options?option_type=unit']) {
        const r = await pedir(ruta, { token: suSesion.access_token });
        exigir(r.status === 200, `con su sesión, ${ruta} responde ${r.status}`);
      }
      const cambio = await pedir(`/admin/products/${c.producto.id}/status`,
        { method: 'PATCH', token: suSesion.access_token, body: { status: 'active' } });
      exigir(cambio.status === 200, `con su sesión, no puede cambiar el estado de una publicación: HTTP ${cambio.status}`);
    });
    await v.afirma('Desde que vuelve a entrar ve el botón «Admin».', async () => {
      const otro = await contextoCon(c.browser, c.viewport, suSesion);
      const suya = await otro.newPage();
      await suya.goto(WEB, { waitUntil: 'domcontentloaded' });
      const loVe = await suya.getByRole('button', { name: 'Admin', exact: true }).waitFor({ timeout: 15_000 })
        .then(() => true, () => false);
      await otro.close();
      exigir(loVe, 'con acceso de administración, la cuenta no ve el botón «Admin»');
    });
    await v.afirma('Para quitarle el acceso, cambiá «Admin» por «Usuario».', async () => {
      await fila.getByLabel('Rol del usuario').selectOption('user');
      await confirmar(page, 'Quitar acceso de administrador', 'Pasar a Usuario', v);
      await esperarTexto(page, 'Rol actualizado correctamente');
      exigir(contar(`SELECT count(*) FROM users WHERE email = '${c.nueva.email}' AND role = 'USER'`) === 1,
        '«Pasar a Usuario» no le quitó el acceso');
    });
  },

  async 'usuarios-propia'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Usuarios');
    await panel.getByPlaceholder('Buscar por nombre o email').fill(ADMIN.email);
    await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    const fila = panel.locator('tbody tr', { hasText: ADMIN.email });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByRole('button', { name: 'Desactivar' }).click();
    await confirmar(page, 'Desactivar la cuenta', 'Desactivar la cuenta', v);
    await esperarTexto(page, 'Error al cambiar estado del usuario');
    await v.mirar(page);
    await v.afirma('El motivo es que nadie puede desactivar su propia cuenta, aunque el mensaje no lo diga.', async () => {
      const r = await pedir(`/admin/users/${c.admin.user.id}/toggle-active`, { method: 'POST', token: c.admin.access_token });
      exigir(r.status === 400 && /propia cuenta/.test(r.data?.detail || ''),
        `el servidor responde ${r.status} ${JSON.stringify(r.data?.detail)}`);
      exigir(!(await page.locator('body').innerText()).includes(r.data.detail),
        'el panel ya muestra el motivo: la advertencia de la guía quedó vieja');
    });
    await fila.getByLabel('Rol del usuario').selectOption('user');
    await confirmar(page, 'Quitar acceso de administrador', 'Pasar a Usuario', v);
    await esperarTexto(page, 'No puedes cambiar tu propio rol de administrador');
    await v.mirar(page);
    await v.afirma({
      paso: 'y no cambia nada',
      limites: ['Tu propia cuenta no se toca desde el panel.', 'No podés desactivarte ni quitarte el acceso de administración'],
    }, async () => {
      exigir(contar(`SELECT count(*) FROM users WHERE email = '${ADMIN.email}' AND is_active AND role = 'ADMIN'`) === 1,
        'la cuenta de administración cambió su propio estado o rol');
    });
  },

  async 'productos-filtrar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Productos');
    await panel.locator('tbody tr').first().waitFor({ timeout: 15_000 });
    await v.captura('productos', page);
    const total = contar('SELECT count(*) FROM products');
    await v.afirma('muestra las publicaciones de todas las cuentas', async () => {
      const visto = await totalQueDice(panel);
      exigir(visto === total, `dice «Total: ${visto}» y en la base hay ${total} publicaciones, de todos los estados`);
    });
    await v.afirma('dice el total y la página', async () => {
      const paginas = Math.max(1, Math.ceil(total / 20));
      exigir((await panel.innerText()).includes(`Página 1 de ${paginas}`), `con ${total} publicaciones no dice «Página 1 de ${paginas}»`);
    });
    await v.afirma('Arriba se filtra por estado', async () => {
      await panel.getByLabel('Filtrar publicaciones por estado').selectOption('active');
      await c.esperarA(async () => {
        const estados = await panel.getByLabel('Estado del producto').evaluateAll((s) => s.map((e) => e.value));
        return estados.length > 0 && estados.every((estado) => estado === 'active');
      }, 'filtrar «Activa» dejó publicaciones en otro estado');
    });
    await v.mirar(page);
    await panel.getByLabel('Filtrar publicaciones por estado').selectOption('');
    await page.waitForTimeout(500);
  },

  async 'productos-pausar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Productos');
    const fila = panel.locator('tbody tr', { hasText: c.producto.nombre });
    await fila.waitFor({ timeout: 15_000 });
    const correosAntes = correosPara(c.vendedora.user.email);
    await fila.getByLabel('Estado del producto').selectOption('paused');
    const capa = page.getByRole('dialog', { name: 'Cambiar el estado de la publicación' });
    await capa.waitFor();
    await v.captura('productos-pausar', page);
    await v.afirma('avisa que quien vende no recibe aviso', async () => {
      exigir(/no recibe aviso/.test((await capa.innerText()).replace(/\s+/g, ' ')), 'la confirmación no avisa que quien vende no recibe aviso');
    });
    await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Pausada', v);
    await c.esperarA(async () => (await fila.getByLabel('Estado del producto').inputValue()) === 'paused',
      'la fila no pasó a «Pausada»');
    await v.mirar(page);
    await v.afirma('La publicación deja de verse en el Mercado, en las búsquedas y en su enlace directo.', async () => {
      exigir(!(await enElMercado(c.producto.nombre)), 'pausada, sigue en el Mercado');
      exigir(!(await suEnlaceAbre(c.producto.id)), 'pausada, su enlace directo sigue abriendo');
    });
    await v.afirma('No se borra.', async () => {
      exigir(contar(`SELECT count(*) FROM products WHERE id = '${c.producto.id}' AND status = 'PAUSED'`) === 1,
        'pausada, en la base no está como pausada');
    });
    const { page: suya, contexto } = await misPublicaciones(c.browser, c.viewport, c.vendedora, v);
    const tarjeta = suya.locator('[class*="productCard"], [class*="publicacion"]').filter({ hasText: c.producto.nombre }).first();
    await v.afirma('Quien vende la ve en «Mis publicaciones» como «Pausado», con el botón «Activar».', async () => {
      await tarjeta.waitFor({ timeout: 15_000 });
      const texto = await tarjeta.innerText();
      exigir(/Pausado/.test(texto), `quien vende no la ve «Pausado»: ${texto.slice(0, 120)}`);
      exigir(await tarjeta.getByRole('button', { name: /Activar/ }).count() > 0, 'quien vende no tiene el botón «Activar»');
    });
    await v.afirma('La puede volver a activar sola.', async () => {
      await tarjeta.getByRole('button', { name: /Activar/ }).click();
      await suya.getByRole('button', { name: 'Activar', exact: true }).last().click();
      await c.esperarA(async () => enElMercado(c.producto.nombre), 'quien vende la reactivó y no volvió al Mercado');
    });
    await contexto.close();
    await v.afirma({
      limites: ['Nadie recibe un aviso de lo que se cambia desde el panel.',
        'Si pausás una publicación o desactivás una cuenta, la persona no recibe ningún mensaje.'],
    }, async () => {
      const recibidos = correosPara(c.vendedora.user.email) - correosAntes;
      exigir(recibidos === 0, `pausada su publicación, quien vende recibió ${recibidos} correo(s)`);
    });
  },

  async 'productos-activar'(c, v) {
    const { page } = c;
    await pedir(`/admin/products/${c.producto.id}/status`, { method: 'PATCH', token: c.admin.access_token, body: { status: 'paused' } });
    const panel = await pestana(page, 'Productos');
    const fila = panel.locator('tbody tr', { hasText: c.producto.nombre });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByLabel('Estado del producto').selectOption('active');
    await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Activa', v);
    await v.afirma('La publicación vuelve a verse en el Mercado.', async () => {
      await c.esperarA(async () => enElMercado(c.producto.nombre), 'activa, no volvió al Mercado');
    });
    // Ahora que se ve: en el Mercado no está el teléfono de quien la publicó.
    await v.afirma({
      limites: ['Los teléfonos no se publican.', 'En el Mercado y en las fichas no aparece el teléfono de nadie.'],
    }, async () => {
      const listado = await pedir(`/catalog/products?search=${encodeURIComponent(c.producto.nombre)}`);
      const ficha = await pedir(`/catalog/products/${c.producto.id}`);
      exigir(ficha.status === 200, `la ficha no abre: HTTP ${ficha.status}`);
      for (const [donde, respuesta] of [['el listado', listado], ['la ficha', ficha]]) {
        exigir(!JSON.stringify(respuesta.data).includes(c.telefonos.vendedora), `${donde} del Mercado trae el teléfono de quien vende`);
      }
    });
  },

  async 'productos-agotada'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Productos');
    const fila = panel.locator('tbody tr', { hasText: c.producto.nombre });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByLabel('Estado del producto').selectOption('sold_out');
    await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Agotada', v);
    await c.esperarA(async () => (await fila.getByLabel('Estado del producto').inputValue()) === 'sold_out',
      'la fila no pasó a «Agotada»');
    await v.afirma('la publicación deja de verse en el Mercado y en su enlace, igual que si la pausaras', async () => {
      exigir(!(await enElMercado(c.producto.nombre)), 'agotada, sigue en el Mercado');
      exigir(!(await suEnlaceAbre(c.producto.id)), 'agotada, su enlace sigue abriendo');
    });
    await v.afirma('quien vende la sigue viendo como «Activo» en «Mis publicaciones»', async () => {
      const { page: suya, contexto } = await misPublicaciones(c.browser, c.viewport, c.vendedora, v);
      const tarjeta = suya.locator('[class*="productCard"], [class*="publicacion"]').filter({ hasText: c.producto.nombre }).first();
      await tarjeta.waitFor({ timeout: 15_000 });
      const texto = await tarjeta.innerText();
      await contexto.close();
      exigir(/Activo/.test(texto), 'agotada, quien vende no la ve «Activo»');
    });
    await pedir(`/admin/products/${c.producto.id}/status`, { method: 'PATCH', token: c.admin.access_token, body: { status: 'active' } });
  },

  async 'productos-eliminar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Productos');
    const fila = panel.locator('tbody tr', { hasText: c.producto.nombre });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByLabel('Estado del producto').selectOption('deleted');
    await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Eliminada', v);
    await v.afirma('En el panel sigue en la lista con el estado «Eliminada».', async () => {
      await c.esperarA(async () => (await fila.getByLabel('Estado del producto').inputValue()) === 'deleted',
        'la fila no dice «Eliminada»');
    });
    await v.mirar(page);
    await v.afirma('La publicación deja de verse en el Mercado y en las búsquedas.', async () => {
      exigir(!(await enElMercado(c.producto.nombre)), 'eliminada, sigue en el Mercado');
    });
    await v.afirma('Desaparece de «Mis publicaciones» de quien vende: no la ve ni tiene un botón para volver a activarla.', async () => {
      const suyas = await pedir('/products/my', { token: c.vendedora.access_token });
      exigir(!(suyas.data?.products || []).some((p) => p.id === c.producto.id),
        'eliminada, sigue en «Mis publicaciones» de quien vende');
      const { page: suya, contexto } = await misPublicaciones(c.browser, c.viewport, c.vendedora, v);
      const laVe = (await suya.locator('body').innerText()).includes(c.producto.nombre);
      await contexto.close();
      exigir(!laVe, 'eliminada, quien vende la sigue viendo en «Mis publicaciones»');
    });
    await v.afirma('No se borra: si hiciera falta, se puede volver a «Activa» y reaparece para todos.', async () => {
      await fila.getByLabel('Estado del producto').selectOption('active');
      await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Activa', v);
      await c.esperarA(async () => enElMercado(c.producto.nombre), 'vuelta a «Activa», no reapareció');
    });
    // Y queda eliminada: es de la corrida.
    const eliminar = () => pedir(`/admin/products/${c.producto.id}/status`,
      { method: 'PATCH', token: c.admin.access_token, body: { status: 'deleted' } });
    await eliminar();
    await v.afirma('Hoy quien vende sí puede volver a activarla con un pedido armado a mano', async () => {
      const r = await pedir(`/products/${c.producto.id}`,
        { method: 'PATCH', token: c.vendedora.access_token, body: { status: 'active' } });
      const volvio = r.status === 200 && await enElMercado(c.producto.nombre);
      await eliminar();
      exigir(volvio, `quien vende ya no puede volver a activarla (HTTP ${r.status}): la advertencia de la guía quedó vieja`);
    });
  },

  async 'ordenes-ver'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Órdenes');
    await panel.locator('tbody tr').first().waitFor({ timeout: 15_000 }).catch(() => {
      throw new Falla('no hay ninguna orden para mirar: la base demo tendría que traer alguna');
    });
    await v.mirar(page);
    const numero = c.orden.numero;
    const fila = panel.locator('tbody tr', { hasText: numero });
    await fila.waitFor({ timeout: 10_000 });
    const total = contar('SELECT count(*) FROM orders');
    await v.afirma('Abajo dice el total y la página', async () => {
      const visto = await totalQueDice(panel);
      exigir(visto === total, `dice «Total: ${visto}» y en la base hay ${total} órdenes`);
      const paginas = Math.max(1, Math.ceil(total / 20));
      exigir((await panel.innerText()).includes(`Página 1 de ${paginas}`), `con ${total} órdenes no dice «Página 1 de ${paginas}»`);
    });
    await v.afirma('Se filtra con «Todos los estados» o con uno de los estados de una orden', async () => {
      // La orden de la corrida espera el comprobante de la transferencia.
      const filtro = panel.getByLabel('Filtrar órdenes por estado');
      await filtro.selectOption({ label: 'Entregada' });
      await c.esperarA(async () => (await fila.count()) === 0, 'filtrar «Entregada» deja una orden que espera comprobante');
      await filtro.selectOption({ label: 'Esperando comprobante' });
      await fila.waitFor({ timeout: 10_000 }).catch(() => {
        throw new Falla('filtrar «Esperando comprobante» no muestra la orden que lo espera');
      });
      await filtro.selectOption('');
      await fila.waitFor({ timeout: 10_000 });
    });
    const soloSeMiran = {
      paso: 'Las órdenes sólo se miran: no hay botones para cambiar su estado ni para cancelarlas.',
      limites: ['Las órdenes sólo se miran.', 'Desde el panel no se cambia el estado de una orden ni se cancela.',
        'Desde el panel no se puede aprobar ni rechazar un pago.'],
    };
    await v.afirma(soloSeMiran, async () => {
      exigir(await fila.locator('select, input').count() === 0, 'la fila de una orden ofrece cambiarla');
    });
    await fila.getByRole('button', { name: `Ver la orden ${numero}` }).click();
    const detalle = page.getByRole('dialog', { name: `Orden ${numero}` });
    await detalle.waitFor({ timeout: 10_000 });
    await v.captura('ordenes', page);
    await v.afirma(soloSeMiran, async () => {
      const botones = await detalle.getByRole('button').allInnerTexts();
      exigir(botones.every((b) => b.trim() === '×'), `el detalle de la orden ofrece acciones: ${botones.join(', ')}`);
      exigir(await detalle.locator('select, input, textarea').count() === 0, 'el detalle de la orden tiene campos para cambiarla');
    });
    // Lo que la guía advierte que hoy falta en el detalle.
    const texto = (await detalle.innerText()).replace(/\s+/g, ' ');
    const suya = await pedir('/orders/my?as_role=buyer', { token: c.compradora.access_token });
    const deElla = (suya.data || []).find((o) => o.order_number === numero);
    const vendida = await pedir('/orders/my?as_role=seller', { token: c.vendedora.access_token });
    const deQuienVende = (vendida.data || []).find((o) => o.order_number === numero);
    await v.afirma('aunque la orden tenga artículos', async () => {
      exigir(/No hay detalles de items disponibles/.test(texto), 'el detalle ya muestra los artículos: la advertencia de la guía quedó vieja');
      exigir((deElla?.items || []).length > 0, 'la orden no tiene artículos');
    });
    await v.afirma('el correo y la dirección de quien compra aparecen con un guion', async () => {
      exigir(/Email: -/.test(texto) && /Dirección: -/.test(texto),
        'el detalle ya trae el correo o la dirección de quien compra: la advertencia de la guía quedó vieja');
    });
    await v.afirma('el subtotal y el envío aparecen en cero', async () => {
      exigir(/Subtotal: \$\s?0(?![\d.,])/.test(texto) && /Envío: \$\s?0(?![\d.,])/.test(texto),
        'el detalle ya trae el subtotal o el envío: la advertencia de la guía quedó vieja');
    });
    await v.afirma('El total sí es el de la orden.', async () => {
      const visto = Number((texto.match(/Total: \$\s?([\d.]+)/) || [])[1]?.replace(/\./g, ''));
      exigir(visto === c.orden.total, `el total del detalle dice ${visto} y la orden es de ${c.orden.total}`);
    });
    await v.afirma('el detalle completo lo ven quien compra y quien vende en su cuenta', async () => {
      exigir((deElla?.items || []).length > 0, 'quien compró no ve los artículos de su orden');
      exigir((deQuienVende?.items || []).length > 0, 'quien vendió no ve los artículos de su orden');
    });
    await v.afirma({ limites: 'quien compra y quien vende ven el del otro en su orden' }, async () => {
      exigir(deElla?.seller_phone === c.telefonos.vendedora, 'quien compró no ve el teléfono de quien vende en su orden');
      exigir(deQuienVende?.buyer_phone === c.telefonos.compradora, 'quien vendió no ve el teléfono de quien compra en su orden');
    });
    await v.afirma('Cerrá el detalle con «×» o con Escape.', async () => {
      await page.keyboard.press('Escape');
      await detalle.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { throw new Falla('Escape no cerró el detalle'); });
      await fila.getByRole('button', { name: `Ver la orden ${numero}` }).click();
      await detalle.getByRole('button', { name: 'Cerrar' }).click();
      await detalle.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { throw new Falla('«×» no cerró el detalle'); });
    });
  },

  async 'categorias-crear'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Categorías');
    await panel.getByRole('heading', { name: 'Gestión de Categorías y Subcategorías' }).waitFor({ timeout: 15_000 });
    await v.mirar(page);
    await panel.getByRole('button', { name: '+ Nueva Categoría' }).click();
    await panel.getByRole('heading', { name: 'Nueva Categoría' }).waitFor();
    await panel.getByPlaceholder('Ej: Fertilizantes').fill(c.categoria.nombre);
    await panel.getByPlaceholder('Descripción opcional...').fill('Categoría de la guía del panel.');
    await v.captura('categorias', page);
    await panel.getByRole('button', { name: 'Crear Categoría' }).click();
    await v.afirma('Son opcionales', async () => {
      // Se creó sin icono, tipo ni orden.
      await esperarTexto(page, 'Categoría creada exitosamente');
      exigir(contar(`SELECT count(*) FROM categories WHERE name = '${c.categoria.nombre}'`) === 1, 'la categoría no se creó');
    });
    await v.mirar(page);
    await v.afirma({
      paso: 'La categoría nueva aparece enseguida en el filtro «Categoría» del Mercado.',
      seccion: 'Las categorías y subcategorías son las que se eligen al publicar y al filtrar el Mercado.',
    }, async () => {
      const mercado = await c.browser.newContext({ viewport: c.viewport });
      const suya = await mercado.newPage();
      await suya.goto(`${WEB}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
      await c.esperarA(async () => (await suya.locator('#catalog-category option').allTextContents())
        .includes(c.categoria.nombre), 'la categoría nueva no aparece en el filtro «Categoría» del Mercado');
      await v.mirar(suya);
      await mercado.close();
    });
  },

  async 'categorias-subcategoria'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Categorías');
    const tarjeta = panel.locator('[class*="categoryCard"]').filter({ hasText: c.categoria.nombre });
    await tarjeta.getByRole('button', { name: `Mostrar las subcategorías de ${c.categoria.nombre}` }).click();
    await v.mirar(page);
    await tarjeta.getByRole('button', { name: `Agregar una subcategoría a ${c.categoria.nombre}` }).click();
    await tarjeta.getByPlaceholder('Nombre de subcategoría').fill(c.categoria.sub);
    await v.mirar(page);
    await tarjeta.getByRole('button', { name: `Agregar la subcategoría a ${c.categoria.nombre}` }).click();
    await esperarTexto(page, 'Subcategoría agregada');
    await v.mirar(page);
    await v.afirma({
      paso: 'Ya se puede elegir al publicar en esa categoría.',
      seccion: 'Las categorías y subcategorías son las que se eligen al publicar y al filtrar el Mercado.',
    }, async () => {
      // Es la lista que lee el formulario de publicar.
      const categorias = (await pedir('/catalog/categories')).data || [];
      const suya = categorias.find((cat) => cat.name === c.categoria.nombre);
      exigir((suya?.subcategories || []).some((s) => s.name === c.categoria.sub),
        'la subcategoría nueva no se ofrece al publicar');
    });
    await tarjeta.getByRole('button', { name: `Ocultar las subcategorías de ${c.categoria.nombre}` }).click();
    await v.mirar(page);
  },

  async 'categorias-editar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Categorías');
    const tarjeta = panel.locator('[class*="categoryCard"]').filter({ hasText: c.categoria.nombre });
    await tarjeta.getByRole('button', { name: `Editar la categoría ${c.categoria.nombre}` }).click();
    await tarjeta.getByRole('heading', { name: 'Editar Categoría' }).waitFor();
    await v.mirar(page);
    await v.afirma('Cambiá lo que haga falta y tocá «Guardar Cambios».', async () => {
      await tarjeta.locator('[class*="editCategoryForm"] textarea').fill('Editada por la guía del panel.');
      await tarjeta.getByRole('button', { name: 'Guardar Cambios' }).click();
      await esperarTexto(page, 'Categoría actualizada');
      exigir(contar(`SELECT count(*) FROM categories WHERE name = '${c.categoria.nombre}'
        AND description = 'Editada por la guía del panel.'`) === 1, 'el cambio no quedó guardado');
    });
    await v.mirar(page);
    const conPublicaciones = c.categoriaConPublicaciones;
    const otra = panel.locator('[class*="categoryCard"]').filter({ hasText: conPublicaciones });
    await otra.getByRole('button', { name: `Editar la categoría ${conPublicaciones}` }).click();
    await otra.getByRole('heading', { name: 'Editar Categoría' }).waitFor();
    await v.afirma('Si la categoría ya tiene publicaciones, el tipo no se puede cambiar.', async () => {
      exigir(await otra.locator('select').isDisabled(), `en «${conPublicaciones}», con publicaciones, el tipo se puede cambiar`);
    });
    await v.mirar(page);
    await otra.getByRole('button', { name: 'Cancelar' }).click();
  },

  async 'categorias-eliminar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Categorías');
    await v.afirma('Sólo se puede si ninguna publicación la está usando.', async () => {
      const [enUso] = queryRows(`SELECT s.id FROM subcategories s
        JOIN products p ON p.subcategory_id = s.id GROUP BY s.id LIMIT 1`);
      exigir(enUso, 'la base no tiene ninguna subcategoría en uso para probarlo');
      const r = await pedir(`/admin/subcategories/${enUso[0]}`, { method: 'DELETE', token: c.admin.access_token });
      exigir(r.status >= 400, `se eliminó una subcategoría en uso: HTTP ${r.status}`);
    });
    const tarjeta = panel.locator('[class*="categoryCard"]').filter({ hasText: c.categoria.nombre });
    await tarjeta.getByRole('button', { name: `Mostrar las subcategorías de ${c.categoria.nombre}` }).click();
    await tarjeta.getByRole('button', { name: `Eliminar la subcategoría ${c.categoria.sub}` }).click();
    await confirmar(page, 'Eliminar la subcategoría', 'Eliminar la subcategoría', v);
    await v.afirma('Confirmá y aparece «Subcategoría eliminada».', async () => {
      await esperarTexto(page, 'Subcategoría eliminada');
      exigir(contar(`SELECT count(*) FROM subcategories WHERE name = '${c.categoria.sub}'`) === 0, 'la subcategoría sigue en la base');
    });
    await v.mirar(page);
    const otra = panel.locator('[class*="categoryCard"]').filter({ hasText: c.categoriaConPublicaciones });
    const suEliminar = otra.getByRole('button', { name: `Eliminar la categoría ${c.categoriaConPublicaciones}` });
    await v.afirma('Una categoría con publicaciones no se puede eliminar: el botón «Eliminar» queda apagado', async () => {
      exigir(await suEliminar.isDisabled(), `«Eliminar» de «${c.categoriaConPublicaciones}» no está apagado`);
    });
    await v.mirar(page);
    await tarjeta.getByRole('button', { name: `Eliminar la categoría ${c.categoria.nombre}` }).click();
    await v.afirma('avisa que se elimina para siempre', async () => {
      const capa = page.getByRole('dialog', { name: 'Eliminar la categoría' });
      await capa.waitFor({ timeout: 10_000 });
      exigir(/para siempre/.test(await capa.innerText()), 'la confirmación no avisa que se elimina para siempre');
    });
    await confirmar(page, 'Eliminar la categoría', 'Eliminar la categoría', v);
    await esperarTexto(page, 'Categoría eliminada');
    await v.mirar(page);
    await v.afirma('Desaparece del filtro del Mercado.', async () => {
      // Es la lista que lee el filtro.
      const categorias = (await pedir('/catalog/categories')).data || [];
      exigir(!categorias.some((cat) => cat.name === c.categoria.nombre), 'eliminada, la categoría sigue en el Mercado');
    });
  },

  async 'documentacion-revisar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Documentación');
    const fila = panel.locator('tbody tr', { hasText: c.vendedora.user.email });
    await fila.waitFor({ timeout: 15_000 });
    await v.captura('documentacion', page);
    await v.afirma('Arranca mostrando las «Pendientes»', async () => {
      const filtro = await panel.getByLabel('Filtrar documentación por estado').inputValue();
      exigir(filtro === 'pendiente', `arranca con el filtro «${filtro}»`);
    });
    await v.afirma('Al lado dice cuántas quedan', async () => {
      const visto = Number(((await panel.innerText()).match(/(\d+) pendientes? de revisión/) || [])[1]);
      const pendientes = contar("SELECT count(*) FROM documentacion_de_vendedores WHERE estado = 'PENDIENTE'");
      exigir(visto === pendientes, `dice ${visto} pendientes y en la base son ${pendientes}`);
    });
    await v.afirma('Se abre en otra pestaña del navegador.', async () => {
      const [ventana] = await Promise.all([
        page.waitForEvent('popup', { timeout: 10_000 }),
        fila.getByRole('button', { name: 'constancia.pdf' }).click(),
      ]).catch(() => { throw new Falla('tocar el nombre de la constancia no la abrió en otra pestaña'); });
      await ventana.close();
    });
    for (const estado of ['aprobada', 'rechazada', '']) {
      await panel.getByLabel('Filtrar documentación por estado').selectOption(estado);
      await page.waitForTimeout(400);
      await v.mirar(page);
    }
    await panel.getByLabel('Filtrar documentación por estado').selectOption('pendiente');
  },

  async 'documentacion-aprobar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Documentación');
    await panel.getByLabel('Filtrar documentación por estado').selectOption('');
    const fila = panel.locator('tbody tr', { hasText: c.vendedora.user.email });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByRole('button', { name: 'Aprobar' }).click();
    await esperarTexto(page, `Documentación de ${c.vendedora.user.full_name} aprobada.`);
    await v.mirar(page);
    await v.afirma('el estado pasa a «Documentación revisada», con quién la revisó y cuándo', async () => {
      await fila.getByText('Documentación revisada').waitFor({ timeout: 10_000 }).catch(() => {
        throw new Falla('la fila no dice «Documentación revisada»');
      });
      exigir(/por .+ el /.test(await fila.innerText()), 'aprobada, la fila no dice quién la revisó ni cuándo');
    });
    exigir(/Ya revisada/.test(await fila.innerText()), 'aprobada, la fila no dice «Ya revisada»');
    await v.mirar(page);
    const mercado = await c.browser.newContext({ viewport: c.viewport });
    const ficha = await mercado.newPage();
    const suFicha = async () => {
      await ficha.goto(`${WEB}/?section=product&id=${c.productoDocumentado.id}`, { waitUntil: 'domcontentloaded' });
      await ficha.locator('main[aria-busy="false"]:has(#detalle-titulo)').waitFor({ timeout: 15_000 });
      return ficha.locator('main').innerText();
    };
    await v.afirma({
      paso: 'las publicaciones de esa persona muestran «Documentación revisada»',
      limites: 'Aprobarla agrega un distintivo en las publicaciones del vendedor.',
    }, async () => {
      exigir(/Documentación revisada/.test(await suFicha()), 'aprobada, la ficha de su publicación no dice «Documentación revisada»');
    });
    await v.mirar(ficha);
    await v.afirma('Si la persona presenta otra constancia, el distintivo se retira hasta que se revise la nueva.', async () => {
      await presentarDocumentacion(c.vendedora.access_token, '30-11111111-8', 'Guía Admin SRL');
      exigir(!/Documentación revisada/.test(await suFicha()),
        'con otra constancia presentada, la ficha sigue diciendo «Documentación revisada»');
    });
    await mercado.close();
  },

  async 'documentacion-rechazar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Documentación');
    await panel.getByLabel('Filtrar documentación por estado').selectOption('pendiente');
    const fila = panel.locator('tbody tr', { hasText: c.segunda.user.email });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByRole('button', { name: 'Rechazar' }).click();
    const confirmarRechazo = fila.getByRole('button', { name: 'Confirmar rechazo' });
    await v.afirma('Sin motivo, el botón no se habilita.', async () => {
      exigir(await confirmarRechazo.isDisabled(), 'sin motivo, «Confirmar rechazo» está habilitado');
    });
    await v.mirar(page);
    await fila.getByRole('button', { name: 'Cancelar' }).click();
    await fila.getByRole('button', { name: 'Rechazar' }).click();
    const MOTIVO = 'La constancia está vencida: presentá la del año en curso.';
    await fila.getByLabel('Motivo del rechazo').fill(MOTIVO);
    await confirmarRechazo.click();
    await esperarTexto(page, `Documentación de ${c.segunda.user.full_name} rechazada.`);
    await v.mirar(page);
    await v.afirma('Quien vende ve en su cuenta el estado «Rechazada» y el motivo', async () => {
      const contexto = await contextoCon(c.browser, c.viewport, c.segunda);
      const suya = await contexto.newPage();
      await suya.goto(WEB, { waitUntil: 'domcontentloaded' });
      await suya.getByRole('button', { name: 'Mi cuenta' }).first().click();
      await esperarTexto(suya, 'Por qué se rechazó:');
      const suCuenta = (await suya.locator('body').innerText()).replace(/\s+/g, ' ');
      await v.mirar(suya);
      await contexto.close();
      exigir(/Rechazada/.test(suCuenta), 'quien vende no ve el estado «Rechazada»');
      exigir(suCuenta.includes(MOTIVO), 'quien vende no ve el motivo del rechazo');
    });
    await panel.getByLabel('Filtrar documentación por estado').selectOption('rechazada');
    const decidida = panel.locator('tbody tr', { hasText: c.segunda.user.email });
    await v.afirma('no se puede volver a decidir', async () => {
      await decidida.getByText('Ya revisada').waitFor({ timeout: 10_000 });
      exigir(await decidida.getByRole('button', { name: 'Aprobar' }).count() === 0,
        'una documentación ya decidida se puede volver a decidir');
    });
    await v.mirar(page);
    await v.afirma(['Puede presentar otra constancia cuando quiera.', 'hasta que la persona presente otra'], async () => {
      await presentarDocumentacion(c.segunda.access_token, '27-12345678-0', 'Segunda Guía SA')
        .catch((error) => { throw new Falla(error.message); });
      await panel.getByLabel('Filtrar documentación por estado').selectOption('pendiente');
      await panel.locator('tbody tr', { hasText: c.segunda.user.email }).getByRole('button', { name: 'Aprobar' })
        .waitFor({ timeout: 10_000 }).catch(() => { throw new Falla('la constancia nueva no quedó para decidir'); });
    });
  },

  async 'config-tipos'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Configuración');
    await panel.getByRole('heading', { name: /Configuración de Formularios/ }).waitFor({ timeout: 15_000 });
    const LISTAS = { 'Tipos de Cobro': 'pricing_type', Disponibilidad: 'availability', 'Tiempo de Respuesta': 'response_time', Unidades: 'unit' };
    await v.afirma({
      paso: 'cuatro listas',
      limites: ['Las marcas no se administran desde este panel.', 'no están entre las listas de «Configuración»'],
    }, async () => {
      const botones = panel.locator('[class*="_configTabs_"] button');
      await botones.first().waitFor({ timeout: 10_000 });
      const listas = (await botones.allInnerTexts()).map((t) => t.trim()).sort();
      exigir(JSON.stringify(listas) === JSON.stringify(Object.keys(LISTAS).sort()), `las listas son: ${listas.join(', ')}`);
    });
    for (const [lista, tipo] of Object.entries(LISTAS)) {
      await panel.getByRole('button', { name: lista }).click();
      await v.afirma('Al lado del botón dice cuántas opciones tiene la lista', async () => {
        // Las inactivas también cuentan: la lista las muestra.
        const cantidad = contar(`SELECT count(*) FROM form_options WHERE option_type = '${tipo}'`);
        await c.esperarA(async () => (await panel.innerText()).includes(`${cantidad} opciones`),
          `«${lista}» no dice «${cantidad} opciones»`);
      });
      await v.mirar(page);
    }
    await v.captura('config', page);
  },

  async 'config-crear'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Configuración');
    await panel.getByRole('button', { name: 'Unidades' }).click();
    await panel.getByRole('button', { name: '+ Nueva Opción' }).click();
    await v.mirar(page);
    await panel.getByPlaceholder('Valor interno (ej: buenos_aires)').fill(c.opcion.valor);
    await panel.getByPlaceholder('Etiqueta visible (ej: Buenos Aires)').fill(c.opcion.etiqueta);
    await panel.getByPlaceholder('Orden').fill('99');
    await panel.getByRole('button', { name: 'Crear opción' }).click();
    await esperarTexto(page, 'Opción creada exitosamente');
    await v.mirar(page);
    const unidades = await unidadesAlPublicar(c, v);
    await v.afirma(['una unidad nueva aparece enseguida en «Unidad» al publicar', 'lo que se ve en el formulario'], async () => {
      exigir(unidades.includes(c.opcion.etiqueta), 'la unidad nueva no aparece en «Unidad» al publicar');
    });
    await v.afirma('«Orden»: el lugar en la lista', async () => {
      exigir(unidades.at(-1) === c.opcion.etiqueta, `con el orden 99 no queda última: termina en ${unidades.slice(-2).join(', ')}`);
    });
  },

  async 'config-editar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Configuración');
    await panel.getByRole('button', { name: 'Unidades' }).click();
    await panel.getByRole('button', { name: `Editar la opción ${c.opcion.etiqueta}` }).click();
    await v.afirma({ paso: 'El valor interno queda fijo', seccion: 'que después no se puede cambiar' }, async () => {
      const valor = panel.getByLabel('Valor interno de la opción (no se puede cambiar)');
      exigir(await valor.getAttribute('readonly') !== null, 'el valor interno se puede cambiar en el panel');
      const [[id]] = queryRows(`SELECT id FROM form_options WHERE value = '${c.opcion.valor}'`);
      const r = await pedir(`/admin/form-options/${id}`,
        { method: 'PUT', token: c.admin.access_token, body: { value: `${c.opcion.valor}_otro` } });
      exigir(r.status >= 400, `el servidor deja cambiar el valor interno: HTTP ${r.status}`);
    });
    await panel.getByLabel('Estado de la opcion').selectOption('inactive');
    await v.mirar(page);
    await panel.getByRole('button', { name: `Guardar la opción ${c.opcion.etiqueta}` }).click();
    await esperarTexto(page, 'Opción actualizada');
    await v.mirar(page);
    await v.afirma('Para dejar de ofrecerla sin borrarla, elegí «Inactivo».', async () => {
      exigir(contar(`SELECT count(*) FROM form_options WHERE value = '${c.opcion.valor}' AND NOT is_active`) === 1,
        'no quedó guardada como inactiva');
    });
    await v.afirma('Una opción «Inactivo» deja de ofrecerse al publicar y queda marcada así en la lista.', async () => {
      const enLaLista = panel.locator('[class*="optionItem"]', { hasText: c.opcion.etiqueta });
      exigir(/Inactivo/.test(await enLaLista.innerText()), 'en la lista no está marcada «Inactivo»');
      exigir(!(await unidadesAlPublicar(c, v)).includes(c.opcion.etiqueta), 'inactiva, la unidad se sigue ofreciendo al publicar');
    });
  },

  async 'config-eliminar'(c, v) {
    const { page } = c;
    // Activa otra vez, para ver que al eliminarla deja de ofrecerse.
    const [[id]] = queryRows(`SELECT id FROM form_options WHERE value = '${c.opcion.valor}'`);
    await pedir(`/admin/form-options/${id}`, { method: 'PUT', token: c.admin.access_token, body: { is_active: true } });
    exigir((await unidadesAlPublicar(c, v)).includes(c.opcion.etiqueta), 'activa otra vez, la unidad no se ofrece al publicar');
    const panel = await pestana(page, 'Configuración');
    await panel.getByRole('button', { name: 'Unidades' }).click();
    await panel.getByRole('button', { name: `Eliminar la opción ${c.opcion.etiqueta}` }).click();
    await confirmar(page, 'Eliminar la opción', 'Eliminar la opción', v);
    await v.afirma('Confirmá y aparece «Opción eliminada».', async () => {
      await esperarTexto(page, 'Opción eliminada');
      exigir(contar(`SELECT count(*) FROM form_options WHERE value = '${c.opcion.valor}'`) === 0,
        'eliminada, la opción sigue en la base');
    });
    await v.mirar(page);
    await v.afirma('Deja de ofrecerse en los formularios.', async () => {
      exigir(!(await unidadesAlPublicar(c, v)).includes(c.opcion.etiqueta), 'eliminada, la unidad se sigue ofreciendo al publicar');
    });
  },
};

RECORRIDOS['sin-conexion'] = async (c, v) => {
  const { page } = c;
  // Con un filtro puesto, la lista de usuarios deja de contestar.
  const panel = await pestana(page, 'Usuarios');
  await panel.getByLabel('Filtrar usuarios por rol').selectOption('admin');
  await panel.locator('tbody tr').first().waitFor({ timeout: 15_000 });
  let fallido = null;
  const cortar = (ruta) => {
    fallido = ruta.request().url();
    return ruta.fulfill({ status: 503, body: '{"detail":"no disponible"}' });
  };
  await page.route('**/api/admin/users?*', cortar);
  await panel.getByLabel('Filtrar usuarios por estado').selectOption('true');
  await esperarTexto(page, 'No se pudo cargar la lista de usuarios.');
  await v.afirma('el panel no muestra una tabla vacía como si no hubiera nada', async () => {
    exigir(await panel.locator('tbody tr').count() === 0, 'con la lista caída, el panel muestra filas');
  });
  await v.mirar(page);
  // Vuelve la conexión.
  await page.unroute('**/api/admin/users?*', cortar);
  await v.afirma('pide lo mismo otra vez, con los mismos filtros', async () => {
    const [pedido] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/api/admin/users?')),
      panel.getByRole('button', { name: 'Reintentar' }).click(),
    ]);
    exigir(pedido.url() === fallido, `pidió ${pedido.url()} y lo que no cargó era ${fallido}`);
    await panel.locator('tbody tr').first().waitFor({ timeout: 15_000 }).catch(() => {
      throw new Falla('«Reintentar» no volvió a cargar la lista');
    });
    const roles = await panel.getByLabel('Rol del usuario').evaluateAll((s) => s.map((e) => e.value));
    exigir(roles.every((rol) => rol === 'admin'), 'después de reintentar, la lista perdió el filtro por rol');
  });
  await v.mirar(page);
  await panel.getByLabel('Filtrar usuarios por rol').selectOption('');
  await panel.getByLabel('Filtrar usuarios por estado').selectOption('');
};

// Las unidades que se ofrecen al publicar, en otra pestaña de la sesión.
async function unidadesAlPublicar(c, v) {
  const alta = await c.contexto.newPage();
  await alta.goto(WEB, { waitUntil: 'domcontentloaded' });
  await alta.getByRole('button', { name: /Vender/ }).first().click();
  await alta.getByRole('heading', { name: /Publicar un producto/i }).waitFor({ timeout: 15_000 });
  await alta.locator('#unit option').nth(1).waitFor({ state: 'attached', timeout: 15_000 });
  await v.mirar(alta);
  const opciones = (await alta.locator('#unit option').allTextContents()).map((t) => t.trim());
  await alta.close();
  return opciones;
}

// --- El inventario -----------------------------------------------------------
//
// Lo que se ve de cada pestaña al abrirla —botones, opciones, campos—, contra
// lo que cita su sección de la guía. Lo que no está citado es un hueco. Los
// datos de las filas no son controles: nombres, correos, archivos, números.

const PESTANAS = {
  Dashboard: 'Dashboard: el resumen',
  Usuarios: 'Usuarios',
  Productos: 'Productos: las publicaciones',
  Órdenes: 'Órdenes',
  Categorías: 'Categorías',
  Documentación: 'Documentación de vendedores',
  Configuración: 'Configuración: las listas de los formularios',
};

async function inventario(page, guia) {
  const huecos = [];
  for (const [pestanaDelPanel, tituloDeLaSeccion] of Object.entries(PESTANAS)) {
    const seccion = guia.secciones.find((s) => s.titulo === tituloDeLaSeccion);
    if (!seccion) {
      huecos.push(`la guía no tiene la sección «${tituloDeLaSeccion}» para la pestaña «${pestanaDelPanel}»`);
      continue;
    }
    const panel = await pestana(page, pestanaDelPanel);
    await page.waitForTimeout(1200);
    const controles = await panel.evaluate((raiz) => {
      const textos = new Set();
      for (const el of raiz.querySelectorAll('button, option, input[placeholder], textarea[placeholder]')) {
        const visible = el.tagName === 'OPTION'
          ? (el.parentElement?.getClientRects().length ?? 0) > 0
          : el.getClientRects().length > 0;
        if (!visible) continue;
        // Las pestañas y la cruz se citan en «Entrar al panel».
        if (el.closest('[class*="_tabs_"]') || el.closest('[class*="_header_"]')) continue;
        // Los datos de una fila no son controles.
        if (el.closest('tbody') && el.tagName === 'OPTION') continue;
        if (el.closest('tbody') && /\.\w{2,4}$/.test((el.textContent || '').trim())) continue;
        if (el.closest('[class*="categoryCard"]') && el.tagName === 'OPTION') continue;
        const texto = (el.getAttribute('placeholder') || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (texto) textos.add(texto);
      }
      return [...textos];
    });
    for (const control of controles) {
      const n = normalizar(control);
      // Los números de página y los contadores cambian con los datos.
      if (/^\d+$/.test(n)) continue;
      if (!seccion.citas.some((cita) => {
        const partes = cita.split('…').map((p) => p.trim()).filter(Boolean);
        return partes.length > 1 ? partes.every((p) => n.includes(p)) : cita === n;
      })) {
        huecos.push(`la pestaña «${pestanaDelPanel}» muestra «${control}» y su sección de la guía no lo nombra`);
      }
    }
  }
  return huecos;
}

// Un error del navegador, dicho en términos de la guía: si no encontró un
// control, cuál; si no, la primera línea.
function porQueNoSePudo(error) {
  // En «waiting for …» va la cadena entera, del panel al control: el que
  // faltaba es el último nombrado.
  const esperando = error.message.split('\n').find((linea) => /waiting for/.test(linea)) || '';
  const nombres = [...esperando.matchAll(/name: ['"]([^'"]+)['"]/g)].map((m) => m[1]);
  if (nombres.length) {
    return `el panel no muestra «${nombres.at(-1)}», que el recorrido tenía que tocar`;
  }
  return `no se pudo hacer: ${error.message.split('\n')[0]}`;
}

// --- La corrida --------------------------------------------------------------

async function prepararLaCorrida(browser, ancho) {
  const viewport = ANCHOS[ancho];
  // Corto, para que las imágenes de la guía se lean: «Guía producto e4x9k».
  const sello = `${ancho[0]}${Date.now().toString(36).slice(-5)}`;
  const admin = await entrar(ADMIN.email, ADMIN.password);
  // Dos cuentas que venden, creadas desde la API de administración: entran
  // enseguida, sin confirmar el correo.
  const crear = async (nombre) => {
    const email = `guia.${nombre.toLowerCase()}.${sello}@example.com`;
    const r = await pedir('/admin/users', {
      method: 'POST', token: admin.access_token,
      body: { email, password: 'GuiaPanel1', full_name: `${nombre} Guía ${sello}`, phone: '', role: 'user' },
    });
    if (r.status !== 201) throw new Error(`no se pudo crear la cuenta ${email}: HTTP ${r.status}`);
    return entrar(email, 'GuiaPanel1');
  };
  const vendedora = await crear('Vendedora');
  const segunda = await crear('Segunda');
  const categorias = (await pedir('/catalog/categories')).data;
  const categoria = categorias.find((cat) => !cat.is_service);
  const localidades = (await pedir('/catalog/localities?province_id=06')).data;
  const pergamino = localidades.find((l) => l.name === 'Pergamino');
  const publicar = async (nombre, sesion = vendedora) => {
    const r = await pedir('/products', {
      method: 'POST', token: sesion.access_token,
      body: {
        name: nombre, description: 'Publicación de la guía del panel de administración.',
        category_id: categoria.id, price: 1000, stock: 5, unit: 'kg',
        locality_id: pergamino.id, publication_type: 'producto', operation_kind: 'insumo',
      },
    });
    if (r.status >= 400) throw new Error(`no se pudo publicar «${nombre}»: HTTP ${r.status}`);
    return { id: r.data.id, nombre };
  };
  const producto = await publicar(`Guía producto ${sello}`);
  const productoDocumentado = await publicar(`Guía documentada ${sello}`);
  // Una orden propia, por transferencia: la base demo limpia no trae ninguna y
  // el paso de «Órdenes» tiene que tener qué mirar.
  // Para cobrar por transferencia hace falta un alias; éste es inventado.
  const alias = await pedir('/auth/me', {
    method: 'PATCH', token: vendedora.access_token, body: { alias_bancario: 'guia.panel.demo' },
  });
  if (alias.status >= 400) throw new Error(`no se pudo cargar el alias de la vendedora: HTTP ${alias.status}`);
  const compradora = await crear('Compradora');
  // Teléfonos inventados, para ver quién los ve y quién no.
  const digitos = String(Date.now()).slice(-6);
  const telefonos = { vendedora: `+54 9 2477 1${digitos}`, compradora: `+54 9 2477 2${digitos}` };
  for (const [quien, sesion] of [['vendedora', vendedora], ['compradora', compradora]]) {
    const r = await pedir('/auth/me', { method: 'PATCH', token: sesion.access_token, body: { phone: telefonos[quien] } });
    if (r.status >= 400) throw new Error(`no se pudo cargar el teléfono de la ${quien}: HTTP ${r.status}`);
  }
  await pedir('/cart/items', {
    method: 'POST', token: compradora.access_token,
    body: { product_id: productoDocumentado.id, quantity: 1 },
  });
  const compra = await pedir('/orders/checkout/transfer', {
    method: 'POST', token: compradora.access_token,
    body: {
      shipping_address: 'Ruta 8 km 220',
      shipping_locality_id: pergamino.id,
      shipping_postal_code: '2700',
      notes: 'Orden de la guía del panel.',
      shipping_decisions: [{ seller_id: vendedora.user.id, mode: 'self' }],
      payment_decisions: [{ seller_id: vendedora.user.id, method: 'transfer' }],
    },
  });
  if (compra.status >= 400) throw new Error(`no se pudo crear la orden de la guía: HTTP ${compra.status} ${JSON.stringify(compra.data?.detail ?? compra.data).slice(0, 200)}`);
  const [orden] = queryRows(`SELECT order_number, round(total_amount) FROM orders
    WHERE id = '${compra.data.orders[0].order_id}'`);
  await presentarDocumentacion(vendedora.access_token, '30-71009999-1', 'Vendedora Guía SRL');
  await presentarDocumentacion(segunda.access_token, '30-11111111-8', 'Segunda Guía SA');
  const [conPublicaciones] = queryRows(`SELECT c.name FROM categories c
    JOIN products p ON p.category_id = c.id AND p.status <> 'DELETED' GROUP BY c.name ORDER BY count(*) DESC LIMIT 1`);
  const contexto = await browser.newContext({ viewport });
  // Un control que no está no se espera medio minuto.
  contexto.setDefaultTimeout(10_000);
  const page = await contexto.newPage();
  return {
    browser, viewport, contexto, page, admin, vendedora, segunda, producto, productoDocumentado,
    compradora, telefonos, sello, publicar: (sesion, nombre) => publicar(nombre, sesion),
    orden: { numero: orden[0], total: Number(orden[1]) },
    categoriaConPublicaciones: conPublicaciones[0],
    nueva: { email: `guia.nueva.${sello}@example.com`, nombre: `Nueva Guía ${sello}`, clave: 'GuiaNueva1' },
    categoria: { nombre: `Guía categoría ${sello}`, sub: `Guía subcategoría ${sello}` },
    opcion: { valor: `guia_${sello.replace(/\W/g, '_')}`, etiqueta: `Guía unidad ${sello}` },
    esperarA: async (condicion, mensaje, limite = 15_000) => {
      const hasta = Date.now() + limite;
      while (Date.now() < hasta) {
        if (await condicion()) return;
        await new Promise((listo) => { setTimeout(listo, 200); });
      }
      throw new Falla(mensaje);
    },
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
  console.log(`Guía: ${RUTA_DE_LA_GUIA.replace(`${RAIZ}/`, '')}, ${guia.pasos.length} pasos, `
    + `${guia.pasos.reduce((s, p) => s + p.citas.length, 0)} textos citados, `
    + `${guia.sinComprobar?.length ?? 0} frases declaradas sin comprobar`);

  // Lo que la guía declara que no se comprueba tiene que seguir escrito donde
  // la lista dice. Si cambió, alguien tiene que volver a mirar su fuente.
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
      const producidas = new Set();
      for (const paso of guia.pasos) {
        const nombre = `Paso ${paso.numero}. ${paso.titulo}`;
        const recorrido = RECORRIDOS[paso.id];
        if (!recorrido) continue;
        const v = new Vista(ancho, guia, paso);
        const motivos = [];
        try {
          await recorrido(c, v);
          await v.mirar(c.page).catch(() => {});
          const faltan = paso.citas.filter((cita) => !aparece(cita, v.vistos));
          if (faltan.length) motivos.push(`la guía nombra ${faltan.map((f) => `«${f}»`).join(', ')} `
            + 'y el panel no lo mostró en este paso');
        } catch (error) {
          motivos.push(error instanceof Falla ? error.message : porQueNoSePudo(error));
          // Un paso roto no deja el panel en un estado raro para el siguiente.
          await c.page.keyboard.press('Escape').catch(() => {});
          await c.page.goto(WEB, { waitUntil: 'domcontentloaded' }).catch(() => {});
        }
        // Una frase que ya no está falla aunque su comprobación haya pasado.
        motivos.unshift(...v.sinFrase);
        if (motivos.length) {
          fallas.push(`${ancho}, ${nombre}: ${motivos.join('; ')}`);
          console.log(`[FALLA] ${nombre}: ${motivos.join('; ')}`);
        } else {
          console.log(`[OK] ${nombre} (${v.atadas} frases de resultado)`);
        }
        todoLoVisto.push(...v.vistos);
        for (const p of v.producidas) producidas.add(p);
      }
      for (const hueco of await inventario(c.page, guia)) {
        fallas.push(`${ancho}, inventario: ${hueco}`);
        console.log(`[FALLA] inventario: ${hueco}`);
      }
      for (const imagen of guia.imagenes.filter((i) => i.ancho === ancho)) {
        const clave = `${imagen.nombre}-${imagen.ancho}`;
        if (!producidas.has(clave)) fallas.push(`${ancho}: la guía muestra ${imagen.ruta} y ningún paso la genera`);
        else if (!existsSync(join(RAIZ, 'docs', imagen.ruta))) fallas.push(`${ancho}: falta la imagen ${imagen.ruta}; correr con --capturas`);
      }
      await c.contexto.close();
    }
    const sueltas = guia.citasDeAfuera.filter((cita) => !aparece(cita, todoLoVisto));
    for (const cita of sueltas) fallas.push(`fuera de los pasos, la guía nombra «${cita}» y ningún paso lo mostró`);
  } finally {
    await browser.close();
  }

  console.log('\n-------------------');
  if (fallas.length) {
    console.log(`LA GUÍA Y EL PANEL NO COINCIDEN: ${fallas.length}`);
    for (const falla of fallas) console.log(`  - ${falla}`);
    return 1;
  }
  console.log(`LA GUÍA Y EL PANEL COINCIDEN: ${guia.pasos.length} pasos en ${ANCHOS_PEDIDOS.join(' y ')}`
    + `${CAPTURAS ? `, capturas en ${CARPETA_DE_CAPTURAS.replace(`${RAIZ}/`, '')}` : ''}`);
  return 0;
}

main().then((codigo) => process.exit(codigo)).catch((error) => {
  console.error(`no se pudo correr: ${error.stack || error.message}`);
  process.exit(2);
});
