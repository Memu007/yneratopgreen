# Bugs y limitaciones conocidos — TopGreen

> Lista honesta de issues identificados al momento de la entrega
> (2026-06-04). El nuevo equipo debería tratarlos antes de pasar a producción.

---

## Severidad alta

### 1. Mercado Pago: botón de pago a veces queda en gris
- **Síntoma**: en el sandbox MP, el botón "Pagar" del init_point queda
  deshabilitado y no permite completar el pago.
- **Causa probable** (según diagnóstico del equipo anterior):
  - Token mismatch entre la app marketplace y la cuenta de prueba del comprador.
  - Las cuentas de prueba `TESTUSER*` deben pertenecer a la misma aplicación
    que el `MP_ACCESS_TOKEN`.
- **Workaround**: usar tarjetas de prueba reales con titular `APRO`.
- **Status**: **no resuelto**. Requiere debug con la app MP del nuevo equipo.

### 2. JWT_SECRET hardcodeado / débil en seed
- **Síntoma**: si el nuevo equipo no rota `JWT_SECRET` antes de poner en
  producción, los tokens emitidos pueden ser falsificables.
- **Mitigación**: el `.env.example` instruye `JWT_SECRET=CAMBIAR_JWT_SECRET_MINIMO_32_CARACTERES`
  pero no hay validación que lo enforce.
- **Recomendación**: agregar check en `config.py` que rechace strings
  con `CAMBIAR_` cuando `ENV=production`.

### 3. Storage local no es viable en producción
- **Síntoma**: las imágenes de productos se suben a un volumen Docker
  (`/data/uploads`). Si se redeploya o escala, se pierden / no se sincronizan.
- **Status**: el código tiene placeholder para S3 / Cloudinary
  (`STORAGE_BACKEND` setting, `boto3` en requirements) pero **no está wireado**.
- **Recomendación**: implementar antes de cualquier deploy productivo.

---

## Severidad media

### 4. Fase II parcial sin feature flag
- **Síntoma**: features de Fase II (ratings, services, geo) están integrados
  en UI sin posibilidad de desactivarlos en runtime.
- **Riesgo**: confunde a usuarios finales y al admin.
- **Recomendación**: agregar flags en `AuthContext` (ej. `features.ratingsEnabled`)
  y leerlos desde `/api/health` o un endpoint de config pública.

### 5. Backend `VERSION` desincronizada del frontend
- `package.json` → `1.0.1`.
- `backend/app/core/config.py` → `VERSION = "1.0.0"`.
- **Impacto**: bajo. El `/api/health` reporta `1.0.0`, mientras el frontend
  builda como `1.0.1`.
- **Fix**: actualizar `config.py` a `1.0.1` y agregarlo al checklist de release.

### 6. CORS permisivo en local
- `backend/app/main.py` agrega `localhost:5173`, `localhost:5174`, etc. de forma incondicional.
- **Riesgo**: bajo en local; en producción, asegurar que la lista no incluye
  localhost cuando `ENV=production`.

### 7. Sin recovery de password
- No hay flujo "olvidé mi password". Los usuarios bloqueados deben
  contactar al admin para reset manual.

### 8. Sin email transaccional
- Las notificaciones de orden, registro, cambio de password, etc.
  **solo aparecen como notificaciones in-app**. No se envían emails.
- Si el usuario no entra a la web, no se entera.

### 9. Búsqueda débil
- Solo `LIKE %term%` sobre `title` y `description`.
- Sin stemming, sin fuzzy match, sin tipo "más relevante".
- Performance puede degradarse con muchos productos. No hay índice de texto completo.

---

## Severidad baja

### 10. `ServicesPage` es página estática
- No es un marketplace de servicios, es una página informativa de TopGreen
  como empresa. Está enlazada desde Header.
- **Status**: intencional. Si Fase II completa servicios como marketplace,
  reemplazar esta página por la grilla real.

### 11. Productos demo del seed no tienen ratings ni geo
- Los datos demo no incluyen coordenadas, ratings ni reviews.
- **Impacto**: el filtro `min_rating` y la búsqueda geo no muestran
  resultados con el seed default.
- **Fix**: enriquecer `seed.py` o crear un seed adicional `seed_phase2_demo.py`.

### 12. `/api/health` no chequea DB ni MP
- Solo retorna `{status: "ok"}` siempre.
- Ideal: agregar un `liveness` y `readiness` que verifiquen conectividad.

### 13. Sin paginación consistente en algunos listados de admin
- `/api/admin/users` y `/api/admin/orders` retornan todos los registros.
- **Impacto**: bajo con pocos registros, problemático con miles.

### 14. Imágenes públicas externas en seed (Unsplash)
- Si Unsplash cambia URLs o caen, los productos demo quedan sin imagen.
- Decisión consciente para no incluir binarios en el ZIP. El nuevo equipo
  puede subir sus propias imágenes de prueba.

### 15. `vite.config.ts` no tiene proxy a `/api`
- Vite dev server **no proxea** `/api` al backend. El frontend llama a
  `VITE_API_URL` directamente, lo que requiere CORS habilitado.
- **Alternativa más limpia**: configurar `server.proxy` en `vite.config.ts`
  y servir todo desde `localhost:5173`.

---

## Riesgos de seguridad pendientes

1. **Secretos en historial Git anterior**: aunque el ZIP **no incluye `.git`**,
   las credenciales (password FTP, tokens de Mercado Pago, authtoken de ngrok,
   `JWT_SECRET`) que **estuvieron commiteados** en el repositorio del equipo
   anterior siguen siendo válidas hasta que se roten. **El nuevo equipo no
   debe asumir que están limpias** — ver lista en
   [SETUP_PAYMENTS.md § 6](SETUP_PAYMENTS.md).
2. **Passwords demo del seed**: `admin123` / `vendedor123` / `cliente123`.
   Si el seed se ejecuta en producción, son inmediatamente comprometibles.
3. **Sin rate limiting en login**: vulnerable a brute force. Considerar
   agregar slowapi o Cloudflare WAF.
4. **JWT en localStorage**: vulnerable a XSS. Considerar migrar a httpOnly
   cookies con CSRF token.
5. **Sin auditoría / logging estructurado de eventos de seguridad**
   (logins fallidos, cambios de rol, deletes admin).

---

## Acciones recomendadas antes de pasar a producción

1. Rotar todos los secretos. Ver [SETUP_PAYMENTS.md § 6](SETUP_PAYMENTS.md).
2. Implementar storage externo de imágenes.
3. Agregar feature flags y decidir el destino de Fase II parcial.
4. Implementar email transaccional + recovery de password.
5. Resolver el bug del botón gris de MP (con la app MP propia del nuevo equipo).
6. Agregar tests automatizados (pytest backend, vitest frontend).
7. Configurar pipeline CI con linting + tests + build.
8. Actualizar `VERSION` en backend al release real.
9. Cambiar passwords demo del seed antes de cualquier deploy productivo
   (o no correr el seed en producción).
10. Reconfigurar `CORS_ORIGINS` para producción (sin localhost).
