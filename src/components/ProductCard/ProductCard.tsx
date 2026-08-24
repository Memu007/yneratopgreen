import React, { useState } from 'react';
import styles from './ProductCard.module.css';
import { Product } from '../../types';
import { precioVisible, formatCantidad, etiquetaDeCatalogo, formatRating } from '../../utils/formatters';
import {
  accionDe,
  normalizarAnatomia,
  ETIQUETA_DE_ANATOMIA,
  ETIQUETA_DE_CONDICION,
} from '../../utils/anatomia';
import { useCart } from '../../hooks/useCart';
import { ProductDetailModal } from '../ProductDetail/ProductDetailModal';
import { ProductImage } from '../ProductImage/ProductImage';

interface ProductCardProps {
  product: Product;
  /** Adónde mandar a quien pide una cotización. Sin esto el botón no aparece:
      prometer una solicitud que no existe es peor que no ofrecerla. */
  onSolicitarCotizacion?: () => void;
  /** `compacta` es la misma tarjeta en una columna angosta —la vista previa de
      Inicio y de Servicios—. No es otra tarjeta: mismos datos, misma anatomía,
      misma acción; lo único que cambia es que el activo deja de ocupar la fila
      entera, porque en una grilla de tres columnas no hay fila entera. */
  variante?: 'catalogo' | 'compacta';
}

/** Un dato con su rótulo. Se omite entero cuando el valor no está: una fila de
 *  guiones no informa nada y ocupa el lugar de algo que sí. */
const Dato: React.FC<{ rotulo: string; valor?: string | null }> = ({ rotulo, valor }) =>
  valor ? (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  ) : null;

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSolicitarCotizacion,
  variante = 'catalogo',
}) => {
  const { addItem } = useCart();
  const [showDetail, setShowDetail] = useState(false);
  const [cantidad, setCantidad] = useState(1);

  const anatomia = normalizarAnatomia(product.operationKind);
  const accion = accionDe(product);
  const esServicio = anatomia === 'servicio' || anatomia === 'logistica';

  // Es la ubicación declarada por el VENDEDOR, no el origen de la publicación:
  // ese vive en la base como localidad y no sale en la respuesta pública. Se
  // muestra en el orden en que viene, sin reordenar: el texto es libre y
  // adivinar cuál parte es provincia inventaba «Argentina, Buenos Aires».
  const ubicacion = [product.location?.province, product.location?.city]
    .filter(Boolean)
    .join(', ');

  const abrirDetalle = () => setShowDetail(true);

  const ejecutar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (accion.tipo === 'comprar') {
      addItem(product, esServicio ? 1 : cantidad);
      return;
    }
    if (accion.tipo === 'cotizar' && onSolicitarCotizacion) onSolicitarCotizacion();
  };

  const cobertura = product.coverageZones?.length ? product.coverageZones.join(', ') : '';

  return (
    <>
      <article
        className={`${styles.card} ${styles[anatomia]} ${variante === 'compacta' ? styles.compacta : ''}`}
        onClick={abrirDetalle}
      >
        {/* Servicio y logística no llevan imagen: lo que hay que comparar de un
            servicio es su alcance, no una foto de alguien trabajando. */}
        {!esServicio && (
          <div className={styles.media}>
            <ProductImage src={product.image} alt={product.name} loading="lazy" />
          </div>
        )}

        <div className={styles.cuerpo}>
          <div className={styles.encabezado}>
            <span className="tg-eyebrow">{ETIQUETA_DE_ANATOMIA[anatomia]}</span>
            {product.condition && (
              <span className={styles.estado}>{ETIQUETA_DE_CONDICION[product.condition]}</span>
            )}
          </div>

          <h3 className={styles.titulo}>{product.name}</h3>

          {ubicacion && <p className={styles.ubicacion}>{ubicacion}</p>}

          {esServicio && (
            <dl className={styles.datosDeServicio}>
              <Dato rotulo="Cobertura" valor={cobertura} />
              <Dato rotulo="Modalidad" valor={etiquetaDeCatalogo(product.pricingType)} />
              <Dato rotulo="Respuesta" valor={etiquetaDeCatalogo(product.responseTime)} />
            </dl>
          )}

          <div className={styles.precio}>
            <strong className={`tg-price ${styles.cifra}`}>{precioVisible(product)}</strong>
            {Number(product.price) > 0 && product.unit && <span>por {product.unit}</span>}
          </div>

          {/* El stock se dice cuando hay unidades que contar. Un servicio no
              las tiene: preguntarle cuántas quedan es la pregunta equivocada. */}
          {!esServicio && (
            <p className={`${styles.stock} ${product.stock > 0 ? styles.stockOk : ''}`}>
              {product.stock > 0
                ? formatCantidad(product.stock, product.stock === 1 ? 'disponible' : 'disponibles')
                : 'Sin stock'}
            </p>
          )}

          <div className={styles.vendedor}>
            <span className={styles.vendedorNombre}>{product.seller.name}</span>
            {product.seller.ratingCount > 0 ? (
              <span className={styles.calificacion}>
                {`${formatRating(product.seller.rating)} · ${product.seller.ratingCount} calificaciones`}
              </span>
            ) : (
              <span className={styles.calificacion}>Sin calificaciones aún</span>
            )}
          </div>

          {/* Un insumo se compra de a varias unidades; un activo es uno solo y
              un servicio no se cuenta. Por eso el selector aparece sólo donde
              contar tiene sentido. */}
          {anatomia === 'insumo' && accion.tipo === 'comprar' && (
            <div className={styles.cantidad} onClick={(e) => e.stopPropagation()}>
              <label htmlFor={`cantidad-${product.id}`}>Cantidad</label>
              <input
                id={`cantidad-${product.id}`}
                type="number"
                min={1}
                max={product.stock}
                value={cantidad}
                onChange={(e) => {
                  const pedida = Number(e.target.value);
                  setCantidad(Math.min(Math.max(1, pedida || 1), product.stock));
                }}
              />
              <button className="tg-button tg-button--primary" onClick={ejecutar}>
                {accion.etiqueta}
              </button>
            </div>
          )}

          {!(anatomia === 'insumo' && accion.tipo === 'comprar') && (
            <div className={styles.acciones}>
              <button
                className="tg-button tg-button--primary"
                onClick={ejecutar}
                disabled={accion.tipo === 'sin-stock' || (accion.tipo === 'cotizar' && !onSolicitarCotizacion)}
              >
                {accion.etiqueta}
              </button>
              <button
                className="tg-button tg-button--secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  abrirDetalle();
                }}
              >
                Ver detalle
              </button>
            </div>
          )}
        </div>
      </article>

      {showDetail && (
        <ProductDetailModal
          product={product}
          onClose={() => setShowDetail(false)}
          onSolicitarCotizacion={onSolicitarCotizacion}
        />
      )}
    </>
  );
};
