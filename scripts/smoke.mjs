import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const API_URL = process.env.SMOKE_API_URL || 'http://localhost:8000/api';
const FRONTEND_URL = process.env.SMOKE_FRONTEND_URL || 'http://localhost:5173';
const forcedFailure = process.argv
  .find((argument) => argument.startsWith('--force-failure='))
  ?.split('=', 2)[1];

if (forcedFailure && forcedFailure !== 'health') {
  console.error(`Fallo forzado desconocido: ${forcedFailure}`);
  console.error('Valor permitido: --force-failure=health');
  process.exit(2);
}

const localEnv = parseEnvFile('.env');
const DB_USER = localEnv.DB_USER || 'topgreen';
const DB_NAME = localEnv.DB_NAME || 'topgreen';
const state = {};
const results = [];

function parseEnvFile(path) {
  const values = {};

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    values[key] = value;
  }

  return values;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function querySql(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      'topgreen-db',
      'psql',
      '-U',
      DB_USER,
      '-d',
      DB_NAME,
      '-tA',
      '-F',
      '\t',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim();
}

function queryRows(sql) {
  const output = querySql(sql);
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => line.split('\t'));
}

function queryCount(sql) {
  const value = Number.parseInt(querySql(sql), 10);
  assert(Number.isInteger(value), `La consulta SQL no devolvió un entero: ${sql}`);
  return value;
}

async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const rawBody = await response.text();
  let data = null;
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = rawBody;
    }
  }

  if (!response.ok) {
    const rawDetail =
      typeof data === 'object' && data !== null && 'detail' in data
        ? data.detail
        : rawBody || response.statusText;
    const detail =
      typeof rawDetail === 'string' ? rawDetail : JSON.stringify(rawDetail);
    throw new Error(`${method} ${path} respondió HTTP ${response.status}: ${detail}`);
  }

  return { status: response.status, data };
}

async function runCase(number, name, callback) {
  const startedAt = Date.now();

  try {
    const observation = await callback();
    const elapsed = Date.now() - startedAt;
    results.push({ number, name, passed: true, observation, elapsed });
    console.log(`[PASS] ${String(number).padStart(2, '0')} ${name} — ${observation} (${elapsed} ms)`);
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ number, name, passed: false, observation: message, elapsed });
    console.log(`[FAIL] ${String(number).padStart(2, '0')} ${name} — ${message} (${elapsed} ms)`);
  }
}

await runCase(1, 'Salud del servicio', async () => {
  const path = forcedFailure === 'health' ? '/health__forced_failure' : '/health';
  const { status, data } = await apiRequest(path);
  assert(data?.status === 'ok', `status inesperado: ${JSON.stringify(data)}`);
  return `HTTP ${status}, status=ok`;
});

await runCase(2, 'Registro de usuario', async () => {
  const credentials = {
    email: 'smoke.comprador@example.com',
    password: 'smoke123',
    full_name: 'Comprador Smoke',
    phone: '+54 11 5555 0101',
    role: 'user',
  };
  const { status, data } = await apiRequest('/auth/register', {
    method: 'POST',
    body: credentials,
  });

  assert(data?.user?.email === credentials.email, 'el usuario registrado no coincide');
  assert(data?.access_token, 'el registro no devolvió access_token');
  state.buyerCredentials = credentials;
  state.buyerId = data.user.id;
  return `HTTP ${status}, user_id=${data.user.id}`;
});

await runCase(3, 'Ingreso y obtención del token', async () => {
  assert(state.buyerCredentials, 'caso 2 no dejó credenciales para ingresar');
  const { status, data } = await apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: state.buyerCredentials.email,
      password: state.buyerCredentials.password,
    },
  });

  assert(data?.access_token, 'el login no devolvió access_token');
  assert(data?.refresh_token, 'el login no devolvió refresh_token');
  state.buyerToken = data.access_token;
  state.buyerRefreshToken = data.refresh_token;
  return `HTTP ${status}, JWT recibido`;
});

await runCase(4, 'Catálogo con categoría y precio', async () => {
  const [selection] = queryRows(`
    SELECT category_id::text, MIN(price)::text
    FROM products
    WHERE status = 'ACTIVE'
    GROUP BY category_id
    ORDER BY COUNT(*) DESC, category_id
    LIMIT 1
  `);
  assert(selection, 'la base no tiene productos activos para probar el catálogo');

  const [categoryId, maxPrice] = selection;
  const sqlTotal = queryCount(`
    SELECT COUNT(*)
    FROM products
    WHERE status = 'ACTIVE'
      AND category_id = ${sqlLiteral(categoryId)}
      AND price >= 0
      AND price <= ${Number(maxPrice)}
  `);
  const params = new URLSearchParams({
    category: categoryId,
    min_price: '0',
    max_price: maxPrice,
    page_size: '100',
  });
  const { status, data } = await apiRequest(`/catalog/products?${params}`);

  assert(data.total === sqlTotal, `API=${data.total}, SQL=${sqlTotal}`);
  assert(sqlTotal > 0, 'la combinación elegida no devuelve productos');
  assert(
    data.items.every(
      (item) => item.category_id === categoryId && Number(item.price) <= Number(maxPrice),
    ),
    'la API devolvió un producto fuera de categoría o precio',
  );
  state.catalogCategoryId = categoryId;
  return `HTTP ${status}, API=${data.total}, SQL=${sqlTotal}, max_price=${maxPrice}`;
});

