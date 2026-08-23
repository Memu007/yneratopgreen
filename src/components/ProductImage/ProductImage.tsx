import { useEffect, useState } from 'react';
import styles from './ProductImage.module.css';
import { IlustracionDeFamilia } from './IlustracionDeFamilia';
import { esFotoDeRelleno, familiaDe } from '../../utils/ilustracion';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  /** El nombre de la categoría, para elegir el motivo. Opcional a propósito:
      donde no se sepa, el motivo genérico sigue siendo honesto. */
  categoria?: string;
}

export function ProductImage({
  src,
  alt,
  className = '',
  loading,
  categoria,
}: ProductImageProps) {
  // Dos motivos distintos para no mostrar una foto, y conviene no confundirlos:
  // que no haya imagen, y que la que hay sea de relleno. El segundo no falla
  // nunca —carga perfecto y muestra cualquier cosa—, así que se decide por el
  // origen antes de pedirla, y no esperando un error que no va a llegar.
  const deRelleno = esFotoDeRelleno(src);
  const [fallo, setFallo] = useState(false);

  useEffect(() => setFallo(false), [src]);

  if (deRelleno || fallo) {
    return (
      // La clase de quien llama es para la FOTO: trae `object-fit` y
      // `display: block`, que acá romperían la columna. La ilustración se
      // ocupa sola de llenar su contenedor.
      <div className={styles.ilustracion}>
        <div className={styles.motivo} aria-hidden="true">
          <IlustracionDeFamilia familia={familiaDe(categoria)} />
        </div>
        {/* La categoría, no el nombre del producto: la ilustración representa a
            la familia, y prometer más que eso sería fingir una foto. */}
        <span className={styles.familia}>{categoria || 'Publicación'}</span>
        <span className={styles.aclaracion}>Imagen ilustrativa</span>
        {/* Lo mismo, para quien no ve el dibujo. */}
        <span className={styles.soloLectores}>
          {`Imagen ilustrativa de ${categoria || 'la publicación'}. Sin foto del producto: ${alt}`}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFallo(true)}
    />
  );
}
