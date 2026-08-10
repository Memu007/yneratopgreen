#!/usr/bin/env node
/**
 * Puerta automática de accesibilidad.
 *
 * Recorre las rutas principales, públicas y autenticadas, en escritorio y en
 * celular, y corre axe sobre cada una. Falla ante cualquier violación
 * `serious` o `critical` y muestra regla, ruta y elemento.
 *
 * La puerta verifica su propio recorrido: antes de medir exige un marcador
 * propio de cada pantalla, y al terminar exige el inventario completo. Una
 * navegación rota hace fallar el comando; nunca reduce la cobertura en
 * silencio.
 *
 * NO reemplaza a `npm run contraste` ni a `npm run smoke`:
 *   - `contraste` mide parejas texto/fondo que axe deja en "incompleto",
 *     porque axe no resuelve gradientes, texto sobre foto ni opacidad heredada;
 *   - `smoke` verifica el comportamiento, que axe no mira.
 *
 * Requiere la API en :8000 y el frontend en :5173, con el seed cargado.
 *
 *   npm run a11y                  # falla con serious o critical
 *   npm run a11y -- --todas       # además lista minor y moderate
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const API = process.env.A11Y_API_URL || 'http://127.0.0.1:8000/api';
const WEB = process.env.A11Y_WEB_URL || 'http://localhost:5173';
const VERTODAS = process.argv.includes('--todas');

const BLOQUEANTES = new Set(['serious', 'critical']);
const MEDIDAS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'celular', width: 390, height: 844 },
];

/* Inventario exigido, parte de la especificación de esta puerta y no del seed.
   Si falta una, sobra una o se repite, el comando falla. */
const ESPERADAS = [
  'inicio',
  'ingreso',
  'registro',
  'registro: correo pendiente',
  'verificación de correo',
  'quienes somos',
  'servicios',
  'contacto',
  'catálogo',
  'detalle de producto',
  'carrito',
  'checkout: envío',
  'checkout: pago',
  'panel del comprador',
  'panel: mis compras',
  'panel del vendedor',
  'panel: mis ventas',
  'panel: mis productos',
  'administración',
  'administración: usuarios',
  'administración: productos',
  'administración: órdenes',
];

const ESPERA = 20000;
const hallazgos = [];
const informativos = [];
const revisadas = [];

async function ingresar(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`No pude ingresar como ${email}: HTTP ${r.status}`);
  const d = await r.json();
  return { access: d.access_token, refresh: d.refresh_token };
}

async function contexto(navegador, viewport, tokens) {
  const ctx = await navegador.newContext({ viewport });
  if (tokens) {
    await ctx.addInitScript(({ a, r }) => {
      window.localStorage.setItem('access_token', a);
      window.localStorage.setItem('refresh_token', r);
    }, { a: tokens.access, r: tokens.refresh });
  }
  return ctx;
}

/**
 * Mide una pantalla. `marcador` es un localizador inequívoco de esa pantalla:
 * si no aparece, no llegamos, y eso es un fallo del comando —no una pantalla
 * que se omite—.
 */
async function revisar(page, ruta, medida, marcador) {
  try {
    await marcador.first().waitFor({ state: 'visible', timeout: ESPERA });
  } catch (e) {
    throw new Error(`No llegué a «${ruta}» en ${medida.nombre}: el marcador de la pantalla `
      + `no apareció. La puerta no puede medir lo que no abrió.\n  ${e.message.split('\n')[0]}`);
  }
  await page.waitForTimeout(400);

  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  revisadas.push(`${medida.nombre}/${ruta}`);

  let bloqueantes = 0;
  for (const v of resultado.violations) {
    const fila = {
      medida: medida.nombre,
      ruta,
      regla: v.id,
      impacto: v.impact || 'sin impacto',
      descripcion: v.help,
      nodos: v.nodes.map((n) => `${n.target.join(' ')}  ${(n.html || '').replace(/\s+/g, ' ').slice(0, 90)}`),
      total: v.nodes.length,
    };
    if (BLOQUEANTES.has(v.impact)) { hallazgos.push(fila); bloqueantes += 1; } else { informativos.push(fila); }
  }
  const marca = bloqueantes === 0 ? '✓' : '✗';
  const extra = resultado.violations.length - bloqueantes;
  console.log(`  ${marca} ${medida.nombre.padEnd(10)} ${ruta.padEnd(28)} ${bloqueantes} bloqueantes`
    + (extra ? `, ${extra} menores` : ''));
}

/* Pestaña activa del panel de administración: prueba que el clic entró. */
const pestaniaActiva = (page, nombre) => page
  .locator('[class*="_tabs_"] button[class*="_active_"]')
  .filter({ hasText: nombre });

/* --- recorridos ---------------------------------------------------------- */

