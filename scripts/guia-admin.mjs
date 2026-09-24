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
 *   2. Lo que el paso dice que pasa después, pasa. Eso lo comprueba el
 *      recorrido: quién puede entrar, qué se ve en el Mercado, qué ve quien
 *      vende.
 *   3. Nada del panel queda sin nombrar. Los controles que se ven en cada
 *      pestaña tienen que estar citados en su sección de la guía.
 *
 * Si algo no coincide, falla y nombra el paso. Salida: 0 si la guía y el
 * panel coinciden; 1 si algún paso no coincide; 2 si no se pudo correr.
 *
 * Necesita la API en 8000, el frontend de desarrollo en 5173 y la siembra
 * demo. Crea sus propias cuentas, publicaciones, una categoría y una opción,
 * todas con un sello en el nombre; lo que la guía elimina, se elimina.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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

function leerLaGuia(ruta) {
  const texto = readFileSync(ruta, 'utf8');
  const pasos = [];
  const patron = /^### Paso (\d+)\. (.+)\n<!-- recorrido: ([\w-]+) -->\n([\s\S]*?)(?=^### |^## |^---\s*$|(?![\s\S]))/gm;
  for (const m of texto.matchAll(patron)) {
    pasos.push({ numero: Number(m[1]), titulo: m[2].trim(), id: m[3], bloque: m[0], citas: citasDe(m[4]) });
  }
  let resto = texto;
  for (const paso of pasos) resto = resto.replace(paso.bloque, '');
  // Cada sección `## N. Título` agrupa los pasos de una pestaña.
  const secciones = [];
  for (const m of texto.matchAll(/^## (\d+)\. (.+)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)) {
    secciones.push({ titulo: m[2].trim(), citas: citasDe(m[3]).map(normalizar) });
  }
  const imagenes = [...texto.matchAll(/\]\((guia-panel-admin\/([\w-]+)-(escritorio|celular)\.png)\)/g)]
    .map((m) => ({ ruta: m[1], nombre: m[2], ancho: m[3] }));
  return { pasos, citasDeAfuera: citasDe(resto), secciones, imagenes };
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
  constructor(ancho, imagenes) {
    this.ancho = ancho;
    this.imagenes = imagenes;
    this.vistos = [];
    this.producidas = new Set();
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
    await abrirElPanel(page);
    await v.captura('entrar', page);
    await page.keyboard.press('Escape');
    await elPanel(page).waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {
      throw new Falla('Escape no cerró el panel');
    });
    await abrirElPanel(page);
    await elPanel(page).getByRole('button', { name: 'Cerrar' }).first().click();
    await elPanel(page).waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {
      throw new Falla('la cruz «×» no cerró el panel');
    });
    // Sólo una cuenta de administración ve el botón.
    const otro = await contextoCon(c.browser, c.viewport, c.vendedora);
    const suya = await otro.newPage();
    await suya.goto(WEB, { waitUntil: 'domcontentloaded' });
    await suya.getByRole('button', { name: 'Mi cuenta' }).first().waitFor({ timeout: 15_000 });
    exigir(await suya.getByRole('button', { name: 'Admin', exact: true }).count() === 0,
      'una cuenta que no es de administración ve el botón «Admin»');
    await otro.close();
  },

  async resumen(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Dashboard');
    await panel.getByText('Total de usuarios').waitFor({ timeout: 15_000 });
    await v.captura('resumen', page);
    const valorDe = async (rotulo) => {
      const tarjeta = panel.locator('[class*="statCard"]').filter({ hasText: rotulo });
      return (await tarjeta.locator('[class*="statValue"]').innerText()).trim();
    };
    const esperado = {
      'Total de usuarios': contar('SELECT count(*) FROM users'),
      'Usuarios comunes': contar("SELECT count(*) FROM users WHERE role = 'USER'"),
      Administradores: contar("SELECT count(*) FROM users WHERE role = 'ADMIN'"),
      'Productos Activos': contar("SELECT count(*) FROM products WHERE status = 'ACTIVE'"),
      'Órdenes Totales': contar('SELECT count(*) FROM orders'),
      'Órdenes en proceso': contar(`SELECT count(*) FROM orders WHERE status IN
        ('PLACED','CONFIRMED','AWAITING_TRANSFER_RECEIPT','TRANSFER_RECEIPT_SUBMITTED','PAID','SHIPPED')`),
      Completadas: contar("SELECT count(*) FROM orders WHERE status = 'DELIVERED'"),
    };
    for (const [rotulo, cantidad] of Object.entries(esperado)) {
      const visto = Number(await valorDe(rotulo));
      exigir(visto === cantidad, `«${rotulo}» dice ${visto} y en la base son ${cantidad}`);
    }
    const volumen = Number(queryRows(`SELECT COALESCE(round(sum(total_amount)), 0) FROM orders
      WHERE status IN ('PAID','SHIPPED','DELIVERED')`)[0][0]);
    const vistoVolumen = Number((await valorDe('Volumen vendido')).replace(/[^\d]/g, ''));
    exigir(vistoVolumen === volumen,
      `«Volumen vendido» dice ${vistoVolumen} y la suma de las pagadas, enviadas y entregadas es ${volumen}`);
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
    // Lo que dice cuando ninguna cuenta coincide.
    await panel.getByPlaceholder('Buscar por nombre o email').fill(`nadie-${Date.now()}`);
    await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    await esperarTexto(page, 'No hay usuarios que coincidan con el filtro.');
    exigir(await panel.locator('tbody tr').count() === 0, 'sin coincidencias, la tabla muestra filas');
    await v.mirar(page);
    await panel.getByPlaceholder('Buscar por nombre o email').fill(c.vendedora.user.email);
    await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    await c.esperarA(async () => (await panel.locator('tbody tr').count()) === 1
      && (await panel.locator('tbody tr').first().innerText()).includes(c.vendedora.user.email),
    'buscar por correo no dejó sólo esa cuenta');
    await v.mirar(page);
    await panel.getByPlaceholder('Buscar por nombre o email').fill('');
    await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    await panel.getByLabel('Filtrar usuarios por rol').selectOption('admin');
    await c.esperarA(async () => {
      const filas = await panel.locator('tbody tr').all();
      if (filas.length === 0) return false;
      for (const fila of filas) {
        if ((await fila.getByLabel('Rol del usuario').inputValue()) !== 'admin') return false;
      }
      return true;
    }, 'filtrar «Administradores» dejó cuentas que no son de administración');
    await v.mirar(page);
    await panel.getByLabel('Filtrar usuarios por rol').selectOption('');
    await panel.getByLabel('Filtrar usuarios por estado').selectOption('false');
    await page.waitForTimeout(800);
    const estados = await panel.locator('tbody tr').allInnerTexts();
    exigir(estados.every((fila) => /Inactivo/.test(fila)), 'filtrar «Solo inactivos» dejó cuentas activas');
    await v.mirar(page);
    await panel.getByLabel('Filtrar usuarios por estado').selectOption('');
    await page.waitForTimeout(500);
    await v.mirar(page);
  },

  async 'usuarios-crear'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Usuarios');
    await panel.getByRole('button', { name: '+ Crear Usuario' }).click();
    await panel.getByRole('heading', { name: 'Crear Nuevo Usuario' }).waitFor();
    await v.captura('usuarios-crear', page);
    // Sin los obligatorios, y con una contraseña corta: no crea nada.
    await panel.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
    await esperarTexto(page, 'Completá el email, la contraseña y el nombre: son obligatorios.');
    await v.mirar(page);
    await panel.getByPlaceholder('Email *').fill(c.nueva.email);
    await panel.getByPlaceholder('Nombre Completo *').fill(c.nueva.nombre);
    await panel.getByPlaceholder('Contraseña *').fill('abc');
    await panel.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
    await esperarTexto(page, 'La contraseña necesita al menos 6 caracteres.');
    await v.mirar(page);
    // Un correo que ya tiene cuenta.
    await panel.getByPlaceholder('Email *').fill(c.vendedora.user.email);
    await panel.getByPlaceholder('Contraseña *').fill(c.nueva.clave);
    await panel.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
    await esperarTexto(page, 'El email ya está registrado');
    await v.mirar(page);
    exigir(contar(`SELECT count(*) FROM users WHERE email = '${c.nueva.email}'`) === 0,
      'un alta rechazada creó la cuenta igual');
    // Ahora sí.
    await panel.getByPlaceholder('Email *').fill(c.nueva.email);
    await panel.getByLabel('Rol del nuevo usuario').selectOption('user');
    await panel.getByRole('button', { name: 'Crear Usuario', exact: true }).click();
    await esperarTexto(page, 'Usuario creado exitosamente');
    await v.mirar(page);
    const r = await pedir('/auth/login', { method: 'POST', body: { email: c.nueva.email, password: c.nueva.clave } });
    exigir(r.status === 200, `la cuenta recién creada no puede entrar: HTTP ${r.status}`);
    // «Cancelar» cierra sin crear.
    await panel.getByRole('button', { name: '+ Crear Usuario' }).click();
    await panel.getByRole('button', { name: 'Cancelar', exact: true }).click();
    exigir(!(await panel.getByRole('heading', { name: 'Crear Nuevo Usuario' }).isVisible()),
      '«Cancelar» no cerró el formulario de alta');
  },

  async 'usuarios-desactivar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Usuarios');
    await panel.getByPlaceholder('Buscar por nombre o email').fill(c.nueva.email);
    await panel.getByRole('button', { name: 'Buscar usuarios' }).click();
    const fila = panel.locator('tbody tr', { hasText: c.nueva.email });
    await fila.waitFor({ timeout: 15_000 });
    // Una sesión abierta de esa persona, para ver que se corta.
    const suSesion = await entrar(c.nueva.email, c.nueva.clave);
    await fila.getByRole('button', { name: 'Desactivar' }).click();
    const capa = page.getByRole('dialog', { name: 'Desactivar la cuenta' });
    await capa.waitFor();
    await v.captura('usuarios-desactivar', page);
    await capa.getByRole('button', { name: 'Cancelar' }).click();
    exigir(contar(`SELECT count(*) FROM users WHERE email = '${c.nueva.email}' AND is_active`) === 1,
      '«Cancelar» desactivó la cuenta igual');
    await fila.getByRole('button', { name: 'Desactivar' }).click();
    await confirmar(page, 'Desactivar la cuenta', 'Desactivar la cuenta', v);
    await fila.getByText('Inactivo').waitFor({ timeout: 10_000 });
    await v.mirar(page);
    // No puede entrar, y lo que ve al intentarlo.
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
    const conSesion = await pedir('/auth/me', { token: suSesion.access_token });
    exigir(conSesion.status >= 400, `la sesión abierta sigue sirviendo: /auth/me respondió ${conSesion.status}`);
    // Y se vuelve a activar.
    await fila.getByRole('button', { name: 'Activar' }).click();
    await confirmar(page, 'Activar la cuenta', 'Activar la cuenta', v);
    await fila.getByText('Activo', { exact: true }).waitFor({ timeout: 10_000 });
    await v.mirar(page);
    const otraVez = await pedir('/auth/login', { method: 'POST', body: { email: c.nueva.email, password: c.nueva.clave } });
    exigir(otraVez.status === 200, `reactivada, no puede entrar con su contraseña: HTTP ${otraVez.status}`);
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
    const vieja = await pedir('/auth/login', { method: 'POST', body: { email: c.nueva.email, password: c.nueva.clave } });
    exigir(vieja.status === 401, `la contraseña anterior sigue sirviendo: HTTP ${vieja.status}`);
    const conLaNueva = await pedir('/auth/login', { method: 'POST', body: { email: c.nueva.email, password: nueva } });
    exigir(conLaNueva.status === 200, `la contraseña nueva no sirve: HTTP ${conLaNueva.status}`);
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
    // Al volver a entrar ve «Admin».
    const suSesion = await entrar(c.nueva.email, c.nueva.clave);
    const otro = await contextoCon(c.browser, c.viewport, suSesion);
    const suya = await otro.newPage();
    await suya.goto(WEB, { waitUntil: 'domcontentloaded' });
    await suya.getByRole('button', { name: 'Admin', exact: true }).waitFor({ timeout: 15_000 }).catch(() => {
      throw new Falla('con acceso de administración, la cuenta no ve el botón «Admin»');
    });
    await otro.close();
    await fila.getByLabel('Rol del usuario').selectOption('user');
    await confirmar(page, 'Quitar acceso de administrador', 'Pasar a Usuario', v);
    await esperarTexto(page, 'Rol actualizado correctamente');
    exigir(contar(`SELECT count(*) FROM users WHERE email = '${c.nueva.email}' AND role = 'USER'`) === 1,
      '«Pasar a Usuario» no le quitó el acceso');
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
    await fila.getByLabel('Rol del usuario').selectOption('user');
    await confirmar(page, 'Quitar acceso de administrador', 'Pasar a Usuario', v);
    await esperarTexto(page, 'No puedes cambiar tu propio rol de administrador');
    await v.mirar(page);
    exigir(contar(`SELECT count(*) FROM users WHERE email = '${ADMIN.email}' AND is_active AND role = 'ADMIN'`) === 1,
      'la cuenta de administración cambió su propio estado o rol');
  },

  async 'productos-filtrar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Productos');
    await panel.locator('tbody tr').first().waitFor({ timeout: 15_000 });
    await v.captura('productos', page);
    await panel.getByLabel('Filtrar publicaciones por estado').selectOption('active');
    await page.waitForTimeout(800);
    const filas = await panel.locator('tbody tr').allInnerTexts();
    exigir(filas.length > 0 && filas.every((f) => /Activa/.test(f)), 'filtrar «Activa» dejó otras');
    await v.mirar(page);
    await panel.getByLabel('Filtrar publicaciones por estado').selectOption('');
    await page.waitForTimeout(500);
  },

  async 'productos-pausar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Productos');
    const fila = panel.locator('tbody tr', { hasText: c.producto.nombre });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByLabel('Estado del producto').selectOption('paused');
    await page.getByRole('dialog', { name: 'Cambiar el estado de la publicación' }).waitFor();
    await v.captura('productos-pausar', page);
    await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Pausada', v);
    await fila.getByText('Pausada').first().waitFor({ timeout: 10_000 });
    await v.mirar(page);
    exigir(!(await enElMercado(c.producto.nombre)), 'pausada, sigue en el Mercado');
    exigir(!(await suEnlaceAbre(c.producto.id)), 'pausada, su enlace directo sigue abriendo');
    // Quien vende la ve pausada, con «Activar», y la puede reactivar.
    const { page: suya, contexto } = await misPublicaciones(c.browser, c.viewport, c.vendedora, v);
    const tarjeta = suya.locator('[class*="productCard"], [class*="publicacion"]').filter({ hasText: c.producto.nombre }).first();
    await tarjeta.waitFor({ timeout: 15_000 });
    const texto = await tarjeta.innerText();
    exigir(/Pausado/.test(texto), `quien vende no la ve «Pausado»: ${texto.slice(0, 120)}`);
    await tarjeta.getByRole('button', { name: /Activar/ }).click();
    await suya.getByRole('button', { name: 'Activar', exact: true }).last().click();
    await c.esperarA(async () => enElMercado(c.producto.nombre), 'quien vende la reactivó y no volvió al Mercado');
    await contexto.close();
  },

  async 'productos-activar'(c, v) {
    const { page } = c;
    await pedir(`/admin/products/${c.producto.id}/status`, { method: 'PATCH', token: c.admin.access_token, body: { status: 'paused' } });
    const panel = await pestana(page, 'Productos');
    const fila = panel.locator('tbody tr', { hasText: c.producto.nombre });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByLabel('Estado del producto').selectOption('active');
    await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Activa', v);
    await fila.getByText('Activa').first().waitFor({ timeout: 10_000 });
    exigir(await enElMercado(c.producto.nombre), 'activa, no volvió al Mercado');
  },

  async 'productos-agotada'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Productos');
    const fila = panel.locator('tbody tr', { hasText: c.producto.nombre });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByLabel('Estado del producto').selectOption('sold_out');
    await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Agotada', v);
    await fila.getByText('Agotada').first().waitFor({ timeout: 10_000 });
    exigir(!(await enElMercado(c.producto.nombre)), 'agotada, sigue en el Mercado: la guía dice que deja de verse');
    exigir(!(await suEnlaceAbre(c.producto.id)), 'agotada, su enlace sigue abriendo: la guía dice que no');
    const { page: suya, contexto } = await misPublicaciones(c.browser, c.viewport, c.vendedora, v);
    const tarjeta = suya.locator('[class*="productCard"], [class*="publicacion"]').filter({ hasText: c.producto.nombre }).first();
    await tarjeta.waitFor({ timeout: 15_000 });
    exigir(/Activo/.test(await tarjeta.innerText()), 'agotada, quien vende no la ve «Activo»: la guía dice que sí');
    await contexto.close();
    await pedir(`/admin/products/${c.producto.id}/status`, { method: 'PATCH', token: c.admin.access_token, body: { status: 'active' } });
  },

  async 'productos-eliminar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Productos');
    const fila = panel.locator('tbody tr', { hasText: c.producto.nombre });
    await fila.waitFor({ timeout: 15_000 });
    await fila.getByLabel('Estado del producto').selectOption('deleted');
    await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Eliminada', v);
    await fila.getByText('Eliminada').first().waitFor({ timeout: 10_000 });
    await v.mirar(page);
    exigir(!(await enElMercado(c.producto.nombre)), 'eliminada, sigue en el Mercado');
    const suyas = await pedir('/products/my', { token: c.vendedora.access_token });
    exigir(!(suyas.data?.products || []).some((p) => p.id === c.producto.id),
      'eliminada, sigue en «Mis publicaciones» de quien vende');
    const { page: suya, contexto } = await misPublicaciones(c.browser, c.viewport, c.vendedora, v);
    exigir(!(await suya.locator('body').innerText()).includes(c.producto.nombre),
      'eliminada, quien vende la sigue viendo en «Mis publicaciones»');
    await contexto.close();
    // Se puede volver a «Activa», y reaparece.
    await fila.getByLabel('Estado del producto').selectOption('active');
    await confirmar(page, 'Cambiar el estado de la publicación', 'Pasar a Activa', v);
    await c.esperarA(async () => enElMercado(c.producto.nombre), 'vuelta a «Activa», no reapareció');
    // Y queda eliminada: es de la corrida.
    await pedir(`/admin/products/${c.producto.id}/status`, { method: 'PATCH', token: c.admin.access_token, body: { status: 'deleted' } });
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
    // En la tabla no hay nada para cambiar una orden.
    exigir(await fila.locator('select').count() === 0, 'la fila de una orden ofrece cambiarla');
    await fila.getByRole('button', { name: `Ver la orden ${numero}` }).click();
    const detalle = page.getByRole('dialog', { name: `Orden ${numero}` });
    await detalle.waitFor({ timeout: 10_000 });
    await v.captura('ordenes', page);
    // Lo que la guía advierte: sin artículos, correo ni dirección, y el
    // subtotal en cero; el total, el de la orden.
    const texto = (await detalle.innerText()).replace(/\s+/g, ' ');
    exigir(/Email: -/.test(texto) && /Dirección: -/.test(texto),
      'el detalle ya trae el correo o la dirección de quien compra: la advertencia de la guía quedó vieja');
    const total = Number((texto.match(/Total: \$\s?([\d.]+)/) || [])[1]?.replace(/\./g, ''));
    exigir(total === c.orden.total, `el total del detalle dice ${total} y la orden es de ${c.orden.total}`);
    const suya = await pedir('/orders/my?as_role=buyer', { token: c.compradora.access_token });
    const deElla = (suya.data || []).find((o) => o.order_number === numero);
    exigir((deElla?.items || []).length > 0, 'quien compró no ve los artículos de su orden');
    const botones = await detalle.getByRole('button').allInnerTexts();
    exigir(botones.every((b) => b.trim() === '×'), `el detalle de la orden ofrece acciones: ${botones.join(', ')}`);
    exigir(await detalle.locator('select, input, textarea').count() === 0, 'el detalle de la orden tiene campos para cambiarla');
    await page.keyboard.press('Escape');
    await detalle.waitFor({ state: 'hidden', timeout: 10_000 });
    await fila.getByRole('button', { name: `Ver la orden ${numero}` }).click();
    await detalle.getByRole('button', { name: 'Cerrar' }).click();
    await detalle.waitFor({ state: 'hidden', timeout: 10_000 });
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
    await esperarTexto(page, 'Categoría creada exitosamente');
    await v.mirar(page);
    const categorias = (await pedir('/catalog/categories')).data || [];
    exigir(categorias.some((cat) => cat.name === c.categoria.nombre), 'la categoría nueva no llegó al Mercado');
    const mercado = await c.browser.newContext({ viewport: c.viewport });
    const suya = await mercado.newPage();
    await suya.goto(`${WEB}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await c.esperarA(async () => (await suya.locator('#catalog-category option').allTextContents())
      .includes(c.categoria.nombre), 'la categoría nueva no aparece en el filtro «Categoría» del Mercado');
    await v.mirar(suya);
    await mercado.close();
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
    const categorias = (await pedir('/catalog/categories')).data || [];
    const suya = categorias.find((cat) => cat.name === c.categoria.nombre);
    exigir((suya?.subcategories || []).some((s) => s.name === c.categoria.sub),
      'la subcategoría nueva no se ofrece al publicar');
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
    await tarjeta.locator('[class*="editCategoryForm"] textarea').fill('Editada por la guía del panel.');
    await tarjeta.getByRole('button', { name: 'Guardar Cambios' }).click();
    await esperarTexto(page, 'Categoría actualizada');
    await v.mirar(page);
    // Una categoría con publicaciones: el tipo no se cambia.
    const conPublicaciones = c.categoriaConPublicaciones;
    const otra = panel.locator('[class*="categoryCard"]').filter({ hasText: conPublicaciones });
    await otra.getByRole('button', { name: `Editar la categoría ${conPublicaciones}` }).click();
    await otra.getByRole('heading', { name: 'Editar Categoría' }).waitFor();
    exigir(await otra.locator('select').isDisabled(), `en «${conPublicaciones}», con publicaciones, el tipo se puede cambiar`);
    await v.mirar(page);
    await otra.getByRole('button', { name: 'Cancelar' }).click();
  },

  async 'categorias-eliminar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Categorías');
    // Una subcategoría en uso no se elimina.
    const [enUso] = queryRows(`SELECT s.id FROM subcategories s
      JOIN products p ON p.subcategory_id = s.id GROUP BY s.id LIMIT 1`);
    if (enUso) {
      const r = await pedir(`/admin/subcategories/${enUso[0]}`, { method: 'DELETE', token: c.admin.access_token });
      exigir(r.status >= 400, `se eliminó una subcategoría en uso: HTTP ${r.status}`);
    }
    const tarjeta = panel.locator('[class*="categoryCard"]').filter({ hasText: c.categoria.nombre });
    await tarjeta.getByRole('button', { name: `Mostrar las subcategorías de ${c.categoria.nombre}` }).click();
    await tarjeta.getByRole('button', { name: `Eliminar la subcategoría ${c.categoria.sub}` }).click();
    await confirmar(page, 'Eliminar la subcategoría', 'Eliminar la subcategoría', v);
    await esperarTexto(page, 'Subcategoría eliminada');
    await v.mirar(page);
    // La que tiene publicaciones no se puede eliminar.
    const otra = panel.locator('[class*="categoryCard"]').filter({ hasText: c.categoriaConPublicaciones });
    const suEliminar = otra.getByRole('button', { name: `Eliminar la categoría ${c.categoriaConPublicaciones}` });
    exigir(await suEliminar.isDisabled(), `«Eliminar» de «${c.categoriaConPublicaciones}» no está apagado`);
    await v.mirar(page);
    await tarjeta.getByRole('button', { name: `Eliminar la categoría ${c.categoria.nombre}` }).click();
    await confirmar(page, 'Eliminar la categoría', 'Eliminar la categoría', v);
    await esperarTexto(page, 'Categoría eliminada');
    await v.mirar(page);
    const categorias = (await pedir('/catalog/categories')).data || [];
    exigir(!categorias.some((cat) => cat.name === c.categoria.nombre), 'eliminada, la categoría sigue en el Mercado');
  },

  async 'documentacion-revisar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Documentación');
    const fila = panel.locator('tbody tr', { hasText: c.vendedora.user.email });
    await fila.waitFor({ timeout: 15_000 });
    await v.captura('documentacion', page);
    const [ventana] = await Promise.all([
      page.waitForEvent('popup', { timeout: 10_000 }),
      fila.getByRole('button', { name: 'constancia.pdf' }).click(),
    ]).catch(() => { throw new Falla('tocar el nombre de la constancia no la abrió en otra pestaña'); });
    await ventana.close();
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
    await fila.getByText('Documentación revisada').waitFor({ timeout: 10_000 });
    exigir(/por .+ el /.test(await fila.innerText()), 'aprobada, la fila no dice quién la revisó ni cuándo');
    exigir(/Ya revisada/.test(await fila.innerText()), 'aprobada, la fila no dice «Ya revisada»');
    await v.mirar(page);
    // Sus publicaciones muestran el distintivo.
    const mercado = await c.browser.newContext({ viewport: c.viewport });
    const ficha = await mercado.newPage();
    await ficha.goto(`${WEB}/?section=product&id=${c.productoDocumentado.id}`, { waitUntil: 'domcontentloaded' });
    await ficha.locator('main[aria-busy="false"]:has(#detalle-titulo)').waitFor({ timeout: 15_000 });
    exigir(/Documentación revisada/.test(await ficha.locator('main').innerText()),
      'aprobada, la ficha de su publicación no dice «Documentación revisada»');
    await v.mirar(ficha);
    // Otra constancia retira el distintivo.
    await presentarDocumentacion(c.vendedora.access_token, '30-11111111-8', 'Guía Admin SRL');
    await ficha.reload({ waitUntil: 'domcontentloaded' });
    await ficha.locator('main[aria-busy="false"]:has(#detalle-titulo)').waitFor({ timeout: 15_000 });
    exigir(!/Documentación revisada/.test(await ficha.locator('main').innerText()),
      'con otra constancia presentada, la ficha sigue diciendo «Documentación revisada»');
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
    exigir(await confirmarRechazo.isDisabled(), 'sin motivo, «Confirmar rechazo» está habilitado');
    await v.mirar(page);
    await fila.getByRole('button', { name: 'Cancelar' }).click();
    await fila.getByRole('button', { name: 'Rechazar' }).click();
    const MOTIVO = 'La constancia está vencida: presentá la del año en curso.';
    await fila.getByLabel('Motivo del rechazo').fill(MOTIVO);
    await confirmarRechazo.click();
    await esperarTexto(page, `Documentación de ${c.segunda.user.full_name} rechazada.`);
    await v.mirar(page);
    // Quien vende ve el estado y el motivo.
    const contexto = await contextoCon(c.browser, c.viewport, c.segunda);
    const suya = await contexto.newPage();
    await suya.goto(WEB, { waitUntil: 'domcontentloaded' });
    await suya.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await esperarTexto(suya, 'Por qué se rechazó:');
    const suCuenta = (await suya.locator('body').innerText()).replace(/\s+/g, ' ');
    exigir(suCuenta.includes(MOTIVO), 'quien vende no ve el motivo del rechazo');
    await v.mirar(suya);
    await contexto.close();
    // Ya decidida, no se vuelve a decidir; y puede presentar otra.
    await panel.getByLabel('Filtrar documentación por estado').selectOption('rechazada');
    const decidida = panel.locator('tbody tr', { hasText: c.segunda.user.email });
    await decidida.getByText('Ya revisada').waitFor({ timeout: 10_000 });
    exigir(await decidida.getByRole('button', { name: 'Aprobar' }).count() === 0,
      'una documentación ya decidida se puede volver a decidir');
    await v.mirar(page);
    await presentarDocumentacion(c.segunda.access_token, '27-12345678-0', 'Segunda Guía SA');
  },

  async 'config-tipos'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Configuración');
    await panel.getByRole('heading', { name: /Configuración de Formularios/ }).waitFor({ timeout: 15_000 });
    for (const lista of ['Tipos de Cobro', 'Disponibilidad', 'Tiempo de Respuesta', 'Unidades']) {
      await panel.getByRole('button', { name: lista }).click();
      await page.waitForTimeout(400);
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
    exigir((await unidadesAlPublicar(c, v)).includes(c.opcion.etiqueta), 'la unidad nueva no aparece en «Unidad» al publicar');
  },

  async 'config-editar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Configuración');
    await panel.getByRole('button', { name: 'Unidades' }).click();
    await panel.getByRole('button', { name: `Editar la opción ${c.opcion.etiqueta}` }).click();
    const valor = panel.getByLabel('Valor interno de la opción (no se puede cambiar)');
    exigir(await valor.getAttribute('readonly') !== null, 'el valor interno se puede cambiar');
    await panel.getByLabel('Estado de la opcion').selectOption('inactive');
    await v.mirar(page);
    await panel.getByRole('button', { name: `Guardar la opción ${c.opcion.etiqueta}` }).click();
    await esperarTexto(page, 'Opción actualizada');
    await v.mirar(page);
    exigir(!(await unidadesAlPublicar(c, v)).includes(c.opcion.etiqueta), 'inactiva, la unidad se sigue ofreciendo al publicar');
  },

  async 'config-eliminar'(c, v) {
    const { page } = c;
    const panel = await pestana(page, 'Configuración');
    await panel.getByRole('button', { name: 'Unidades' }).click();
    await panel.getByRole('button', { name: `Eliminar la opción ${c.opcion.etiqueta}` }).click();
    await confirmar(page, 'Eliminar la opción', 'Eliminar la opción', v);
    await esperarTexto(page, 'Opción eliminada');
    await v.mirar(page);
    exigir(contar(`SELECT count(*) FROM form_options WHERE value = '${c.opcion.valor}'`) === 0,
      'eliminada, la opción sigue en la base');
  },
};

RECORRIDOS['sin-conexion'] = async (c, v) => {
  const { page } = c;
  await pestana(page, 'Dashboard');
  // La lista de usuarios no contesta.
  const cortar = (ruta) => ruta.fulfill({ status: 503, body: '{"detail":"no disponible"}' });
  await page.route('**/api/admin/users?*', cortar);
  const panel = await pestana(page, 'Usuarios');
  await esperarTexto(page, 'No se pudo cargar la lista de usuarios.');
  exigir(await panel.locator('tbody tr').count() === 0, 'con la lista caída, el panel muestra filas');
  await v.mirar(page);
  // Vuelve la conexión.
  await page.unroute('**/api/admin/users?*', cortar);
  await panel.getByRole('button', { name: 'Reintentar' }).click();
  await panel.locator('tbody tr').first().waitFor({ timeout: 15_000 }).catch(() => {
    throw new Falla('«Reintentar» no volvió a cargar la lista');
  });
  await v.mirar(page);
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
  const publicar = async (nombre) => {
    const r = await pedir('/products', {
      method: 'POST', token: vendedora.access_token,
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
    compradora, orden: { numero: orden[0], total: Number(orden[1]) },
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
    + `${guia.pasos.reduce((s, p) => s + p.citas.length, 0)} textos citados`);

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
        const v = new Vista(ancho, guia.imagenes);
        try {
          await recorrido(c, v);
          await v.mirar(c.page).catch(() => {});
          const faltan = paso.citas.filter((cita) => !aparece(cita, v.vistos));
          if (faltan.length) throw new Falla(`la guía nombra ${faltan.map((f) => `«${f}»`).join(', ')} `
            + 'y el panel no lo mostró en este paso');
          console.log(`[OK] ${nombre}`);
        } catch (error) {
          const motivo = error instanceof Falla ? error.message : porQueNoSePudo(error);
          fallas.push(`${ancho}, ${nombre}: ${motivo}`);
          console.log(`[FALLA] ${nombre}: ${motivo}`);
          // Un paso roto no deja el panel en un estado raro para el siguiente.
          await c.page.keyboard.press('Escape').catch(() => {});
          await c.page.goto(WEB, { waitUntil: 'domcontentloaded' }).catch(() => {});
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
