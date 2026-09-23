// Auditoría móvil: recorre el sitio en 360, 390 y 768 px como lo haría una
// persona y mide cada pantalla a la que llega.
//
// La salida separa dos cosas que no se pueden confundir:
//   - hallazgos de UI: lo medido en las pantallas —desborde, blancos táctiles,
//     texto recortado, consola, red—, lo que la capa de checkout deja fuera
//     de la vista y los controles que se ven pero no reciben el toque porque
//     otra cosa se les pone encima;
//   - recorridos que el script no completó: dónde se cortó y por qué. No
//     cuentan como hallazgo; si el script intentó operar algo que la persona
//     no ve, lo dice como falla del script. Un vencimiento sin más no prueba
//     de quién es la culpa: el motivo dice qué se esperaba, y ahí se mira.
// Sale con 2 si algún recorrido no se completó, con 1 si hay desbordes,
// recortes en la capa de checkout o controles tapados, y con 0 si no.
//
// Cada corrida deja su evidencia en una carpeta nueva y se niega a escribir en
// una que ya tenga archivos: las capturas versionadas son el registro de lo
// que se vio en su fecha. MOBILE_AUDIT_EVIDENCE_DIR elige la carpeta.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const API_URL = process.env.MOBILE_AUDIT_API_URL || 'http://localhost:8000/api';
const FRONTEND_URL = process.env.MOBILE_AUDIT_FRONTEND_URL || 'http://localhost:5173';
const EVIDENCE_DIR = path.resolve(process.env.MOBILE_AUDIT_EVIDENCE_DIR
  || `docs/pm/evidence/mobile-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`);
const viewports = [
  { name: '360x800', width: 360, height: 800, isMobile: true, deviceScaleFactor: 2 },
  { name: '390x844', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
  { name: '768x1024', width: 768, height: 1024, isMobile: false, deviceScaleFactor: 1 },
];
const results = {
  generatedAt: new Date().toISOString(),
  evidencia: EVIDENCE_DIR,
  recorridos: [],
  viewports: [],
  controlesTapados: [],
  capaDeCheckout: [],
  console: [],
  network: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Un control que la persona ve y no puede tocar: es un hallazgo de UI. */
class ControlTapado extends Error {}

/**
 * Deja el control a la vista y confirma que una persona puede tocarlo.
 *
 * Si el control está dentro del panel de filtros plegado, la persona no lo ve:
 * la falla es del script, que tenía que abrirlo. Si se ve y en su centro hay
 * otra cosa, el toque de la persona no le llega: es un hallazgo de UI.
 */
async function alcanzar(locator, nombre) {
  await locator.waitFor({ state: 'attached', timeout: 15_000 });
  const plegado = await locator.evaluate((element) => {
    const resumen = document.querySelector('button[aria-controls="panel-de-filtros"]');
    return Boolean(element.closest('#panel-de-filtros')
      && resumen
      && getComputedStyle(resumen).display !== 'none'
      && resumen.getAttribute('aria-expanded') !== 'true');
  });
  assert(!plegado,
    `falla del script: quiso operar «${nombre}» con el panel de filtros plegado; tenía que abrirlo con «Filtros»`);
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
  const encima = await locator.evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    // Un enlace que ocupa dos renglones no tiene nada en el centro de su caja:
    // se toca sobre el texto, así que se mira el centro del primer renglón.
    const rect = element.getClientRects()[0] || element.getBoundingClientRect();
    const punto = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (punto && (punto === element || element.contains(punto))) return null;
    if (!punto) return '(nada: queda fuera de la pantalla)';
    const clase = typeof punto.className === 'string' && punto.className.trim()
      ? `.${punto.className.trim().split(/\s+/)[0]}` : '';
    return `<${punto.tagName.toLowerCase()}${clase}> «${(punto.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)}»`;
  });
  if (encima) {
    throw new ControlTapado(`«${nombre}» se ve pero no recibe el toque: en su centro está ${encima}`);
  }
}

async function tocar(locator, nombre) {
  await alcanzar(locator, nombre);
  await locator.click();
}

async function elegir(locator, nombre, opcion) {
  await alcanzar(locator, nombre);
  await locator.selectOption(opcion);
}

/**
 * Lo que la capa de checkout deja fuera de la vista.
 *
 * El desborde de la página no lo ve: la capa se desplaza de costado dentro de
 * sí misma y el documento sigue midiendo lo mismo que la pantalla. Se mide
 * sólo en el checkout, porque la tabla del panel de administración también se
 * desplaza de costado, pero a propósito.
 */
