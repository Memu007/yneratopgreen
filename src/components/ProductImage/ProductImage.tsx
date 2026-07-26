import { useEffect, useState } from 'react';
import styles from './ProductImage.module.css';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
}

export function ProductImage({
  src,
  alt,
  className = '',
  loading,
}: ProductImageProps) {
  const [failed, setFailed] = useState(!src);

  useEffect(() => setFailed(!src), [src]);

  return failed ? (
    <div className={`${styles.imageFallback} ${className}`} role="img" aria-label={alt}>
      <span>{alt}</span>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