await runCase(5, 'Catálogo con provincia y localidad', async () => {
  const [province] = queryRows(`
    SELECT l.province_id, l.province_name, COUNT(*)::text
    FROM products p
    JOIN localities l ON l.id = p.locality_id
    WHERE p.status = 'ACTIVE'
    GROUP BY l.province_id, l.province_name
    ORDER BY COUNT(*) DESC, l.province_name
    LIMIT 1
  `);
  assert(province, 'la base no tiene productos con provincia');

  const [provinceId, provinceName, provinceSqlTotalRaw] = province;
  const provinceSqlTotal = Number(provinceSqlTotalRaw);
  const provinceParams = new URLSearchParams({ province: provinceName, page_size: '100' });
  const provinceResponse = await apiRequest(`/catalog/products?${provinceParams}`);
  assert(
    provinceResponse.data.total === provinceSqlTotal,
    `provincia API=${provinceResponse.data.total}, SQL=${provinceSqlTotal}`,
  );

  const [locality] = queryRows(`
    SELECT l.id, l.name, COUNT(*)::text
    FROM products p
    JOIN localities l ON l.id = p.locality_id
    WHERE p.status = 'ACTIVE'
      AND l.province_id = ${sqlLiteral(provinceId)}
    GROUP BY l.id, l.name
    ORDER BY COUNT(*) DESC, l.name
    LIMIT 1
  `);
  assert(locality, `no hay localidades con productos en ${provinceName}`);

  const [localityId, localityName, localitySqlTotalRaw] = locality;
  const localitySqlTotal = Number(localitySqlTotalRaw);
  const localityParams = new URLSearchParams({
    province: provinceName,
    locality_id: localityId,
    page_size: '100',
  });
  const localityResponse = await apiRequest(`/catalog/products?${localityParams}`);
  assert(
    localityResponse.data.total === localitySqlTotal,
    `localidad API=${localityResponse.data.total}, SQL=${localitySqlTotal}`,
  );

  state.location = { provinceId, provinceName, localityId, localityName };
  return [
    `provincia HTTP ${provinceResponse.status}, API=${provinceResponse.data.total}, SQL=${provinceSqlTotal}`,
    `localidad HTTP ${localityResponse.status}, API=${localityResponse.data.total}, SQL=${localitySqlTotal}`,
  ].join('; ');
});

await runCase(6, 'Detalle de producto', async () => {
  const sellerLogin = await apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: 'vendedor@ejemplo.com',
      password: 'vendedor123',
    },
  });
  state.sellerToken = sellerLogin.data.access_token;
  state.sellerRefreshToken = sellerLogin.data.refresh_token;
  state.sellerId = sellerLogin.data.user.id;

  const params = new URLSearchParams({
    seller_id: state.sellerId,
    in_stock: 'true',
    page_size: '100',
  });
  const catalog = await apiRequest(`/catalog/products?${params}`);
  const product = catalog.data.items.find(
    (item) => !item.is_service && Number(item.stock) > 0,
  );
  assert(product, 'el vendedor demo no tiene un producto activo con stock');

  const detail = await apiRequest(`/catalog/products/${product.id}`);
  assert(detail.data.id === product.id, 'el detalle no corresponde al producto pedido');
  state.product = product;
  return `HTTP ${detail.status}, product_id=${product.id}, "${product.name}"`;
});

await runCase(7, 'Agregar al carrito y verlo', async () => {
  assert(state.buyerToken, 'caso 3 no dejó token de comprador');
  assert(state.product, 'caso 6 no dejó producto para el carrito');

  const added = await apiRequest('/cart/items', {
    method: 'POST',
    token: state.buyerToken,
    body: { product_id: state.product.id, quantity: 1 },
  });
  const cart = await apiRequest('/cart', { token: state.buyerToken });
  const item = cart.data.items.find((candidate) => candidate.product_id === state.product.id);

  assert(item, 'el producto agregado no aparece en el carrito');
  assert(item.quantity === 1, `cantidad inesperada: ${item.quantity}`);
  state.cartId = cart.data.id;
  return `POST ${added.status}, GET ${cart.status}, total_items=${cart.data.total_items}`;
});

