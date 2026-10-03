// El panel de administración salta con cada aviso: mide cuánto se mueve un botón del contenido.
import { chromium, login, FE } from './lib.mjs';
const s = await login('admin@topgreen.com', 'admin123');
const b = await chromium.launch();
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844, touch: true }, { width: 320, height: 568, touch: true }]) {
  const c = await b.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.touch });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  await p.goto(FE, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: 'Admin', exact: true }).click();
  const panel = p.getByRole('dialog', { name: 'Administración' });
  await panel.waitFor();
  await panel.getByRole('button', { name: 'Configuración', exact: true }).click();
  await p.waitForTimeout(1500);
  await panel.getByRole('button', { name: '+ Nueva Opción' }).click();
  const boton = panel.locator('button', { hasText: 'Crear opción' }).first();
  const medir = async () => p.evaluate(() => {
    const d = document.querySelector('[aria-label="Administración"]');
    const r = d.getBoundingClientRect();
    const cont = d.querySelector('[class*="_content_"]');
    // primera fila de la tabla/lista de opciones
    const fila = d.querySelector('tbody tr button, [class*="_content_"] table button');
    const fr = fila?.getBoundingClientRect();
    return { panelTop: Math.round(r.top), panelBottom: Math.round(r.bottom), panelH: Math.round(r.height),
      contH: cont && Math.round(cont.clientHeight), scrollTop: cont && Math.round(cont.scrollTop),
      fila: fila && `${fila.textContent.trim()}@y=${Math.round(fr.top)}`, avisos: document.documentElement.hasAttribute('data-avisos') };
  });
  const antes = await medir();
  const bb = await boton.boundingBox();
  if (vp.touch) await boton.tap(); else await boton.click();
  await p.locator('[class*="_toastContainer_"] [role]').first().waitFor();
  await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const con = await medir();
  const bb2 = await boton.boundingBox();
  const aviso = await p.locator('[class*="_toastContainer_"] [role]').first().boundingBox();
  await p.waitForFunction(() => !document.documentElement.hasAttribute('data-avisos'), null, { timeout: 10000 });
  const despues = await medir();
  console.log(`${vp.width}x${vp.height}${vp.touch ? ' táctil' : ''}`);
  console.log('  sin aviso :', JSON.stringify(antes), `botón «${(await boton.innerText()).trim()}» y=${Math.round(bb.y)}`);
  console.log('  con aviso :', JSON.stringify(con), `botón y=${Math.round(bb2.y)} (se movió ${Math.round(bb2.y - bb.y)} px); aviso top=${Math.round(aviso.y)}`);
  console.log('  se fue    :', JSON.stringify(despues));
  await c.close();
}
await b.close();