async function publicas(page, medida) {
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await revisar(page, 'inicio', medida,
    page.getByRole('heading', { name: /Bienvenido a/ }));

  await page.getByRole('button', { name: 'Ingresar' }).first().click();
  await revisar(page, 'ingreso', medida,
    page.getByRole('heading', { name: 'Iniciar Sesión' }));

  await page.getByRole('button', { name: /Reg[íi]strate aqu[íi]/i }).first().click();
  await revisar(page, 'registro', medida,
    page.getByRole('heading', { name: 'Crear Cuenta' }));

  // El aviso de "revisá tu correo" es una pantalla propia, no un estado
  // decorativo: se llega dando de alta una cuenta de verdad. El correo lleva
  // la medida para que las dos corridas no choquen entre sí.
  const correoDePrueba = `a11y.${medida.nombre}.${Date.now()}@example.com`;
  await page.locator('input[name="name"]').fill('Accesibilidad Pendiente');
  await page.locator('input[name="email"]').fill(correoDePrueba);
  await page.locator('input[name="password"]').fill('a11y123456');
  await page.locator('form input[type="password"]').nth(1).fill('a11y123456');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await revisar(page, 'registro: correo pendiente', medida,
    page.getByRole('button', { name: 'Reenviar el correo' }));

  // los modales de autenticación no cierran con Escape: se cierra con el botón
  await page.getByRole('button', { name: 'Cerrar' }).first().click();
  await page.getByRole('heading', { name: 'Crear Cuenta' }).waitFor({ state: 'hidden', timeout: ESPERA });

  // La vista del enlace, en su estado de rechazo, que es el que trae además el
  // formulario de reenvío. El estado de éxito consume un token y no puede
  // repetirse en cada corrida.
  await page.goto(`${WEB}/verificar-correo?token=enlace-invalido-de-accesibilidad`, {
    waitUntil: 'domcontentloaded',
  });
  await revisar(page, 'verificación de correo', medida,
    page.getByRole('button', { name: 'Reenviar el enlace' }));
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });

  // las otras tres públicas están a un clic del encabezado y el barrido de
  // contraste ya las cubre; sin ellas las dos puertas medirían distinto
  await page.getByRole('button', { name: 'Quienes Somos', exact: true }).first().click();
  await revisar(page, 'quienes somos', medida,
    page.getByRole('heading', { name: 'Nuestro equipo' }));

  await page.getByRole('button', { name: 'Servicios', exact: true }).first().click();
  await revisar(page, 'servicios', medida,
    page.getByRole('heading', { name: 'Servicios', level: 1 }));

  await page.getByRole('button', { name: 'Contacto', exact: true }).first().click();
  await revisar(page, 'contacto', medida,
    page.getByRole('heading', { name: 'Contacto', level: 1 }));
}

