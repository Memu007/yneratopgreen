import React, { useEffect, useRef, useState } from 'react';
import { Product, CotizacionPedida } from '../../types';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  precioVisible,
  formatCantidad,
  etiquetaDeCatalogo,
  formatRating,
} from '../../utils/formatters';
import {
  accionDe,
  normalizarAnatomia,
  ETIQUETA_DE_ANATOMIA,
  ETIQUETA_DE_CONDICION,
} from '../../utils/anatomia';
import { convertBackendProductToFrontend, getProductDetail } from '../../utils/catalogService';
import { ErrorDeLaApi } from '../../utils/api';
import { urlDe, type Seccion } from '../../navegacion/politica';
import { SellerProfileModal } from '../SellerProfile/SellerProfileModal';
import styles from './ProductDetailPage.module.css';
import { ProductImage } from '../ProductImage/ProductImage';
import { ADAPTACION_DEMO, fotoDemoDeArchivo } from '../../utils/fotosDemo';

interface ProductDetailPageProps {
  /** La publicación, tal como la pide la barra. */
  id: string;
  /** Desde qué sección se abrió. Sin origen se llegó por un enlace directo:
      no hay atrás propio y la salida es el Mercado. */
  origen: Seccion | null;
  onVolver: () => void;
  onIrAlMercado: () => void;
  onSolicitarCotizacion?: (pedido: CotizacionPedida) => void;
  /** Qué hacer cuando falta la sesión. La ficha queda abajo, así que al
      cerrar el ingreso —se complete o se cancele— la persona sigue en la
      misma publicación, y nada se agrega solo al carrito. */
  onRequiereIngreso?: () => void;
}

/** Cómo se nombra el regreso según de dónde se vino. */
const VOLVER_A: Partial<Record<Seccion, string>> = {
  marketplace: 'Volver al Mercado',
  home: 'Volver a Inicio',
};

/** Una fila de la tabla técnica. Se omite entera si el dato no está: una fila
 *  con un guion no informa, y varias seguidas parecen una ficha vacía. */
const Fila: React.FC<{ rotulo: string; valor?: string | null }> = ({ rotulo, valor }) =>
  valor ? (
    <tr>
      <th scope="row">{rotulo}</th>
      <td>{valor}</td>
    </tr>
  ) : null;

type Carga =
  | { estado: 'cargando' }
  | { estado: 'lista'; product: Product }
  | { estado: 'no-disponible' }
  | { estado: 'error' };

/**
 * La ficha de una publicación, con URL propia.
 *
 * Antes era una capa que recibía la publicación ya armada por la tarjeta, y
 * por eso sólo existía mientras la tarjeta estaba a la vista. Ahora se busca
 * por su identificador, siempre: con un enlace pegado en otra pestaña no hay
 * tarjeta, y aun habiéndola, lo que dice la tarjeta es de cuando se bajó el
 * listado. Mostrar eso mientras llega la respuesta presentaría como vigente
 * una publicación que puede ya no estarlo.
 */
