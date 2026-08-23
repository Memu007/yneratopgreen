import React, { useState } from 'react';
import styles from './ContactPage.module.css';

// Configuración de EmailJS - CAMBIAR ESTOS VALORES
const EMAILJS_CONFIG = {
  serviceId: 'service_topgreen',      // Se configura en EmailJS
  templateId: 'template_contact',     // Se configura en EmailJS
  publicKey: 'YOUR_PUBLIC_KEY',       // Se obtiene de EmailJS
  // Email de destino (donde llegan los mensajes)
  destinationEmail: 'info@topgreen.com.ar',
  // Número de WhatsApp para notificaciones
  whatsappNumber: '+5492233485801'
};

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getSubjectText = (value: string) => {
    const subjects: Record<string, string> = {
      'ventas': 'Consultas sobre Ventas',
      'compras': 'Consultas sobre Compras',
      'tecnico': 'Soporte Técnico',
      'servicios': 'Servicios TopGreen',
      'facturacion': 'Facturación',
      'otro': 'Otro'
    };
    return subjects[value] || value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Opción 1: Enviar por EmailJS (requiere configuración)
      // Si EmailJS está configurado, descomentar esto:
      /*
      const emailjs = await import('@emailjs/browser');
      await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        {
          from_name: formData.name,
          from_email: formData.email,
          phone: formData.phone || 'No proporcionado',
          subject: getSubjectText(formData.subject),
          message: formData.message,
          to_email: EMAILJS_CONFIG.destinationEmail,
        },
        EMAILJS_CONFIG.publicKey
      );
      */

      // Opción 2: Abrir cliente de email del usuario (funciona siempre)
      const subject = encodeURIComponent(`[TopGreen] ${getSubjectText(formData.subject)}`);
      const body = encodeURIComponent(
        `Nombre: ${formData.name}\n` +
        `Email: ${formData.email}\n` +
        `Teléfono: ${formData.phone || 'No proporcionado'}\n` +
        `Asunto: ${getSubjectText(formData.subject)}\n\n` +
        `Mensaje:\n${formData.message}`
      );
      
      // Abre el cliente de email con los datos pre-llenados
      window.open(`mailto:${EMAILJS_CONFIG.destinationEmail}?subject=${subject}&body=${body}`, '_blank');

      setSubmitStatus('success');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      
    } catch (error) {
      console.error('Error al enviar:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Hola TopGreen! Me gustaría hacer una consulta:\n\n` +
      `Nombre: ${formData.name || '(completar)'}\n` +
      `Email: ${formData.email || '(completar)'}\n` +
      `Asunto: ${formData.subject ? getSubjectText(formData.subject) : '(completar)'}\n\n` +
      `${formData.message || '(escribir mensaje)'}`
    );
    window.open(`https://wa.me/${EMAILJS_CONFIG.whatsappNumber.replace(/\+/g, '')}?text=${message}`, '_blank');
  };

  return (
    <div className={styles.contactPage}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <h1>Contacto</h1>
          <p className={styles.subtitle}>Estamos para ayudarte</p>
        </div>
      </section>

      <section className={styles.contactSection}>
        <div className={styles.container}>
          <div className={styles.contactGrid}>
            {/* Contact Form */}
            <div className={styles.formContainer}>
              <h2>Envianos tu Consulta</h2>
              
              {submitStatus === 'success' && (
                <div className={styles.successMessage}>
                  Se abrió tu cliente de correo con el mensaje. Enviálo para contactarnos.
                </div>
              )}
              
              {submitStatus === 'error' && (
                <div className={styles.errorMessage}>
                  No pudimos abrir tu cliente de correo. Intentá de nuevo o escribinos por WhatsApp.
                </div>
              )}

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="name">Nombre Completo *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="phone">Teléfono</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="subject">Asunto *</label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option value="ventas">Consultas sobre Ventas</option>
                    <option value="compras">Consultas sobre Compras</option>
                    <option value="servicios">Servicios TopGreen</option>
                    <option value="tecnico">Soporte Técnico</option>
                    <option value="facturacion">Facturación</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="message">Mensaje *</label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={6}
                    required
                  />
                </div>

                <div className={styles.buttonGroup}>
                  <button 
                    type="submit" 
                    className={styles.submitButton}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar por Email'}
                  </button>
                  
                  <button 
                    type="button" 
                    className={styles.whatsappButton}
                    onClick={handleWhatsApp}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Contactar por WhatsApp
                  </button>
                </div>
              </form>
            </div>

            {/* Contact Info */}
            <div className={styles.infoContainer}>
              <h2>Información de Contacto</h2>
              
              <div className={styles.infoCard}>
                <div>
                  <h3>Email</h3>
                  <a href="mailto:info@topgreen.com.ar">info@topgreen.com.ar</a>
                </div>
              </div>

              <div className={styles.infoCard}>
                <div>
                  <h3>Teléfono / WhatsApp</h3>
                  <a href="tel:+5492233485801">+54 9 223 348 5801</a>
                </div>
              </div>

              <div className={styles.infoCard}>
                <div>
                  <h3>Ubicación</h3>
                  <p>Mar del Plata, Argentina</p>
                  <p className={styles.muted}>Servicio a todo el país</p>
                </div>
              </div>

              <div className={styles.infoCard}>
                <div>
                  <h3>Horarios</h3>
                  <p>Lunes a Viernes: 9:00 - 18:00</p>
                  <p>Sábados: 9:00 - 13:00</p>
                </div>
              </div>

              {/* Acá había tres enlaces a twitter.com, linkedin.com e instagram.com:
                  los dominios pelados, no perfiles de TopGreen. Un enlace que promete
                  una cuenta que no existe es contenido falso, así que se retiran. El
                  día que haya perfiles reales, vuelven con su URL. */}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className={styles.faqSection}>
        <div className={styles.container}>
          <h2>Preguntas Frecuentes</h2>
          <div className={styles.faqGrid}>
            <div className={styles.faqCard}>
              <h3>¿Cómo empiezo a vender?</h3>
              <p>Registrate como vendedor, completa tu perfil y comenzá a publicar productos de inmediato.</p>
            </div>
            <div className={styles.faqCard}>
              <h3>¿Cuáles son las formas de pago?</h3>
              <p>Aceptamos transferencias bancarias directas al vendedor.</p>
            </div>
            <div className={styles.faqCard}>
              <h3>¿Realizan envíos a todo el país?</h3>
              <p>Sí, trabajamos con logística nacional para llegar a todas las provincias argentinas.</p>
            </div>
            <div className={styles.faqCard}>
              <h3>¿Hay comisiones por venta?</h3>
              <p>Nuestras comisiones son transparentes y competitivas. Consultá nuestros planes para más detalles.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