async function comprador(page, medida) {
  await page.goto(`${WEB}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
  await revisar(page, 'catálogo', medida, page.locator('#catalog-category'));

  // el detalle se abre haciendo clic en la tarjeta, no en un boton: no existe
  // ningun "Ver detalle". Antes esto lo tapaba un catch vacio y esta pantalla
  // se declaraba medida sin haberse abierto nunca.
  await page.locator('[class*="_card_"]').first().click();
  await revisar(page, 'detalle de producto', medida,
    page.getByRole('heading', { name: 'Vendido por' }));

  // cerrar de verdad y comprobarlo: si el detalle queda abierto, el "Agregar"
  // siguiente sería el del modal y no el de la grilla
  await page.getByRole('button', { name: 'Cerrar' }).first().click();
  await page.getByRole('heading', { name: 'Vendido por' }).waitFor({ state: 'hidden', timeout: ESPERA });

  await page.getByRole('button', { name: /Agregar/ }).first().click();
  await page.getByRole('button', { name: /Carrito/ }).click();
  await revisar(page, 'carrito', medida,
    page.getByRole('heading', { name: /Mi Carrito/ }));

  await page.getByRole('button', { name: 'Continuar compra' }).click();
  await revisar(page, 'checkout: envío', medida,
    page.getByRole('heading', { name: /Datos de Env/ }));

  await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
  await page.locator('#checkout-provincia').selectOption('Buenos Aires');
  await page.getByPlaceholder('Rosario').fill('Pergamino');
  await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
  await page.getByPlaceholder('2000').fill('2700');
  await page.locator('form:has(h2) button[type="submit"]').click();
  await revisar(page, 'checkout: pago', medida,
    page.getByRole('heading', { name: /M.todo de Pago/ }));

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.locator('button').filter({ hasText: '👤' }).first().click();
  await revisar(page, 'panel del comprador', medida,
    page.getByRole('heading', { name: 'Mi Perfil' }));

  await page.getByRole('button', { name: 'Mis Compras' }).click();
  await revisar(page, 'panel: mis compras', medida,
    page.getByRole('heading', { name: 'Mis Compras' }));
}

async function vendedor(page, medida) {
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.locator('button').filter({ hasText: '👤' }).first().click();
  await revisar(page, 'panel del vendedor', medida,
    page.getByRole('heading', { name: 'Mi Perfil' }));

  await page.getByRole('button', { name: 'Mis Ventas' }).click();
  await revisar(page, 'panel: mis ventas', medida,
    page.getByRole('heading', { name: 'Mis Ventas' }));

  await page.getByRole('button', { name: 'Mis Productos' }).click();
  await revisar(page, 'panel: mis productos', medida,
    page.getByRole('heading', { name: 'Mis Productos' }));
}

async function administracion(page, medida) {
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Admin/i }).first().click();
  await revisar(page, 'administración', medida,
    page.getByRole('heading', { name: 'Panel de Administración' }));

  for (const [pestania, ruta] of [
    ['Usuarios', 'administración: usuarios'],
    ['Productos', 'administración: productos'],
    ['Órdenes', 'administración: órdenes'],
  ]) {
    // acotado a la barra de pestañas: fuera de ella hay botones con el mismo
    // texto en la página que queda detrás del modal
    await page.locator('[class*="_tabs_"]').first()
      .getByRole('button', { name: new RegExp(pestania, 'i') }).first().click();
    await revisar(page, ruta, medida, pestaniaActiva(page, pestania));
  }
}

/* --- ejecución ----------------------------------------------------------- */

const navegador = await chromium.launch({ headless: true });
try {
  const cuentas = {
    comprador: await ingresar('cliente@ejemplo.com', 'cliente123'),
    vendedor: await ingresar('vendedor@ejemplo.com', 'vendedor123'),
    admin: await ingresar('admin@topgreen.com', 'admin123'),
  };

  for (const medida of MEDIDAS) {
    console.log(`\n=== ${medida.nombre} ${medida.width}x${medida.height} ===`);
    const viewport = { width: medida.width, height: medida.height };

    for (const [tokens, recorrido] of [
      [null, publicas],
      [cuentas.comprador, comprador],
      [cuentas.vendedor, vendedor],
      [cuentas.admin, administracion],
    ]) {
      const ctx = await contexto(navegador, viewport, tokens);
      const page = await ctx.newPage();
      await recorrido(page, medida);
      await ctx.close();
    }
  }
} finally {
  await navegador.close();
}

/* --- cobertura ----------------------------------------------------------- */

const esperadas = MEDIDAS.flatMap((m) => ESPERADAS.map((r) => `${m.nombre}/${r}`));
const vistas = new Set(revisadas);
const faltan = esperadas.filter((e) => !vistas.has(e));
const sobran = [...vistas].filter((v) => !esperadas.includes(v));
const repetidas = revisadas.filter((v, i) => revisadas.indexOf(v) !== i);
const cobertura = faltan.length === 0 && sobran.length === 0
  && repetidas.length === 0 && revisadas.length === esperadas.length;

/* --- informe ------------------------------------------------------------- */

const porRegla = new Map();
for (const h of hallazgos) {
  if (!porRegla.has(h.regla)) porRegla.set(h.regla, { ...h, veces: 0, rutas: new Set(), unicos: new Set() });
  const g = porRegla.get(h.regla);
  g.veces += h.total;
  g.rutas.add(`${h.medida}/${h.ruta}`);
  h.nodos.forEach((n) => g.unicos.add(n));
}

console.log(`\n=== resumen ===`);
console.log(`  ${revisadas.length} de ${esperadas.length} pantallas exigidas`);
console.log(`  ${hallazgos.length} violaciones serious o critical (${porRegla.size} reglas distintas)`);
console.log(`  ${informativos.length} violaciones minor o moderate, no bloquean`);

if (!cobertura) {
  console.log(`\n=== cobertura incompleta ===`);
  faltan.forEach((f) => console.log(`  falta     ${f}`));
  sobran.forEach((s) => console.log(`  sobra     ${s}`));
  repetidas.forEach((r) => console.log(`  repetida  ${r}`));
}

if (porRegla.size) {
  console.log(`\n=== bloqueantes ===`);
  for (const g of porRegla.values()) {
    console.log(`\n  [${g.impacto}] ${g.regla} — ${g.descripcion}`);
    console.log(`    ${g.veces} elementos en: ${[...g.rutas].join(', ')}`);
    [...g.unicos].slice(0, 12).forEach((n) => console.log(`      · ${n}`));
    if (g.unicos.size > 12) console.log(`      … y ${g.unicos.size - 12} más`);
  }
}

if (VERTODAS && informativos.length) {
  const menores = new Map();
  for (const h of informativos) {
    if (!menores.has(h.regla)) menores.set(h.regla, { ...h, rutas: new Set() });
    menores.get(h.regla).rutas.add(`${h.medida}/${h.ruta}`);
  }
  console.log(`\n=== menores, informativas ===`);
  for (const g of menores.values()) {
    console.log(`  [${g.impacto}] ${g.regla} — ${g.descripcion}`);
    console.log(`    en: ${[...g.rutas].join(', ')}`);
  }
}

const ok = cobertura && hallazgos.length === 0;
console.log(`\n${ok ? 'SIN VIOLACIONES BLOQUEANTES, COBERTURA COMPLETA'
  : `${hallazgos.length} VIOLACIONES BLOQUEANTES` + (cobertura ? '' : ', COBERTURA INCOMPLETA')}`);
process.exit(ok ? 0 : 1);
