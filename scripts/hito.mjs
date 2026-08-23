#!/usr/bin/env node
/**
 * Puerta del hito intermedio: las tres capacidades, juntas y en un solo viaje.
 *
 * Catálogo, búsqueda con filtros y geolocalización funcional existen desde
 * hace varias piezas, pero su evidencia estaba repartida entre casos que no se
 * miran entre sí. Esta puerta las demuestra **encadenadas**: lo que una filtra
 * es lo que la siguiente compra, y lo que se compra es lo que el transportista
 * termina viendo.
 *
 * Dos reglas que la hacen valer como demostración:
 *
 *  1. **No fabrica su escenario.** Todo sale del seed idempotente. No prepara
 *     publicaciones, radios, carritos ni orígenes por API ni por SQL antes de
 *     abrir el navegador: si el seed no alcanzara, la puerta falla y hay que
 *     arreglar el seed, no la prueba.
 *  2. **SQL sólo contrasta.** Se usa después de cada paso, para comprobar que
 *     lo que se vio en pantalla coincide con lo que hay en la base.
 *
 * Termina en rojo si algún paso falla o si alguno no llegó a correr.
 *
 *   npm run hito
 *
 * Dos fallas forzadas, para poder ver que las comprobaciones discriminan y no
 * pasan solas. No son parte de la puerta: se piden a mano.
 *
 *   npm run hito -- --force-failure=catalogo-sin-senal
 *   npm run hito -- --force-failure=tarjeta-suplantada
 */
import { chromium } from 'playwright';

import { queryRows, sqlLiteral } from './lib/sql.mjs';

const API = process.env.SMOKE_API_URL || 'http://localhost:8000/api';
const WEB = process.env.SMOKE_FRONTEND_URL || 'http://localhost:5173';
const ESPERA = 20_000;

/* El recorrido exigido. Si falta uno, sobra uno o se repite, la puerta falla:
   una demostración a la que le sacaron un paso no demuestra lo mismo. */
const PASOS = [
  'catálogo filtrado por categoría y ubicación oficial',
  'detalle, carrito y destino del padrón',
  'transportistas compatibles por PostGIS, sin contacto',
  'selección, contacto revelado y orden creada',
  'contraste por SQL de la orden',
  'la operación como transportista',
];

// Cuentas del seed. No se crean cuentas para esta puerta.
const COMPRADOR = { email: 'cliente@ejemplo.com', password: 'cliente123' };
const TRANSPORTISTA = { email: 'transportista@ejemplo.com', password: 'transportista123' };

// El tramo se elige del seed, no se prepara: categoría e ubicación de una
// publicación demo, y como destino la misma localidad, que es donde el
// transportista demo declara su base.
const CATEGORIA = 'Insumos agrícolas';
const PROVINCIA = { id: '06', nombre: 'Buenos Aires' };
const LOCALIDAD = 'Pergamino';

const FALLAS_FORZADAS = ['catalogo-sin-senal', 'tarjeta-suplantada'];
const forzado = process.argv
  .find((argumento) => argumento.startsWith('--force-failure='))
  ?.split('=', 2)[1];

if (forzado && !FALLAS_FORZADAS.includes(forzado)) {
  console.error(`Falla forzada desconocida: ${forzado}`);
  console.error(`Valores permitidos: ${FALLAS_FORZADAS.join(', ')}`);
  process.exit(2);
}

const hechos = [];
const fallas = [];

