import React, { useState } from 'react';
import styles from './ProductCard.module.css';
import { Product, CotizacionPedida } from '../../types';
import { precioVisible, formatCantidad, etiquetaDeCatalogo, formatRating } from '../../utils/formatters';
import {
  accionDe,
  normalizarAnatomia,
  ETIQUETA_DE_ANATOMIA,
  ETIQUETA_DE_CONDICION,
} from '../../utils/anatomia';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { useNavegacionActual } from '../../navegacion/navegacion';
import { urlDe } from '../../navegacion/politica';
import { ProductImage } from '../ProductImage/ProductImage';

interface ProductCardProps {
  product: Product;
  /** Adónde mandar a quien pide una cotización. Sin esto el botón no aparece:
      prometer una solicitud que no existe es peor que no ofrecerla.

      Lleva QUÉ se cotiza y a QUIÉN: antes no llevaba nada, así que Contacto
      empezaba en blanco y la persona tenía que volver a escribir de qué
      publicación estaba hablando —o mandar una consulta que no se entiende—. */
  onSolicitarCotizacion?: (pedido: CotizacionPedida) => void;
  /** Cómo se PRESENTA esta misma tarjeta. `catalogo` es la cuadrícula del
      Mercado, `lista` es la misma operación en un renglón horizontal y
      `compacta` es la vista previa de Inicio. No son cuatro
      tarjetas ni cuatro componentes: mismos datos, misma anatomía, misma
      acción. Y la presentación la elige quien dibuja la grilla —en el Mercado,
      la persona con el selector—, nunca la anatomía de la publicación. */
  variante?: 'catalogo' | 'compacta' | 'lista';
  /** Abre el Login de la aplicación y avisa cuando se cierra —se complete o se
      cancele—. La tarjeta lo usa cuando se quiere comprar sin sesión: se
      vuelve a esta misma tarjeta, sin agregar nada. */
  onSolicitarIngreso?: (alVolver: () => void) => void;
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
  onSolicitarIngreso,
  variante = 'catalogo',
}) => {
  const { addItem } = useCart();
  const { isAuthenticated, user } = useAuth();
  // La ficha es una página con URL propia y se abre por la única política de
  // navegación: una entrada nueva en el historial, que Atrás deshace.
  const { abrirPublicacion } = useNavegacionActual();
  const [cantidad, setCantidad] = useState(1);

  const anatomia = normalizarAnatomia(product.operationKind);
  // Con la sesión adentro: una publicación propia no se ofrece para comprar.
  const accion = accionDe(product, user?.id);
  const esServicio = anatomia === 'servicio' || anatomia === 'logistica';

  // De dónde es la PUBLICACIÓN, del padrón oficial: la misma columna con la que
  // el Backend filtra por provincia. Antes acá salía la ubicación del perfil de
  // quien publica, así que filtrando Buenos Aires podía leerse «Córdoba».
  // Localidad primero y provincia después, que es como se nombra un lugar.
  const ubicacion = [product.location?.city, product.location?.province]
    .filter(Boolean)
    .join(', ');

  const abrirDetalle = () => abrirPublicacion(product.id);
  const urlDeLaFicha = urlDe('product', null, product.id);

  // Los enlaces a la ficha son enlaces de verdad: se pueden copiar, abrir en
  // otra pestaña y recorrer con el teclado. Con un modificador el navegador
  // hace lo suyo; sin él, se navega sin recargar la página.
  const irALaFicha = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    abrirDetalle();
  };

  // La tarjeta y el detalle hacen lo mismo, así que sin sesión tienen que hacer
  // lo mismo. Antes la tarjeta agregaba al carrito en silencio —ni siquiera
  // avisaba— y el detalle mostraba un aviso: dos caminos a la misma acción con
  // dos comportamientos distintos.
  const faltaIngresar = accion.tipo === 'comprar' && !isAuthenticated;
  const rotuloDelCta = faltaIngresar ? 'Ingresar para continuar' : accion.etiqueta;

  const pedirIngreso = () => {
    // Se vuelve a esta misma tarjeta y a esta misma página: no se abre el
    // detalle ni se agrega nada. Lo que sigue lo decide la persona.
    onSolicitarIngreso?.(() => {});
  };

  const ejecutar = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (accion.tipo === 'comprar') {
      if (faltaIngresar) {
        if (onSolicitarIngreso) pedirIngreso();
        return;
      }
      addItem(product, esServicio ? 1 : cantidad);
      return;
    }
    if (accion.tipo === 'cotizar' && onSolicitarCotizacion) {
      onSolicitarCotizacion({
        id: product.id, publicacion: product.name, vendedor: product.seller.name,
      });
      return;
    }
  };

  const cobertura = product.coverageZones?.length ? product.coverageZones.join(', ') : '';

  return (
      <article
        className={[
          styles.card,
          styles[anatomia],
          variante === 'compacta' ? styles.compacta : '',
          variante === 'lista' ? styles.lista : '',
          // Que la tarjeta lleve foto no es lo mismo que ser un activo: es que
          // la operación se mira con una foto. La presentación en renglón
          // reserva la banda por esto y no por la anatomía.
          styles.conFoto,
        ].filter(Boolean).join(' ')}
        onClick={abrirDetalle}
      >
        {/* La banda va en las cuatro anatomías.
            Antes servicio y logística no la llevaban, y el argumento era bueno
            mientras no hubiera imagen: sin foto, el hueco no prometía nada y el
            ancho rendía más en los datos. Ahora hay foto para las cuatro, y una
            cuadrícula donde la mitad de las tarjetas arranca con imagen y la
            otra mitad no tiene dos alturas de la misma cosa. Cobertura,
            modalidad y respuesta siguen abajo, completas: la banda no les saca
            lugar. */}
        <div className={styles.media}>
          <ProductImage src={product.image} alt={product.name} loading="lazy" />
        </div>

        <div className={styles.cuerpo}>
          <div className={styles.encabezado}>
            <span className={`tg-eyebrow ${styles.anatomia}`}>{ETIQUETA_DE_ANATOMIA[anatomia]}</span>
            {product.condition && (
              <span className={styles.estado}>{ETIQUETA_DE_CONDICION[product.condition]}</span>
            )}
          </div>

          {/* El título es el enlace a la ficha: la tarjeta entera responde al
              clic, pero sólo un enlace llega con el teclado —y el insumo que
              se compra desde la tarjeta no tiene «Ver detalle»—. */}
          <h3 className={styles.titulo}>
            <a
              href={urlDeLaFicha}
              data-ficha={product.id}
              data-ficha-enlace="titulo"
              onClick={irALaFicha}
            >
              {product.name}
            </a>
          </h3>

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
                {rotuloDelCta}
              </button>
            </div>
          )}

          {!(anatomia === 'insumo' && accion.tipo === 'comprar') && (
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
              <a
                className="tg-button tg-button--secondary"
                href={urlDeLaFicha}
                data-ficha={product.id}
                data-ficha-enlace="detalle"
                onClick={irALaFicha}
              >
                Ver detalle
              </a>
            </div>
          )}
        </div>
      </article>
  );
};
