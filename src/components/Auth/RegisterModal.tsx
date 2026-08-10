import React, { useEffect, useState } from 'react';
import styles from './AuthModal.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast/Toast';
import { RegisterData, RegistroPendiente } from '../../types';
import {
  getLocalities,
  getProvinces,
  LocalityResponse,
  ProvinceResponse,
} from '../../utils/catalogService';

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
    carrierCoverageRadiusKm: undefined,
    carrierCapacity: '',
  });
  const [provinces, setProvinces] = useState<ProvinceResponse[]>([]);
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
      const respuesta = await register(formData);
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

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
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
            <label className={styles.label}>
              Nombre completo <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="name"
              className={styles.input}
              placeholder="Juan Pérez"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Email <span className={styles.required}>*</span>
            </label>
            <input
              type="email"
              name="email"
              className={styles.input}
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Teléfono</label>
            <input
              type="tel"
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
                <label className={styles.label}>
                  Transporte habilitado <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  name="carrierTransport"
                  className={styles.input}
                  placeholder="Camión con acoplado, dominio AB 123 CD"
                  value={formData.carrierTransport}
                  onChange={handleChange}
                  required
                />
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
                <label className={styles.label}>
                  Radio de cobertura (km) <span className={styles.required}>*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
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
                <label className={styles.label}>Capacidad de carga (opcional)</label>
                <input
                  type="text"
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
            <label className={styles.label}>
              Contraseña <span className={styles.required}>*</span>
            </label>
            <div className={styles.passwordGroup}>
              <input
                type={showPassword ? 'text' : 'password'}
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
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Confirmar contraseña <span className={styles.required}>*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              className={styles.input}
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
