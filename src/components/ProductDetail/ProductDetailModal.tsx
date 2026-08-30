import React, { useState } from 'react';
import { Product } from '../../types';
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
import { useCapaModal } from '../../hooks/useCapaModal';
import { SellerProfileModal } from '../SellerProfile/SellerProfileModal';
import styles from './ProductDetailModal.module.css';
import { ProductImage } from '../ProductImage/ProductImage';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onSolicitarCotizacion?: () => void;
  /** Qué hacer cuando falta la sesión. Sin esto el botón sólo avisaba con un
      toast: detectaba bien el requisito y dejaba a la persona sin salida,
      aunque el Login ya existe y la cabecera sabe abrirlo. */
  onRequiereIngreso?: () => void;
}

/** Una fila de la tabla técnica. Se omite entera si el dato no está: una fila
 *  con un guion no informa, y varias seguidas parecen una ficha vacía. */
const Fila: React.FC<{ rotulo: string; valor?: string | null }> = ({ rotulo, valor }) =>
  valor ? (
    <tr>
      <th scope="row">{rotulo}</th>
      <td>{valor}</td>
    </tr>
  ) : null;

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onSolicitarCotizacion,
  onRequiereIngreso,
}) => {
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [showSellerProfile, setShowSellerProfile] = useState(false);
  const capa = useCapaModal<HTMLDivElement>(onClose);

  const anatomia = normalizarAnatomia(product.operationKind);
  const accion = accionDe(product);
  const esServicio = anatomia === 'servicio' || anatomia === 'logistica';
  const cobertura = product.coverageZones?.length ? product.coverageZones.join(', ') : '';

  // Antes esto era `[product.image, product.image, product.image]`: tres
  // miniaturas de la MISMA foto, que al hacer clic no cambiaban nada. Una
  // galería que no lleva a ningún lado es una acción falsa.
  const imagen = product.image;

  // Sin sesión, el botón no promete lo que no puede hacer: dice que el paso
  // siguiente es ingresar. El rótulo y la acción tienen que decir lo mismo.
  const faltaIngresar = accion.tipo === 'comprar' && !isAuthenticated;
  const rotuloDelCta = faltaIngresar ? 'Ingresar para continuar' : accion.etiqueta;

  const ejecutar = () => {
    if (accion.tipo === 'cotizar') {
      onSolicitarCotizacion?.();
      onClose();
      return;
    }
    if (accion.tipo !== 'comprar') return;

    if (!isAuthenticated) {
      // Se abre el Login de verdad y se vuelve a este mismo detalle, se
      // complete o se cancele. No se agrega nada al carrito: eso lo decide la
      // persona con un clic nuevo, ya con su sesión.
      if (onRequiereIngreso) {
        onRequiereIngreso();
        return;
      }
      showToast('Tenés que ingresar para continuar', 'warning');
      return;
    }
    if (!esServicio && quantity > product.stock) {
      showToast(`Quedan ${product.stock} disponibles`, 'warning');
      return;
    }

    addItem(product, esServicio ? 1 : quantity);
    showToast(`Agregado: ${product.name}`, 'success');
    onClose();
  };

  // La ubicación de la publicación, del padrón: localidad y después provincia.
  // La del vendedor es otro dato y vive en su bloque.
  const ubicacion = [product.location?.city, product.location?.province]
    .filter(Boolean)
    .join(', ');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-titulo"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.encabezado}>
          <div>
            <div className="tg-eyebrow">
              {[ETIQUETA_DE_ANATOMIA[anatomia], product.condition && ETIQUETA_DE_CONDICION[product.condition]]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <h2 id="detalle-titulo" className={styles.titulo}>{product.name}</h2>
            <p className={styles.categoria}>
              {[product.category, product.subcategory].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button className={styles.cerrar} aria-label="Cerrar" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" />
            </svg>
          </button>
        </div>

        <div className={`${styles.cuerpo} ${esServicio ? styles.sinGaleria : ''}`}>
          {/* Servicio y logística no llevan galería: lo que hay que leer es su
              alcance. Un servicio sin foto no es un servicio incompleto. */}
          {!esServicio && (
            <section className={styles.galeria} aria-label="Imagen de la publicación">
              <div className={styles.imagenPrincipal}>
                <ProductImage src={imagen} alt={product.name} />
              </div>
            </section>
          )}

          {/* El resumen de la operación: precio, dónde, en qué condición y qué
              se puede hacer. Es lo que decide, y por eso va junto y arriba. */}
          <aside className={styles.resumen}>
            <div className={styles.precio}>
              <strong className={`tg-price ${styles.cifra}`}>{precioVisible(product)}</strong>
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
                disabled={accion.tipo === 'sin-stock' || (accion.tipo === 'cotizar' && !onSolicitarCotizacion)}
              >
                {rotuloDelCta}
              </button>
              <button
                className="tg-button tg-button--secondary"
                onClick={() => setShowSellerProfile(true)}
              >
                Ver perfil del vendedor
              </button>
            </div>

            <p className="tg-small">
              {accion.tipo === 'cotizar'
                ? 'La cotización se pide por Contacto: todavía no existe una solicitud atada a esta publicación.'
                : 'Conserva el carrito y el checkout de siempre; no abre mensajería ni reserva.'}
            </p>
          </aside>

          <div className={styles.detalle}>
            <section className={styles.seccion}>
              <div className="tg-eyebrow">Descripción</div>
              <h3>Datos informados por el vendedor</h3>
              <p className={styles.descripcion}>{product.description}</p>
              <p className="tg-small">
                TopGreen presenta la información cargada en la publicación. No implica inspección.
              </p>
            </section>

            {/* La tabla técnica sale de características estructuradas. Si no
                hay, no se arma partiendo la descripción: eso sería inventar
                una ficha que el vendedor nunca completó. */}
            {Object.keys(product.features).length > 0 && (
              <section className={styles.seccion}>
                <div className="tg-eyebrow">Información técnica</div>
                <h3>Especificaciones declaradas</h3>
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
              <h3>{product.seller.name}</h3>
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
                <h3>El traslado se define en el checkout</h3>
                <p>
                  Después de indicar el destino, TopGreen consulta transportistas
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
      </div>

      {showSellerProfile && (
        <SellerProfileModal
          sellerId={product.seller.id}
          sellerName={product.seller.name}
          onClose={() => setShowSellerProfile(false)}
        />
      )}
    </div>
  );
};
