#!/usr/bin/env node
/**
 * Puerta automática de accesibilidad.
 *
 * Recorre las rutas principales, públicas y autenticadas, en escritorio y en
 * celular, y corre axe sobre cada una. Falla ante cualquier violación
 * `serious` o `critical` y muestra regla, ruta y elemento.
 *
 * NO reemplaza a `npm run contraste` ni a `npm run smoke`:
 *   - `contraste` mide parejas texto/fondo que axe deja en "incompleto",
 *     porque axe no resuelve gradientes, texto sobre foto ni opacidad heredada;
 *   - `smoke` verifica el comportamiento, que axe no mira.
 *
 * Requiere la API en :8000 y el frontend en :5173, con el seed cargado.
 *
 *   npm run a11y                  # falla con serious o critical
 *   npm run a11y -- --todas       # además lista minor y moderate
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const API = process.env.A11Y_API_URL || 'http://127.0.0.1:8000/api';
const WEB = process.env.A11Y_WEB_URL || 'http://localhost:5173';
const VERTODAS = process.argv.includes('--todas');

const BLOQUEANTES = new Set(['serious', 'critical']);
const MEDIDAS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'celular', width: 390, height: 844 },
];

const hallazgos = [];
const informativos = [];
let rutasRevisadas = 0;

async function ingresar(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`No pude ingresar como ${email}: HTTP ${r.status}`);
  const d = await r.json();
  return { access: d.access_token, refresh: d.refresh_token };
}

async function contexto(navegador, viewport, tokens) {
  const ctx = await navegador.newContext({ viewport });
  if (tokens) {
    await ctx.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: tokens.access, r: tokens.refresh });
  }
  return ctx;
}

async function revisar(page, ruta, medida) {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  rutasRevisadas += 1;

  let bloqueantes = 0;
  for (const v of resultado.violations) {
    const fila = {
      medida: medida.nombre,
      ruta,
      regla: v.id,
      impacto: v.impact || 'sin impacto',
      descripcion: v.help,
      nodos: v.nodes.map((n) => `${n.target.join(' ')}  ${(n.html || '').replace(/\s+/g, ' ').slice(0, 90)}`),
      total: v.nodes.length,
    };
    if (BLOQUEANTES.has(v.impact)) { hallazgos.push(fila); bloqueantes += 1; } else { informativos.push(fila); }
  }
  const marca = bloqueantes === 0 ? '✓' : '✗';
  const extra = resultado.violations.length - bloqueantes;
  console.log(`  ${marca} ${medida.nombre.padEnd(10)} ${ruta.padEnd(28)} ${bloqueantes} bloqueantes`
    + (extra ? `, ${extra} menores` : ''));
}

/* --- recorridos ---------------------------------------------------------- */

