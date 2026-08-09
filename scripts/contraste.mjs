#!/usr/bin/env node
/**
 * Barrido de contraste texto/fondo.
 *
 * Mide cada texto visible contra el fondo que efectivamente lo pinta, en
 * escritorio y en celular, y falla si alguno queda por debajo de 4,5:1 (texto
 * normal) o 3:1 (texto grande).
 *
 * Cubre lo que `npm run a11y` deja en "incompleto" y por eso NO se reemplazan:
 *   - resuelve el fondo por la PILA DE PINTADO, no subiendo por el DOM;
 *   - evalua todos los tonos de un gradiente, no un extremo;
 *   - compone capas translucidas y la opacidad heredada;
 *   - descarta el texto tapado por un modal, que no se lee;
 *   - acota el texto sobre foto sustituyendola por blanco y por negro puros:
 *     cualquier foto real queda entre esos dos extremos, porque el compuesto
 *     es lineal en el pixel de la foto y la luminancia crece con cada canal;
 *   - barre cada contenedor con scroll propio, no solo la ventana.
 *
 * Requiere la API en :8000 y el frontend en :5173, con el seed cargado.
 *
 *   npm run contraste
 */
import { chromium } from 'playwright';

const API = process.env.A11Y_API_URL || 'http://127.0.0.1:8000/api';
const WEB = process.env.A11Y_WEB_URL || 'http://localhost:5173';

const fallos = [];
const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) fallos.push(m); };

async function login(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  return { access: d.access_token, refresh: d.refresh_token };
}

/* Igual que el medidor aceptado, pero devuelve el detalle completo de cada
   incumplimiento para poder corregir la pareja exacta: clase, color de texto,
   tonos de fondo, tamaño y peso. */
