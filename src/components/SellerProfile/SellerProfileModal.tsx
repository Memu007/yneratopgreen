import React, { useState, useEffect } from 'react';
import styles from './SellerProfileModal.module.css';
import { apiGet } from '../../utils/api';

interface SellerProfileModalProps {
  sellerId: string;
  sellerName: string;
  onClose: () => void;
}

interface SellerReputation {
  user_id: string;
  user_name: string;
  rating_average: number;
  rating_count: number;
  sales_count: number;
  purchases_count: number;
}

interface Review {
  id: string;
  order_id: string;
  reviewer_name: string;
  score: number;
  comment: string | null;
  rating_type: string;
  created_at: string;
}

export const SellerProfileModal: React.FC<SellerProfileModalProps> = ({
  sellerId,
  sellerName,
  onClose
}) => {
  const [reputation, setReputation] = useState<SellerReputation | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSellerData = async () => {
      try {
        setLoading(true);
        // Cargar reputación y reviews en paralelo
        const [reputationData, reviewsData] = await Promise.all([
          apiGet<SellerReputation>(`/ratings/user/${sellerId}`),
          apiGet<Review[]>(`/ratings/user/${sellerId}/reviews`)
        ]);
        setReputation(reputationData);
        setReviews(reviewsData);
      } catch (err) {
        console.error('Error cargando perfil del vendedor:', err);
        setError('No se pudo cargar el perfil del vendedor');
      } finally {
        setLoading(false);
      }
    };

    loadSellerData();
  }, [sellerId]);

  const renderStars = (score: number) => {
    return '⭐'.repeat(score) + '☆'.repeat(5 - score);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>×</button>
        
        <div className={styles.header}>
          <div className={styles.avatar}>
            {sellerName.charAt(0).toUpperCase()}
          </div>
          <h2 className={styles.sellerName}>{sellerName}</h2>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Cargando perfil...</p>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* Reputación */}
            <div className={styles.reputationSection}>
              <div className={styles.reputationCard}>
                <div className={styles.ratingBig}>
                  {reputation && reputation.rating_count > 0 ? (
                    <>
                      <span className={styles.ratingNumber}>
                        {reputation.rating_average.toFixed(1)}
                      </span>
                      <span className={styles.ratingStars}>
                        {renderStars(Math.round(reputation.rating_average))}
                      </span>
                      <span className={styles.ratingCount}>
                        ({reputation.rating_count} {reputation.rating_count === 1 ? 'calificación' : 'calificaciones'})
                      </span>
                    </>
                  ) : (
                    <span className={styles.noRating}>Sin calificaciones aún</span>
                  )}
                </div>
                
                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span className={styles.statNumber}>{reputation?.sales_count || 0}</span>
                    <span className={styles.statLabel}>Ventas</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comentarios */}
            <div className={styles.reviewsSection}>
              <h3>Opiniones de compradores</h3>
              
              {reviews.length === 0 ? (
                <div className={styles.noReviews}>
                  <p>Este vendedor aún no tiene opiniones.</p>
                  <p className={styles.hint}>Las opiniones aparecen cuando los compradores califican sus compras.</p>
                </div>
              ) : (
                <div className={styles.reviewsList}>
                  {reviews.map((review) => (
                    <div key={review.id} className={styles.reviewCard}>
                      <div className={styles.reviewHeader}>
                        <span className={styles.reviewerName}>{review.reviewer_name}</span>
                        <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                      </div>
                      <div className={styles.reviewStars}>
                        {renderStars(review.score)}
                      </div>
                      {review.comment && (
                        <p className={styles.reviewComment}>{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
