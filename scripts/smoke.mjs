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

async function apiUpload(path, { token, filename, content, contentType }) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: contentType }), filename);
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const rawBody = await response.text();
  const data = rawBody ? JSON.parse(rawBody) : null;
  if (!response.ok) {
    throw new Error(`POST ${path} respondió HTTP ${response.status}: ${data?.detail || rawBody}`);
  }
  return { status: response.status, data };
}

async function expectApiError(expectedStatus, callback) {
  try {
    await callback();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(`HTTP ${expectedStatus}`), `error inesperado: ${message}`);
    return message;
  }
  throw new Error(`la API no respondió HTTP ${expectedStatus}`);
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

await runCase(13, 'Transferencia exige CBU o alias del vendedor', async () => {
  await apiRequest('/cart/items', {
    method: 'POST',
    token: state.buyerToken,
    body: { product_id: state.product.id, quantity: 1 },
  });
  const error = await expectApiError(400, () =>
    apiRequest('/orders/transfer-options', { token: state.buyerToken }),
  );
  assert(/no configuró CBU ni alias/i.test(error), `motivo inesperado: ${error}`);
  return 'HTTP 400 con motivo visible; no se creó ninguna orden';
});

await runCase(14, 'Datos bancarios correctos y orden esperando comprobante', async () => {
  const bankData = {
    cbu: '2850590940090418135201',
    alias_bancario: 'topgreen.smoke',
  };
  await apiRequest('/auth/me', {
    method: 'PATCH',
    token: state.sellerToken,
    body: bankData,
  });
  const options = await apiRequest('/orders/transfer-options', {
    token: state.buyerToken,
  });
  const [databaseBank] = queryRows(`
    SELECT cbu, alias_bancario
    FROM users
    WHERE id = ${sqlLiteral(state.sellerId)}
  `);
  const sellerOption = options.data.find((option) => option.seller_id === state.sellerId);
  assert(sellerOption, 'la API no devolvió el vendedor del carrito');
  assert(sellerOption.cbu === databaseBank[0], 'el CBU de API no coincide con SQL');
  assert(
    sellerOption.alias_bancario === databaseBank[1],
    'el alias de API no coincide con SQL',
  );

  const checkout = await apiRequest('/orders/checkout/transfer', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: 'Av. Transferencia 123',
      shipping_city: 'Rosario',
      shipping_province: 'Santa Fe',
      shipping_postal_code: '2000',
      notes: 'Orden smoke por transferencia',
    },
  });
  const [order] = checkout.data.orders;
  assert(order?.status === 'awaiting_transfer_receipt', `estado inesperado: ${order?.status}`);
  assert(order.cbu === databaseBank[0], 'la orden no devolvió el CBU correcto');
  state.transferOrderId = order.order_id;

  await apiRequest('/auth/me', {
    method: 'PATCH',
    token: state.sellerToken,
    body: {
      cbu: '0000003100098765432101',
      alias_bancario: 'topgreen.cambio',
    },
  });
  const buyerOrders = await apiRequest('/orders/my?as_role=buyer', {
    token: state.buyerToken,
  });
  const savedOrder = buyerOrders.data.find((candidate) => candidate.id === order.order_id);
  const [databaseSnapshot] = queryRows(`
    SELECT transfer_cbu, transfer_alias_bancario, transfer_account_holder
    FROM orders
    WHERE id = ${sqlLiteral(order.order_id)}
  `);
  assert(savedOrder?.seller_cbu === bankData.cbu, 'la orden cambió su CBU junto con el perfil');
  assert(
    savedOrder?.seller_alias_bancario === bankData.alias_bancario,
    'la orden cambió su alias junto con el perfil',
  );
  assert(databaseSnapshot[0] === bankData.cbu, 'SQL no conservó el CBU original');
  assert(databaseSnapshot[1] === bankData.alias_bancario, 'SQL no conservó el alias original');
  assert(databaseSnapshot[2] === order.seller_name, 'SQL no conservó el titular original');
  return `HTTP ${checkout.status}, order_id=${order.order_id}, snapshot API=SQL intacto tras cambiar el perfil`;
});

