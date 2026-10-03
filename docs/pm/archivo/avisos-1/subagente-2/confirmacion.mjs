// «Descartar cambios» (Confirmacion, z-index 12000, por ENCIMA de los avisos) también se achica.
// Su tarjeta no tiene overflow: ¿el contenido se sale de la tarjeta?
import { readFileSync } from 'node:fs';
import { chromium, login, FE } from './lib.mjs';
const s = await login(readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim(), 'advaviso123');
const b = await chromium.launch();
const vps = (process.env.VPS || '568x320,844x390,320x568').split(',').map(v => v.split('x').map(Number));
for (const [w, h] of vps) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  await p.route('**/api/products', r => (r.request().method() !== 'POST' ? r.continue() : r.abort('failed')));
  await p.goto(FE, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: /^Vender/ }).first().tap();
  const v = p.getByRole('dialog', { name: 'Publicar' });
  await v.waitFor();
  await v.locator('#name').fill('Adversario avisos no se publica');
  await v.locator('#category').selectOption({ index: 1 });
  await v.locator('#description').fill('Descripción larga del adversario de avisos.');
  await v.locator('#price').fill('100');
  await v.locator('#stock').fill('2');
  await v.locator('#province').selectOption({ index: 1 });
  await p.waitForFunction(() => document.querySelectorAll('#locality option').length > 1);
  await v.locator('#locality').selectOption({ index: 1 });
  const pub = v.getByRole('button', { name: 'Publicar producto' });
  await pub.scrollIntoViewIfNeeded(); await pub.tap();
  await p.locator('[class*="_toastContainer_"] [role="alert"]').waitFor();
  await v.getByRole('button', { name: 'Cancelar' }).tap();
  const desc = p.getByRole('button', { name: 'Descartar cambios' });
  await desc.waitFor();
  await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const m = await p.evaluate(() => {
    const capas = [...document.querySelectorAll('[aria-modal="true"]')]; const t = capas.at(-1);
    const r = t.getBoundingClientRect();
    const btns = [...t.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return `${b.textContent.trim()} ${Math.round(q.top)}-${Math.round(q.bottom)}`; });
    return `tarjeta ${Math.round(r.top)}-${Math.round(r.bottom)} (alto ${Math.round(r.height)}, contenido ${t.scrollHeight}, overflow ${getComputedStyle(t).overflowY}); botones: ${btns.join(' | ')}`;
  });
  console.log(`${w}x${h}: ${m}`);
  await p.screenshot({ path: `/tmp/adv-avisos/confirmacion-${w}x${h}.png` });
  const bb = await desc.boundingBox();
  await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await v.waitFor({ state: 'hidden', timeout: 5000 }).then(() => console.log('   «Descartar cambios» tocado: cerró'), () => console.log('   «Descartar cambios» tocado: NO cerró'));
  await c.close();
}
await b.close();
