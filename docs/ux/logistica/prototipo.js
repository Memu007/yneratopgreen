/* Prototipo de UX de logística — TopGreen.
   Sin API, sin base y sin dependencias. Todos los datos son ficticios y están
   acá abajo, a la vista. La búsqueda real por cercanía es de la Fase 3: acá
   los resultados están escritos a mano para poder acordar las pantallas. */

const LOCALIDADES = [
  'Reconquista, Santa Fe',
  'Rafaela, Santa Fe',
  'Venado Tuerto, Santa Fe',
  'Rosario, Santa Fe',
  'Pergamino, Buenos Aires',
  'Río Cuarto, Córdoba',
];

/* Los nombres son los que hoy puede devolver `full_name`: no existe un campo
   de nombre comercial y el prototipo no lo promete.
   Las dos distancias son en línea recta desde la base del transportista, una
   al origen y otra al destino, y las dos tienen que caer dentro del radio
   declarado. Los números son ficticios pero coherentes entre sí. */
const TRANSPORTISTAS = {
  duarte: {
    id: 'duarte',
    nombre: 'Sebastián Duarte',
    base: 'Rafaela, Santa Fe',
    radio: 240,
    transporte: 'Camión con acoplado granelero',
    capacidad: 'Hasta 30 toneladas de granos',
    habilitadoEl: '12/06/2026',
    aOrigen: 228,
    aDestino: 196,
    telefono: '+54 9 3492 55-0110',
    correo: 'sebastian.duarte@ejemplo.test',
  },
  ledesma: {
    id: 'ledesma',
    nombre: 'Ramón Ledesma',
    base: 'Reconquista, Santa Fe',
    radio: 400,
    transporte: 'Chasis con caja cerrada',
    capacidad: 'Hasta 12 toneladas',
    habilitadoEl: '03/07/2026',
    aOrigen: 0,
    aDestino: 388,
    telefono: '+54 9 3482 55-0144',
    correo: 'ramon.ledesma@ejemplo.test',
  },
  ibarra: {
    id: 'ibarra',
    nombre: 'Marcela Ibarra',
    base: 'Pergamino, Buenos Aires',
    radio: 300,
    transporte: 'Carretón para maquinaria',
    capacidad: 'Hasta 40 toneladas, carga sobredimensionada',
    habilitadoEl: '28/05/2026',
    aOrigen: 0,
    aDestino: 176,
    telefono: '+54 9 2477 55-0188',
    correo: 'marcela.ibarra@ejemplo.test',
  },
};

const DESTINO_DEL_COMPRADOR = 'Venado Tuerto, Santa Fe';

function pedidosIniciales() {
  return [
    {
      id: 'A',
      vendedor: 'Agro Insumos del Litoral',
      origen: 'Reconquista, Santa Fe',
      items: ['Semilla de soja RR — 40 bolsas de 50 kg', 'Inoculante — 4 unidades'],
      necesitaFlete: null,
      destino: DESTINO_DEL_COMPRADOR,
      elegido: null,
      candidatos: ['duarte', 'ledesma'],
    },
    {
      id: 'B',
      vendedor: 'Maquinarias Pergamino',
      origen: 'Pergamino, Buenos Aires',
      items: ['Kit de filtros y correas — 2 unidades'],
      necesitaFlete: null,
      destino: DESTINO_DEL_COMPRADOR,
      elegido: null,
      candidatos: ['ibarra'],
    },
  ];
}

const PASOS = {
  comprador: [
    ['c-checkout', 'Envío'],
    ['c-busqueda', 'Buscar flete'],
    ['c-resumen', 'Resumen'],
    ['c-pago', 'Pago'],
    ['c-compras', 'Mis compras'],
  ],
  transportista: [
    ['t-perfil', 'Mi perfil'],
    ['t-operacion', 'Un viaje mío'],
  ],
  vendedor: [['v-venta', 'Una venta']],
};

let pedidos = pedidosIniciales();
let pedidoEnBusqueda = 'A';
let vistaActual = 'c-checkout';