await runCase(15, 'Comprobante fallido visible y comprobante válido asociado', async () => {
  const failure = await expectApiError(400, () =>
    apiUpload(`/orders/${state.transferOrderId}/transfer-receipt`, {
      token: state.buyerToken,
      filename: 'comprobante.txt',
      content: 'archivo inválido',
      contentType: 'text/plain',
    }),
  );
  assert(/Formato de archivo no permitido/i.test(failure), `motivo inesperado: ${failure}`);

  const statusAfterFailure = querySql(`
    SELECT status::text
    FROM orders
    WHERE id = ${sqlLiteral(state.transferOrderId)}
  `);
  const receiptsAfterFailure = queryCount(`
    SELECT COUNT(*)
    FROM orders
    WHERE id = ${sqlLiteral(state.transferOrderId)}
      AND transfer_receipt_url IS NOT NULL
  `);
  assert(statusAfterFailure === 'AWAITING_TRANSFER_RECEIPT', `estado tras fallo: ${statusAfterFailure}`);
  assert(receiptsAfterFailure === 0, 'el fallo dejó un comprobante asociado');

  const uploaded = await apiUpload(`/orders/${state.transferOrderId}/transfer-receipt`, {
    token: state.buyerToken,
    filename: 'comprobante.png',
    content: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
    contentType: 'image/png',
  });
  const [databaseReceipt] = queryRows(`
    SELECT status::text, transfer_receipt_url
    FROM orders
    WHERE id = ${sqlLiteral(state.transferOrderId)}
  `);
  assert(databaseReceipt[0] === 'TRANSFER_RECEIPT_SUBMITTED', `estado: ${databaseReceipt[0]}`);
  assert(databaseReceipt[1] === uploaded.data.transfer_receipt_url, 'URL API y SQL no coinciden');
  const stored = await fetch(`${new URL(API_URL).origin}${databaseReceipt[1]}`);
  assert(stored.status === 200, `el archivo guardado respondió HTTP ${stored.status}`);
  return `fallo HTTP 400 sin cambiar orden; archivo HTTP 200; URL API=SQL`;
});

await runCase(16, 'Sólo el vendedor correcto valida el comprobante', async () => {
  const otherSeller = await apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: 'otro.vendedor.smoke@example.com',
      password: 'smoke123',
      full_name: 'Otro Vendedor Smoke',
      role: 'user',
    },
  });
  await expectApiError(403, () =>
    apiRequest(`/orders/${state.transferOrderId}/transfer-receipt`, {
      method: 'PATCH',
      token: otherSeller.data.access_token,
      body: { decision: 'approve' },
    }),
  );
  const approved = await apiRequest(`/orders/${state.transferOrderId}/transfer-receipt`, {
    method: 'PATCH',
    token: state.sellerToken,
    body: { decision: 'approve' },
  });
  assert(approved.data.status === 'paid', `estado tras aprobar: ${approved.data.status}`);
  const databaseStatus = querySql(`
    SELECT status::text FROM orders WHERE id = ${sqlLiteral(state.transferOrderId)}
  `);
  assert(databaseStatus === 'PAID', `estado SQL tras aprobar: ${databaseStatus}`);
  state.otherSellerToken = otherSeller.data.access_token;
  return 'otro vendedor HTTP 403; vendedor correcto dejó API=paid y SQL=PAID';
});