async function medirLaCapaDeCheckout(page, viewport, screen) {
  const medida = await page.evaluate(() => {
    const capa = document.querySelector('[role="dialog"][aria-label="Checkout"]');
    if (!capa) return null;
    const marco = capa.getBoundingClientRect();
    const derecha = marco.left + capa.clientWidth;
    const fuera = [...capa.querySelectorAll('h2, h3, h4, legend, label, p, input, select, textarea, button, a')]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0
        && (rect.left < marco.left - 1 || rect.right > derecha + 1))
      .slice(0, 20)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        label: (element.getAttribute('aria-label') || element.textContent
          || element.getAttribute('placeholder') || element.id || '')
          .trim().replace(/\s+/g, ' ').slice(0, 60),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }));
    return { ancho: capa.clientWidth, contenido: capa.scrollWidth, fuera };
  });
  assert(medida, `falla del script: en ${screen} no está la capa de checkout que iba a medir`);
  results.capaDeCheckout.push({
    viewport: viewport.name,
    screen,
    ...medida,
    recortada: medida.contenido > medida.ancho + 1 || medida.fuera.length > 0,
  });
}

/** Lo que la pantalla dice cuando el recorrido se corta: un aviso con
    role="alert" suele ser la razón, y sin él el vencimiento no la dice. */
async function avisosEnPantalla(page) {
  const avisos = await page.getByRole('alert').allTextContents().catch(() => []);
  const textos = avisos.map((texto) => texto.trim().replace(/\s+/g, ' ')).filter(Boolean);
  return textos.length ? `la pantalla dice: ${textos.map((texto) => `«${texto}»`).join(', ')}` : '';
}

const resumenDeFiltros = (page) => page.locator('button[aria-controls="panel-de-filtros"]');

/** En celular y tablet el panel de filtros está plegado: una persona lo abre
    con «Filtros» antes de tocar sus controles. En escritorio no hay resumen y
    el panel está siempre abierto. */
async function abrirFiltros(page) {
  const resumen = resumenDeFiltros(page);
  if (!(await resumen.isVisible())) return;
  if ((await resumen.getAttribute('aria-expanded')) !== 'true') await tocar(resumen, 'Filtros');
  await page.waitForFunction(() => document
    .querySelector('button[aria-controls="panel-de-filtros"]')?.getAttribute('aria-expanded') === 'true');
}

/** El panel abierto termina en «Ver N resultados», que lo pliega y devuelve a
    la lista: es como vuelve una persona a los resultados. */
async function verResultados(page) {
  const resumen = resumenDeFiltros(page);
  if (!(await resumen.isVisible())) return;
  await tocar(page.getByRole('button', { name: /^Ver \d+ resultados?$/ }), 'Ver resultados');
  await page.waitForFunction(() => document
    .querySelector('button[aria-controls="panel-de-filtros"]')?.getAttribute('aria-expanded') === 'false');
}

/** Una carpeta de evidencia vacía o nueva; nunca una con capturas de otra corrida. */
async function prepararEvidencia() {
  const archivos = await readdir(EVIDENCE_DIR).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  if (archivos.length > 0) {
    console.error(`La carpeta de evidencia ya tiene ${archivos.length} archivo(s) y no se sobrescribe: ${EVIDENCE_DIR}`);
    console.error('Elegí otra con MOBILE_AUDIT_EVIDENCE_DIR, o no la pases y se crea una nueva.');
    process.exit(2);
  }
  await mkdir(EVIDENCE_DIR, { recursive: true });
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${endpoint} respondió HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function login(email, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(data.access_token, `login de ${email} no devolvió access_token`);
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

async function createPage(browser, viewport, tokens, state) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: true,
    deviceScaleFactor: viewport.deviceScaleFactor,
  });
  if (tokens) {
    await context.addInitScript(({ accessToken, refreshToken }) => {
      localStorage.setItem('access_token', accessToken);
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    }, tokens);
  }

  const page = await context.newPage();
  page.on('pageerror', (error) => {
    results.console.push({
      viewport: viewport.name,
      screen: state.screen,
      level: 'error',
      message: error.message,
    });
  });
  page.on('console', (message) => {
    if (!['warning', 'warn', 'error'].includes(message.type())) return;
    results.console.push({
      viewport: viewport.name,
      screen: state.screen,
      level: message.type(),
      message: message.text(),
    });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    results.network.push({
      viewport: viewport.name,
      screen: state.screen,
      method: response.request().method(),
      status: response.status(),
      url: response.url(),
    });
  });

  return { context, page };
}

