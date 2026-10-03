// Quien agrega con el teclado: el aviso «Agregado» espera sin temporizador.
// ¿Cuántos Tab hasta llegar a él, y cuántos de esos focos quedan debajo del aviso?
import { readFileSync } from 'node:fs';
import { chromium, login, FE, API, pid } from './lib.mjs';
const email = readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim();
const s = await login(email, 'advaviso123');
const id = await pid(process.env.PROD || 'Urea Granulada');
const vp = { width: +(process.env.W || 1440), height: +(process.env.H || 900) };
const b = await chromium.launch();
const c = await b.newContext({ viewport: vp });
await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
const p = await c.newPage();
await p.goto(`${FE}/?section=product&id=${id}`, { waitUntil: 'domcontentloaded' });
const agregar = p.getByRole('button', { name: /^Agregar/ });
await agregar.waitFor();
await agregar.focus();
await p.keyboard.press('Enter');
const aviso = p.locator('[class*="_toastContainer_"] [role]').first();
await aviso.waitFor();
console.log('aviso:', (await aviso.innerText()).replace(/\s+/g, ' '));
await p.waitForTimeout(8000);
console.log('a los 8 s sigue:', await aviso.count(), 'data-avisos:', await p.evaluate(() => document.documentElement.hasAttribute('data-avisos')));
if (process.env.IR) {
  // Sigue con el teclado a otra sección: el aviso sigue esperando.
  const enlace = p.getByRole('button', { name: process.env.IR, exact: true }).first();
  await enlace.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(4000);
  console.log('fui a', process.env.IR, p.url(), 'aviso sigue:', await aviso.count());
}
let tapados = [], total = 0, llego = -1;
for (let i = 1; i <= 300; i++) {
  await p.keyboard.press('Tab');
  const r = await p.evaluate(() => {
    const a = document.activeElement;
    const t = document.querySelector('[class*="_toastContainer_"] li:not([aria-hidden]) [role]');
    if (!a || a === document.body) return { body: true };
    if (t && t.closest('[class*="_toastContainer_"]').contains(a)) return { enAviso: true };
    const ra = a.getBoundingClientRect(), rt = t?.getBoundingClientRect();
    if (!rt) return { sinAviso: true };
    const ox = Math.max(0, Math.min(ra.right, rt.right) - Math.max(ra.left, rt.left));
    const oy = Math.max(0, Math.min(ra.bottom, rt.bottom) - Math.max(ra.top, rt.top));
    const frac = ra.width * ra.height ? (ox * oy) / (ra.width * ra.height) : 0;
    const cx = (ra.left + ra.right) / 2, cy = (ra.top + ra.bottom) / 2;
    const enCentro = document.elementFromPoint(cx, cy);
    return { txt: (a.getAttribute('aria-label') || a.textContent || a.tagName).replace(/\s+/g, ' ').trim().slice(0, 40), frac: Math.round(frac * 100), centroTapado: !!enCentro?.closest('[class*="_toastContainer_"]'), y: Math.round(ra.top), avisoTop: Math.round(rt.top) };
  });
  if (r.enAviso) { llego = i; break; }
  if (r.sinAviso) { console.log('el aviso se fue en el Tab', i); break; }
  total++;
  if (r.frac > 0) tapados.push(`Tab ${i}: «${r.txt}» y=${r.y} ${r.frac}% tapado${r.centroTapado ? ', centro tapado' : ''} (aviso top=${r.avisoTop})`);
}
console.log(`${vp.width}x${vp.height}: Tab hasta el aviso: ${llego}; focos recorridos: ${total}; con parte debajo del aviso: ${tapados.length}`);
for (const t of tapados) console.log('  ' + t);
await c.close(); await b.close();
await fetch(API + '/cart', { method: 'DELETE', headers: { authorization: 'Bearer ' + s.a } });