await runCase(17, 'Rechazo de comprobante guarda el motivo', async () => {
  await apiRequest('/cart/items', {
    method: 'POST',
    token: state.buyerToken,
    body: { product_id: state.product.id, quantity: 1 },
  });
  const checkout = await apiRequest('/orders/checkout/transfer', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: 'Av. Rechazo 456',
      shipping_city: 'Rosario',
      shipping_province: 'Santa Fe',
      shipping_postal_code: '2000',
    },
  });
  const rejectedOrder = checkout.data.orders[0];
  await apiUpload(`/orders/${rejectedOrder.order_id}/transfer-receipt`, {
    token: state.buyerToken,
    filename: 'comprobante-rechazo.png',
    content: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
    contentType: 'image/png',
  });
  const reason = 'El monto del comprobante no coincide';
  const rejected = await apiRequest(`/orders/${rejectedOrder.order_id}/transfer-receipt`, {
    method: 'PATCH',
    token: state.sellerToken,
    body: { decision: 'reject', reason },
  });
  assert(rejected.data.status === 'rejected', `estado API: ${rejected.data.status}`);
  const [databaseRejection] = queryRows(`
    SELECT status::text, cancellation_reason
    FROM orders
    WHERE id = ${sqlLiteral(rejectedOrder.order_id)}
  `);
  assert(databaseRejection[0] === 'REJECTED', `estado SQL: ${databaseRejection[0]}`);
  assert(databaseRejection[1] === reason, 'el motivo API no quedó guardado');
  return `API=rejected, SQL=REJECTED, motivo guardado="${reason}"`;
});

await runCase(18, 'Transferencia completa desde la interfaz', async () => {
  const [databaseBank] = queryRows(`
    SELECT cbu, alias_bancario
    FROM users
    WHERE id = ${sqlLiteral(state.sellerId)}
  `);
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];

  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.buyerToken,
        refreshToken: state.buyerRefreshToken,
      },
    );
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`${FRONTEND_URL}/?section=marketplace`, {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForFunction(
      () => document.querySelectorAll('#catalog-category option').length > 1,
    );
    await page.locator('#catalog-type').selectOption('productos');
    await page.getByRole('button', { name: /Agregar/ }).first().click();
    await page.getByRole('button', { name: /Carrito/ }).click();
    await page.getByRole('button', { name: 'Continuar compra' }).click();

    await page.getByRole('heading', { name: /Datos de Envío/ }).waitFor();
    await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5555-0101');
    await page.locator('form select').selectOption('Buenos Aires');
    await page.getByPlaceholder('Rosario').fill('Rosario');
    await page
      .getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B')
      .fill('Av. Transferencia UI 789');
    await page.getByPlaceholder('2000').fill('2000');
    await page.locator('form:has(h2) button[type="submit"]').click();

    await page.getByRole('heading', { name: /Método de Pago/ }).waitFor();
    await page.locator('input[value="bank_transfer"]').check();
    await page
      .getByText(/TopGreen no recibe ni retiene el dinero/)
      .waitFor({ state: 'visible' });
    await page.getByText(new RegExp(databaseBank[1])).waitFor({ state: 'visible' });
    const bankDetails = await page.locator('form:has(h2)').textContent();
    assert(bankDetails?.includes(databaseBank[0]), 'la UI no muestra el CBU guardado en SQL');
    assert(bankDetails?.includes(databaseBank[1]), 'la UI no muestra el alias guardado en SQL');
    await page.getByRole('button', { name: /Crear orden y adjuntar comprobante/ }).click();

    await page.getByRole('heading', { name: /Transferencia bancaria/ }).waitFor();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'comprobante-ui.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.getByRole('button', { name: 'Adjuntar comprobante' }).click();
    await page
      .getByText(/Comprobante enviado\. Esperando validación del vendedor/)
      .waitFor({ state: 'visible', timeout: 15_000 });

    assert(pageErrors.length === 0, `errores JS: ${pageErrors.join(' | ')}`);
    const [databaseOrder] = queryRows(`
      SELECT status::text, transfer_receipt_url, order_number
      FROM orders
      WHERE buyer_id = ${sqlLiteral(state.buyerId)}
        AND seller_id = ${sqlLiteral(state.sellerId)}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    assert(databaseOrder[0] === 'TRANSFER_RECEIPT_SUBMITTED', `estado SQL: ${databaseOrder[0]}`);
    assert(databaseOrder[1], 'la orden creada por UI no guardó el comprobante');

    const transferPanel = (await page.locator('body').textContent()) || '';
    assert(
      transferPanel.includes(databaseOrder[2]),
      `la UI no muestra ${databaseOrder[2]} como referencia de pago`,
    );
    assert(
      /como concepto de la transferencia/i.test(transferPanel),
      'la UI no instruye a usar la referencia como concepto del pago',
    );

    const sellerContext = await browser.newContext();
    try {
      await sellerContext.addInitScript(
        ({ accessToken, refreshToken }) => {
          window.localStorage.setItem('access_token', accessToken);
          window.localStorage.setItem('refresh_token', refreshToken);
        },
        {
          accessToken: state.sellerToken,
          refreshToken: state.sellerRefreshToken,
        },
      );
      const sellerPage = await sellerContext.newPage();
      await sellerPage.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await sellerPage.locator('button').filter({ hasText: '👤' }).first().click();
      await sellerPage.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
      await sellerPage.getByRole('button', { name: 'Mis Ventas' }).click();
      const saleHeading = sellerPage.getByRole('heading', {
        name: `Venta #${databaseOrder[2]}`,
      });
      await saleHeading.waitFor({ state: 'visible' });
      const saleCard = saleHeading.locator('xpath=../../..');
      const warning = saleCard.getByText(/Verificá el dinero en tu cuenta bancaria/);
      await warning.waitFor({ state: 'visible' });
      const warningPrecedesButtons = await saleCard.evaluate((card) => {
        const warningElement = [...card.querySelectorAll('p')].find((element) =>
          element.textContent?.includes('Verificá el dinero en tu cuenta bancaria')
        );
        const approveButton = [...card.querySelectorAll('button')].find((element) =>
          element.textContent?.includes('Aprobar comprobante')
        );
        return Boolean(
          warningElement
          && approveButton
          && warningElement.compareDocumentPosition(approveButton)
            & Node.DOCUMENT_POSITION_FOLLOWING
        );
      });
      assert(warningPrecedesButtons, 'el aviso del vendedor no está antes de aprobar/rechazar');
    } finally {
      await sellerContext.close();
    }

    return 'UI + API + DB, avisos visibles al comprador y vendedor antes de aprobar';
  } finally {
    await browser.close();
  }
});

