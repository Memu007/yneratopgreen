// Panel de administración: alto de las filas de Usuarios/Productos/Órdenes vs. el salto de la capa
// cuando aparece y cuando se va (sola, a los 4 s) un aviso. Sólo mide; no cambia nada.
import { chromium, login, FE } from './lib.mjs';
const s = await login('admin@topgreen.com', 'admin123');
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [1366, 768], [390, 844]]) {
  const touch = w < 800;
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  await p.goto(FE, { waitUntil: 'domcontentloaded' });
  await (touch ? p.getByRole('button', { name: 'Admin', exact: true }).tap() : p.getByRole('button', { name: 'Admin', exact: true }).click());
  const panel = p.getByRole('dialog', { name: 'Administración' });
  await panel.waitFor();
  for (const tab of ['Usuarios', 'Productos', 'Órdenes']) {
    await panel.getByRole('button', { name: tab, exact: true }).click();
    await p.waitForTimeout(1500);
    const filas = async () => p.evaluate(() => {
      const d = document.querySelector('[aria-label="Administración"]');
      const rows = [...d.querySelectorAll('tbody tr')].slice(0, 6);
      return rows.map(r => { const q = r.getBoundingClientRect(); const ctl = r.querySelector('select, button'); const cq = ctl?.getBoundingClientRect(); return { top: Math.round(q.top), alto: Math.round(q.height), ctl: ctl && `${ctl.tagName}«${(ctl.textContent || '').trim().slice(0, 12)}» ${Math.round(cq.top)}-${Math.round(cq.bottom)}` }; });
    });
    const sin = await filas();
    await p.evaluate(() => { document.documentElement.style.setProperty('--tg-avisos-alto', '52px'); document.documentElement.setAttribute('data-avisos', ''); });
    const con = await filas();
    await p.evaluate(() => { document.documentElement.style.removeProperty('--tg-avisos-alto'); document.documentElement.removeAttribute('data-avisos'); });
    if (!sin.length) { console.log(`${w}x${h} ${tab}: sin filas de tabla`); continue; }
    const salto = con[0].top - sin[0].top;
    const altos = sin.map(f => f.alto);
    console.log(`${w}x${h} ${tab}: alto de filas ${Math.min(...altos)}-${Math.max(...altos)} px; salto al aparecer un aviso de una línea: ${salto} px (y al irse, ${-salto}); fila 1 control ${sin[0].ctl} → ${con[0].ctl}; fila 2 control ${sin[1]?.ctl}`);
  }
  await c.close();
}
await b.close();
