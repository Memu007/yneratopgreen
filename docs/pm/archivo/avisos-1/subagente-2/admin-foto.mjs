import { chromium, login, FE } from './lib.mjs';
const s = await login('admin@topgreen.com', 'admin123');
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
const p = await c.newPage();
await p.goto(FE); await p.getByRole('button', { name: 'Admin', exact: true }).click();
const panel = p.getByRole('dialog', { name: 'Administración' }); await panel.waitFor();
await panel.getByRole('button', { name: 'Marcas', exact: true }).click(); await p.waitForTimeout(1500);
await p.mouse.move(720, 600); await p.mouse.wheel(0, 1500); await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/adv-avisos/admin-marcas-1440.png' });
// ¿El último «Corregir» se alcanza con el mouse? elementFromPoint en su centro
const ult = panel.getByRole('button', { name: 'Corregir' }).last();
const r = await ult.evaluate(e => { const b = e.getBoundingClientRect(); return { y: Math.round(b.top), alto: innerHeight }; });
console.log('último «Corregir» en y=', r.y, 'ventana', r.alto);
await b.close();