await runCase(19, 'Las rutas financieras heredadas no están expuestas', async () => {
  await expectApiError(404, () => apiRequest('/payments/public-key'));
  await expectApiError(404, () => apiRequest('/mp-oauth/status', {
    token: state.sellerToken,
  }));
  await expectApiError(404, () => apiRequest('/payments/simulate-payment/inexistente', {
    method: 'POST',
    token: state.buyerToken,
  }));
  return 'payments, mp-oauth y simulate-payment respondieron HTTP 404';
});

await runCase(20, 'Respaldo de imágenes en el recorrido de demostración', async () => {
  const browser = await chromium.launch({ headless: true });
  let blockedSeedImages = 0;
  const blockSeedImages = (page) =>
    page.route('https://picsum.photos/**', (route) => {
      blockedSeedImages += 1;
      return route.fulfill({ status: 404, body: 'imagen rota por smoke' });
    });

  try {
    const buyerContext = await browser.newContext();
    await buyerContext.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.buyerToken,
        refreshToken: state.buyerRefreshToken,
      },
    );
    const buyerPage = await buyerContext.newPage();
    await blockSeedImages(buyerPage);
    await buyerPage.goto(`${FRONTEND_URL}/?section=marketplace`, {
      waitUntil: 'domcontentloaded',
    });
    await buyerPage.locator('#catalog-category').waitFor({ state: 'visible', timeout: 15_000 });
    await buyerPage.waitForFunction(
      () => document.querySelectorAll('#catalog-category option').length > 1,
    );
    await buyerPage.locator('#catalog-type').selectOption('productos');
    const productName = state.product.name;
    await buyerPage
      .getByPlaceholder('Buscar productos, semillas, maquinaria...')
      .fill(productName);
    await buyerPage
      .getByPlaceholder('Buscar productos, semillas, maquinaria...')
      .press('Enter');
    const productHeading = buyerPage.getByRole('heading', {
      name: productName,
      exact: true,
      level: 3,
    });
    await productHeading.waitFor({ state: 'visible' });
    const productCard = productHeading.locator('xpath=ancestor::div[contains(@class,\"card\")]');
    const addButton = productCard.getByRole('button', { name: /Agregar/ });

    await productHeading.click();
    const detailHeading = buyerPage.getByRole('heading', {
      name: productName,
      exact: true,
      level: 2,
    });
    await detailHeading.waitFor({ state: 'visible' });
    const detailModal = detailHeading.locator('xpath=ancestor::div[contains(@class,\"modal\")]');
    await detailModal.getByRole('img', { name: productName, exact: true }).first().waitFor();
    await detailModal.getByRole('button', { name: '✕' }).click();

    await addButton.click();
    await buyerPage.getByRole('button', { name: /Carrito/ }).click();
    const cartHeading = buyerPage.getByRole('heading', { name: /Mi Carrito/ });
    await cartHeading.waitFor();
    const cartModal = cartHeading.locator('xpath=ancestor::div[contains(@class,\"modal\")]');
    await cartModal.getByRole('img', { name: productName, exact: true }).waitFor();
    await cartModal.getByRole('button', { name: 'Continuar compra' }).click();
    const shippingHeading = buyerPage.getByRole('heading', { name: /Datos de Envío/ });
    const checkoutModal = shippingHeading.locator('xpath=ancestor::div[contains(@class,\"modal\")]');
    await checkoutModal.getByRole('img', { name: productName, exact: true }).waitFor();
    await buyerContext.close();

    const sellerContext = await browser.newContext();
    await sellerContext.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: state.sellerToken,
        refreshToken: state.sellerRefreshToken,
      },
    );
    const sellerPage = await sellerContext.newPage();
    await blockSeedImages(sellerPage);
    await sellerPage.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await sellerPage.locator('button').filter({ hasText: '👤' }).first().click();
    await sellerPage.getByRole('heading', { name: 'Mi Perfil' }).waitFor();
    await sellerPage.getByRole('button', { name: 'Mis Productos' }).click();
    await sellerPage.getByRole('heading', { name: 'Mis Productos' }).waitFor();
    await sellerPage.getByRole('img').first().waitFor();
    await sellerContext.close();

    const adminLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@topgreen.com', password: 'admin123' },
    });
    const adminContext = await browser.newContext();
    await adminContext.addInitScript(
      ({ accessToken, refreshToken }) => {
        window.localStorage.setItem('access_token', accessToken);
        window.localStorage.setItem('refresh_token', refreshToken);
      },
      {
        accessToken: adminLogin.data.access_token,
        refreshToken: adminLogin.data.refresh_token,
      },
    );
    const adminPage = await adminContext.newPage();
    await blockSeedImages(adminPage);
    await adminPage.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await adminPage.getByRole('button', { name: '⚙️ Admin' }).click();
    await adminPage.getByRole('heading', { name: 'Panel de Administración' }).waitFor();
    await adminPage.getByRole('button', { name: '📦 Productos' }).click();
    const table = adminPage.locator('table');
    await table.waitFor();
    await table.getByRole('img').first().waitFor();
    await adminContext.close();

    assert(blockedSeedImages > 0, 'Playwright no forzó ninguna URL de picsum.photos a HTTP 404');
    return 'URLs rotas reemplazadas en detalle, carrito, checkout, vendedor y administración';
  } finally {
    await browser.close();
  }
});