async function publicas(page, medida) {
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await revisar(page, 'inicio', medida);

  await page.getByRole('button', { name: 'Ingresar' }).first().click();
  await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  await revisar(page, 'ingreso', medida);

  await page.getByRole('button', { name: /Reg[íi]strate aqu[íi]/i }).first().click();
  await page.getByRole('heading', { name: 'Crear Cuenta' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  await revisar(page, 'registro', medida);
  // los modales de autenticación no cierran con Escape: se cierra con el botón
  await page.getByRole('button', { name: 'Cerrar' }).first().click();
  await page.waitForTimeout(600);

  // las otras tres públicas están a un clic del encabezado y el barrido de
  // contraste ya las cubre; sin ellas las dos puertas medirían distinto
  for (const [boton, ruta] of [['Quienes Somos', 'quienes somos'], ['Servicios', 'servicios'], ['Contacto', 'contacto']]) {
    await page.getByRole('button', { name: boton, exact: true }).first().click();
    await page.waitForTimeout(1300);
    await revisar(page, ruta, medida);
  }
}

async function comprador(page, medida) {
  await page.goto(`${WEB}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
  await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1500);
  await revisar(page, 'catálogo', medida);

  await page.getByRole('button', { name: /Ver detalle|Detalle/ }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await revisar(page, 'detalle de producto', medida);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: /Agregar/ }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Carrito/ }).click();
  await page.waitForTimeout(1000);
  await revisar(page, 'carrito', medida);

  await page.getByRole('button', { name: 'Continuar compra' }).click();
  await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  await revisar(page, 'checkout: envío', medida);

  await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
  await page.locator('form select').selectOption('Buenos Aires').catch(() => {});
  await page.getByPlaceholder('Rosario').fill('Pergamino');
  await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
  await page.getByPlaceholder('2000').fill('2700');
  await page.locator('form:has(h2) button[type="submit"]').click();
  await page.getByRole('heading', { name: /M.todo de Pago/ }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  await revisar(page, 'checkout: pago', medida);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.locator('button').filter({ hasText: '👤' }).first().click();
  await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(700);
  await revisar(page, 'panel del comprador', medida);
  await page.getByRole('button', { name: 'Mis Compras' }).click().catch(() => {});
  await page.waitForTimeout(1200);
  await revisar(page, 'panel: mis compras', medida);
}

async function vendedor(page, medida) {
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.locator('button').filter({ hasText: '👤' }).first().click();
  await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(700);
  await revisar(page, 'panel del vendedor', medida);
  await page.getByRole('button', { name: 'Mis Ventas' }).click();
  await page.waitForTimeout(1200);
  await revisar(page, 'panel: mis ventas', medida);
  await page.getByRole('button', { name: 'Mis Productos' }).click().catch(() => {});
  await page.waitForTimeout(1200);
  await revisar(page, 'panel: mis productos', medida);
}

async function administracion(page, medida) {
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const boton = page.getByRole('button', { name: /Admin/i }).first();
  if (!(await boton.count())) return;
  await boton.click();
  await page.waitForTimeout(2000);
  await revisar(page, 'administración', medida);
  // acotado a la barra de pestañas del panel: fuera de ella hay botones con
  // el mismo texto en la página que queda detrás del modal
  const pestanias = page.locator('[class*="_tabs_"]').first();
  for (const nombre of ['Usuarios', 'Productos', 'Órdenes']) {
    const b = pestanias.getByRole('button', { name: new RegExp(nombre, 'i') }).first();
    if (await b.count()) {
      await b.click();
      await page.waitForTimeout(1400);
      await revisar(page, `administración: ${nombre.toLowerCase()}`, medida);
    }
  }
}

/* --- ejecución ----------------------------------------------------------- */

const navegador = await chromium.launch({ headless: true });
try {
  const cuentas = {
    comprador: await ingresar('cliente@ejemplo.com', 'cliente123'),
    vendedor: await ingresar('vendedor@ejemplo.com', 'vendedor123'),
    admin: await ingresar('admin@topgreen.com', 'admin123'),
  };

  for (const medida of MEDIDAS) {
    console.log(`\n=== ${medida.nombre} ${medida.width}x${medida.height} ===`);
    const viewport = { width: medida.width, height: medida.height };

    for (const [tokens, recorrido] of [
      [null, publicas],
      [cuentas.comprador, comprador],
      [cuentas.vendedor, vendedor],
      [cuentas.admin, administracion],
    ]) {
      const ctx = await contexto(navegador, viewport, tokens);
      const page = await ctx.newPage();
      await recorrido(page, medida);
      await ctx.close();
    }
  }
} finally {
  await navegador.close();
}

/* --- informe ------------------------------------------------------------- */

const porRegla = new Map();
for (const h of hallazgos) {
  if (!porRegla.has(h.regla)) porRegla.set(h.regla, { ...h, veces: 0, rutas: new Set(), unicos: new Set() });
  const g = porRegla.get(h.regla);
  g.veces += h.total;
  g.rutas.add(`${h.medida}/${h.ruta}`);
  h.nodos.forEach((n) => g.unicos.add(n));
}

console.log(`\n=== resumen ===`);
console.log(`  ${rutasRevisadas} pantallas revisadas`);
console.log(`  ${hallazgos.length} violaciones serious o critical (${porRegla.size} reglas distintas)`);
console.log(`  ${informativos.length} violaciones minor o moderate, no bloquean`);

if (porRegla.size) {
  console.log(`\n=== bloqueantes ===`);
  for (const g of porRegla.values()) {
    console.log(`\n  [${g.impacto}] ${g.regla} — ${g.descripcion}`);
    console.log(`    ${g.veces} elementos en: ${[...g.rutas].join(', ')}`);
    [...g.unicos].slice(0, 12).forEach((n) => console.log(`      · ${n}`));
    if (g.unicos.size > 12) console.log(`      … y ${g.unicos.size - 12} más`);
  }
}

if (VERTODAS && informativos.length) {
  const menores = new Map();
  for (const h of informativos) {
    if (!menores.has(h.regla)) menores.set(h.regla, { ...h, rutas: new Set() });
    menores.get(h.regla).rutas.add(`${h.medida}/${h.ruta}`);
  }
  console.log(`\n=== menores, informativas ===`);
  for (const g of menores.values()) {
    console.log(`  [${g.impacto}] ${g.regla} — ${g.descripcion}`);
    console.log(`    en: ${[...g.rutas].join(', ')}`);
  }
}

console.log(`\n${hallazgos.length === 0 ? 'SIN VIOLACIONES BLOQUEANTES' : `${hallazgos.length} VIOLACIONES BLOQUEANTES`}`);
process.exit(hallazgos.length === 0 ? 0 : 1);
