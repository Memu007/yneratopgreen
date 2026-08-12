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

/* Inventario exigido, parte de la especificación de esta puerta y no del seed.
   Si falta una medición, sobra o se repite, el comando falla. */
const ESPERADAS = [
  'portada',
  'portada (foto blanca)',
  'portada (foto negra)',
  'about',
  'services',
  'contact',
  'about (foto blanca)',
  'about (foto negra)',
  'verificación de correo',
  'catálogo',
  'catálogo (hover)',
  'detalle',
  'carrito',
  'checkout envío',
  'checkout traslado',
  'checkout transportista elegido',
  'checkout pago',
  'perfil vendedor',
  'mis ventas',
  'administración',
];
const ESPERA = 20000;
const MEDIDAS = [
  { n: 'escritorio', width: 1440, height: 900 },
  { n: 'movil', width: 390, height: 844 },
];
const MEDIDAS_NOMBRES = MEDIDAS.map((m) => m.n);

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

  const malos = []; let medidos = 0; let sinMedir = 0; let tapados = 0; let deshabilitados = 0;
  for (const el of document.querySelectorAll('body *')) {
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).filter(Boolean).join(' ');
    if (!texto) continue;
    const caja = el.getBoundingClientRect();
    if (caja.width < 1 || caja.height < 1) continue;
    if (!enPantalla(caja)) continue;
    const estilo = getComputedStyle(el);
    if (estilo.visibility === 'hidden' || estilo.opacity === '0') continue;
    /* Controles deshabilitados: exentos por la norma y por decisión de PM del
       2026-08-09 —oscurecerlos los haría parecer disponibles—. Se cuentan
       aparte para que la exención nunca quede invisible. */
    if (el.closest(':disabled, [aria-disabled="true"]')) { deshabilitados += 1; continue; }
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
  return { malos, medidos, sinMedir, tapados, deshabilitados };
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
async function extremosDeFoto(page, etiqueta, volverA, marcador) {
  for (const [nombre, px] of [['foto blanca', '#ffffff'], ['foto negra', '#000000']]) {
    // recargar primero, para partir siempre del inicio y de la foto original,
    // y recien despues navegar a la pantalla que toca. Antes se sustituia sobre
    // la pantalla en la que hubiera quedado el recorrido, y las mediciones de
    // "about" se hacian en realidad sobre contacto.
    await page.reload({ waitUntil: 'domcontentloaded' });
    if (volverA) {
      await page.getByRole('button', { name: volverA, exact: true }).first().click();
    }
    await marcador.first().waitFor({ state: 'visible', timeout: ESPERA });

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
    await revisar(page, `${etiqueta} (${nombre})`, marcador);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
}

let totalMedidos = 0;
let sinMedirTotal = 0;
let deshabilitadosTotal = 0;
const todos = [];
const medidas = [];

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

async function revisar(page, pantalla, marcador) {
  // el marcador prueba que llegamos: si no aparece, no se mide y el comando
  // falla. Una pantalla que no se abrió no puede declararse revisada.
  try {
    await marcador.first().waitFor({ state: 'visible', timeout: ESPERA });
  } catch (e) {
    throw new Error(`No llegué a «${pantalla}»: el marcador de la pantalla no `
      + `apareció.\n  ${e.message.split('\n')[0]}`);
  }
  const vistos = new Set();
  const incumple = new Set();
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
      deshabilitadosTotal += res.deshabilitados;
      for (const m of res.malos) {
        const clave = `${m.clase}|${m.color}|${m.fondo}|${m.texto}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        if (!m.sobreImagen) incumple.add(clave);
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
  medidas.push(pantalla);
  ok(!desborda, `${pantalla}: sin desborde horizontal`);
  console.log(`      ${medidos} medidos, ${tapados} tapados, ${incumple.size} por debajo del mínimo`);
}

for (const medida of MEDIDAS) {
  console.log(`\n=== ${medida.n} ${medida.width}x${medida.height} ===`);
  const viewport = { width: medida.width, height: medida.height };

  {
    const ctx = await sesion({ viewport }, comprador);
    const page = await ctx.newPage();

    const portada = page.getByRole('heading', { name: /Bienvenido a/ });
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await revisar(page, `${medida.n} portada`, portada);

    await extremosDeFoto(page, `${medida.n} portada`, null, portada);

    const equipo = page.getByRole('heading', { name: 'Nuestro equipo' });
    for (const [seccion, titulo, marca] of [
      ['Quienes Somos', 'about', equipo],
      ['Servicios', 'services', page.getByRole('heading', { name: 'Servicios', level: 1 })],
      ['Contacto', 'contact', page.getByRole('heading', { name: 'Contacto', level: 1 })],
    ]) {
      await page.getByRole('button', { name: seccion, exact: true }).first().click();
      await revisar(page, `${medida.n} ${titulo}`, marca);
    }
    await extremosDeFoto(page, `${medida.n} about`, 'Quienes Somos', equipo);

    // La vista del enlace de confirmación, en su estado de rechazo: es el que
    // trae el texto de error y el formulario de reenvío. El de éxito consume
    // un token y no se puede repetir en cada corrida.
    await page.goto(`${WEB}/verificar-correo?token=enlace-invalido-de-contraste`, {
      waitUntil: 'domcontentloaded',
    });
    await revisar(page, `${medida.n} verificación de correo`,
      page.getByRole('button', { name: 'Reenviar el enlace' }));

    await page.goto(`${WEB}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await revisar(page, `${medida.n} catálogo`, page.locator('#catalog-category'));

    // hover sobre un enlace, para medir tambien ese estado
    const enlace = page.locator('a').first();
    await enlace.waitFor({ state: 'visible', timeout: ESPERA });
    await enlace.hover();
    await revisar(page, `${medida.n} catálogo (hover)`, page.locator('#catalog-category'));

    // el detalle se abre haciendo clic en la tarjeta, no en un boton: no existe
    // ningun "Ver detalle". Antes esto lo tapaba un catch vacio y esta pantalla
    // se declaraba medida sin haberse abierto nunca.
    const vendidoPor = page.getByRole('heading', { name: 'Vendido por' });
    await page.locator('[class*="_card_"]').first().click();
    await revisar(page, `${medida.n} detalle`, vendidoPor);

    await page.getByRole('button', { name: 'Cerrar' }).first().click();
    await vendidoPor.waitFor({ state: 'hidden', timeout: ESPERA });

    // Una publicación con origen dentro del radio del transportista demo: sin
    // eso no hay a quién elegir y las pantallas del traslado no existirían.
    const buscador = page.getByPlaceholder('Buscar productos, semillas, maquinaria...');
    await buscador.fill('Fertilizante Triple 15');
    await buscador.press('Enter');
    await page.getByRole('heading', { name: 'Fertilizante Triple 15 - NPK', exact: true, level: 3 })
      .waitFor({ state: 'visible', timeout: ESPERA });
    await page.getByRole('button', { name: /Agregar/ }).first().click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await revisar(page, `${medida.n} carrito`, page.getByRole('heading', { name: /Mi Carrito/ }));

    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await revisar(page, `${medida.n} checkout envío`,
      page.getByRole('heading', { name: /Datos de Env/ }));

    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
    await page.locator('#checkout-provincia').selectOption('06');
    await page.waitForFunction(
      () => document.querySelectorAll('#checkout-localidad option').length > 1);
    await page.locator('#checkout-localidad').selectOption({ label: 'Pergamino' });
    const traslado = page.locator('[class*="_fletes_"]');
    await traslado.getByRole('radio', { name: /Necesito flete/ }).first()
      .waitFor({ state: 'visible', timeout: ESPERA });
    await traslado.getByRole('radio', { name: /Necesito flete/ }).first().check();
    await revisar(page, `${medida.n} checkout traslado`,
      page.getByRole('heading', { name: 'Cómo se traslada cada pedido' }));

    await traslado.getByRole('button', { name: /^Seleccionar a / }).first().click();
    await revisar(page, `${medida.n} checkout transportista elegido`,
      traslado.getByText('Transportista elegido'));

    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
    await page.getByPlaceholder('2000').fill('2700');
    await page.locator('form:has(h2) button[type="submit"]').click();
    await revisar(page, `${medida.n} checkout pago`,
      page.getByRole('heading', { name: /M.todo de Pago/ }));

    await ctx.close();
  }

  {
    const ctx = await sesion({ viewport }, vendedor);
    const page = await ctx.newPage();
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await page.locator('button').filter({ hasText: '👤' }).first().click();
    await revisar(page, `${medida.n} perfil vendedor`,
      page.getByRole('heading', { name: 'Mi Perfil' }));
    await page.getByRole('button', { name: 'Mis Ventas' }).click();
    await revisar(page, `${medida.n} mis ventas`,
      page.getByRole('heading', { name: 'Mis Ventas' }));
    await ctx.close();
  }

  {
    const ctx = await sesion({ viewport }, admin);
    const page = await ctx.newPage();
    await page.goto(WEB, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Admin/i }).first().click();
    await revisar(page, `${medida.n} administración`,
      page.getByRole('heading', { name: 'Panel de Administración' }));
    await ctx.close();
  }
}