await runCase(21, 'Registro de transportista desde la interfaz', async () => {
  assert(state.location, 'caso 5 no dejó provincia/localidad');
  await expectApiError(422, () => apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: 'transportista.incompleto@example.com',
      password: 'smoke123',
      full_name: 'Transportista Incompleto',
      is_carrier: true,
    },
  }));

  const email = 'transportista.smoke@example.com';
  const password = 'smoke123';
  const transport = 'Camión habilitado dominio SM0 KE21';
  const capacity = 'Hasta 40 toneladas de semillas';
  const radius = 125.5;
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.getByText('Regístrate aquí').click();
    await page.getByRole('heading', { name: 'Crear Cuenta' }).waitFor();

    await page.locator('input[name="name"]').fill('Transportista Smoke');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="phone"]').fill('+54 11 5555 2121');
    await page.getByLabel('Quiero registrarme como transportista').check();
    await page.getByLabel('Provincia base').selectOption(state.location.provinceId);
    await page.getByLabel('Localidad base').selectOption(state.location.localityId);
    await page.locator('input[name="carrierTransport"]').fill(transport);
    await page.getByLabel('Declaro que el transporte está habilitado').check();
    await page.locator('input[name="carrierCoverageRadiusKm"]').fill(String(radius));
    await page.locator('input[name="carrierCapacity"]').fill(capacity);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form input[type="password"]').nth(1).fill(password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.getByText(/Transportista Smoke.*cuenta fue creada exitosamente/).waitFor({
      state: 'visible',
      timeout: 15_000,
    });

    const login = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert(login.data.user.role === 'user', 'el transportista recibió un rol nuevo');
    assert(login.data.user.is_carrier === true, 'la API no marca al transportista');
    assert(
      login.data.user.carrier_base_locality_id === state.location.localityId,
      'la API no conserva la localidad base',
    );

    const [databaseCarrier] = queryRows(`
      SELECT
        u.role::text,
        u.is_carrier::text,
        u.carrier_base_locality_id,
        u.carrier_transport,
        u.carrier_transport_certified::text,
        u.carrier_coverage_radius_km::text,
        COALESCE(u.carrier_capacity, ''),
        l.name
      FROM users u
      JOIN localities l ON l.id = u.carrier_base_locality_id
      WHERE u.email = ${sqlLiteral(email)}
    `);
    assert(databaseCarrier, 'el transportista registrado por UI no quedó en la base');
    assert(databaseCarrier[0] === 'USER', `rol SQL inesperado: ${databaseCarrier[0]}`);
    assert(databaseCarrier[1] === 'true', 'is_carrier SQL no quedó activo');
    assert(databaseCarrier[2] === state.location.localityId, 'localidad base SQL incorrecta');
    assert(databaseCarrier[3] === transport, 'transporte SQL incorrecto');
    assert(databaseCarrier[4] === 'true', 'habilitación SQL no quedó activa');
    assert(Number(databaseCarrier[5]) === radius, `radio SQL inesperado: ${databaseCarrier[5]}`);
    assert(databaseCarrier[6] === capacity, 'capacidad SQL incorrecta');

    return `UI + API + DB, localidad=${databaseCarrier[7]}, radio=${databaseCarrier[5]} km`;
  } finally {
    await browser.close();
  }
});

