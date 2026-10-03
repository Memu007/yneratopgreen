// Celular apaisado: «Vender» con el error de publicar a la vista. ¿Cuánto formulario queda entre
// la cabecera fija y los botones fijos? ¿Y el carrito / checkout?
import { readFileSync } from 'node:fs';
import { chromium, login, FE } from './lib.mjs';
const s = await login(readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim(), 'advaviso123');
const b = await chromium.launch();
const vps = (process.env.VPS || '844x390,568x320,390x844,320x568').split(',').map(v => v.split('x').map(Number));
for (const [w, h] of vps) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  let posts = 0;
  await p.route('**/api/products', r => { if (r.request().method() !== 'POST') return r.continue(); posts++; return r.abort('failed'); });
  await p.goto(FE, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: /^Vender/ }).first().tap();
  const v = p.getByRole('dialog', { name: 'Publicar' });
  await v.waitFor();
  const medir = () => p.evaluate(() => {
    const d = document.querySelector('[aria-label="Publicar"]'); const r = d.getBoundingClientRect();
    const head = d.querySelector('[class*="_modalHeader_"]')?.getBoundingClientRect();
    const acc = d.querySelector('[class*="_formActions_"]')?.getBoundingClientRect();
    const libre = Math.round(Math.min(acc ? acc.top : r.bottom, r.bottom) - (head ? head.bottom : r.top));
    const t = document.querySelector('[class*="_toastContainer_"] li:not([aria-hidden]) [role]')?.getBoundingClientRect();
    return `capa ${Math.round(r.top)}-${Math.round(r.bottom)} (${Math.round(r.height)}px), cabecera ${head ? Math.round(head.height) : '-'}px, botones ${acc ? Math.round(acc.height) : '-'}px, formulario a la vista entre las dos: ${libre}px${t ? `; aviso ${Math.round(t.top)}-${Math.round(t.bottom)}` : ''}`;
  });
  const sin = await medir();
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
  await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const con = await medir();
  const bb = await pub.boundingBox();
  const antes = posts;
  await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await p.waitForTimeout(1200);
  console.log(`${w}x${h} táctil\n  sin aviso: ${sin}\n  con error: ${con}\n  «Publicar producto» y=${Math.round(bb.y)}-${Math.round(bb.y + bb.height)}; tocarlo: POST ${antes}→${posts}`);
  await p.screenshot({ path: `/tmp/adv-avisos/vender-${w}x${h}.png` });
  await c.close();
}
await b.close();