export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  id,
  origen,
  onVolver,
  onIrAlMercado,
  onSolicitarCotizacion,
  onRequiereIngreso,
}) => {
  const { addItem } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [showSellerProfile, setShowSellerProfile] = useState(false);
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [reintento, setReintento] = useState(0);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let vigente = true;
    setCarga({ estado: 'cargando' });
    setQuantity(1);
    getProductDetail(id)
      .then((respuesta) => {
        if (vigente) setCarga({ estado: 'lista', product: convertBackendProductToFrontend(respuesta) });
      })
      .catch((error: unknown) => {
        if (!vigente) return;
        // 404 es la respuesta de la API tanto para la que no existe como para
        // la que no está activa: para quien mira, las dos no están disponibles.
        if (error instanceof ErrorDeLaApi && error.estado === 404) setCarga({ estado: 'no-disponible' });
        else setCarga({ estado: 'error' });
      });
    return () => { vigente = false; };
  }, [id, reintento]);

  // Llegar a otra página mueve el foco a su título: el teclado sigue desde
  // arriba de la ficha y un lector de pantalla anuncia dónde se está. El título
  // es siempre el mismo elemento —cambia su texto al cargar—, así que el foco
  // no se pierde cuando llega la respuesta.
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
  }, [id]);

  const irAlMercado = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Con un modificador el navegador hace lo suyo: abrir en otra pestaña.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onIrAlMercado();
  };
  const enlaceAlMercado = (
    <a className={styles.volver} href={urlDe('marketplace')} onClick={irAlMercado}>
      Ir al Mercado
    </a>
  );

  const product = carga.estado === 'lista' ? carga.product : null;

  const textoDelTitulo = (() => {
    switch (carga.estado) {
      case 'lista': return carga.product.name;
      case 'no-disponible': return 'Esta publicación no está disponible';
      case 'error': return 'No pudimos cargar la publicación';
      default: return 'Cargando la publicación…';
    }
  })();

  return (
    <main className={styles.pagina} aria-busy={carga.estado === 'cargando'}>
      <div className="tg-container">
        <nav className={styles.navegacion} aria-label="Ficha de la publicación">
          {origen ? (
            <button type="button" className={styles.volver} onClick={onVolver}>
              {VOLVER_A[origen] ?? 'Volver'}
            </button>
          ) : enlaceAlMercado}
        </nav>

        <article className={styles.ficha}>
          <header className={styles.encabezado}>
            {product && (
              <div className="tg-eyebrow">
                {[
                  ETIQUETA_DE_ANATOMIA[normalizarAnatomia(product.operationKind)],
                  product.condition && ETIQUETA_DE_CONDICION[product.condition],
                ].filter(Boolean).join(' · ')}
              </div>
            )}
            <h1 id="detalle-titulo" ref={titulo} tabIndex={-1} className={styles.titulo}>
              {textoDelTitulo}
            </h1>
            {product && (
              <p className={styles.categoria}>
                {[product.category, product.subcategory].filter(Boolean).join(' · ')}
              </p>
            )}
          </header>

          {carga.estado === 'cargando' && (
            <p className={styles.aviso} role="status">Buscando la publicación.</p>
          )}

          {carga.estado === 'no-disponible' && (
            <div className={styles.aviso}>
              <p>
                Puede que la hayan pausado o dado de baja, o que el enlace esté
                incompleto. Las operaciones vigentes están en el Mercado.
              </p>
              {origen && enlaceAlMercado}
            </div>
          )}

          {carga.estado === 'error' && (
            <div className={styles.aviso} role="alert">
              <p>No hubo respuesta del servidor. Revisá la conexión y probá de nuevo.</p>
              <div className={styles.accionesDelAviso}>
                <button
                  type="button"
                  className="tg-button tg-button--primary"
                  onClick={() => setReintento((veces) => veces + 1)}
                >
                  Reintentar
                </button>
                {origen && enlaceAlMercado}
              </div>
            </div>
          )}

          {product && (
            <Ficha
              product={product}
              quantity={quantity}
              setQuantity={setQuantity}
              isAuthenticated={isAuthenticated}
              userId={user?.id}
              onVerPerfil={() => setShowSellerProfile(true)}
              onSolicitarCotizacion={onSolicitarCotizacion}
              onRequiereIngreso={onRequiereIngreso}
              onAgregar={(cantidad) => {
                addItem(product, cantidad);
                showToast(`Agregado: ${product.name}`, 'success');
              }}
              onAvisar={(mensaje) => showToast(mensaje, 'warning')}
            />
          )}
        </article>
      </div>

      {product && showSellerProfile && (
        <SellerProfileModal
          sellerId={product.seller.id}
          sellerName={product.seller.name}
          onClose={() => setShowSellerProfile(false)}
        />
      )}
    </main>
  );
};

interface FichaProps {
  product: Product;
  quantity: number;
  setQuantity: (cantidad: number) => void;
  isAuthenticated: boolean;
  userId?: string;
  onVerPerfil: () => void;
  onSolicitarCotizacion?: (pedido: CotizacionPedida) => void;
  onRequiereIngreso?: () => void;
  onAgregar: (cantidad: number) => void;
  onAvisar: (mensaje: string) => void;
}

/** El cuerpo de la ficha: el mismo contenido y las mismas acciones que tenía
 *  el detalle cuando era una capa. */