// --- Órdenes de transferencia que no se pueden abandonar -------------------

async function crearOrdenTransferencia(calle) {
  await apiRequest('/cart/items', {
    method: 'POST',
    token: state.buyerToken,
    body: { product_id: state.product.id, quantity: 1 },
  });
  const checkout = await apiRequest('/orders/checkout/transfer', {
    method: 'POST',
    token: state.buyerToken,
    body: {
      shipping_address: calle,
      shipping_city: 'Rosario',
      shipping_province: 'Santa Fe',
      shipping_postal_code: '2000',
    },
  });
  const [order] = checkout.data.orders;
  assert(order?.status === 'awaiting_transfer_receipt', `estado inicial: ${order?.status}`);
  return order;
}

function estadoDeOrden(orderId) {
  return querySql(`SELECT status::text FROM orders WHERE id = ${sqlLiteral(orderId)}`);
}

function stockDeProducto(productId) {
  return queryCount(`SELECT stock FROM products WHERE id = ${sqlLiteral(productId)}`);
}

const RECIBO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function adjuntarComprobante(orderId, nombre) {
  await apiUpload(`/orders/${orderId}/transfer-receipt`, {
    token: state.buyerToken,
    filename: nombre,
    content: RECIBO_PNG,
    contentType: 'image/png',
  });
  const estado = estadoDeOrden(orderId);
  assert(estado === 'TRANSFER_RECEIPT_SUBMITTED', `estado tras adjuntar: ${estado}`);
}

