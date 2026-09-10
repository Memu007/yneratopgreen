import React, { useState } from 'react';
import type { CotizacionPedida } from '../../types';
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

interface ContactPageProps {
  /**
   * La publicación desde la que se pidió una cotización, si se llegó por ahí.
   *
   * Entrar por la cabecera o el pie la deja en `null`, y entonces esta pantalla
   * es la de siempre: una consulta genérica no hereda el asunto ni el mensaje
   * de una publicación que alguien miró antes.
   */
  cotizacion?: CotizacionPedida | null;
}

/**
 * El texto con el que arranca una cotización.
 *
 * Nombra la publicación y a quien la publicó, que es lo que hace que del otro
 * lado se entienda de qué se está hablando. Lo que NO trae son los datos de
 * quien escribe: el nombre, el correo y el teléfono los pone ella. Completarlos
 * por su cuenta sería inventar quién es.
 */
const mensajeDeCotizacion = ({ publicacion, vendedor }: CotizacionPedida) =>
  `Hola, quiero pedir una cotización por «${publicacion}», publicada por ${vendedor}.`
  + '\n\nContame precio, disponibilidad y cómo seguimos.';

export const ContactPage: React.FC<ContactPageProps> = ({ cotizacion = null }) => {
  // El formulario nace con la cotización adentro si se llegó por una
  // publicación. Es estado inicial y no un efecto: la pantalla se monta de nuevo
  // en cada entrada a Contacto, así que una publicación nueva reemplaza a la
  // anterior sin que quede nada mezclado de la vez pasada.
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: cotizacion ? 'cotizacion' : '',
    message: cotizacion ? mensajeDeCotizacion(cotizacion) : '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'preparado'>('idle');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getSubjectText = (value: string) => {
    const subjects: Record<string, string> = {
      'cotizacion': 'Solicitud de cotización',
      'ventas': 'Consultas sobre Ventas',
      'compras': 'Consultas sobre Compras',
      'tecnico': 'Soporte Técnico',
      'servicios': 'Servicios AgroBoeda',
      'facturacion': 'Facturación',
      'otro': 'Otro'
    };
    return subjects[value] || value;
  };

  /**
   * Prepara el correo y lo abre en la aplicación de la persona. Nada más, y
   * eso es exactamente lo que dice el botón.
   *
   * Antes esto decía «Enviar por Email», llamaba a `window.open` con un
   * `mailto:`, declaraba ÉXITO y vaciaba el formulario. Ninguna de esas tres
   * cosas se podía sostener: `window.open` con un `mailto:` no informa si se
   * abrió un cliente —devuelve `null` en casos perfectamente normales, y el
   * navegador puede no tener ninguno configurado—, así que la pantalla afirmaba
   * un envío que nadie vio y, de paso, borraba lo que la persona había escrito.
   * Si el correo no se abría, el texto ya no estaba.
   *
   * Ahora no se afirma nada sobre el resultado y NO se limpia el formulario: lo
   * escrito queda para copiar, corregir, reintentar o mandarlo por WhatsApp.
   */
  const abrirEnElCorreo = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // La codificación segura del asunto y del cuerpo se conserva: sin esto, un
    // salto de línea o un `&` en el mensaje cortan el `mailto:` por la mitad.
    const asunto = encodeURIComponent(`[AgroBoeda] ${getSubjectText(formData.subject)}`);
    const cuerpo = encodeURIComponent(
      `Nombre: ${formData.name}\n`
      + `Email: ${formData.email}\n`
      + `Teléfono: ${formData.phone || 'No proporcionado'}\n`
      + `Asunto: ${getSubjectText(formData.subject)}\n\n`
      + `Mensaje:\n${formData.message}`,
    );
    window.open(`mailto:${EMAILJS_CONFIG.destinationEmail}?subject=${asunto}&body=${cuerpo}`, '_blank');
    // Una instrucción neutral, no un resultado: decimos qué hacer, no qué pasó.
    setSubmitStatus('preparado');
    setIsSubmitting(false);
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Hola AgroBoeda! Me gustaría hacer una consulta:\n\n` +
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
              
              {/* Una instrucción, no un resultado. No sabemos si se abrió el
                  correo —nadie puede saberlo desde acá—, así que decimos qué
                  falta hacer y no qué pasó. El texto sigue abajo, intacto. */}
              {submitStatus === 'preparado' && (
                <div className={styles.successMessage} role="status">
                  Preparamos el mensaje en tu aplicación de correo. Revisalo y enviálo desde ahí.
                  Si no se abrió, podés copiar el texto de abajo o escribirnos por WhatsApp.
                </div>
              )}

              <form onSubmit={abrirEnElCorreo} className={styles.form}>
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
                    <option value="cotizacion">Solicitud de cotización</option>
                    <option value="ventas">Consultas sobre Ventas</option>
                    <option value="compras">Consultas sobre Compras</option>
                    <option value="servicios">Servicios AgroBoeda</option>
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
                    {isSubmitting ? 'Preparando…' : 'Abrir en mi correo'}
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
                  {/* Idem el pie: el enlace lleva a la casilla que recibe, pero
                      no se escribe la dirección, que todavía es la de la marca
                      vieja. */}
                  <a href="mailto:info@topgreen.com.ar">Escribinos</a>
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
                  los dominios pelados, no perfiles de AgroBoeda. Un enlace que promete
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
