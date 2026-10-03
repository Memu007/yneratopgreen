// Celular apaisado / chico con el error de «Vender» todavía a la vista: carrito y checkout.
import { readFileSync } from 'node:fs';
import { chromium, login, FE, API, pid } from './lib.mjs';
const s = await login(readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim(), 'advaviso123');
const id = await pid('Kit de Filtros');
const b = await chromium.launch();
for (const [w, h] of [[568, 320], [844, 390], [320, 568]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  await p.goto(`${FE}/?section=product&id=${id}`, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: /^Agregar/ }).tap();
  await p.locator('[class*="_toastContainer_"] [role]').first().waitFor();
  await p.locator('[class*="_toastContainer_"] [role]').first().waitFor({ state: 'detached', timeout: 10000 });
  await p.route('**/api/products', r => (r.request().method() !== 'POST' ? r.continue() : r.abort('failed')));
  await p.getByRole('button', { name: /^Vender/ }).first().tap();
  const v = p.getByRole('dialog', { name: 'Publicar' });
  await v.waitFor();
  await v.locator('#name').fill('Adversario avisos no se publica');
  await v.locator('#category').selectOption({ index: 1 });
  await v.locator('#description').fill('Descripción larga del adversario de avisos.');
  await v.locator('#price').fill('100'); await v.locator('#stock').fill('2');
  await v.locator('#province').selectOption({ index: 1 });
  await p.waitForFunction(() => document.querySelectorAll('#locality option').length > 1);
  await v.locator('#locality').selectOption({ index: 1 });
  const pub = v.getByRole('button', { name: 'Publicar producto' });
  await pub.scrollIntoViewIfNeeded(); await pub.tap();
  await p.locator('[class*="_toastContainer_"] [role="alert"]').waitFor();
  await v.getByRole('button', { name: 'Cancelar' }).tap();
  await p.getByRole('button', { name: 'Descartar cambios' }).tap();
  await v.waitFor({ state: 'hidden' });
  await p.getByRole('button', { name: /Carrito/ }).first().tap();
  const car = p.getByRole('dialog', { name: 'Mi carrito' }); await car.waitFor();
  await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const m = await p.evaluate(() => {
    const d = document.querySelector('[aria-label="Mi carrito"]'); const r = d.getBoundingClientRect();
    const hijos = [...d.children].map(ch => `${(ch.className.match(/_([a-zA-Z]+)_/) || [])[1]}:${Math.round(ch.getBoundingClientRect().height)}`);
    const btn = [...d.querySelectorAll('button')].find(b => /Continuar compra/.test(b.textContent)); const q = btn?.getBoundingClientRect();
    const t = document.querySelector('[class*="_toastContainer_"] li:not([aria-hidden]) [role]').getBoundingClientRect();
    return `capa ${Math.round(r.top)}-${Math.round(r.bottom)}; partes ${hijos.join(' ')}; «Continuar compra» ${q ? `${Math.round(q.top)}-${Math.round(q.bottom)}` : 'no está'}; aviso ${Math.round(t.top)}-${Math.round(t.bottom)}`;
  });
  console.log(`${w}x${h} carrito con error: ${m}`);
  await p.screenshot({ path: `/tmp/adv-avisos/carrito-${w}x${h}.png` });
  // ¿Se llega a «Continuar compra» tocando su centro? Y deslizando la capa con el dedo.
  const btn = car.getByRole('button', { name: 'Continuar compra' });
  const bb = await btn.boundingBox();
  const cy = Math.min(bb.y + bb.height / 2, h - 1);
  const encima = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.closest('[class*="_toastContainer_"]') ? 'AVISO' : (e?.closest('button')?.textContent.trim() ?? e?.tagName); }, [bb.x + bb.width / 2, cy]);
  const dentro = bb.y + bb.height <= h;
  console.log(`   «Continuar compra» ${Math.round(bb.y)}-${Math.round(bb.y + bb.height)} (ventana ${h}): entero en pantalla ${dentro}; en su centro visible (y=${Math.round(cy)}): ${encima}`);
  // cierra el error con su ×, como haría la persona
  await p.locator('[class*="_toastContainer_"] [role="alert"]').getByRole('button', { name: 'Cerrar aviso' }).tap();
  await p.waitForFunction(() => !document.documentElement.hasAttribute('data-avisos'));
  await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const bb2 = await btn.boundingBox();
  const cap2 = await car.boundingBox();
  console.log(`   sin el aviso: capa ${Math.round(cap2.y)}-${Math.round(cap2.y + cap2.height)}; «Continuar compra» ${Math.round(bb2.y)}-${Math.round(bb2.y + bb2.height)} (entero en pantalla ${bb2.y + bb2.height <= h})`);
  await c.close();
}
await b.close();
await fetch(API + '/cart', { method: 'DELETE', headers: { authorization: 'Bearer ' + s.a } });