const MEDIR = () => {
  const hex = (p) => '#' + p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const lum = (rgb) => {
    const c = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const rgbDe = (valor) => {
    const m = valor.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).map(parseFloat).filter((n) => !Number.isNaN(n));
    if (p.length > 3 && p[3] === 0) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const todosLosRgb = (valor) => [...valor.matchAll(/rgba?\(([^)]+)\)/g)]
    .map((m) => m[1].split(/[,\s/]+/).map(parseFloat).filter((n) => !Number.isNaN(n)))
    .filter((p) => !(p.length > 3 && p[3] === 0))
    .map((p) => [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]);

  const enPantalla = (caja) => caja.bottom > 0 && caja.top < window.innerHeight
    && caja.right > 0 && caja.left < window.innerWidth;

  /* Mezcla un color semitransparente sobre lo que tenga debajo. */
  const mezclar = (frente, fondo) => {
    const a = frente[3] === undefined ? 1 : frente[3];
    if (a >= 1) return frente.slice(0, 3);
    return [0, 1, 2].map((i) => frente[i] * a + fondo[i] * (1 - a));
  };

  const fondos = (el) => {
    const caja = el.getBoundingClientRect();
    const x = Math.min(Math.max(caja.left + Math.min(caja.width / 2, 40), 1), window.innerWidth - 1);
    const y = Math.min(Math.max(caja.top + caja.height / 2, 1), window.innerHeight - 1);
    const pila = document.elementsFromPoint(x, y);
    const desde = pila.indexOf(el);
    /* Si algo que no es descendiente suyo está pintado ENCIMA, el texto está
       tapado —el catálogo detrás de un modal, por ejemplo— y no se lee. No es
       un incumplimiento de contraste: es texto que no está a la vista. */
    if (desde === -1) return { tapado: true };
    for (let i = 0; i < desde; i += 1) {
      if (el.contains(pila[i])) continue;
      const e = getComputedStyle(pila[i]);
      if ((e.backgroundImage && e.backgroundImage !== 'none') || rgbDe(e.backgroundColor)) {
        return { tapado: true };
      }
    }
    const debajo = pila.slice(desde);
    const capas = [];
    for (const n of debajo) {
      const e = getComputedStyle(n);
      if (e.backgroundImage && e.backgroundImage !== 'none') {
        const tonos = todosLosRgb(e.backgroundImage);
        if (tonos.length) { capas.push({ tonos, origen: 'gradiente', de: n }); }
        else return { tonos: null, origen: 'imagen', capas };
      }
      const c = rgbDe(e.backgroundColor);
      if (c) {
        if (c[3] >= 1) { capas.push({ tonos: [c], origen: 'solido', de: n }); break; }
        capas.push({ tonos: [c], origen: 'translucido', de: n });
      }
    }
    if (!capas.length) return { tonos: [[255, 255, 255]], origen: 'raiz' };
    // componer de abajo hacia arriba: el último opaco es la base
    let base = [255, 255, 255];
    const ultimo = capas[capas.length - 1];
    if (ultimo.tonos[0][3] >= 1 && ultimo.origen !== 'gradiente') base = ultimo.tonos[0].slice(0, 3);
    let resultado = null; let origen = 'solido';
    for (let i = capas.length - 1; i >= 0; i -= 1) {
      const capa = capas[i];
      origen = capa.origen;
      const mezclados = capa.tonos.map((t) => mezclar(t, resultado ? resultado[0] : base));
      resultado = mezclados;
      if (capa.tonos.length > 1) origen = 'gradiente';
    }
    return { tonos: resultado || [base], origen };
  };
  const ratio = (a, b) => {
    const la = lum(a.slice(0, 3)); const lb = lum(b.slice(0, 3));
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const malos = []; let medidos = 0; let sinMedir = 0; let tapados = 0;
  for (const el of document.querySelectorAll('body *')) {
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).filter(Boolean).join(' ');
    if (!texto) continue;
    const caja = el.getBoundingClientRect();
    if (caja.width < 1 || caja.height < 1) continue;
    if (!enPantalla(caja)) continue;
    const estilo = getComputedStyle(el);
    if (estilo.visibility === 'hidden' || estilo.opacity === '0') continue;
    const color = rgbDe(estilo.color);
    if (!color) continue;
    const { tonos, origen, tapado } = fondos(el);
    if (tapado) { tapados += 1; continue; }
    if (!tonos) {
      sinMedir += 1;
      malos.push({ sobreImagen: true, clase: (el.className || '').toString(), tag: el.tagName.toLowerCase(),
        texto: texto.slice(0, 40), color: hex(color.slice(0, 3)), fondo: '(imagen)', tonos: '', origen: 'imagen',
        px: parseFloat(estilo.fontSize), peso: parseInt(estilo.fontWeight, 10) || 400, minimo: 0, ratio: 0 });
      continue;
    }
    const px = parseFloat(estilo.fontSize);
    const peso = parseInt(estilo.fontWeight, 10) || 400;
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    const minimo = grande ? 3 : 4.5;
    let alfa = color[3] === undefined ? 1 : color[3];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      alfa *= parseFloat(getComputedStyle(n).opacity);
    }
    const efectivo = alfa < 1 ? mezclar([...color.slice(0, 3), alfa], tonos[0]) : color.slice(0, 3);
    const r = Math.min(...tonos.map((t) => ratio(efectivo, t)));
    medidos += 1;
    if (r < minimo) {
      const peorTono = tonos.reduce((a, b) => (ratio(efectivo, a) <= ratio(efectivo, b) ? a : b));
      malos.push({
        clase: (el.className || '').toString(),
        tag: el.tagName.toLowerCase(),
        texto: texto.slice(0, 40),
        color: hex(efectivo),
        fondo: hex(peorTono),
        tonos: tonos.map(hex).join(' '),
        origen,
        px, peso, minimo,
        ratio: Number(r.toFixed(2)),
      });
    }
  }
  return { malos, medidos, sinMedir, tapados };
};

const navegador = await chromium.launch({ headless: true });
const comprador = await login('cliente@ejemplo.com', 'cliente123');
const vendedor = await login('vendedor@ejemplo.com', 'vendedor123');
const admin = await login('admin@topgreen.com', 'admin123');

async function sesion(ctxOpts, tokens) {
  const ctx = await navegador.newContext(ctxOpts);
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = 'html{scroll-behavior:auto !important}'
        + '*,*::before,*::after{animation-duration:0s !important;'
        + 'animation-delay:0s !important;transition-duration:0s !important;'
        + 'transition-delay:0s !important;}';
      document.head.appendChild(s);
    });
  });
  if (tokens) {
    await ctx.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: tokens.access, r: tokens.refresh });
  }
  return ctx;
}

