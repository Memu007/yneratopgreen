// Celular apaisado: un error que se queda en el panel de administración. ¿Cuánto contenido queda a la vista?
import { chromium, login, FE } from './lib.mjs';
const s = await login('admin@topgreen.com', 'admin123');
const b = await chromium.launch();
const vps = (process.env.VPS || '844x390,568x320,390x844,320x568').split(',').map(v => v.split('x').map(Number));
for (const [w, h] of vps) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  let fallar = 0;
  await p.route('**/api/admin/form-options?*', r => (fallar-- > 0 ? r.fulfill({ status: 500, body: '{}' }) : r.continue()));
  await p.goto(FE, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: 'Admin', exact: true }).tap();
  const panel = p.getByRole('dialog', { name: 'Administración' });
  await panel.waitFor();
  await p.waitForTimeout(1500);
  const medir = () => p.evaluate(() => {
    const d = document.querySelector('[aria-label="Administración"]');
    const r = d.getBoundingClientRect();
    const hijos = [...d.children].map(ch => `${(ch.className.match(/_([a-zA-Z]+)_/) || [])[1]}:${ch.clientHeight}/${ch.scrollHeight}`);
    const t = document.querySelector('[class*="_toastContainer_"] li:not([aria-hidden]) [role]')?.getBoundingClientRect();
    return `panel top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} alto=${Math.round(r.height)}; hijos (alto visible/alto total): ${hijos.join(' ')}${t ? `; aviso top=${Math.round(t.top)}` : ''}`;
  });
  const sin = await medir();
  fallar = 1;
  await panel.getByRole('button', { name: 'Configuración', exact: true }).tap();
  await p.locator('[class*="_toastContainer_"] [role="alert"]').waitFor();
  await panel.getByRole('button', { name: /Unidades|Disponibilidad|Tipo/ }).first().tap().catch(() => {});
  await p.waitForTimeout(1500);
  await p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
  const con = await medir();
  console.log(`${w}x${h} táctil\n  sin aviso: ${sin}\n  con error: ${con}`);
  await p.screenshot({ path: `/tmp/adv-avisos/admin-${w}x${h}.png` });
  await c.close();
}
await b.close();
