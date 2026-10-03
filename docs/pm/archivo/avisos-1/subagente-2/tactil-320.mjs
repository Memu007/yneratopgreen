// A 320 de ancho, deslizar 100 px de costado no cierra el aviso: ¿qué eventos llegan?
import { readFileSync } from 'node:fs';
import { chromium, login, FE, API, pid } from './lib.mjs';
const s = await login(readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim(), 'advaviso123');
const id = await pid('Kit de Filtros');
const b = await chromium.launch();
for (const [w, h, dx, dir] of [[320, 568, 100, 1], [390, 844, 100, 1]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  await p.goto(`${FE}/?section=product&id=${id}`, { waitUntil: 'domcontentloaded' });
  const agregar = p.getByRole('button', { name: /^Agregar/ });
  await agregar.waitFor();
  const anchos = await p.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, inner: innerWidth, vv: visualViewport.width, scale: visualViewport.scale }));
  await agregar.tap();
  const aviso = p.locator('[class*="_toastContainer_"] li:not([aria-hidden]) [role]');
  await aviso.first().waitFor(); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__ev = []; const t = document.querySelector('[class*="_toastContainer_"]'); for (const k of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) t.addEventListener(k, e => window.__ev.push(`${k}@${Math.round(e.clientX)}[${e.pointerType}:${e.target.tagName}.${String(e.target.className).slice(0,22)}|li=${e.target.closest('li')?.style.transform}]`), true); });
  const r = await aviso.first().boundingBox();
  const x0 = r.x + r.width / 2, y0 = r.y + r.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / 10, y: y0 }] });
  const mitad = await aviso.first().boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const t1 = Date.now();
  const cerro = await aviso.first().waitFor({ state: 'detached', timeout: 1000 }).then(() => true, () => false);
  const ev = await p.evaluate(() => window.__ev);
  const resumen = ev.filter((e, i) => i === 0 || !e.startsWith('pointermove') || i === ev.length - 1 || ev[i + 1]?.startsWith('pointer') && !ev[i + 1].startsWith('pointermove'));
  console.log(`${w}x${h} dx=${dx} ${JSON.stringify(anchos)}: x del aviso antes=${Math.round(r.x)} con el dedo encima=${Math.round(mitad.x)}; cerró antes de 1 s: ${cerro}; eventos: ${ev.length} → ${resumen.join(' ')}`);
  await c.close();
}
await b.close();
await fetch(API + '/cart', { method: 'DELETE', headers: { authorization: 'Bearer ' + s.a } });