/* Texto sobre foto: el medidor no puede resolver el fondo. Lo acoto sustituyendo
   la foto por blanco puro y por negro puro. Cualquier foto real queda entre esos
   dos extremos: el compuesto es lineal en el pixel de la foto y la luminancia
   crece con cada canal, asi que ninguna imagen puede dar peor que el peor de los
   dos. Se sustituye por un gradiente de color plano y no por una imagen, para que
   el medidor lo pueda leer. */
async function extremosDeFoto(page, etiqueta, volverA) {
  for (const [nombre, px] of [['foto blanca', '#ffffff'], ['foto negra', '#000000']]) {
    await page.evaluate((color) => {
      const plano = `linear-gradient(${color} 0%, ${color} 100%)`;
      for (const el of document.querySelectorAll('*')) {
        const e = getComputedStyle(el);
        if (e.backgroundImage && e.backgroundImage.includes('url(')) {
          el.style.setProperty('background-image', plano, 'important');
        }
      }
    }, px);
    await page.waitForTimeout(300);
    await revisar(page, `${etiqueta} (${nombre})`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    if (volverA) {
      await page.getByRole('button', { name: volverA, exact: true }).first().click();
      await page.waitForTimeout(1200);
    }
  }
}

let totalMedidos = 0;
let sinMedirTotal = 0;
const todos = [];

/* Devuelve los contenedores con scroll propio, además del documento. Los
   modales scrollean por dentro: sin esto sólo se mide su primera pantalla. */
const SCROLLERS = () => {
  const lista = [{ i: -1, alto: window.innerHeight, total: document.documentElement.scrollHeight }];
  window.__scrollers = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.scrollHeight <= el.clientHeight + 8) continue;
    const e = getComputedStyle(el);
    if (!['auto', 'scroll'].includes(e.overflowY)) continue;
    window.__scrollers.push(el);
    lista.push({ i: window.__scrollers.length - 1, alto: el.clientHeight, total: el.scrollHeight });
  }
  return lista;
};

