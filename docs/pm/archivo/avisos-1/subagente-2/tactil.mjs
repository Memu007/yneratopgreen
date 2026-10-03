// Puntos 2 y 3 en un celular emulado (hasTouch, isMobile): tocar no pausa; deslizar de costado cierra;
// deslizar vertical no cierra. Con toques reales por CDP.
import { readFileSync } from 'node:fs';
import { chromium, login, FE, API, pid } from './lib.mjs';
const s = await login(readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim(), 'advaviso123');
const id = await pid('Kit de Filtros');
const b = await chromium.launch();
for (const [w, h] of [[390, 844], [320, 568]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  const deslizar = async (x0, y0, dx, dy) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / 10, y: y0 + dy * i / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await p.goto(`${FE}/?section=product&id=${id}`, { waitUntil: 'domcontentloaded' });
  const agregar = p.getByRole('button', { name: /^Agregar/ });
  const aviso = p.locator('[class*="_toastContainer_"] li:not([aria-hidden]) [role]');
  // A. tocar el texto del aviso: ¿se va igual a los ~4 s?
  await agregar.tap(); await aviso.first().waitFor(); const t0 = Date.now();
  const bb = await p.locator('[class*="_toastContainer_"] [class*="_message_"]').first().boundingBox();
  await p.touchscreen.tap(bb.x + 10, bb.y + bb.height / 2);
  await aviso.first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  console.log(`${w}x${h} A: tocado el texto; se fue a los ${Date.now() - t0} ms (quedan ${await aviso.count()})`);
  // B. vertical sobre el aviso: no cierra
  await agregar.tap(); await aviso.first().waitFor(); await p.waitForTimeout(400);
  let r = await aviso.first().boundingBox();
  await deslizar(r.x + r.width / 2, r.y + r.height / 2, 0, -120);
  await p.waitForTimeout(300);
  let r2 = await aviso.first().boundingBox().catch(() => null);
  console.log(`${w}x${h} B: vertical 120 px; sigue: ${!!r2}, x antes=${Math.round(r.x)} después=${r2 && Math.round(r2.x)}`);
  // C. de costado 100 px: cierra
  r = await aviso.first().boundingBox();
  console.log(`${w}x${h} C: en el centro del aviso (${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}) está:`, await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return `${e.tagName} «${e.closest('button')?.textContent?.trim() ?? e.textContent.trim().slice(0, 30)}» (botón: ${!!e.closest('button')})`; }, [r.x + r.width / 2, r.y + r.height / 2]));
  const t1 = Date.now();
  await deslizar(r.x + r.width / 2, r.y + r.height / 2, 100, 5);
  await aviso.first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  console.log(`${w}x${h} C: de costado 100 px; cerró en ${Date.now() - t1} ms (quedan ${await aviso.count()})`);
  // D. de costado 40 px: no cierra y vuelve a su lugar
  await p.waitForTimeout(500);
  await agregar.tap();
  const ok = await aviso.first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  if (!ok) { await p.screenshot({ path: `/tmp/adv-avisos/tactil-D-${w}.png` }); console.log('D: no apareció el aviso; botón:', await agregar.isEnabled(), await agregar.boundingBox(), 'avisos en DOM:', await p.locator('[class*="_toastContainer_"] [role]').count()); await c.close(); continue; }
  await p.waitForTimeout(400);
  r = await aviso.first().boundingBox();
  await deslizar(r.x + r.width / 2, r.y + r.height / 2, 40, 0);
  await p.waitForTimeout(400);
  r2 = await aviso.first().boundingBox().catch(() => null);
  console.log(`${w}x${h} D: de costado 40 px; sigue: ${!!r2}, x antes=${Math.round(r.x)} después=${r2 && Math.round(r2.x)}`);
  await c.close();
}
await b.close();
await fetch(API + '/cart', { method: 'DELETE', headers: { authorization: 'Bearer ' + s.a } });