await runCase(22, 'Sin comprobante, comprador y vendedor pueden cancelar', async () => {
  const stockInicial = stockDeProducto(state.product.id);

  const ordenComprador = await crearOrdenTransferencia('Av. Abandono 100');
  await expectApiError(403, () =>
    apiRequest(`/orders/${ordenComprador.order_id}/cancel`, {
      method: 'POST',
      token: state.otherSellerToken,
      body: { reason: 'no es mi orden' },
    }),
  );
  assert(
    estadoDeOrden(ordenComprador.order_id) === 'AWAITING_TRANSFER_RECEIPT',
    'un usuario ajeno movió la orden',
  );

  await apiRequest(`/orders/${ordenComprador.order_id}/cancel`, {
    method: 'POST',
    token: state.buyerToken,
    body: { reason: 'me arrepentí antes de transferir' },
  });
  const estadoComprador = estadoDeOrden(ordenComprador.order_id);
  assert(estadoComprador === 'CANCELLED', `el comprador dejó la orden en ${estadoComprador}`);

  const ordenVendedor = await crearOrdenTransferencia('Av. Abandono 200');
  await apiRequest(`/orders/${ordenVendedor.order_id}/cancel`, {
    method: 'POST',
    token: state.sellerToken,
    body: { reason: 'nunca llegó la transferencia' },
  });
  const estadoVendedor = estadoDeOrden(ordenVendedor.order_id);
  assert(estadoVendedor === 'REJECTED', `el vendedor dejó la orden en ${estadoVendedor}`);

  const stockFinal = stockDeProducto(state.product.id);
  assert(
    stockFinal === stockInicial,
    `cancelar sin aprobar movió el stock: ${stockInicial} -> ${stockFinal}`,
  );

  return `ajeno 403; comprador=CANCELLED, vendedor=REJECTED, stock intacto en ${stockFinal}`;
});

await runCase(23, 'Sin comprobante, el vendedor igual aprueba o rechaza', async () => {
  const stockInicial = stockDeProducto(state.product.id);

  const ordenRechazo = await crearOrdenTransferencia('Av. Sin Comprobante 300');
  await expectApiError(400, () =>
    apiRequest(`/orders/${ordenRechazo.order_id}/transfer-receipt`, {
      method: 'PATCH',
      token: state.sellerToken,
      body: { decision: 'reject' },
    }),
  );
  const motivo = 'No veo la transferencia en mi cuenta';
  await apiRequest(`/orders/${ordenRechazo.order_id}/transfer-receipt`, {
    method: 'PATCH',
    token: state.sellerToken,
    body: { decision: 'reject', reason: motivo },
  });
  const [rechazada] = queryRows(`
    SELECT status::text, cancellation_reason
    FROM orders
    WHERE id = ${sqlLiteral(ordenRechazo.order_id)}
  `);
  assert(rechazada[0] === 'REJECTED', `estado SQL: ${rechazada[0]}`);
  assert(rechazada[1] === motivo, 'no se guardó el motivo del rechazo');
  // Se cuenta en una consulta aparte: querySql recorta el resultado y un
  // último campo NULL desaparecería de la fila.
  const comprobantesRechazo = queryCount(`
    SELECT COUNT(*)
    FROM orders
    WHERE id = ${sqlLiteral(ordenRechazo.order_id)}
      AND transfer_receipt_url IS NOT NULL
  `);
  assert(comprobantesRechazo === 0, 'quedó un comprobante donde nunca se adjuntó uno');

  const ordenAprobada = await crearOrdenTransferencia('Av. Sin Comprobante 400');
  const aprobada = await apiRequest(`/orders/${ordenAprobada.order_id}/transfer-receipt`, {
    method: 'PATCH',
    token: state.sellerToken,
    body: { decision: 'approve' },
  });
  assert(aprobada.data.status === 'paid', `estado API: ${aprobada.data.status}`);
  assert(
    estadoDeOrden(ordenAprobada.order_id) === 'PAID',
    'la aprobación sin comprobante no llegó a la base',
  );

  const stockFinal = stockDeProducto(state.product.id);
  assert(
    stockFinal === stockInicial - 1,
    `stock esperado ${stockInicial - 1}, obtenido ${stockFinal}`,
  );

  return `rechazo sin motivo HTTP 400; rechazo con motivo=REJECTED; aprobación sin comprobante=PAID, stock ${stockInicial} -> ${stockFinal}`;
});