const Ficha: React.FC<FichaProps> = ({
  product,
  quantity,
  setQuantity,
  isAuthenticated,
  userId,
  onVerPerfil,
  onSolicitarCotizacion,
  onRequiereIngreso,
  onAgregar,
  onAvisar,
}) => {
  const anatomia = normalizarAnatomia(product.operationKind);
  // La misma decisión que la tarjeta, con la misma función y la misma sesión:
  // los dos caminos llevan a la misma acción y no pueden ofrecer cosas
  // distintas sobre la misma publicación.
  const accion = accionDe(product, userId);
  const esServicio = anatomia === 'servicio' || anatomia === 'logistica';
  const cobertura = product.coverageZones?.length ? product.coverageZones.join(', ') : '';

  // Antes esto era `[product.image, product.image, product.image]`: tres
  // miniaturas de la MISMA foto, que al hacer clic no cambiaban nada. Una
  // galería que no lleva a ningún lado es una acción falsa.
  const imagen = product.image;

  // Si la que se está mostrando es una foto del catálogo demostrativo, hay que
  // acreditarla. Veinticinco de las treinta son CC BY o CC BY-SA, y esas
  // licencias piden autor, licencia y mención de la adaptación DONDE SE MUESTRA
  // la obra: un inventario en `docs/` no cumple con quien mira la página. La
  // foto de un vendedor no lleva crédito porque es suya.
  const creditoDeLaFoto = fotoDemoDeArchivo(imagen);

  // Sin sesión, el botón no promete lo que no puede hacer: dice que el paso
  // siguiente es ingresar. El rótulo y la acción tienen que decir lo mismo.
  const faltaIngresar = accion.tipo === 'comprar' && !isAuthenticated;
  const rotuloDelCta = faltaIngresar ? 'Ingresar para continuar' : accion.etiqueta;

  const ejecutar = () => {
    if (accion.tipo === 'cotizar') {
      // La publicación y el vendedor viajan con el pedido: es lo que hace que
      // Contacto sepa de qué se está hablando.
      onSolicitarCotizacion?.({
        id: product.id, publicacion: product.name, vendedor: product.seller.name,
      });
      return;
    }
    if (accion.tipo !== 'comprar') return;

    if (!isAuthenticated) {
      // Se abre el Login de verdad sobre esta misma ficha. No se agrega nada
      // al carrito: eso lo decide la persona con un clic nuevo, ya con su
      // sesión.
      if (onRequiereIngreso) {
        onRequiereIngreso();
        return;
      }
      onAvisar('Tenés que ingresar para continuar');
      return;
    }
    if (!esServicio && quantity > product.stock) {
      onAvisar(`Quedan ${product.stock} disponibles`);
      return;
    }

    onAgregar(esServicio ? 1 : quantity);
  };

  // La ubicación de la publicación, del padrón: localidad y después provincia.
  // La del vendedor es otro dato y vive en su bloque.
  const ubicacion = [product.location?.city, product.location?.province]
    .filter(Boolean)
    .join(', ');

  return (
    <div className={styles.cuerpo}>
      {/* La galería va en las cuatro anatomías.
          Antes servicio y logística no la llevaban, y el argumento era bueno
          mientras no hubiera imagen: un servicio sin foto no es un servicio
          incompleto. Ahora hay foto para las cuatro, y el alcance
          —cobertura, modalidad, respuesta— sigue completo en el resumen,
          que es donde se lee. */}
      <section className={styles.galeria} aria-label="Imagen de la publicación">
        <div className={styles.imagenPrincipal}>
          <ProductImage src={imagen} alt={product.name} />
        </div>
        {creditoDeLaFoto && (
          <p className={styles.credito}>
            {`${creditoDeLaFoto.obra} — ${creditoDeLaFoto.autor} · `}
            <a href={creditoDeLaFoto.urlLicencia} target="_blank" rel="noreferrer noopener">
              {creditoDeLaFoto.licenciaVisible}
            </a>
            {` · foto ilustrativa del catálogo de demostración, ${ADAPTACION_DEMO}`}
          </p>
        )}
      </section>

      {/* El resumen de la operación: precio, dónde, en qué condición y qué
          se puede hacer. Es lo que decide, y por eso va junto y arriba. */}
      <aside className={styles.resumen}>
        <div className={styles.precio}>
          {/* Cuántos caracteres tiene la cifra: en celular el cuerpo baja lo
              justo para que entre entera, sin partirla. */}
          <strong
            className={`tg-price ${styles.cifra}`}
            style={{ '--cifras': String(precioVisible(product).length) } as React.CSSProperties}
          >
            {precioVisible(product)}
          </strong>
          {Number(product.price) > 0 && product.unit && <span>por {product.unit}</span>}
        </div>

        {ubicacion && <p className={styles.ubicacion}>{ubicacion}</p>}

        <dl className={styles.datos}>
          {product.condition && (
            <div>
              <dt>Condición</dt>
              <dd>{ETIQUETA_DE_CONDICION[product.condition]}</dd>
            </div>
          )}
          {cobertura && (
            <div>
              <dt>Cobertura</dt>
              <dd>{cobertura}</dd>
            </div>
          )}
          {product.pricingType && (
            <div>
              <dt>Modalidad</dt>
              <dd>{etiquetaDeCatalogo(product.pricingType)}</dd>
            </div>
          )}
          {product.availability && (
            <div>
              <dt>Disponibilidad</dt>
              <dd>{etiquetaDeCatalogo(product.availability)}</dd>
            </div>
          )}
          {product.responseTime && (
            <div>
              <dt>Respuesta</dt>
              <dd>{etiquetaDeCatalogo(product.responseTime)}</dd>
            </div>
          )}
          {!esServicio && (
            <div>
              <dt>Disponible</dt>
              <dd>{product.stock > 0 ? formatCantidad(product.stock, product.unit) : 'Sin stock'}</dd>
            </div>
          )}
        </dl>

        {/* La cantidad se elige donde contar unidades significa algo. */}
        {anatomia === 'insumo' && accion.tipo === 'comprar' && (
          <div className="tg-field">
            <label htmlFor="detalle-cantidad">Cantidad</label>
            <input
              id="detalle-cantidad"
              type="number"
              min={1}
              max={product.stock}
              value={quantity}
              onChange={(e) => {
                const pedida = parseInt(e.target.value, 10) || 1;
                setQuantity(Math.min(product.stock, Math.max(1, pedida)));
              }}
            />
          </div>
        )}

        <div className={styles.acciones}>
          <button
            className="tg-button tg-button--primary"
            onClick={ejecutar}
            disabled={
              accion.tipo === 'sin-stock'
              || accion.tipo === 'propia'
              || (accion.tipo === 'cotizar' && !onSolicitarCotizacion)
            }
          >
            {rotuloDelCta}
          </button>
          <button
            className="tg-button tg-button--secondary"
            onClick={onVerPerfil}
          >
            Ver perfil del vendedor
          </button>
        </div>

        <p className="tg-small">
          {accion.tipo === 'cotizar'
            ? 'La cotización se pide por Contacto: todavía no existe una solicitud atada a esta publicación.'
            : accion.tipo === 'propia'
              ? 'Esta publicación es tuya y nadie se compra a sí mismo. Podés seguir viéndola como la ve cualquiera.'
              : 'Conserva el carrito y el checkout de siempre; no abre mensajería ni reserva.'}
        </p>
      </aside>

      <div className={styles.detalle}>
        <section className={styles.seccion}>
          <div className="tg-eyebrow">Descripción</div>
          <h2>Datos informados por el vendedor</h2>
          <p className={styles.descripcion}>{product.description}</p>
          <p className="tg-small">
            AgroBoeda presenta la información cargada en la publicación. No implica inspección.
          </p>
        </section>

        {/* La tabla técnica sale de características estructuradas. Si no
            hay, no se arma partiendo la descripción: eso sería inventar
            una ficha que el vendedor nunca completó. */}
        {Object.keys(product.features).length > 0 && (
          <section className={styles.seccion}>
            <div className="tg-eyebrow">Información técnica</div>
            <h2>Especificaciones declaradas</h2>
            <div className={styles.tablaContenedor}>
              <table className={styles.tabla}>
                <caption className="tg-sr-only">Especificaciones declaradas por el vendedor</caption>
                <tbody>
                  {Object.entries(product.features).map(([clave, valor]) => (
                    <Fila key={clave} rotulo={clave} valor={valor} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className={styles.seccion}>
          <div className="tg-eyebrow">Contraparte</div>
          <h2>{product.seller.name}</h2>
          <div className={styles.vendedor}>
            <p className="tg-small">
              {product.seller.ratingCount > 0
                ? `${formatRating(product.seller.rating)} · ${product.seller.ratingCount} ${product.seller.ratingCount === 1 ? 'calificación' : 'calificaciones'}`
                : 'Sin calificaciones aún'}
            </p>
            {product.seller.salesCount > 0 && (
              <p className="tg-small">
                {product.seller.salesCount} {product.seller.salesCount === 1 ? 'venta' : 'ventas'}
              </p>
            )}
            {/* El texto es exactamente «Documentación revisada»: dice lo
                que se hizo —alguien miró una constancia— y no promete
                identidad comprobada ni ausencia de fraude. */}
            {product.seller.documentacionRevisada && (
              <p className={styles.documentacion}>Documentación revisada</p>
            )}
            <p className="tg-small">
              Los datos de contacto se comparten al confirmar la compra.
            </p>
          </div>
        </section>

        {!esServicio && (
          <section className={`${styles.seccion} ${styles.logistica}`}>
            <div className="tg-eyebrow">Logística</div>
            <h2>El traslado se define en el checkout</h2>
            <p>
              Después de indicar el destino, AgroBoeda consulta transportistas
              compatibles con la carga y la cobertura declarada.
            </p>
            <p className="tg-small" id="ayuda-transportistas">
              No se habilita antes de conocer el destino. No existe un directorio
              público independiente.
            </p>
          </section>
        )}
      </div>
    </div>
  );
};
