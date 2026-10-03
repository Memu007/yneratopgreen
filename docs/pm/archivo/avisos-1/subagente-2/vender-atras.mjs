// En «Vender»: un error que se queda (más alto) queda ATRÁS de un aviso corto.
// La reserva se calcula con el de adelante; ¿el de atrás asoma sobre la capa y su botón?
import { readFileSync } from 'node:fs';
import { chromium, login, FE } from './lib.mjs';
const s = await login(readFileSync('/tmp/adv-avisos/comprador.txt', 'utf8').trim(), 'advaviso123');
const b = await chromium.launch();
const vps = (process.env.VPS || '320x568,390x844,1440x900').split(',').map(v => v.split('x').map(Number));
for (const [w, h] of vps) {
  const touch = w < 800;
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  let posts = 0;
  await p.route('**/api/products', r => { if (r.request().method() !== 'POST') return r.continue(); posts++; return r.abort('failed'); });
  await p.goto(FE, { waitUntil: 'domcontentloaded' });
  const tocar = async (l) => touch ? l.tap() : l.click();
  await tocar(p.getByRole('button', { name: /^Vender/ }).first());
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
  await pub.scrollIntoViewIfNeeded();
  await tocar(pub);
  await p.locator('[class*="_toastContainer_"] [role="alert"]').waitFor();
  // Ahora uno corto adelante: elige 4 fotos (el máximo es 3).
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await v.locator('input[type=file]').setInputFiles([1,2,3,4].map(i => ({ name: `f${i}.png`, mimeType: 'image/png', buffer: png })));
  await p.waitForFunction(() => document.querySelectorAll('[class*="_toastContainer_"] [role]').length === 2);
  if (!touch) await p.mouse.move(2, 2);
  await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const m = await p.evaluate(() => {
    const capa = document.querySelector('[aria-label="Publicar"]');
    const rc = capa.getBoundingClientRect();
    const boton = [...capa.querySelectorAll('button')].find(b => b.textContent.includes('Publicar producto'));
    const rb = boton.getBoundingClientRect();
    const t = [...document.querySelectorAll('[class*="_toastContainer_"] li')].map(li => {
      const n = li.querySelector('[role]'); const r = n.getBoundingClientRect();
      return { txt: n.textContent.trim().slice(0, 45), alto: n.offsetHeight, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), atras: li.dataset.atras ?? '0' };
    });
    // puntos del botón tapados por un aviso
    let tapados = 0, total = 0, ejemplo = null;
    for (let y = Math.ceil(rb.top) + 1; y < rb.bottom - 1; y += 2) for (let x = Math.ceil(rb.left) + 1; x < rb.right - 1; x += 4) {
      total++; const e = document.elementFromPoint(x, y);
      if (e?.closest('[class*="_toastContainer_"]')) { tapados++; ejemplo ??= `(${x},${y})`; }
    }
    return { reserva: getComputedStyle(document.documentElement).getPropertyValue('--tg-avisos-alto'), capaBottom: Math.round(rc.bottom), boton: { top: Math.round(rb.top), bottom: Math.round(rb.bottom), left: Math.round(rb.left), right: Math.round(rb.right) }, avisos: t, tapados, total, ejemplo };
  });
  console.log(`${w}x${h}${touch ? ' táctil' : ''}: --tg-avisos-alto=${m.reserva}; capa bottom=${m.capaBottom}; botón ${JSON.stringify(m.boton)}`);
  for (const a of m.avisos) console.log(`   aviso atras=${a.atras} alto=${a.alto} top=${a.top} bottom=${a.bottom} x=${a.left}-${a.right} «${a.txt}»`);
  console.log(`   puntos del botón debajo de un aviso: ${m.tapados}/${m.total} ${m.ejemplo ?? ''}`);
  if (m.tapados) {
    const antes = posts;
    const [x, y] = m.ejemplo.slice(1, -1).split(',').map(Number);
    if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
    await p.waitForTimeout(1500);
    console.log(`   tocar ese punto: POST antes=${antes} después=${posts}`);
  }
  await c.close();
}
await b.close();