await runCase(8, 'Crear orden desde el carrito', async () => {
  assert(state.buyerToken, 'no hay token de comprador');
  const order = await apiRequest('/orders/checkout', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: 'Av. Smoke 123',
      shipping_city: 'Balcarce',
      shipping_province: 'Buenos Aires',
      shipping_postal_code: '7620',
      notes: 'Orden automatizada sin pago',
    },
  });

  assert(order.data?.id, 'checkout no devolvió una orden');
  assert(order.data.items?.length === 1, 'la orden no conserva el ítem del carrito');
  state.orderId = order.data.id;
  return `HTTP ${order.status}, order_id=${order.data.id}, status=${order.data.status}`;
});

await runCase(9, 'Publicar producto como vendedor desde la interfaz', async () => {
  assert(state.sellerToken, 'caso 6 no dejó token de vendedor');
  assert(state.product?.category_name, 'no hay categoría para completar el formulario');
  assert(state.location, 'caso 5 no dejó provincia/localidad');

  const productName = `Producto Smoke UI ${Date.now()}`;
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const applicationConsoleErrors = [];

  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.sellerToken,
        refreshToken: state.sellerRefreshToken,
      },
    );

    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error'
        && /Error al|Uncaught|TypeError|ReferenceError/i.test(message.text())
      ) {
        applicationConsoleErrors.push(message.text());
      }
    });

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    const sellButton = page.getByRole('button', { name: /Vender/i }).first();
    await sellButton.waitFor({ state: 'visible', timeout: 15_000 });
    await sellButton.click();

    await page
      .getByRole('heading', { name: /Agregar Nuevo Producto/i })
      .waitFor({ state: 'visible' });
    await page.locator('#name').fill(productName);

    const categoryOption = page
      .locator('#category option')
      .filter({ hasText: state.product.category_name })
      .first();
    await categoryOption.waitFor({ state: 'attached', timeout: 10_000 });
    await page.locator('#category').selectOption({ label: state.product.category_name });

    await page
      .locator('#description')
      .fill('Producto creado por la suite integral de smoke tests de TopGreen.');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'smoke-product.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.locator('#price').fill('12345');
    await page.locator('#stock').fill('3');
    await page.locator('#province').selectOption(state.location.provinceId);
    await page.locator('#locality').selectOption(state.location.localityId);
    await page.locator('form button[type="submit"]').click();
    await page
      .getByText(/publicado exitosamente!/i)
      .waitFor({ state: 'visible', timeout: 20_000 });

    assert(pageErrors.length === 0, `errores JS: ${pageErrors.join(' | ')}`);
    assert(
      applicationConsoleErrors.length === 0,
      `errores de consola: ${applicationConsoleErrors.join(' | ')}`,
    );

    const myProducts = await apiRequest('/products/my', { token: state.sellerToken });
    const published = myProducts.data.products?.find(
      (product) => product.name === productName,
    );
    assert(published, 'la API del vendedor no devuelve el producto publicado por UI');

    const [databaseProduct] = queryRows(`
      SELECT p.id::text, COUNT(pi.id)::text
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.name = ${sqlLiteral(productName)}
        AND p.seller_id = ${sqlLiteral(state.sellerId)}
        AND p.locality_id = ${sqlLiteral(state.location.localityId)}
      GROUP BY p.id
    `);
    assert(databaseProduct, 'la publicación de UI no quedó en la base');
    assert(
      Number(databaseProduct[1]) === 1,
      `la publicación quedó con ${databaseProduct[1]} imágenes en vez de 1`,
    );

    state.publishedProductId = databaseProduct[0];
    return `UI + API + DB, product_id=${databaseProduct[0]}, imágenes=1`;
  } finally {
    await browser.close();
  }
});