async function revisar(page, pantalla) {
  const vistos = new Set();
  let medidos = 0; let sinMedir = 0; let tapados = 0;
  const scrollers = await page.evaluate(SCROLLERS);
  for (const sc of scrollers) {
    for (let y = 0; y < Math.max(sc.total, 1); y += Math.max(Math.round(sc.alto * 0.8), 80)) {
      const llego = await page.evaluate(({ i, py }) => {
        const el = i === -1 ? null : window.__scrollers[i];
        if (el) { el.scrollTop = py; return el.scrollTop; }
        window.scrollTo({ top: py, behavior: 'instant' });
        return window.scrollY;
      }, { i: sc.i, py: y });
      await page.waitForTimeout(150);
      const res = await page.evaluate(MEDIR);
      medidos += res.medidos; sinMedir += res.sinMedir; tapados += res.tapados;
      for (const m of res.malos) {
        const clave = `${m.clase}|${m.color}|${m.fondo}|${m.texto}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        todos.push({ pantalla, ...m });
      }
      if (llego < y - 2) break;   // ya está abajo de todo
    }
    await page.evaluate((i) => {
      const el = i === -1 ? null : window.__scrollers[i];
      if (el) el.scrollTop = 0; else window.scrollTo({ top: 0, behavior: 'instant' });
    }, sc.i);
  }
  totalMedidos += medidos; sinMedirTotal += sinMedir;
  const desborda = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(!desborda, `${pantalla}: sin desborde horizontal`);
  console.log(`      ${medidos} medidos, ${tapados} tapados, ${vistos.size} por debajo del mínimo`);
}

for (const medida of [{ n: 'escritorio', width: 1440, height: 900 }, { n: 'movil', width: 390, height: 844 }]) {
  console.log(`\n=== ${medida.n} ${medida.width}x${medida.height} ===`);
  const viewport = { width: medida.width, height: medida.height };

  {
    const ctx = await sesion({ viewport }, comprador);
    const page = await ctx.newPage();

    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await revisar(page, `${medida.n} portada`);

    await extremosDeFoto(page, `${medida.n} portada`, null);

    for (const [seccion, titulo] of [['Quienes Somos', 'about'], ['Servicios', 'services'], ['Contacto', 'contact']]) {
      await page.getByRole('button', { name: seccion, exact: true }).first().click();
      await page.waitForTimeout(1200);
      await revisar(page, `${medida.n} ${titulo}`);
    }
    await extremosDeFoto(page, `${medida.n} about`, 'Quienes Somos');
    await page.getByRole('button', { name: 'Home', exact: true }).first().click();
    await page.waitForTimeout(800);

    await page.goto(`${WEB}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1500);
    await revisar(page, `${medida.n} catálogo`);

    const enlace = page.locator('a').first();
    if (await enlace.count()) { await enlace.hover(); await page.waitForTimeout(200); }
    await revisar(page, `${medida.n} catálogo (hover)`);

    await page.getByRole('button', { name: /Ver detalle|Detalle/ }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await revisar(page, `${medida.n} detalle`);
    await page.keyboard.press('Escape').catch(() => {});

    await page.getByRole('button', { name: /Agregar/ }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.waitForTimeout(1000);
    await revisar(page, `${medida.n} carrito`);

    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(400);
    await revisar(page, `${medida.n} checkout envío`);

    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
    await page.locator('form select').selectOption('Buenos Aires').catch(() => {});
    await page.getByPlaceholder('Rosario').fill('Pergamino');
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');
    await page.locator('form:has(h2) button[type="submit"]').click();
    await page.getByRole('heading', { name: /M.todo de Pago/ }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(400);
    await revisar(page, `${medida.n} checkout pago`);

    await ctx.close();
  }

  {
    const ctx = await sesion({ viewport }, vendedor);
    const page = await ctx.newPage();
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.locator('button').filter({ hasText: '👤' }).first().click();
    await page.getByRole('heading', { name: 'Mi Perfil' }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    await revisar(page, `${medida.n} perfil vendedor`);
    await page.getByRole('button', { name: 'Mis Ventas' }).click();
    await page.waitForTimeout(1200);
    await revisar(page, `${medida.n} mis ventas`);
    await ctx.close();
  }

  {
    const ctx = await sesion({ viewport }, admin);
    const page = await ctx.newPage();
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const btn = page.getByRole('button', { name: /Admin/i }).first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(1800);
      await revisar(page, `${medida.n} administración`);
    }
    await ctx.close();
  }
}

await navegador.close();


console.log(`\n=== resumen ===`);
console.log(`  ${totalMedidos} textos medidos; ${sinMedirTotal} sobre imagen (no medibles por color)`);

// agrupar por clase+color+fondo
const grupos = new Map();
for (const m of todos.filter((x) => !x.sobreImagen)) {
  const k = `${m.clase.split(' ')[0] || m.tag}|${m.color}|${m.fondo}`;
  if (!grupos.has(k)) grupos.set(k, { ...m, veces: 0, pantallas: new Set() });
  const g = grupos.get(k);
  g.veces += 1; g.pantallas.add(m.pantalla);
  if (m.ratio < g.ratio) g.ratio = m.ratio;
}
const cuantos = todos.filter((m) => !m.sobreImagen).length;
console.log(`  ${cuantos} incumplimientos, ${grupos.size} parejas distintas\n`);
[...grupos.values()].sort((a, b) => a.ratio - b.ratio).forEach((g) => {
  console.log(`  ${g.ratio.toFixed(2)}:1 (mín ${g.minimo})  ${g.clase.split(' ')[0] || g.tag}`);
  console.log(`      texto ${g.color} sobre ${g.fondo} [${g.origen}] ${g.px}px/${g.peso}  ×${g.veces}  "${g.texto}"`);
});

const sobreImagen = todos.filter((m) => m.sobreImagen);
const reales = todos.filter((m) => !m.sobreImagen);
console.log(`\n=== textos sobre imagen, no resolubles por color (${sobreImagen.length}) ===`);
const vistosImg = new Set();
for (const m of sobreImagen) {
  const k = `${m.clase}|${m.texto}`;
  if (vistosImg.has(k)) continue; vistosImg.add(k);
  console.log(`  ${m.pantalla}  ${m.clase.split(' ')[0] || m.tag}  ${m.color} ${m.px}px/${m.peso}  "${m.texto}"`);
}
ok(reales.length === 0, `ningún texto por debajo del mínimo (${reales.length})`);
console.log(`\n${fallos.length === 0 ? 'TODO OK' : `${fallos.length} FALLOS`}`);
process.exit(reales.length === 0 ? 0 : 1);
