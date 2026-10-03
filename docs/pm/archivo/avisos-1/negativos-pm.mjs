// Negativos de PM para AVISOS-1, en un celular emulado con pantalla táctil (390 px).
// Corre desde la raíz del worktree candidato: node <ruta>/negativos-pm.mjs
// Necesita la API en 8000, el frontend en 5173 y la siembra local (usuarios inventados).
// A. Deslizar el error 120 px de costado lo cierra; 30 px no.
// B. Deslizar hacia abajo 120 px lo cierra.
// C. Tocar con el dedo un aviso bueno: ¿sigue a los 9 s? (D1 de la Dev)
// D. Ocho errores seguidos: cuántos toques hacen falta para limpiarlos.
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const API = 'http://localhost:8000/api';
const FRONT = 'http://localhost:5173';
const post = async (ruta, body, token) => {
  const r = await fetch(`${API}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const sesion = (await post('/auth/login', { email: 'vendedor@ejemplo.com', password: 'vendedor123' })).data;
const sql = (q) => execFileSync('/usr/bin/docker', ['exec', 'topgreen-db', 'psql', '-U', 'topgreen', '-d', 'topgreen', '-Atc', q])
  .toString().trim();
const [subId, catId] = sql("SELECT s.id || '|' || c.id FROM subcategories s JOIN categories c ON c.id = s.category_id "
  + "WHERE c.slug = 'maquinaria-agricola' AND s.slug = 'tractores'").split('|');
const locId = sql("SELECT id FROM localities WHERE name = 'Pergamino' AND province_name = 'Buenos Aires' LIMIT 1");
const alta = await post('/products', {
  name: `Aviso PM ${Date.now()}`, description: 'Negativo de PM.', category_id: catId, subcategory_id: subId,
  price: 1000, stock: 3, unit: 'unidad', locality_id: locId, publication_type: 'producto',
  operation_kind: 'activo', condition: 'usado',
}, sesion.access_token);
if (!alta.data?.id) throw new Error(`alta: ${alta.status} ${JSON.stringify(alta.data).slice(0, 200)}`);
const id = alta.data.id;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(({ a, r }) => {
  localStorage.setItem('access_token', a);
  localStorage.setItem('refresh_token', r);
}, { a: sesion.access_token, r: sesion.refresh_token });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(`${FRONT}/?section=account`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /publicaciones/i }).first().click();
const tarjeta = page.locator('[class*="_productCard_"]').filter({ hasText: alta.data.name }).first();
await tarjeta.waitFor({ state: 'visible', timeout: 20_000 });

const avisos = () => page.evaluate(() => [...document.querySelectorAll('[class*="_toastContainer_"] [role]')]
  .filter((n) => !/_saliendo_/.test(n.className)).map((n) => n.getAttribute('role')));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const alternar = async () => {
  await tarjeta.locator('[class*="_toggleBtn_"]').tap();
  const conf = page.locator('[class*="_confirmModal_"]');
  await conf.waitFor({ state: 'visible', timeout: 10_000 });
  await conf.locator('[class*="_confirmButton_"]').tap();
  await conf.waitFor({ state: 'hidden', timeout: 10_000 });
};
const cortar = (si) => (si
  ? page.route(`**/api/products/${id}`, (r) => (r.request().method() === 'PATCH' ? r.abort('failed') : r.continue()))
  : page.unroute(`**/api/products/${id}`));
const deslizar = async (dx, dy) => {
  const caja = await page.locator('[class*="_toastContainer_"] [role]').last().boundingBox();
  const x = caja.x + caja.width / 3; const y = caja.y + caja.height / 2;
  const t = (type, px, py) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }],
  });
  await t('touchStart', x, y);
  for (let i = 1; i <= 6; i += 1) { await t('touchMove', x + (dx * i) / 6, y + (dy * i) / 6); await espera(16); }
  await t('touchEnd');
  await espera(500);
};
const salida = [];

await cortar(true);
await alternar();
await page.waitForFunction(() => document.querySelector('[class*="_toastContainer_"] [role="alert"]'), null, { timeout: 10_000 });
await deslizar(30, 0);
salida.push(`A1. deslizar 30 px de costado: quedan ${(await avisos()).length} (tiene que quedar 1)`);
await deslizar(120, 0);
salida.push(`A2. deslizar 120 px de costado: quedan ${(await avisos()).length} (tiene que quedar 0)`);
await alternar();
await page.waitForFunction(() => document.querySelector('[class*="_toastContainer_"] [role="alert"]'), null, { timeout: 10_000 });
await deslizar(0, 120);
salida.push(`B. deslizar 120 px hacia abajo: quedan ${(await avisos()).length} (tiene que quedar 0)`);
await deslizar(0, 0).catch(() => {});

await cortar(false);
await alternar();
await page.waitForFunction(() => document.querySelector('[class*="_toastContainer_"] [role="status"]'), null, { timeout: 10_000 });
const caja = await page.locator('[class*="_toastContainer_"] [role="status"]').last().boundingBox();
await page.touchscreen.tap(caja.x + 30, caja.y + caja.height / 2);
await espera(9_000);
salida.push(`C. tocar un aviso bueno con el dedo: a los 9 s quedan ${(await avisos()).length}`);
await page.touchscreen.tap(195, 300);
await espera(5_000);
salida.push(`C2. tocar otra parte de la pantalla: a los 5 s más quedan ${(await avisos()).length}`);

await cortar(true);
for (let i = 0; i < 8; i += 1) await alternar();
await espera(800);
const pie = await page.evaluate(() => {
  const r = document.querySelector('[class*="_toastContainer_"] ol').getBoundingClientRect();
  return Math.round(r.top);
});
let toques = 0;
while ((await avisos()).length && toques < 20) {
  await page.locator('[class*="_toastContainer_"] [data-cerrar]').last().tap();
  toques += 1;
  await espera(350);
}
salida.push(`D. ocho errores seguidos: la pila empieza en y=${pie} de 844; hicieron falta ${toques} toques para limpiarla`);

await browser.close();
console.log(salida.join('\n'));
