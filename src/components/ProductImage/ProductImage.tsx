import { useEffect, useState } from 'react';
import styles from './ProductImage.module.css';
import { esFotoDeRelleno } from '../../utils/fotos';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
}

export function ProductImage({ src, alt, className = '', loading }: ProductImageProps) {
  // Dos ausencias distintas, y conviene no confundirlas: que no haya foto, y
  // que hubiera una y no cargue. La primera es del vendedor y la segunda es
  // nuestra o de la red, así que se dicen con palabras distintas y con dibujos
  // distintos. Una foto de relleno cuenta como la primera: hay una URL, pero
  // no es una foto de esta publicación.
  const sinFoto = esFotoDeRelleno(src);
  const [fallo, setFallo] = useState(false);

  useEffect(() => setFallo(false), [src]);

  if (sinFoto || fallo) {
    const texto = fallo ? 'No pudimos cargar la imagen' : 'Sin fotografía';
    return (
      // La clase de quien llama es para la FOTO: trae `object-fit` y
      // `display: block`, que acá romperían la composición.
      <div
        className={`${styles.fallback} ${fallo ? styles.roto : ''}`}
        role="img"
        aria-label={`${texto}. ${alt}`}
      >
        <span className={styles.copy}>{texto}</span>
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
