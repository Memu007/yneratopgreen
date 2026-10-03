// Pestañas Categorías / Marcas / Configuración del panel: se dibujan FUERA del área que desplaza
// (hijos directos de la capa, que tiene overflow:hidden). Con un aviso, la capa se achica: ¿cuánto más se pierde?
import { chromium, login, FE } from './lib.mjs';
const s = await login('admin@topgreen.com', 'admin123');
const b = await chromium.launch();
const vps = (process.env.VPS || '1920x1080,1440x900,1366x768,390x844').split(',').map(v => v.split('x').map(Number));
for (const [w, h] of vps) {
  const touch = w < 800;
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  await c.addInitScript(({ a, r }) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }, { a: s.a, r: s.r });
  const p = await c.newPage();
  await p.goto(FE, { waitUntil: 'domcontentloaded' });
  const tocar = (l) => touch ? l.tap() : l.click();
  await tocar(p.getByRole('button', { name: 'Admin', exact: true }));
  const panel = p.getByRole('dialog', { name: 'Administración' });
  await panel.waitFor();
  for (const tab of ['Categorías', 'Marcas', 'Configuración']) {
    await tocar(panel.getByRole('button', { name: tab, exact: true }));
    await p.waitForTimeout(1500);
    const medir = () => p.evaluate(() => {
      const d = document.querySelector('[aria-label="Administración"]');
      const rp = d.getBoundingClientRect();
      const sec = [...d.children].at(-1); const rs = sec.getBoundingClientRect();
      // controles de la sección que quedan fuera de la capa (no se ven ni se tocan)
      const ctr = [...sec.querySelectorAll('button, input, select')];
      const fuera = ctr.filter(e => e.getBoundingClientRect().top >= rp.bottom - 2);
      return { capa: `${Math.round(rp.top)}-${Math.round(rp.bottom)}`, seccion: `${Math.round(rs.top)}-${Math.round(rs.bottom)}`, cortado: Math.max(0, Math.round(rs.bottom - rp.bottom)), controles: ctr.length, fuera: fuera.length, ejemplo: fuera.slice(0, 3).map(e => (e.textContent || e.placeholder || e.tagName).trim().slice(0, 25)) };
    });
    const sin = await medir();
    // el aviso: «Complete valor y etiqueta» / «Ingrese un nombre…» no cambian nada; acá se fuerza por CSS
    // con la altura real de un aviso de una línea, como lo pone Toast.tsx
    await p.evaluate(() => { document.documentElement.style.setProperty('--tg-avisos-alto', '52px'); document.documentElement.setAttribute('data-avisos', ''); });
    const con = await medir();
    await p.evaluate(() => { document.documentElement.style.removeProperty('--tg-avisos-alto'); document.documentElement.removeAttribute('data-avisos'); });
    // ¿la rueda del mouse desplaza algo?
    let rueda = '';
    if (!touch && sin.cortado) {
      await p.mouse.move(w / 2, h / 2);
      const antes = await p.evaluate(() => [...document.querySelector('[aria-label="Administración"]').querySelectorAll('*')].reduce((a, e) => a + e.scrollTop, 0) + document.querySelector('[aria-label="Administración"]').scrollTop);
      await p.mouse.wheel(0, 800); await p.waitForTimeout(500);
      const despues = await p.evaluate(() => [...document.querySelector('[aria-label="Administración"]').querySelectorAll('*')].reduce((a, e) => a + e.scrollTop, 0) + document.querySelector('[aria-label="Administración"]').scrollTop);
      rueda = `; rueda: scrollTop total ${antes}→${despues}`;
    }
    console.log(`${w}x${h} ${tab}: sin aviso capa ${sin.capa}, sección ${sin.seccion}, cortado ${sin.cortado}px, ${sin.fuera}/${sin.controles} controles afuera | con aviso capa ${con.capa}, cortado ${con.cortado}px, ${con.fuera}/${con.controles} controles afuera ${JSON.stringify(con.ejemplo)}${rueda}`);
  }
  await c.close();
}
await b.close();