async function inspect(page, state, viewport, screen, screenshotName = screen) {
  state.screen = screen;
  await page.waitForTimeout(250);
  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const label = (element) =>
      (element.getAttribute('aria-label')
        || element.getAttribute('title')
        || element.textContent
        || element.tagName)
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 100);
    const elements = [...document.querySelectorAll('body *')].filter(visible);
    const overflowElements = elements
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left < -1 || rect.right > viewportWidth + 1)
      .slice(0, 20)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        label: label(element),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }));
    const smallTouchTargets = elements
      .filter((element) =>
        element.matches('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]'))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width < 44 || rect.height < 44)
      .slice(0, 40)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        label: label(element),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }));
    const clippedText = elements
      .filter((element) => element.children.length === 0 && element.textContent?.trim())
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .slice(0, 20)
      .map((element) => ({ tag: element.tagName.toLowerCase(), label: label(element) }));

    return {
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth,
      horizontalOverflow:
        document.body.scrollWidth > viewportWidth + 1
        || document.documentElement.scrollWidth > viewportWidth + 1,
      overflowElements,
      smallTouchTargets,
      clippedText,
    };
  });

  results.viewports.push({ viewport: viewport.name, screen, ...layout });
  if (viewport.width === 360 || viewport.width === 390) {
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, `${viewport.name}-${screenshotName}.png`),
      fullPage: false,
    });
  }
}

async function waitForCatalog(page) {
  // El selector de categoría existe aunque el panel esté plegado: se espera a
  // que tenga sus opciones, no a que se vea.
  await page.locator('#catalog-category').waitFor({ state: 'attached', timeout: 15_000 });
  await page.waitForFunction(() => document.querySelectorAll('#catalog-category option').length > 1);
  await page.waitForFunction(() => document.querySelectorAll('main h3').length > 0);
}

async function exercisePublicCatalog(browser, viewport, state) {
  const { context, page } = await createPage(browser, viewport, null, state);
  try {
    state.screen = '01-home';
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /seguir produciendo/ }).waitFor();
    await inspect(page, state, viewport, '01-home');

    state.screen = '02-filters';
    await tocar(page.getByRole('button', { name: /Explorar operaciones/i }), 'Explorar operaciones');
    await waitForCatalog(page);
    await abrirFiltros(page);
    await elegir(page.locator('#catalog-category'), 'Categoría', { index: 1 });
    await elegir(page.locator('#catalog-province'), 'Provincia', { index: 1 });
    await page.waitForFunction(() => document.querySelectorAll('#catalog-locality option').length > 1);
    await elegir(page.locator('#catalog-locality'), 'Localidad', { index: 1 });
    await inspect(page, state, viewport, '02-filters');

    state.screen = '03-catalog';
    await tocar(page.getByRole('button', { name: 'Limpiar filtros' }), 'Limpiar filtros');
    // Limpiar tiene que dejar los tres en «todas»: si no, lo que sigue mediría
    // un catálogo filtrado creyendo que es el completo.
    await page.waitForFunction(() =>
      document.querySelector('#catalog-category')?.value === 'Todas las categorías'
      && document.querySelector('#catalog-province')?.value === ''
      && document.querySelector('#catalog-locality')?.value === '');
    await verResultados(page);
    await page.waitForFunction(() => document.querySelectorAll('main h3').length > 0);
    await inspect(page, state, viewport, '03-catalog');

    state.screen = '04-detail';
    const titulo = page.locator('main h3 a[data-ficha]').first();
    const id = await titulo.getAttribute('data-ficha');
    await tocar(titulo, 'título de la primera publicación');
    // La ficha es una página: se espera a que termine de cargar su título.
    await page.locator('main[aria-busy="false"] #detalle-titulo').waitFor({ state: 'visible' });
    const barra = new URL(page.url()).searchParams;
    assert(barra.get('section') === 'product' && barra.get('id') === id,
      `la ficha de ${id} se abrió sin su URL propia: la barra dice ${page.url()}`);
    await inspect(page, state, viewport, '04-detail');
  } finally {
    await context.close();
  }
}

