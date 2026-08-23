import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const API_URL = process.env.MOBILE_AUDIT_API_URL || 'http://localhost:8000/api';
const FRONTEND_URL = process.env.MOBILE_AUDIT_FRONTEND_URL || 'http://localhost:5173';
const EVIDENCE_DIR = path.resolve('docs/pm/evidence/mobile-2026-07-26');
const viewports = [
  { name: '360x800', width: 360, height: 800, isMobile: true, deviceScaleFactor: 2 },
  { name: '390x844', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
  { name: '768x1024', width: 768, height: 1024, isMobile: false, deviceScaleFactor: 1 },
];
const results = { generatedAt: new Date().toISOString(), viewports: [], console: [], network: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function createPage(browser, viewport, tokens) {
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
  const state = { screen: 'inicio' };
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

  return { context, page, state };
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
  await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => document.querySelectorAll('#catalog-category option').length > 1);
  await page.waitForFunction(() => document.querySelectorAll('main h3').length > 0);
}

async function exercisePublicCatalog(browser, viewport) {
  const { context, page, state } = await createPage(browser, viewport);
  try {
    state.screen = '01-home';
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Bienvenido a/ }).waitFor();
    await inspect(page, state, viewport, '01-home');

    state.screen = '02-filters';
    await page.getByRole('button', { name: /Explorar Productos/ }).click();
    await waitForCatalog(page);
    await page.locator('#catalog-category').selectOption({ index: 1 });
    await page.locator('#catalog-province').selectOption({ index: 1 });
    await page.waitForFunction(() => document.querySelectorAll('#catalog-locality option').length > 1);
    await page.locator('#catalog-locality').selectOption({ index: 1 });
    await inspect(page, state, viewport, '02-filters');

    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await page.waitForFunction(() => document.querySelectorAll('main h3').length > 0);
    await inspect(page, state, viewport, '03-catalog');

    state.screen = '04-detail';
    await page.locator('main h3').first().click();
    await page.locator('div[role="dialog"], h2').first().waitFor({ state: 'visible' });
    await inspect(page, state, viewport, '04-detail');
  } finally {
    await context.close();
  }
}

async function exerciseCheckout(browser, viewport, buyerTokens) {
  const { context, page, state } = await createPage(browser, viewport, buyerTokens);
  try {
    state.screen = '05-cart';
    await page.goto(`${FRONTEND_URL}/?section=marketplace`, { waitUntil: 'domcontentloaded' });
    await waitForCatalog(page);
    await page.locator('#catalog-type').selectOption('productos');
    const addButton = page.getByRole('button', { name: /Agregar/ }).first();
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('heading', { name: /Mi Carrito/ }).waitFor();
    await inspect(page, state, viewport, '05-cart');

    await page.getByRole('button', { name: 'Continuar compra' }).click();
    await page.getByRole('heading', { name: /Datos de Envío/ }).waitFor();
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
    await page.locator('#checkout-provincia').selectOption('06');
    await page.waitForFunction(
      () => document.querySelectorAll('#checkout-localidad option').length > 1);
    await page.locator('#checkout-localidad').selectOption({ label: 'Pergamino' });
    await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Av. Prueba 123');
    await page.getByPlaceholder('2000').fill('2000');
    await page.locator('form:has(h2) button[type="submit"]').click();
    await page.getByRole('heading', { name: /Método de Pago/ }).waitFor();
    await inspect(page, state, viewport, '05-checkout-payment');
  } finally {
    await context.close();
  }
}

async function exerciseSeller(browser, viewport, sellerTokens) {
  const publication = await createPage(browser, viewport, sellerTokens);
  try {
    publication.state.screen = '06-publication';
    await publication.page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await publication.page.getByRole('button', { name: /Vender/ }).click();
    await publication.page.getByRole('heading', { name: /Agregar Nuevo Producto/ }).waitFor();
    await publication.page.locator('#name').fill('Auditoría móvil sin publicar');
    await publication.page.waitForFunction(() => document.querySelectorAll('#category option').length > 1);
    await publication.page.locator('#category').selectOption({ index: 1 });
    await publication.page.locator('#province').selectOption({ index: 1 });
    await publication.page.waitForFunction(() => document.querySelectorAll('#locality option').length > 1);
    await publication.page.locator('#locality').selectOption({ index: 1 });
    await inspect(publication.page, publication.state, viewport, '06-publication', '06-publication-top');
    await publication.page.locator('form').evaluate((form) => {
      form.parentElement.scrollTo(0, form.parentElement.scrollHeight);
    });
    await inspect(
      publication.page,
      publication.state,
      viewport,
      '06-publication-bottom',
      '06-publication-bottom',
    );
  } finally {
    await publication.context.close();
  }

  const dashboard = await createPage(browser, viewport, sellerTokens);
  try {
    dashboard.state.screen = '07-seller-panel';
    await dashboard.page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await dashboard.page.getByRole('button', { name: 'Mi cuenta' }).first().click();
    await dashboard.page.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
    await inspect(dashboard.page, dashboard.state, viewport, '07-seller-panel');
    await dashboard.page.getByRole('button', { name: 'Mis Productos' }).click();
    await dashboard.page.getByRole('heading', { name: 'Mis Productos' }).waitFor();
    await inspect(dashboard.page, dashboard.state, viewport, '07-seller-products');
  } finally {
    await dashboard.context.close();
  }
}

async function exerciseAdmin(browser, viewport, adminTokens) {
  const { context, page, state } = await createPage(browser, viewport, adminTokens);
  try {
    state.screen = '07-admin-panel';
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('heading', { name: 'Panel de Administración' }).waitFor();
    await inspect(page, state, viewport, '07-admin-panel');
    await page.getByRole('button', { name: '📦 Productos' }).click();
    await page.locator('table').waitFor();
    await inspect(page, state, viewport, '07-admin-products');
  } finally {
    await context.close();
  }
}

await mkdir(EVIDENCE_DIR, { recursive: true });
await apiRequest('/health');
const [buyerTokens, sellerTokens, adminTokens] = await Promise.all([
  login('cliente@ejemplo.com', 'cliente123'),
  login('vendedor@ejemplo.com', 'vendedor123'),
  login('admin@topgreen.com', 'admin123'),
]);
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    await exercisePublicCatalog(browser, viewport);
    await exerciseCheckout(browser, viewport, buyerTokens);
    await exerciseSeller(browser, viewport, sellerTokens);
    await exerciseAdmin(browser, viewport, adminTokens);
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(EVIDENCE_DIR, 'audit-results.json'),
  `${JSON.stringify(results, null, 2)}\n`,
);

const overflow = results.viewports.filter((entry) => entry.horizontalOverflow);
console.log(`Pantallas verificadas: ${results.viewports.length}`);
console.log(`Desbordes horizontales: ${overflow.length}`);
console.log(`Errores/advertencias de consola: ${results.console.length}`);
console.log(`Respuestas 4xx/5xx: ${results.network.length}`);
console.log(`Resultado: ${path.join(EVIDENCE_DIR, 'audit-results.json')}`);
if (overflow.length > 0) process.exitCode = 1;
