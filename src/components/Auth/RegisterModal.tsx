import React, { useEffect, useState } from 'react';
import styles from './AuthModal.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { RegisterData, RegistroPendiente } from '../../types';
import {
  getLocalities,
  getProvinces,
  LocalityResponse,
  ProvinceResponse,
} from '../../utils/catalogService';
import { apiGet } from '../../utils/api';
import { type TipoDeCarga } from '../../utils/logistica';
import { useCapaModal } from '../../hooks/useCapaModal';

interface RegisterModalProps {
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ 
  onClose, 
  onSwitchToLogin 
}) => {
  const { register, reenviarVerificacion } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'user',
    isCarrier: false,
    carrierBaseLocalityId: '',
    carrierTransport: '',
    carrierTransportCertified: false,
    carrierCertificationDetail: '',
    carrierCoverageRadiusKm: undefined,
    carrierCapacity: '',
    carrierVehicleModel: '',
    carrierPlate: '',
    carrierCargoTypes: [],
    carrierCargoOther: '',
  });
  const [provinces, setProvinces] = useState<ProvinceResponse[]>([]);
  // El catálogo de cargas lo sirve el servidor: lo que se guarda son sus
  // claves, así que la lista que se ofrece acá tiene que ser la misma que
  // valida el alta. Una copia en la pantalla se desincronizaría en silencio.
  const [tiposDeCarga, setTiposDeCarga] = useState<TipoDeCarga[]>([]);
  const [localities, setLocalities] = useState<LocalityResponse[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Mientras haya un registro pendiente, el formulario deja lugar al aviso de
  // "revisá tu correo": el alta ya no inicia sesión.
  const [pendiente, setPendiente] = useState<RegistroPendiente | null>(null);
  const [avisoDeReenvio, setAvisoDeReenvio] = useState('');

  useEffect(() => {
    if (formData.isCarrier && provinces.length === 0) {
      void getProvinces().then(setProvinces).catch(() => {
        setError('No se pudo cargar el padrón de localidades.');
      });
    }
  }, [formData.isCarrier, provinces.length]);

  // Si el catálogo no llega, la sección sigue usable: las cargas son
  // opcionales, así que no se traba el alta por no poder ofrecerlas.
  useEffect(() => {
    if (!formData.isCarrier || tiposDeCarga.length > 0) return;
    void apiGet<{ types: TipoDeCarga[] }>('/logistics/cargo-types')
      .then((r) => setTiposDeCarga(r.types))
      .catch(() => setTiposDeCarga([]));
  }, [formData.isCarrier, tiposDeCarga.length]);

  useEffect(() => {
    if (!provinceId) {
      setLocalities([]);
      return;
    }
    void getLocalities(provinceId).then(setLocalities).catch(() => {
      setError('No se pudieron cargar las localidades.');
    });
  }, [provinceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      const respuesta = await register({
        ...formData,
        // Sin «Otra» declarada, el detalle no describe nada: se suelta acá
        // igual que en el perfil, para no mandar un dato huérfano.
        carrierCargoOther: formData.carrierCargoTypes?.includes('otra')
          ? formData.carrierCargoOther
          : '',
      });
      setPendiente(respuesta);
      showToast(`Te mandamos un correo a ${respuesta.email}.`, 'success');
    } catch (err: unknown) {
      // El motivo real sube tal cual. Antes cualquier fallo se convertía en
      // "Error al crear la cuenta", y ahora el alta puede fallar porque el
      // correo no salió, que es algo distinto y se resuelve reintentando.
      const errorMessage = err instanceof Error ? err.message : '';
      setError(errorMessage || 'Error al crear la cuenta. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReenviar = async () => {
    if (!pendiente) return;
    setAvisoDeReenvio('');
    setIsLoading(true);
    try {
      setAvisoDeReenvio(await reenviarVerificacion(pendiente.email));
    } catch (err: unknown) {
      setAvisoDeReenvio(
        err instanceof Error ? err.message : 'No se pudo reenviar el correo.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Atrapa el foco, lo devuelve al cerrar, cierra con Escape y traba el
  // scroll del fondo. Ninguna capa del producto hacía nada de esto.
  const capa = useCapaModal<HTMLDivElement>(onClose);

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modal}
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-label="Crear cuenta"
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Crear Cuenta</h2>
          <button className={styles.closeButton} aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </div>

        {pendiente ? (
          <div className={styles.form}>
            <div className={styles.success} role="status">
              {pendiente.message}
            </div>
            <p className={styles.helpText}>
              Sin confirmar el correo no vas a poder ingresar. Si no te llega,
              revisá el correo no deseado o pedí otro enlace.
            </p>
            {avisoDeReenvio && (
              <div className={styles.success} role="status">
                {avisoDeReenvio}
              </div>
            )}
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleReenviar}
              disabled={isLoading}
            >
              {isLoading ? 'Reenviando...' : 'Reenviar el correo'}
            </button>
            <button type="button" className={styles.switchLink} onClick={onSwitchToLogin}>
              Ir a iniciar sesión
            </button>
          </div>
        ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="registro-nombre">
              Nombre completo <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="registro-nombre"
              name="name"
              className={styles.input}
              placeholder="Juan Pérez"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="registro-email">
              Email <span className={styles.required}>*</span>
            </label>
            <input
              type="email"
              id="registro-email"
              name="email"
              className={styles.input}
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="registro-telefono">Teléfono</label>
            <input
              type="tel"
              id="registro-telefono"
              name="phone"
              className={styles.input}
              placeholder="+54 9 11 1234-5678"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={formData.isCarrier}
              onChange={(e) => setFormData((current) => ({
                ...current,
                isCarrier: e.target.checked,
              }))}
            />
            Quiero registrarme como transportista
          </label>

          {formData.isCarrier && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Provincia base <span className={styles.required}>*</span>
                </label>
                <select
                  aria-label="Provincia base"
                  className={styles.select}
                  value={provinceId}
                  onChange={(e) => {
                    setProvinceId(e.target.value);
                    setFormData((current) => ({
                      ...current,
                      carrierBaseLocalityId: '',
                    }));
                  }}
                  required
                >
                  <option value="">Seleccionar provincia</option>
                  {provinces.map((province) => (
                    <option key={province.id} value={province.id}>{province.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Localidad base <span className={styles.required}>*</span>
                </label>
                <select
                  aria-label="Localidad base"
                  className={styles.select}
                  value={formData.carrierBaseLocalityId}
                  onChange={(e) => setFormData((current) => ({
                    ...current,
                    carrierBaseLocalityId: e.target.value,
                  }))}
                  required
                  disabled={!provinceId}
                >
                  <option value="">Seleccionar localidad</option>
                  {localities.map((locality) => (
                    <option key={locality.id} value={locality.id}>{locality.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="registro-transporte">
                  Transporte habilitado <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  id="registro-transporte"
                  name="carrierTransport"
                  className={styles.input}
                  placeholder="Camión con acoplado, dominio AB 123 CD"
                  value={formData.carrierTransport}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Los tres opcionales. Sin asterisco y con el aviso de que se
                  pueden completar después: pedirlos como obligatorios en el
                  alta ahuyentaría a quien sólo quiere empezar. */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="registro-modelo">Marca y modelo</label>
                <input
                  type="text"
                  id="registro-modelo"
                  name="carrierVehicleModel"
                  className={styles.input}
                  placeholder="Scania R450"
                  value={formData.carrierVehicleModel}
                  onChange={handleChange}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="registro-dominio">Dominio</label>
                <input
                  type="text"
                  id="registro-dominio"
                  name="carrierPlate"
                  className={styles.input}
                  placeholder="AB 123 CD"
                  value={formData.carrierPlate}
                  onChange={handleChange}
                />
                <p className={styles.ayudaPrivada}>
                  Privado: no aparece en el listado de transportistas. Lo ve el
                  comprador recién después de seleccionarte, junto con tu contacto.
                </p>
              </div>

              <div className={styles.formGroup}>
                <span className={styles.label} id="registro-cargas">
                  Cargas que transportás
                </span>
                <div
                  className={styles.cargasGrilla}
                  role="group"
                  aria-labelledby="registro-cargas"
                >
                  {tiposDeCarga.map((tipo) => (
                    <label key={tipo.value} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.carrierCargoTypes?.includes(tipo.value) ?? false}
                        onChange={(e) => setFormData((current) => ({
                          ...current,
                          carrierCargoTypes: e.target.checked
                            ? [...(current.carrierCargoTypes ?? []), tipo.value]
                            : (current.carrierCargoTypes ?? [])
                                .filter((c) => c !== tipo.value),
                        }))}
                      />
                      {tipo.label}
                    </label>
                  ))}
                </div>
                {formData.carrierCargoTypes?.includes('otra') && (
                  <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="registro-carga-otra">
                      Contá qué transportás <span className={styles.required}>*</span>
                    </label>
                    <input
                      id="registro-carga-otra"
                      type="text"
                      maxLength={120}
                      className={styles.input}
                      placeholder="Bidones de 200 litros"
                      value={formData.carrierCargoOther}
                      onChange={(e) => setFormData((current) => ({
                        ...current,
                        carrierCargoOther: e.target.value,
                      }))}
                    />
                  </div>
                )}
                <p className={styles.helpText}>
                  Es una declaración tuya y sirve para que el comprador compare.
                  No decide en qué viajes aparecés: eso lo siguen definiendo tu
                  localidad base y tu radio.
                </p>
              </div>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.carrierTransportCertified}
                  onChange={(e) => setFormData((current) => ({
                    ...current,
                    carrierTransportCertified: e.target.checked,
                  }))}
                  required
                />
                Declaro que el transporte está habilitado
              </label>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="registro-detalle">
                  Detalle de la habilitación <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  id="registro-detalle"
                  name="carrierCertificationDetail"
                  className={styles.input}
                  placeholder="RUTA, transporte de cargas generales, N.° 12345"
                  value={formData.carrierCertificationDetail}
                  onChange={handleChange}
                  required
                />
                <p className={styles.helpText}>
                  Es tu declaración. TopGreen no la verifica y guarda la fecha en que la hacés.
                </p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="registro-radio">
                  Radio de cobertura (km) <span className={styles.required}>*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  id="registro-radio"
                  name="carrierCoverageRadiusKm"
                  className={styles.input}
                  value={formData.carrierCoverageRadiusKm ?? ''}
                  onChange={(e) => setFormData((current) => ({
                    ...current,
                    carrierCoverageRadiusKm: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  }))}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="registro-capacidad">Capacidad de carga (opcional)</label>
                <input
                  type="text"
                  id="registro-capacidad"
                  name="carrierCapacity"
                  className={styles.input}
                  placeholder="Hasta 40 toneladas de semillas"
                  value={formData.carrierCapacity}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="registro-clave">
              Contraseña <span className={styles.required}>*</span>
            </label>
            <div className={styles.passwordGroup}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="registro-clave"
                name="password"
                className={styles.input}
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="registro-clave-2">
              Confirmar contraseña <span className={styles.required}>*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              className={styles.input}
              id="registro-clave-2"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
        )}

        {!pendiente && (
        <div className={styles.switchText}>
          ¿Ya tienes cuenta?{' '}
          <button type="button" className={styles.switchLink} onClick={onSwitchToLogin}>
            Inicia sesión aquí
          </button>
        </div>
        )}
      </div>
    </div>
  );
};