async function exerciseCheckout(browser, viewport, state, buyerTokens) {
  const { context, page } = await createPage(browser, viewport, buyerTokens, state);
  try {
    state.screen = '05-cart';
    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await waitForCatalog(page);
    await abrirFiltros(page);
    await elegir(page.locator('#catalog-type'), 'Tipo', 'productos');
    await verResultados(page);
    const addButton = page.getByRole('button', { name: /Agregar/ }).first();
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('heading', { name: /Mi carrito/i }).waitFor();
    await inspect(page, state, viewport, '05-cart');

    state.screen = '05-checkout-shipping';
    await tocar(page.getByRole('button', { name: 'Continuar compra' }), 'Continuar compra');
    await page.getByRole('heading', { name: /Datos de env/i }).waitFor();
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
    await page.locator('#checkout-provincia').selectOption('06');
    await page.waitForFunction(
      () => document.querySelectorAll('#checkout-localidad option').length > 1);
    await page.locator('#checkout-localidad').selectOption({ label: 'Pergamino' });
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Av. Prueba 123');
    await page.getByPlaceholder('2000').fill('2000');
    // Cada pedido dice cómo se traslada antes de pagar. La persona elige, y la
    // auditoría también: coordinar por su cuenta, que no depende de que haya
    // transportistas para ese tramo.
    await page.getByRole('heading', { name: 'Cómo se traslada cada pedido' }).waitFor();
    const porMiCuenta = page.locator('label').filter({ hasText: 'Coordino el traslado por mi cuenta' });
    await porMiCuenta.first().waitFor();
    for (const opcion of await porMiCuenta.all()) {
      await tocar(opcion, 'Coordino el traslado por mi cuenta');
      assert(await opcion.locator('input[type="radio"]').isChecked(),
        'tocar «Coordino el traslado por mi cuenta» no dejó elegida la opción');
    }
    await inspect(page, state, viewport, '05-checkout-shipping');
    await medirLaCapaDeCheckout(page, viewport, '05-checkout-shipping');

    state.screen = '05-checkout-payment';
    await tocar(page.getByRole('button', { name: 'Continuar al pago' }), 'Continuar al pago');
    await page.getByRole('heading', { name: /Medio de pago/i }).waitFor();
    await inspect(page, state, viewport, '05-checkout-payment');
    await medirLaCapaDeCheckout(page, viewport, '05-checkout-payment');
  } catch (error) {
    error.avisos = await avisosEnPantalla(page);
    throw error;
  } finally {
    await context.close();
  }
}

async function exerciseSeller(browser, viewport, state, sellerTokens) {
  const publication = await createPage(browser, viewport, sellerTokens, state);
  try {
    state.screen = '06-publication';
    await publication.page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await publication.page.getByRole('button', { name: /Vender/ }).click();
    await publication.page.getByRole('heading', { name: /Publicar un producto/i }).waitFor();
    await publication.page.locator('#name').fill('Auditoría móvil sin publicar');
    await publication.page.waitForFunction(() => document.querySelectorAll('#category option').length > 1);
    await publication.page.locator('#category').selectOption({ index: 1 });
    await publication.page.locator('#province').selectOption({ index: 1 });
    await publication.page.waitForFunction(() => document.querySelectorAll('#locality option').length > 1);
    await publication.page.locator('#locality').selectOption({ index: 1 });
    await inspect(publication.page, state, viewport, '06-publication', '06-publication-top');
    await publication.page.locator('form').evaluate((form) => {
      form.parentElement.scrollTo(0, form.parentElement.scrollHeight);
    });
    await inspect(
      publication.page,
      state,
      viewport,
      '06-publication-bottom',
      '06-publication-bottom',
    );
  } finally {
    await publication.context.close();
  }

  const dashboard = await createPage(browser, viewport, sellerTokens, state);
  try {
    state.screen = '07-seller-panel';
    await dashboard.page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await dashboard.page.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await dashboard.page.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
    await inspect(dashboard.page, state, viewport, '07-seller-panel');
    await dashboard.page.getByRole('button', { name: 'Mis publicaciones' }).click();
    await dashboard.page.getByRole('heading', { name: 'Mis publicaciones' }).waitFor();
    await inspect(dashboard.page, state, viewport, '07-seller-products');
  } finally {
    await dashboard.context.close();
  }
}

async function exerciseAdmin(browser, viewport, state, adminTokens) {
  const { context, page } = await createPage(browser, viewport, adminTokens, state);
  try {
    state.screen = '07-admin-panel';
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('heading', { name: 'Panel de Administración' }).waitFor();
    await inspect(page, state, viewport, '07-admin-panel');
    await page.getByRole('button', { name: 'Productos' }).click();
    await page.locator('table').waitFor();
    await inspect(page, state, viewport, '07-admin-products');
  } finally {
    await context.close();
  }
}