function assert(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

async function paso(nombre, callback) {
  assert(PASOS.includes(nombre), `paso fuera del recorrido exigido: ${nombre}`);
  const desde = Date.now();
  try {
    const observacion = await callback();
    hechos.push({ nombre, observacion, ms: Date.now() - desde });
    console.log(`  ✓ ${nombre}\n      ${observacion}`);
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    fallas.push({ nombre, motivo });
    hechos.push({ nombre, observacion: `FALLÓ: ${motivo}`, ms: Date.now() - desde });
    console.log(`  ✗ ${nombre}\n      ${motivo}`);
    throw error;
  }
}

async function ingresar(page, cuenta) {
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Ingresar' }).first().click();
  await page.getByRole('heading', { name: 'Iniciar Sesión' }).waitFor({ timeout: ESPERA });
  await page.getByPlaceholder('tu@email.com').fill(cuenta.email);
  await page.getByPlaceholder('••••••••').fill(cuenta.password);
  await page.locator('[class*="_submitButton_"][type="submit"]').click();
  await page.getByRole('button', { name: 'Salir' }).waitFor({ timeout: ESPERA });
}

async function main() {
  console.log('=== Puerta del hito intermedio ===');
  console.log(`API ${API} · Web ${WEB}\n`);

  const navegador = await chromium.launch({ headless: true });
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await contexto.newPage();
  const datos = {};

  try {
    await ingresar(page, COMPRADOR);

    // ---------------------------------------------------------------- 1
    await paso('catálogo filtrado por categoría y ubicación oficial', async () => {
      await page.locator('button').filter({ hasText: 'TopGreen' }).first().click();
      await page.locator('#catalog-category').waitFor({ state: 'visible', timeout: ESPERA });

      const contar = async () => Number(
        (await page.locator('[class*="_resultsNumber_"]').first().textContent()) || '0',
      );
      const sinFiltrar = await contar();

      await page.locator('#catalog-category').selectOption({ label: CATEGORIA });
      await page.locator('#catalog-province').selectOption(PROVINCIA.id);
      await page.waitForFunction(
        () => document.querySelectorAll('#catalog-locality option').length > 1,
        null,
        { timeout: ESPERA },
      );

      // La localidad se toma del propio selector: el id oficial sale de la
      // pantalla, no de una constante escrita acá.
      const idLocalidad = await page.locator('#catalog-locality').evaluate(
        (selector, nombre) => {
          const opcion = [...selector.options].find((o) => o.textContent.trim() === nombre);
          return opcion ? opcion.value : '';
        },
        LOCALIDAD,
      );
      assert(idLocalidad, `el selector no ofrece ${LOCALIDAD}`);

      // La consulta filtrada llega tarde a propósito. Con una espera por reloj
      // esto mediría el catálogo anterior y la puerta pasaría midiendo otra
      // cosa; con la señal de la respuesta, el retraso es irrelevante.
      await page.route('**/api/catalog/products*', async (ruta) => {
        if (ruta.request().url().includes(`locality_id=${idLocalidad}`)) {
          await new Promise((listo) => setTimeout(listo, 2500));
        }
        await ruta.continue();
      });

      // La consulta que trae las tres condiciones a la vez. La categoría viaja
      // como id, no como nombre, así que se exige presente y no vacía.
      const filtrada = page.waitForResponse(
        (respuesta) => respuesta.url().includes('/catalog/products?')
          && respuesta.url().includes(`locality_id=${idLocalidad}`)
          && /[?&]category=[^&]+/.test(respuesta.url())
          && /[?&]province=[^&]+/.test(respuesta.url())
          && respuesta.status() === 200,
        { timeout: ESPERA },
      );
      await page.locator('#catalog-locality').selectOption(idLocalidad);

      const grilla = page.locator('[class*="_productsGrid_"]');
      let deLaApi = null;
      if (forzado === 'catalogo-sin-senal') {
        // La espera por reloj de la primera entrega, tal cual: 1,2 s y a medir.
        filtrada.catch(() => {});
        await page.waitForTimeout(1200);
      } else {
        deLaApi = (await (await filtrada).json()).items.map((p) => p.name).sort();
        // Y la pantalla tiene que haber terminado de pintar ESA respuesta.
        await page.waitForFunction(
          (cuantos) => document.querySelectorAll(
            '[class*="_productsGrid_"] h3',
          ).length === cuantos,
          deLaApi.length,
          { timeout: ESPERA },
        );
      }

      // Sólo las tarjetas del catálogo: el pie de página también tiene h3.
      const visibles = (await grilla.getByRole('heading', { level: 3 }).allTextContents())
        .map((texto) => texto.trim())
        .filter(Boolean)
        .sort();

      // El contraste sale de la base, no de un número escrito acá.
      const enBase = queryRows(`
        SELECT p.name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        JOIN localities l ON l.id = p.locality_id
        WHERE p.status = 'ACTIVE'
          AND c.name = ${sqlLiteral(CATEGORIA)}
          AND l.name = ${sqlLiteral(LOCALIDAD)}
          AND l.province_name = ${sqlLiteral(PROVINCIA.nombre)}
        ORDER BY p.name
      `).map(([nombre]) => nombre).sort();

      await page.unroute('**/api/catalog/products*');

      assert(enBase.length > 0,
        'el seed no deja ninguna publicación con esa categoría y esa localidad');
      if (deLaApi) {
        assert(JSON.stringify(deLaApi) === JSON.stringify(enBase),
          `la API y SQL no coinciden:\n      API: ${deLaApi.join(', ')}`
          + `\n      SQL: ${enBase.join(', ')}`);
      }
      assert(JSON.stringify(visibles) === JSON.stringify(enBase),
        `la pantalla y SQL no coinciden:\n      pantalla: ${visibles.join(', ')}`
        + `\n      SQL:      ${enBase.join(', ')}`);
      assert(sinFiltrar > enBase.length,
        `el filtro no filtró: ${sinFiltrar} sin filtrar y ${enBase.length} filtrando`);

      datos.publicacion = enBase[0];
      return `${CATEGORIA} · ${LOCALIDAD}, ${PROVINCIA.nombre}: ${enBase.length} de `
        + `${sinFiltrar} publicaciones; pantalla, API y SQL dicen lo mismo pese a `
        + 'una consulta retrasada 2,5 s a propósito';
    });

    // ---------------------------------------------------------------- 2
    await paso('detalle, carrito y destino del padrón', async () => {
      await page.locator('[class*="_productsGrid_"]')
        .getByRole('heading', { name: datos.publicacion, exact: true, level: 3 }).click();
      await page.getByRole('heading', { name: 'Vendido por' }).waitFor({ timeout: ESPERA });
      // Agregar desde el detalle cierra el modal solo.
      await page.getByRole('button', { name: /Agregar al Carrito/ }).click();
      await page.getByRole('heading', { name: 'Vendido por' })
        .waitFor({ state: 'hidden', timeout: ESPERA });

      await page.getByRole('button', { name: /Carrito/ }).click();
      await page.getByRole('heading', { name: /Mi Carrito/ }).waitFor({ timeout: ESPERA });
      await page.getByRole('button', { name: 'Continuar compra' }).click();
      await page.getByRole('heading', { name: /Datos de Env/ }).waitFor({ timeout: ESPERA });

      await page.getByPlaceholder('+54 9 11 1234-5678').fill('+54 9 11 5000-1000');
      await page.getByPlaceholder('Av. San Martín 1234, Piso 5, Depto B').fill('Ruta 8 km 220');
      await page.getByPlaceholder('2000').fill('2700');
      await page.locator('#checkout-provincia').selectOption(PROVINCIA.id);
      await page.waitForFunction(
        () => document.querySelectorAll('#checkout-localidad option').length > 1,
        null,
        { timeout: ESPERA },
      );
      await page.locator('#checkout-localidad').selectOption({ label: LOCALIDAD });

      const traslado = page.locator('[class*="_fletes_"]');
      await traslado.getByRole('radio', { name: /Necesito flete/ }).first()
        .waitFor({ state: 'visible', timeout: ESPERA });

      // El grupo y el origen los derivó el servidor del carrito; acá se
      // comprueba contra la publicación que se agregó.
      const [[vendedor, origen, provinciaOrigen]] = queryRows(`
        SELECT u.full_name, l.name, l.province_name
        FROM products p
        JOIN users u ON u.id = p.seller_id
        JOIN localities l ON l.id = p.locality_id
        WHERE p.name = ${sqlLiteral(datos.publicacion)}
      `);
      const visto = ((await traslado.textContent()) || '').replace(/\s+/g, ' ');
      assert(visto.includes(`Envío de ${vendedor}`),
        `la pantalla no muestra el grupo derivado (${vendedor}): "${visto.slice(0, 160)}"`);
      assert(visto.includes(`${origen}, ${provinciaOrigen}`),
        `la pantalla no muestra el origen oficial (${origen}): "${visto.slice(0, 160)}"`);

      datos.vendedor = vendedor;
      datos.origen = `${origen}, ${provinciaOrigen}`;
      return `«${datos.publicacion}» en el carrito; destino ${LOCALIDAD}; el servidor `
        + `derivó el envío de ${vendedor} desde ${datos.origen}`;
    });

    // ---------------------------------------------------------------- 3
    await paso('transportistas compatibles por PostGIS, sin contacto', async () => {
      const traslado = page.locator('[class*="_fletes_"]');
      await traslado.getByRole('radio', { name: /Necesito flete/ }).first().check();
      await page.getByText('Base:').first().waitFor({ state: 'visible', timeout: ESPERA });

      const visibles = (await traslado.locator('[class*="_fleteNombre_"]').allTextContents())
        .map((texto) => texto.trim()).sort();

      // La misma regla, resuelta por PostGIS: base dentro del radio respecto
      // del destino Y de cada origen del grupo.
      const enPostGIS = queryRows(`
        SELECT u.full_name
        FROM users u
        JOIN localities b ON b.id = u.carrier_base_locality_id
        JOIN localities d ON d.name = ${sqlLiteral(LOCALIDAD)}
                         AND d.province_name = ${sqlLiteral(PROVINCIA.nombre)}
        WHERE u.is_carrier AND u.is_active AND u.is_verified
          AND u.carrier_transport_certified
          AND btrim(COALESCE(u.carrier_certification_detail, '')) <> ''
          AND u.carrier_certification_declared_at IS NOT NULL
          AND COALESCE(u.carrier_coverage_radius_km, 0) > 0
          AND ST_DWithin(b.coordinates, d.coordinates,
                u.carrier_coverage_radius_km::float * 1000.0)
          AND NOT EXISTS (
            SELECT 1 FROM products p
            JOIN localities o ON o.id = p.locality_id
            WHERE p.name = ${sqlLiteral(datos.publicacion)}
              AND NOT ST_DWithin(b.coordinates, o.coordinates,
                    u.carrier_coverage_radius_km::float * 1000.0))
        ORDER BY u.full_name
      `).map(([nombre]) => nombre).sort();

      assert(enPostGIS.length > 0,
        'el seed no deja ningún transportista que cubra este tramo');
      assert(JSON.stringify(visibles) === JSON.stringify(enPostGIS),
        `el listado y PostGIS no coinciden:\n      pantalla: ${visibles.join(', ')}`
        + `\n      PostGIS:  ${enPostGIS.join(', ')}`);

      // Antes de elegir, ningún dato de contacto en pantalla.
      const contactos = queryRows(`
        SELECT u.email, COALESCE(u.phone, ''), COALESCE(u.whatsapp, '')
        FROM users u WHERE u.is_carrier
      `).flat().filter(Boolean);
      const visto = (await traslado.textContent()) || '';
      for (const dato of contactos) {
        assert(!visto.includes(dato), `el listado muestra «${dato}» antes de elegir`);
      }

      datos.transportista = enPostGIS[0];
      return `${enPostGIS.length} transportista(s) que cubren el tramo, iguales a PostGIS `
        + `(${enPostGIS.join(', ')}), y ni un dato de contacto a la vista`;
    });

    // ---------------------------------------------------------------- 4
    await paso('selección, contacto revelado y orden creada', async () => {
      const traslado = page.locator('[class*="_fletes_"]');
      await traslado.getByRole('button', {
        name: new RegExp(`^Seleccionar a ${datos.transportista}`),
      }).click();
      await traslado.getByText('Transportista elegido').waitFor({ timeout: ESPERA });

      const [[correo, telefono]] = queryRows(`
        SELECT u.email, COALESCE(u.phone, '')
        FROM users u WHERE u.full_name = ${sqlLiteral(datos.transportista)}
      `);
      const conElegido = (await traslado.textContent()) || '';
      assert(conElegido.includes(correo),
        'se eligió transportista y no apareció su correo');

      await page.locator('form:has(h2) button[type="submit"]').click();
      await page.getByRole('heading', { name: /M.todo de Pago/ }).waitFor({ timeout: ESPERA });
      // El pago se elige por grupo de vendedor. Acá hay uno solo, pero se
      // marca igual: es lo que hace el comprador.
      await page.locator('input[value="transfer"]').first().check();
      await page.getByRole('button', { name: /Confirmar y crear las órdenes/ }).click();
      await page.getByRole('heading', { name: /Tus órdenes/ })
        .waitFor({ timeout: ESPERA });

      const [[orden]] = queryRows(`
        SELECT o.order_number FROM orders o
        JOIN users u ON u.id = o.buyer_id
        WHERE u.email = ${sqlLiteral(COMPRADOR.email)}
        ORDER BY o.created_at DESC LIMIT 1
      `);
      datos.orden = orden;
      return `${datos.transportista} elegido, contacto visible (${correo}`
        + `${telefono ? ` · ${telefono}` : ''}) y orden ${orden} creada`;
    });

    // ---------------------------------------------------------------- 5
    await paso('contraste por SQL de la orden', async () => {
      const [fila] = queryRows(`
        SELECT
          COALESCE(d.name, '-'),
          COALESCE(oi.origin_locality_name, '-'),
          COALESCE(c.full_name, '-'),
          COALESCE(o.shipping_mode, '-'),
          COALESCE(v.full_name, '-')
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN users v ON v.id = o.seller_id
        LEFT JOIN localities d ON d.id = o.shipping_locality_id
        LEFT JOIN users c ON c.id = o.carrier_id
        WHERE o.order_number = ${sqlLiteral(datos.orden)}
      `);
      assert(fila, `la orden ${datos.orden} no está en la base`);
      const [destino, origen, transportista, modo, vendedor] = fila;

      assert(destino === LOCALIDAD, `destino guardado: ${destino}`);
      assert(datos.origen.startsWith(origen), `origen congelado: ${origen}`);
      assert(transportista === datos.transportista, `transportista guardado: ${transportista}`);
      assert(modo === 'carrier', `modo de traslado guardado: ${modo}`);
      assert(vendedor === datos.vendedor, `vendedor de la orden: ${vendedor}`);

      return `orden ${datos.orden}: destino ${destino}, origen congelado ${origen}, `
        + `traslado «${modo}» con ${transportista}, vendedor ${vendedor}`;
    });

    // ---------------------------------------------------------------- 6
    await paso('la operación como transportista', async () => {
      // Cerrar la confirmación y dejar que se vaya el aviso: si no, el
      // encabezado queda tapado y el clic no llega.
      await page.locator('button[aria-label="Cerrar"]:visible').first().click();
      await page.getByRole('heading', { name: /Tus órdenes/ })
        .waitFor({ state: 'hidden', timeout: ESPERA });
      await page.locator('[class*="_toast_"]').first()
        .waitFor({ state: 'hidden', timeout: ESPERA }).catch(() => {});

      await page.getByRole('button', { name: 'Salir' }).click();
      await page.getByRole('button', { name: 'Ingresar' }).first()
        .waitFor({ state: 'visible', timeout: ESPERA });
      await ingresar(page, TRANSPORTISTA);

      await page.getByRole('button', { name: 'Mi cuenta' }).first().click();
      await page.getByRole('button', { name: /Mis Operaciones/ })
        .waitFor({ state: 'visible', timeout: ESPERA });
      await page.getByRole('button', { name: /Mis Operaciones/ }).click();
      await page.getByRole('heading', { name: 'Mis Operaciones' })
        .waitFor({ state: 'visible', timeout: ESPERA });
      await page.getByText(`Operación #${datos.orden}`).waitFor({ timeout: ESPERA });

      if (forzado === 'tarjeta-suplantada') {
        // Los mismos textos, pero fuera de la tarjeta, y la tarjeta real
        // borrada. Una comprobación que mire la página entera pasaría igual;
        // una que mire la tarjeta tiene que ponerse roja.
        await page.evaluate((textos) => {
          const senuelo = document.createElement('div');
          senuelo.textContent = textos.join(' · ');
          document.body.appendChild(senuelo);
          document.querySelectorAll('[class*="_orderCard_"]')
            .forEach((tarjeta) => tarjeta.remove());
        }, [`Operación #${datos.orden}`, datos.publicacion, LOCALIDAD]);
      }

      // Todo se mira DENTRO de la tarjeta de esta operación. Que un texto
      // exista en otra operación, o en cualquier otro lugar de la página, no
      // puede hacer pasar la comprobación.
      const tarjeta = page.locator('[class*="_orderCard_"]')
        .filter({ hasText: `Operación #${datos.orden}` });
      const cuantas = await tarjeta.count();
      assert(cuantas === 1,
        `esperaba una sola tarjeta de la operación ${datos.orden}, encontré ${cuantas}`);

      const visto = ((await tarjeta.textContent()) || '').replace(/\s+/g, ' ');
      assert(visto.includes(LOCALIDAD), 'la tarjeta no muestra el recorrido');
      assert(visto.includes(datos.publicacion), 'la tarjeta no dice qué hay que mover');
      const [[cantidad]] = queryRows(`
        SELECT oi.quantity FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.order_number = ${sqlLiteral(datos.orden)}
      `);
      assert(visto.includes(`x${cantidad}`),
        `la tarjeta no dice cuánto hay que mover (x${cantidad}): "${visto.slice(0, 200)}"`);
      assert(!/\$\s?\d/.test(visto), 'la tarjeta muestra importes');

      const [[correoComprador, telefonoComprador]] = queryRows(`
        SELECT email, COALESCE(phone, '') FROM users
        WHERE email = ${sqlLiteral(COMPRADOR.email)}
      `);
      for (const dato of [correoComprador, telefonoComprador].filter(Boolean)) {
        assert(!visto.includes(dato),
          `la operación muestra un dato de contacto del comprador («${dato}»)`);
      }
      for (const prohibido of ['CBU', 'Alias', 'comprobante', 'Total']) {
        assert(!visto.toLowerCase().includes(prohibido.toLowerCase()),
          `la operación muestra «${prohibido}»`);
      }

      return `${TRANSPORTISTA.email} ve la tarjeta de ${datos.orden} con recorrido y `
        + 'cantidades, y dentro de esa tarjeta no hay importes ni contacto del comprador';
    });
  } catch {
    // El paso ya se registró; el resumen decide el código de salida.
  } finally {
    await navegador.close();
  }

  const faltantes = PASOS.filter(
    (nombre) => !hechos.some((hecho) => hecho.nombre === nombre),
  );

  console.log('\n=== resumen ===');
  for (const nombre of PASOS) {
    const hecho = hechos.find((h) => h.nombre === nombre);
    if (!hecho) {
      console.log(`  — ${nombre}: NO SE CORRIÓ`);
      continue;
    }
    const marca = hecho.observacion.startsWith('FALLÓ') ? '✗' : '✓';
    console.log(`  ${marca} ${nombre} (${hecho.ms} ms)`);
  }
  console.log(`\n  ${PASOS.length - faltantes.length - fallas.length} de ${PASOS.length} `
    + 'pasos del recorrido, encadenados en un solo viaje');

  if (fallas.length || faltantes.length) {
    console.log('\nHITO NO DEMOSTRADO');
    process.exitCode = 1;
    return;
  }
  console.log('\nHITO DEMOSTRADO: catálogo, búsqueda filtrada y geolocalización funcional, '
    + 'encadenados de punta a punta');
}

await main();