await navegador.close();


console.log(`\n=== resumen ===`);
console.log(`  ${medidas.length} de ${MEDIDAS_NOMBRES.length * ESPERADAS.length} mediciones exigidas`);
console.log(`  ${totalMedidos} textos medidos; ${sinMedirTotal} sobre imagen (no medibles por color)`);
console.log(`  ${deshabilitadosTotal} en controles deshabilitados, exentos por decisión de PM`);

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

/* --- cobertura ----------------------------------------------------------- */

const esperadas = MEDIDAS_NOMBRES.flatMap((n) => ESPERADAS.map((r) => `${n} ${r}`));
const vistas = new Set(medidas);
const faltan = esperadas.filter((e) => !vistas.has(e));
const sobran = [...vistas].filter((v) => !esperadas.includes(v));
const repetidas = medidas.filter((v, i) => medidas.indexOf(v) !== i);
const cobertura = faltan.length === 0 && sobran.length === 0
  && repetidas.length === 0 && medidas.length === esperadas.length;
if (!cobertura) {
  console.log('\n=== cobertura incompleta ===');
  faltan.forEach((f) => console.log(`  falta     ${f}`));
  sobran.forEach((x) => console.log(`  sobra     ${x}`));
  repetidas.forEach((r) => console.log(`  repetida  ${r}`));
}

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
ok(cobertura, `las ${esperadas.length} mediciones exigidas se hicieron`);
/* Una sola fuente de verdad: TODO lo que pasa por ok() decide la salida.
   Antes `todoBien` sólo miraba el contraste y la cobertura, así que un desborde
   horizontal se imprimía como fallo y el comando salía igual con 0. */
const todoBien = fallos.length === 0;
console.log(`\n${todoBien ? 'TODO OK, COBERTURA COMPLETA'
  : `${fallos.length} FALLOS:\n  · ${fallos.join('\n  · ')}`}`);
process.exit(todoBien ? 0 : 1);
