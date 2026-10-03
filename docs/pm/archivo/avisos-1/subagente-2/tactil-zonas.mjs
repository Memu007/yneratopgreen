// Qué parte del aviso «Agregado… Ver carrito» se puede deslizar (fuera de botones), por ancho.
import { readFileSync } from 'node:fs';
import { chromium, login, FE, API, pid } from './lib.mjs';
const s = await login(readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim(), 'advaviso123');
const id = await pid('Kit de Filtros');
const b = await chromium.launch();
for (const [w, h] of [[320, 568], [360, 740], [390, 844]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  await p.goto(`${FE}/?section=product&id=${id}`, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: /^Agregar/ }).tap();
  const aviso = p.locator('[class*="_toastContainer_"] li:not([aria-hidden]) [role]').first();
  await aviso.waitFor(); await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const m = await aviso.evaluate((t) => {
    const r = t.getBoundingClientRect();
    const bs = [...t.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return { n: b.textContent.trim() || b.getAttribute('aria-label'), w: Math.round(q.width), x: `${Math.round(q.left)}-${Math.round(q.right)}`, a: q.width * q.height }; });
    const area = r.width * r.height;
    return `aviso ${Math.round(r.left)}-${Math.round(r.right)} x ${Math.round(r.height)} alto; botones ${bs.map(b => `«${b.n}» ${b.x}`).join(', ')}; centro x=${Math.round((r.left + r.right) / 2)}; ${Math.round(100 * bs.reduce((a, b) => a + b.a, 0) / area)}% del área son botones`;
  });
  console.log(`${w}x${h}: ${m}`);
  await c.close();
}
await b.close();
await fetch(API + '/cart', { method: 'DELETE', headers: { authorization: 'Bearer ' + s.a } });
