// Con el mouse: tres errores de «Publicar producto» (se quedan). Al pasar el mouse por la pila,
// se despliega hacia arriba. ¿Tapa «Publicar producto»? ¿Un clic ahí reintenta?
import { readFileSync } from 'node:fs';
import { chromium, login, FE } from './lib.mjs';
const s = await login(readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim(), 'advaviso123');
const b = await chromium.launch();
const vps = (process.env.VPS || '1440x900,1024x700,700x900,500x800').split(',').map(v => v.split('x').map(Number));
for (const [w, h] of vps) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  let posts = 0;
  await p.route('**/api/products', r => { if (r.request().method() !== 'POST') return r.continue(); posts++; return r.abort('failed'); });
  await p.goto(FE, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: /^Vender/ }).first().click();
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
  for (let i = 1; i <= 3; i++) {
    await pub.click();
    await p.waitForFunction((n) => document.querySelectorAll('[class*="_toastContainer_"] [role="alert"]').length === n, i);
  }
  await p.mouse.move(2, 2);
  await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const bb = await pub.boundingBox();
  const frente = await p.locator('[class*="_toastContainer_"] li:last-child [role]').boundingBox();
  // el mouse entra a la pila por el aviso de adelante
  await p.mouse.move(frente.x + frente.width / 2, frente.y + frente.height / 2, { steps: 5 });
  await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const pila = await p.evaluate(() => { const r = document.querySelector('[class*="_toastContainer_"] ol').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; });
  const xs = Math.max(bb.x + 4, pila.left + 4), xe = Math.min(bb.x + bb.width - 4, pila.right - 4);
  const x = xs <= xe ? (xs + xe) / 2 : bb.x + bb.width / 2, y = bb.y + bb.height / 2;
  const encima = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.closest('[class*="_toastContainer_"]') ? 'AVISO' : e?.textContent?.trim().slice(0, 30); }, [x, y]);
  // sube derecho hasta el botón, sin salir de la pila
  await p.mouse.move(x, y, { steps: 10 });
  await p.waitForTimeout(400);
  const encima2 = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.closest('[class*="_toastContainer_"]') ? 'AVISO: ' + e.closest('[role]')?.textContent.trim().slice(0, 30) : e?.textContent?.trim().slice(0, 30); }, [x, y]);
  const antes = posts;
  await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(1500);
  console.log(`${w}x${h} mouse: botón x=${Math.round(bb.x)}-${Math.round(bb.x + bb.width)} y=${Math.round(bb.y)}-${Math.round(bb.y + bb.height)}; aviso de adelante top=${Math.round(frente.y)}; pila desplegada ${JSON.stringify(pila)}`);
  console.log(`   en (${Math.round(x)},${Math.round(y)}) con la pila desplegada: ${encima}; después de subir el mouse ahí: ${encima2}; clic → POST antes=${antes} después=${posts}`);
  await c.close();
}
await b.close();