const $ = (selector, raiz = document) => raiz.querySelector(selector);
const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

function perfilDeVista(vista) {
  if (vista.startsWith('t-')) return 'transportista';
  if (vista.startsWith('v-')) return 'vendedor';
  return 'comprador';
}

function pedidoPorId(id) {
  return pedidos.find((pedido) => pedido.id === id);
}

/* Un pedido está resuelto de dos formas, y sólo de esas dos:
   el comprador coordina por su cuenta, o eligió un transportista.
   "Necesito flete" sin transportista es una operación ambigua. */
function pedidoResuelto(pedido) {
  if (pedido.necesitaFlete === false) return true;
  return pedido.necesitaFlete === true && Boolean(pedido.elegido);
}

function opcionesDeLocalidad(seleccionada) {
  return LOCALIDADES.map(
    (localidad) =>
      `<option value="${localidad}"${localidad === seleccionada ? ' selected' : ''}>${localidad}</option>`,
  ).join('');
}

// ---------------------------------------------------------------- navegación

function ir(vista) {
  vistaActual = vista;
  $$('.vista').forEach((seccion) => {
    seccion.hidden = seccion.id !== vista;
  });

  const perfil = perfilDeVista(vista);
  $$('.chip[data-perfil]').forEach((chip) => {
    chip.setAttribute('aria-selected', String(chip.dataset.perfil === perfil));
  });

  $('#pasos').innerHTML = PASOS[perfil]
    .map(
      ([destino, texto]) =>
        `<button type="button" class="chip${destino === vista ? ' es-actual' : ''}" data-ir="${destino}">${texto}</button>`,
    )
    .join('');

  $('#estado-busqueda').closest('.barra__grupo').style.visibility =
    vista === 'c-busqueda' ? 'visible' : 'hidden';

  pintar();
  window.scrollTo({ top: 0 });
}

// ------------------------------------------------------------ checkout

function pintarCheckout() {
  // El aviso de "falta resolver" se borra en cuanto el comprador hace algo.
  $('#aviso-checkout').innerHTML = '';
  $('#checkout-pedidos').innerHTML = pedidos
    .map((pedido) => {
      const elegido = pedido.elegido ? TRANSPORTISTAS[pedido.elegido] : null;
      return `
      <article class="pedido${pedidoResuelto(pedido) ? '' : ' es-incompleto'}"
               id="pedido-${pedido.id}" tabindex="-1">
        <div class="pedido__cabecera">
          <h2>Pedido ${pedido.id} — ${pedido.vendedor}</h2>
          <span class="pedido__origen">Sale de ${pedido.origen}</span>
        </div>
        <ul class="pedido__items">${pedido.items.map((item) => `<li>${item}</li>`).join('')}</ul>

        <div class="opciones" role="radiogroup" aria-label="Traslado del pedido ${pedido.id}">
          <label class="opcion${pedido.necesitaFlete === true ? ' es-elegida' : ''}">
            <input type="radio" name="flete-${pedido.id}" value="si"
                   ${pedido.necesitaFlete === true ? 'checked' : ''}
                   data-pedido="${pedido.id}">
            <span class="opcion__texto">
              <strong>Necesito flete</strong>
              <span>Te mostramos transportistas que cubren este tramo.</span>
            </span>
          </label>
          <label class="opcion${pedido.necesitaFlete === false ? ' es-elegida' : ''}">
            <input type="radio" name="flete-${pedido.id}" value="no"
                   ${pedido.necesitaFlete === false ? 'checked' : ''}
                   data-pedido="${pedido.id}">
            <span class="opcion__texto">
              <strong>Coordino el traslado por mi cuenta</strong>
              <span>Seguís al pago sin elegir transportista.</span>
            </span>
          </label>
        </div>

        ${
          pedido.necesitaFlete === true
            ? elegido
              ? `<div class="contacto">
                   <p class="etiqueta">Transportista elegido</p>
                   <p><strong>${elegido.nombre}</strong> — ${elegido.base}</p>
                   <p>${elegido.telefono} · ${elegido.correo}</p>
                   <div class="acciones">
                     <button type="button" class="btn btn--peligro" data-quitar="${pedido.id}">Quitar</button>
                     <button type="button" class="btn btn--fantasma" data-buscar="${pedido.id}">Cambiar</button>
                   </div>
                 </div>`
              : `<div class="acciones">
                   <button type="button" class="btn btn--primario btn--bloque" data-buscar="${pedido.id}">
                     Buscar transportistas para el pedido ${pedido.id}
                   </button>
                 </div>`
            : ''
        }
      </article>`;
    })
    .join('');
}

