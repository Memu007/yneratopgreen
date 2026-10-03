// Girar el celular con el error a la vista: la altura del aviso sólo se mide cuando cambia la lista.
import { readFileSync } from 'node:fs';
import { chromium, login, FE } from './lib.mjs';
const s = await login(readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim(), 'advaviso123');
const b = await chromium.launch();
for (const [[w1, h1], [w2, h2]] of [[[568, 320], [320, 568]], [[844, 390], [390, 844]], [[1440, 900], [320, 568]]]) {
  const c = await b.newContext({ viewport: { width: w1, height: h1 }, hasTouch: true, isMobile: true });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  let posts = 0;
  await p.route('**/api/products', r => { if (r.request().method() !== 'POST') return r.continue(); posts++; return r.abort('failed'); });
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
  await p.setViewportSize({ width: w2, height: h2 });
  await p.waitForTimeout(800);
  const m = await p.evaluate(() => {
    const d = document.querySelector('[aria-label="Publicar"]'); const r = d.getBoundingClientRect();
    const t = document.querySelector('[class*="_toastContainer_"] li:not([aria-hidden]) [role]');
    const rt = t.getBoundingClientRect();
    const botones = [...d.querySelectorAll('[class*="_formActions_"] button')].map(b => { const q = b.getBoundingClientRect(); return `${b.textContent.trim()} ${Math.round(q.top)}-${Math.round(q.bottom)}`; });
    return `--tg-avisos-alto=${getComputedStyle(document.documentElement).getPropertyValue('--tg-avisos-alto')}, aviso mide ${t.offsetHeight}px (${Math.round(rt.top)}-${Math.round(rt.bottom)}); capa bottom=${Math.round(r.bottom)}; ${botones.join(' | ')}`;
  });
  console.log(`${w1}x${h1} → ${w2}x${h2}: ${m}`);
  await c.close();
}
await b.close();