await prepararEvidencia();
await apiRequest('/health');
const [buyerTokens, sellerTokens, adminTokens] = await Promise.all([
  login('cliente@ejemplo.com', 'cliente123'),
  login('vendedor@ejemplo.com', 'vendedor123'),
  login('admin@topgreen.com', 'admin123'),
]);
const recorridos = [
  ['catálogo público', exercisePublicCatalog, null],
  ['compra', exerciseCheckout, buyerTokens],
  ['vendedor', exerciseSeller, sellerTokens],
  ['administración', exerciseAdmin, adminTokens],
];
const browser = await chromium.launch({ headless: true });

// Un recorrido que se corta no detiene los demás: cada uno queda anotado con
// la pantalla en la que estaba, y lo que sí se midió sigue valiendo.
try {
  for (const viewport of viewports) {
    for (const [nombre, recorrer, tokens] of recorridos) {
      const state = { screen: 'inicio' };
      const anotado = { viewport: viewport.name, recorrido: nombre, completo: true };
      try {
        await recorrer(browser, viewport, state, tokens);
      } catch (error) {
        // La primera línea de un vencimiento no dice qué se esperaba; la
        // llamada que lo esperaba sí.
        const lineas = error.message.split('\n');
        const esperaba = lineas.find((linea) => linea.includes('waiting for'));
        const motivo = [
          esperaba ? `${lineas[0]} (${esperaba.replace(/\x1b\[[0-9;]*m/g, '').trim()})` : lineas[0],
          error.avisos,
        ].filter(Boolean).join('; ');
        anotado.completo = false;
        anotado.cortadoEn = state.screen;
        anotado.motivo = motivo;
        anotado.tapado = error instanceof ControlTapado;
        if (anotado.tapado) {
          results.controlesTapados.push({ viewport: viewport.name, screen: state.screen, motivo });
        }
      }
      results.recorridos.push(anotado);
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(EVIDENCE_DIR, 'audit-results.json'),
  `${JSON.stringify(results, null, 2)}\n`,
);

const overflow = results.viewports.filter((entry) => entry.horizontalOverflow);
const recortes = results.capaDeCheckout.filter((entry) => entry.recortada);
const cortados = results.recorridos.filter((entry) => !entry.completo);
const deScript = cortados.filter((entry) => !entry.tapado);
console.log(`Recorridos completos: ${results.recorridos.length - cortados.length} de ${results.recorridos.length}`);
console.log(`Pantallas verificadas: ${results.viewports.length}`);
console.log('Hallazgos de UI:');
console.log(`  Desbordes horizontales: ${overflow.length}`);
console.log(`  Recortes dentro de la capa de checkout: ${recortes.length} de ${results.capaDeCheckout.length} pantallas medidas`);
for (const recorte of recortes) {
  const ejemplos = recorte.fuera.slice(0, 3).map((fuera) => `${fuera.tag} «${fuera.label}» ${fuera.left}→${fuera.right}`);
  console.log(`    - ${recorte.viewport} ${recorte.screen}: la capa mide ${recorte.ancho} px y su contenido ${recorte.contenido}; fuera de la vista: ${ejemplos.join(', ') || '(sólo el desplazamiento)'}`);
}
console.log(`  Controles que se ven y no reciben el toque: ${results.controlesTapados.length}`);
for (const tapado of results.controlesTapados) {
  console.log(`    - ${tapado.viewport} ${tapado.screen}: ${tapado.motivo}`);
}
console.log(`  Errores/advertencias de consola: ${results.console.length}`);
console.log(`  Respuestas 4xx/5xx: ${results.network.length}`);
console.log(`Recorridos que el script no completó (no cuentan como hallazgo de UI; el motivo dice dónde mirar): ${deScript.length}`);
for (const cortado of deScript) {
  console.log(`    - ${cortado.viewport} ${cortado.recorrido}, en ${cortado.cortadoEn}: ${cortado.motivo}`);
}
console.log(`Resultado: ${path.join(EVIDENCE_DIR, 'audit-results.json')}`);
if (overflow.length > 0 || recortes.length > 0 || results.controlesTapados.length > 0) process.exitCode = 1;
if (deScript.length > 0) process.exitCode = 2;