// ------------------------------------------------------------ búsqueda

function distanciaTexto(km) {
  return km === 0 ? 'misma localidad' : `${km} km`;
}

function tarjetaTransportista(transportista, pedido) {
  const esElegido = pedido.elegido === transportista.id;
  return `
    <article class="transportista${esElegido ? ' es-elegido' : ''}">
      <div class="transportista__cabecera">
        <h2>${transportista.nombre}</h2>
        <span class="transportista__distancia">Transportista</span>
      </div>

      <div class="datos">
        <div><span class="etiqueta">Localidad base</span><p>${transportista.base}</p></div>
        <div><span class="etiqueta">Cobertura declarada</span><p>Radio de ${transportista.radio} km</p></div>
        <div><span class="etiqueta">Transporte declarado</span><p>${transportista.transporte}</p></div>
        <div><span class="etiqueta">Capacidad</span><p>${transportista.capacidad}</p></div>
      </div>

      <div class="datos">
        <div>
          <span class="etiqueta">De su base al origen</span>
          <p>${distanciaTexto(transportista.aOrigen)} <span class="ayuda">en línea recta, hasta ${pedido.origen}</span></p>
        </div>
        <div>
          <span class="etiqueta">De su base al destino</span>
          <p>${distanciaTexto(transportista.aDestino)} <span class="ayuda">en línea recta, hasta ${pedido.destino}</span></p>
        </div>
      </div>

      <p class="ayuda">
        Las dos puntas del viaje caen dentro de su radio de ${transportista.radio} km.
      </p>
      <p class="nota-legal">
        Declarado por el transportista el ${transportista.habilitadoEl}.
        TopGreen no verifica esta habilitación.
      </p>

      ${
        esElegido
          ? `<div class="contacto">
               <p class="etiqueta">Contacto</p>
               <p>${transportista.telefono} · ${transportista.correo}</p>
               <p class="ayuda">La coordinación y el precio del flete se acuerdan directamente.</p>
             </div>
             <div class="acciones">
               <button type="button" class="btn btn--peligro" data-quitar="${pedido.id}">Quitar del pedido</button>
               <button type="button" class="btn btn--primario" data-ir="c-checkout">Listo, volver</button>
             </div>`
          : `<p class="contacto__oculto">
               Los datos de contacto aparecen cuando lo seleccionás.
             </p>
             <div class="acciones">
               <button type="button" class="btn btn--primario"
                       data-elegir="${transportista.id}" data-pedido="${pedido.id}">
                 Seleccionar
               </button>
             </div>`
      }
    </article>`;
}

