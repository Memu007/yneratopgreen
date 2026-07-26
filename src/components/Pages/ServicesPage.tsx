import React from 'react';
import styles from './ServicesPage.module.css';
import { ProductImage } from '../ProductImage/ProductImage';

interface ServicesPageProps {
  onNavigateToContact?: () => void;
}

const services = [
  {
    number: '01',
    title: 'Asesoramiento Personalizado en Mecanización',
    image: '/DJI_0079.JPG',
    points: [
      'Evaluación y recomendación de maquinaria agrícola basada en análisis precisos de las necesidades de cada fase de producción.',
      'Capacitación en el uso y mantenimiento de equipos, integrando tecnología de última generación para mejorar la eficiencia operativa.'
    ]
  },
  {
    number: '02',
    title: 'Análisis Ambiental y de Suelo con Tecnología Satelital',
    image: '/relevamiento-inundacion.jpg',
    points: [
      'Estudios avanzados del suelo utilizando datos obtenidos a través de imágenes satelitales y sensores terrestres.',
      'Recomendaciones personalizadas para prácticas agrícolas sostenibles, optimizando la salud del suelo y la productividad a largo plazo.'
    ]
  },
  {
    number: '03',
    title: 'Monitoreo de Cultivos con Inteligencia Artificial',
    image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=600&q=80',
    points: [
      'Implementación de sistemas de monitoreo inteligente que combinan sensores y análisis de datos en tiempo real para gestionar el riego, la fertilización y el control de plagas de manera precisa.',
      'Utilización de algoritmos de inteligencia artificial para predecir necesidades y optimizar el manejo de cultivos.'
    ]
  },
  {
    number: '04',
    title: 'Consultoría en Sostenibilidad y Uso Eficiente de Recursos',
    image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&q=80',
    points: [
      'Desarrollo de estrategias personalizadas que emplean tecnologías como el Internet de las Cosas (IoT) y satélites para reducir el uso de agua, energía y otros insumos, mejorando la sostenibilidad sin sacrificar la productividad.',
      'Implementación de prácticas agrícolas innovadoras que protegen el medio ambiente y promueven la resiliencia de los ecosistemas.'
    ]
  },
  {
    number: '05',
    title: 'Capacitación y Formación en Nuevas Tecnologías',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80',
    points: [
      'Programas de formación que cubren las últimas tendencias en agricultura digital, incluyendo el uso de inteligencia artificial, imágenes satelitales y herramientas de precisión.',
      'Talleres prácticos diseñados para mejorar las competencias técnicas y de gestión, asegurando que los participantes puedan aprovechar al máximo las nuevas tecnologías en el campo.'
    ]
  }
];

export const ServicesPage: React.FC<ServicesPageProps> = ({ onNavigateToContact }) => {
  return (
    <div className={styles.servicesPage}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <video
          className={styles.heroVideo}
          autoPlay
          muted
          loop
          playsInline
        >
          <source src="/video-servicios.mp4" type="video/mp4" />
        </video>
        <div className={styles.heroOverlay}></div>
      </section>

      {/* Intro Section */}
      <section className={styles.introSection}>
        <div className={styles.container}>
          <div className={styles.introContent}>
            <div className={styles.introTitle}>
              <h1>Servicios</h1>
              <div className={styles.titleUnderline}></div>
            </div>
            <div className={styles.introText}>
              <p>
                En TopGreen, sabemos que cada persona involucrada en la producción agropecuaria enfrenta desafíos 
                únicos. Por eso, ofrecemos servicios personalizados que combinan la última tecnología en inteligencia 
                artificial, el uso de satélites y las mejores prácticas en mecanización agrícola. Nuestro objetivo es ayudar 
                a agricultores, productores y entusiastas del campo a maximizar sus resultados, mejorando la eficiencia 
                y promoviendo la sostenibilidad.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className={styles.servicesSection}>
        <div className={styles.container}>
          {services.map((service, index) => (
            <div 
              key={service.number} 
              className={`${styles.serviceCard} ${index % 2 === 1 ? styles.reversed : ''}`}
            >
              <div className={styles.serviceContent}>
                <div className={styles.serviceHeader}>
                  <span className={styles.serviceNumber}>{service.number}</span>
                  <h2 className={styles.serviceTitle}>{service.title}</h2>
                </div>
                <div className={styles.servicePoints}>
                  {service.points.map((point, pointIndex) => (
                    <div key={pointIndex} className={styles.servicePoint}>
                      <span className={styles.pointNumber}>{pointIndex + 1}</span>
                      <p>{point}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.serviceImageWrapper}>
                <ProductImage
                  src={service.image}
                  alt={service.title}
                  className={styles.serviceImage}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <h2>¿Interesado en nuestros servicios?</h2>
          <p>Contáctanos para una consulta personalizada</p>
          <button className={styles.ctaButton} onClick={onNavigateToContact}>
            Contactar Ahora
          </button>
        </div>
      </section>
    </div>
  );
};