await runCase(10, 'Fallo de imagen visible sin perder la publicación', async () => {
  assert(state.sellerToken, 'caso 6 no dejó token de vendedor');
  assert(state.product?.category_name, 'no hay categoría para completar el formulario');
  assert(state.location, 'caso 5 no dejó provincia/localidad');

  const productName = `Producto Smoke Imagen Fallida ${Date.now()}`;
  const failureReason = 'Archivo demasiado grande (prueba controlada)';
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const applicationConsoleErrors = [];
  let uploadIntercepted = false;

  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.sellerToken,
        refreshToken: state.sellerRefreshToken,
      },
    );

    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error'
        && /Error al|Uncaught|TypeError|ReferenceError/i.test(message.text())
      ) {
        applicationConsoleErrors.push(message.text());
      }
    });
    await page.route('**/api/products/*/images', async (route) => {
      uploadIntercepted = true;
      await route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({ detail: failureReason }),
      });
    });

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    const sellButton = page.getByRole('button', { name: /Vender/i }).first();
    await sellButton.waitFor({ state: 'visible', timeout: 15_000 });
    await sellButton.click();

    await page
      .getByRole('heading', { name: /Agregar Nuevo Producto/i })
      .waitFor({ state: 'visible' });
    await page.locator('#name').fill(productName);
    await page.locator('#category').selectOption({ label: state.product.category_name });
    await page
      .locator('#description')
      .fill('Producto publicado aunque falle la carga de su imagen.');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'smoke-upload-failure.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.locator('#price').fill('23456');
    await page.locator('#stock').fill('2');
    await page.locator('#province').selectOption(state.location.provinceId);
    await page.locator('#locality').selectOption(state.location.localityId);
    await page.locator('form button[type="submit"]').click();

    const warning = page.getByText(/publicado, pero no se pudo subir la imagen/i);
    await warning.waitFor({ state: 'visible', timeout: 20_000 });
    const warningText = await warning.textContent();
    assert(
      warningText?.includes(failureReason),
      `el aviso no incluye el motivo: ${warningText}`,
    );
    await page.getByText(productName, { exact: true }).first().waitFor({
      state: 'visible',
      timeout: 20_000,
    });

    assert(uploadIntercepted, 'Playwright no interceptó la petición de imagen');
    assert(pageErrors.length === 0, `errores JS: ${pageErrors.join(' | ')}`);
    assert(
      applicationConsoleErrors.length === 0,
      `errores de consola: ${applicationConsoleErrors.join(' | ')}`,
    );

    const [databaseProduct] = queryRows(`
      SELECT p.id::text, COUNT(pi.id)::text
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.name = ${sqlLiteral(productName)}
        AND p.seller_id = ${sqlLiteral(state.sellerId)}
      GROUP BY p.id
    `);
    assert(databaseProduct, 'el producto sin imagen no quedó en la base');
    assert(
      Number(databaseProduct[1]) === 0,
      `la subida interceptada dejó ${databaseProduct[1]} imágenes`,
    );

    return `UI + DB, producto visible, aviso="${failureReason}", imágenes=0`;
  } finally {
    await browser.close();
  }
});

await runCase(11, 'Ver mis compras y mis ventas', async () => {
  assert(state.orderId, 'caso 8 no dejó una orden');
  const purchases = await apiRequest('/orders/my?as_role=buyer', {
    token: state.buyerToken,
  });
  const sales = await apiRequest('/orders/my?as_role=seller', {
    token: state.sellerToken,
  });

  assert(
    purchases.data.some((order) => order.id === state.orderId),
    'la orden creada no aparece en mis compras',
  );
  assert(
    sales.data.some((order) => order.id === state.orderId),
    'la orden creada no aparece en mis ventas',
  );
  return `compras HTTP ${purchases.status} (${purchases.data.length}), ventas HTTP ${sales.status} (${sales.data.length})`;
});

await runCase(12, 'Administración: usuarios, productos y órdenes', async () => {
  const adminLogin = await apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@topgreen.com',
      password: 'admin123',
    },
  });
  const adminToken = adminLogin.data.access_token;
  const [users, products, orders] = await Promise.all([
    apiRequest('/admin/users?page_size=100', { token: adminToken }),
    apiRequest('/admin/products?page_size=100', { token: adminToken }),
    apiRequest('/admin/orders?page_size=100', { token: adminToken }),
  ]);

  const sqlUsers = queryCount('SELECT COUNT(*) FROM users');
  const sqlProducts = queryCount('SELECT COUNT(*) FROM products');
  const sqlOrders = queryCount('SELECT COUNT(*) FROM orders');

  assert(users.data.total === sqlUsers, `usuarios API=${users.data.total}, SQL=${sqlUsers}`);
  assert(
    products.data.total === sqlProducts,
    `productos API=${products.data.total}, SQL=${sqlProducts}`,
  );
  assert(orders.data.total === sqlOrders, `órdenes API=${orders.data.total}, SQL=${sqlOrders}`);
  return [
    `usuarios HTTP ${users.status}, API=SQL=${sqlUsers}`,
    `productos HTTP ${products.status}, API=SQL=${sqlProducts}`,
    `órdenes HTTP ${orders.status}, API=SQL=${sqlOrders}`,
  ].join('; ');
});

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;

console.log();
console.log('Resumen smoke tests');
console.log('-------------------');
for (const result of results) {
  console.log(
    `${result.passed ? 'PASS' : 'FAIL'} ${String(result.number).padStart(2, '0')} ${result.name}`,
  );
}
console.log('-------------------');
console.log(`${passed}/${results.length} pasaron; ${failed} fallaron`);

if (failed > 0) process.exitCode = 1;