function pintarBusqueda() {
  const pedido = pedidoPorId(pedidoEnBusqueda);
  $('#busqueda-pedido').textContent = `el pedido ${pedido.id} — ${pedido.vendedor}`;
  $('#busqueda-origen').textContent = pedido.origen;
  $('#busqueda-destino').innerHTML = opcionesDeLocalidad(pedido.destino);

  const estado = $('#estado-busqueda').value;
  const caja = $('#resultados');

  if (estado === 'carga') {
    caja.innerHTML = `
      <h2 class="resultados__titulo">Buscando transportistas…</h2>
      <div class="esqueleto"></div><div class="esqueleto"></div>`;
    return;
  }

  // "Coordino por mi cuenta" desde acá resuelve el pedido, no sólo cambia de
  // pantalla: deja necesitaFlete en false.
  const salidaPropia = `<button type="button" class="btn btn--fantasma" data-propio="${pedido.id}">
      Coordino por mi cuenta
    </button>`;

  if (estado === 'vacio') {
    caja.innerHTML = `
      <div class="estado">
        <h2>Ningún transportista cubre este tramo</h2>
        <p>Probá con otro destino, o coordiná el traslado por tu cuenta.</p>
        <div class="acciones" style="justify-content:center">${salidaPropia}</div>
      </div>`;
    return;
  }

  if (estado === 'error') {
    caja.innerHTML = `
      <div class="estado estado--error">
        <h2>No pudimos buscar transportistas</h2>
        <p>Fue un problema nuestro, no tuyo. Tu pedido quedó intacto.</p>
        <div class="acciones" style="justify-content:center">
          <button type="button" class="btn btn--primario" id="reintentar">Reintentar</button>
          ${salidaPropia}
        </div>
      </div>`;
    return;
  }

  const encontrados = pedido.candidatos.map((id) => TRANSPORTISTAS[id]);
  caja.innerHTML = `
    <h2 class="resultados__titulo">
      ${encontrados.length} transportista${encontrados.length === 1 ? '' : 's'} para este tramo
    </h2>
    <div class="transportistas">
      ${encontrados.map((transportista) => tarjetaTransportista(transportista, pedido)).join('')}
    </div>`;
}

// ------------------------------------------------------------ resumen y compras

function bloqueLogistico(pedido) {
  if (pedido.necesitaFlete === null) {
    return `<p class="ayuda">Todavía no dijiste cómo se traslada este pedido.</p>
      <div class="acciones">
        <button type="button" class="btn btn--fantasma" data-ir="c-checkout">Decidirlo</button>
      </div>`;
  }
  if (pedido.necesitaFlete === false) {
    return '<p class="ayuda">Coordinás el traslado por tu cuenta.</p>';
  }
  if (!pedido.elegido) {
    return `<p class="ayuda">Todavía no elegiste transportista.</p>
      <div class="acciones">
        <button type="button" class="btn btn--fantasma" data-buscar="${pedido.id}">Elegir uno</button>
      </div>`;
  }
  const elegido = TRANSPORTISTAS[pedido.elegido];
  return `
    <p class="etiqueta">Transportista</p>
    <p><strong>${elegido.nombre}</strong> — ${elegido.base}</p>
    <p>${elegido.transporte} · ${elegido.capacidad}</p>
    <p>${elegido.telefono} · ${elegido.correo}</p>
    <p class="nota-legal">
      Declarado por el transportista el ${elegido.habilitadoEl}.
      TopGreen no verifica esta habilitación.
    </p>
    <div class="acciones">
      <button type="button" class="btn btn--peligro" data-quitar="${pedido.id}">Quitar</button>
      <button type="button" class="btn btn--fantasma" data-buscar="${pedido.id}">Cambiar</button>
    </div>`;
}

function pintarResumen() {
  $('#resumen-pedidos').innerHTML = pedidos
    .map(
      (pedido) => `
      <article class="pedido">
        <div class="pedido__cabecera">
          <h2>Pedido ${pedido.id} — ${pedido.vendedor}</h2>
          <span class="pedido__origen">${pedido.origen} → ${pedido.destino}</span>
        </div>
        <ul class="pedido__items">${pedido.items.map((item) => `<li>${item}</li>`).join('')}</ul>
        ${bloqueLogistico(pedido)}
      </article>`,
    )
    .join('');
}

function pintarCompras() {
  $('#compras-pedidos').innerHTML = pedidos
    .map((pedido) => {
      const elegido = pedido.elegido ? TRANSPORTISTAS[pedido.elegido] : null;
      let logistica;
      if (elegido) {
        logistica = `<p class="etiqueta">Transportista</p>
          <p><strong>${elegido.nombre}</strong></p>
          <p>${elegido.telefono} · ${elegido.correo}</p>
          <p class="nota-legal">
            La coordinación y el precio del flete se acuerdan directamente.
          </p>`;
      } else if (pedido.necesitaFlete === false) {
        logistica = '<p class="ayuda">Coordinás el traslado por tu cuenta.</p>';
      } else {
        // No se afirma que coordina solo cuando nunca lo decidió.
        logistica = '<p class="ayuda">Este pedido quedó sin resolver el traslado.</p>';
      }
      return `
      <article class="pedido">
        <div class="pedido__cabecera">
          <h2>Pedido ${pedido.id} — ${pedido.vendedor}</h2>
          <span class="pedido__origen">${pedido.origen} → ${pedido.destino}</span>
        </div>
        ${logistica}
      </article>`;
    })
    .join('');
}