await runCase(24, 'Con comprobante enviado, sólo el vendedor puede cancelar', async () => {
  const stockInicial = stockDeProducto(state.product.id);
  const orden = await crearOrdenTransferencia('Av. Comprobante Enviado 500');
  await adjuntarComprobante(orden.order_id, 'comprobante-cancelacion.png');

  const bloqueo = await expectApiError(400, () =>
    apiRequest(`/orders/${orden.order_id}/cancel`, {
      method: 'POST',
      token: state.buyerToken,
      body: { reason: 'quiero retirarme igual' },
    }),
  );
  assert(/vendedor/i.test(bloqueo), `el motivo no explica quién puede cancelar: ${bloqueo}`);
  assert(
    estadoDeOrden(orden.order_id) === 'TRANSFER_RECEIPT_SUBMITTED',
    'el intento del comprador movió la orden',
  );

  await apiRequest(`/orders/${orden.order_id}/cancel`, {
    method: 'POST',
    token: state.sellerToken,
    body: { reason: 'el comprobante no corresponde a esta operación' },
  });
  const estadoFinal = estadoDeOrden(orden.order_id);
  assert(estadoFinal === 'REJECTED', `estado tras cancelar el vendedor: ${estadoFinal}`);

  const stockFinal = stockDeProducto(state.product.id);
  assert(stockFinal === stockInicial, `el stock cambió: ${stockInicial} -> ${stockFinal}`);

  return `comprador HTTP 400 con motivo; vendedor dejó REJECTED; stock intacto en ${stockFinal}`;
});

await runCase(25, 'Dos aprobaciones simultáneas descuentan stock una sola vez', async () => {
  const stockInicial = stockDeProducto(state.product.id);
  const orden = await crearOrdenTransferencia('Av. Concurrencia 600');
  await adjuntarComprobante(orden.order_id, 'comprobante-concurrente.png');

  const aprobar = () =>
    apiRequest(`/orders/${orden.order_id}/transfer-receipt`, {
      method: 'PATCH',
      token: state.sellerToken,
      body: { decision: 'approve' },
    }).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, message: String(error.message) }),
    );

  const [primera, segunda] = await Promise.all([aprobar(), aprobar()]);
  const exitosas = [primera, segunda].filter((resultado) => resultado.ok).length;
  assert(exitosas === 1, `aprobaciones aceptadas: ${exitosas} (se esperaba exactamente 1)`);

  const rechazada = [primera, segunda].find((resultado) => !resultado.ok);
  assert(
    /HTTP 400/.test(rechazada.message),
    `la segunda no fue rechazada con 400: ${rechazada.message}`,
  );

  const estadoFinal = estadoDeOrden(orden.order_id);
  assert(estadoFinal === 'PAID', `estado final: ${estadoFinal}`);

  const stockFinal = stockDeProducto(state.product.id);
  assert(
    stockFinal === stockInicial - 1,
    `descuento doble: ${stockInicial} -> ${stockFinal}, se esperaba ${stockInicial - 1}`,
  );

  return `1 de 2 aceptada, la otra HTTP 400; stock ${stockInicial} -> ${stockFinal}`;
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