function pintar() {
  if (vistaActual === 'c-checkout') pintarCheckout();
  if (vistaActual === 'c-busqueda') pintarBusqueda();
  if (vistaActual === 'c-resumen') pintarResumen();
  if (vistaActual === 'c-compras') pintarCompras();
}

// ------------------------------------------------------------ eventos

document.addEventListener('click', (evento) => {
  const boton = evento.target.closest('button');
  if (!boton) return;

  if (boton.dataset.ir) {
    ir(boton.dataset.ir);
    return;
  }
  if (boton.dataset.buscar) {
    pedidoEnBusqueda = boton.dataset.buscar;
    const pedido = pedidoPorId(pedidoEnBusqueda);
    pedido.necesitaFlete = true;
    ir('c-busqueda');
    return;
  }
  if (boton.dataset.elegir) {
    pedidoPorId(boton.dataset.pedido).elegido = boton.dataset.elegir;
    pintar();
    return;
  }
  if (boton.dataset.quitar) {
    pedidoPorId(boton.dataset.quitar).elegido = null;
    pintar();
    return;
  }
  if (boton.id === 'reintentar') {
    $('#estado-busqueda').value = 'resultados';
    pintar();
    return;
  }
  if (boton.dataset.propio) {
    const pedido = pedidoPorId(boton.dataset.propio);
    pedido.necesitaFlete = false;
    pedido.elegido = null;
    ir('c-checkout');
    return;
  }
  if (boton.id === 'ir-a-resumen') {
    const faltan = pedidos.filter((pedido) => !pedidoResuelto(pedido));
    if (faltan.length > 0) {
      const nombres = faltan.map((pedido) => `pedido ${pedido.id}`).join(' y el ');
      $('#aviso-checkout').innerHTML = `
        <div class="aviso-falta" role="alert">
          Antes de seguir, decidí el traslado del ${nombres}:
          elegí un transportista o marcá que lo coordinás por tu cuenta.
        </div>`;
      $(`#pedido-${faltan[0].id}`).focus();
      return;
    }
    $('#aviso-checkout').innerHTML = '';
    ir('c-resumen');
    return;
  }
  if (boton.id === 'reiniciar') {
    pedidos = pedidosIniciales();
    pedidoEnBusqueda = 'A';
    $('#estado-busqueda').value = 'resultados';
    ir('c-checkout');
  }
});

document.addEventListener('change', (evento) => {
  const campo = evento.target;

  if (campo.name && campo.name.startsWith('flete-')) {
    const pedido = pedidoPorId(campo.dataset.pedido);
    pedido.necesitaFlete = campo.value === 'si';
    if (!pedido.necesitaFlete) pedido.elegido = null;
    pintar();
    return;
  }

  if (campo.id === 'busqueda-destino') {
    pedidoPorId(pedidoEnBusqueda).destino = campo.value;
    pintar();
    return;
  }

  if (campo.id === 'estado-busqueda') pintarBusqueda();

  if (campo.id === 't-hab-fecha') {
    const [anio, mes, dia] = campo.value.split('-');
    $('#t-hab-vista').textContent =
      `Declarado por el transportista el ${dia}/${mes}/${anio}. TopGreen no verifica esta habilitación.`;
  }
});

$('#form-transportista').addEventListener('submit', (evento) => {
  evento.preventDefault();
  $('#t-guardado').textContent = 'Perfil guardado (simulado: el prototipo no persiste nada).';
});

$('#t-localidad').innerHTML = opcionesDeLocalidad('Rafaela, Santa Fe');
ir('c-checkout');
