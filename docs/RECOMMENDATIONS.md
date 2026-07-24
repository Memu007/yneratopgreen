# Recomendaciones para continuar — TopGreen

Pensado para el nuevo equipo que toma el desarrollo. No es prescriptivo:
son sugerencias basadas en lo que el equipo anterior aprendió.

---

## Prioridad 1 — bloqueantes para producción

1. **Rotar secretos**. Ver [SETUP_PAYMENTS.md § 6](SETUP_PAYMENTS.md).
   Sin esto, los tokens viejos siguen siendo válidos.
2. **Reconfigurar Mercado Pago** con la app marketplace propia del nuevo
   equipo. Ver [SETUP_PAYMENTS.md § 3](SETUP_PAYMENTS.md).
3. **Storage externo de imágenes** (S3 / Cloudinary / DigitalOcean Spaces).
   El placeholder está en `backend/app/core/config.py` pero no implementado.
4. **HTTPS y dominio propio**. NO usar Ferozo ni el dominio
   `topgreen.com.ar` actual sin antes confirmar con el cliente.
5. **Feature flag para Fase II**. Decidir si mostrar/ocultar ratings,
   services y filtros geo. Recomendado: agregar endpoint
   `GET /api/config/features` que el frontend consulte al boot.

---

## Prioridad 2 — calidad y mantenibilidad

### Tests automatizados
- Backend: agregar pytest con casos para los flujos críticos (auth, products,
  orders, payments). El target mínimo razonable: 60% coverage en `app/api/`.
- Frontend: vitest + React Testing Library para componentes core
  (`Auth`, `Cart`, `Checkout`, `ProductCard`).
- E2E: Playwright para los happy paths (login → buscar producto → comprar).

### CI/CD
- GitHub Actions / GitLab CI / lo que use el nuevo equipo.
- Pipeline mínimo: install → lint (TS + Python) → tests → build.
- Bloquear merges si tests fallan.

### Linting
- Frontend ya tiene ESLint configurado. Agregar Prettier.
- Backend: agregar `ruff` + `black` + `mypy --strict` (incremental).

### Logging y observabilidad
- `structlog` ya está configurado en backend. Agregar Sentry o equivalente.
- Frontend: capturar errores con `window.onerror` + envío a Sentry.
- Endpoint `/api/health` debería verificar conectividad real (DB, MP).

### Documentación de API
- FastAPI ya genera Swagger en `/api/docs`. Mejorar las descripciones de
  endpoints (`description` en cada decorator) para que sea autodescubrible.

---

## Prioridad 3 — features faltantes

### Email transaccional
- Servicio sugerido: SendGrid, Resend, SES.
- Casos críticos: bienvenida, cambio de password, orden creada, orden enviada.

### Recovery de password
- Flujo: solicitar reset → email con token → cambio.

### Mensajería comprador-vendedor
- Mejora UX en marketplaces. Considerar inbox interno o integración con WhatsApp Business API.

### Reviews de productos
- Hoy solo hay ratings de vendedores. Reviews de productos individuales
  son una mejora de discoverability.

### Búsqueda mejorada
- Reemplazar `LIKE %term%` por:
  - Full Text Search de SQL Server (más simple).
  - O Elasticsearch / Meilisearch / Typesense (más potente).
- Agregar autocomplete y "sugerencias mientras escribís".

### Multi-vendedor en una orden
- Hoy una orden puede tener items de varios vendedores y el split MP
  funciona. Pero el shipping_status es uno solo. Considerar separar en
  sub-órdenes por vendedor (mejor UX).

---

## Prioridad 4 — refactors técnicos sugeridos

### Frontend

- **Routing real**: migrar de routing por estado a `react-router-dom v6`.
  Permite URLs deep-linkables, back/forward, SEO básico.
- **Server state**: agregar React Query o SWR para reemplazar useEffect+fetch
  manuales. Reduce mucho boilerplate y mejora caching.
- **Forms**: reemplazar useState manual por `react-hook-form` + zod.
- **Code splitting**: hoy es un solo bundle de 345 KB gzipped 102 KB. Para
  apps más grandes, dividir por ruta.
- **Vite proxy**: configurar `server.proxy['/api']` en `vite.config.ts`
  para evitar CORS en dev.

### Backend

- **Service layer**: la lógica de negocio está distribuida entre routers
  y models. Extraer a `app/services/` (ya existe la carpeta) más
  consistentemente.
- **Repository pattern**: el código mezcla queries SQLAlchemy con lógica.
  Patrón repository ayuda a testear.
- **Pydantic v2 fixes**: revisar deprecated APIs que pueden estar usándose.
- **Async DB**: pasar a SQLAlchemy 2 async + `asyncpg`/`aioodbc` mejora
  throughput. Requiere migrar todo el path async.

### DB

- **Migración a PostgreSQL**: si no hay requerimiento estricto del cliente
  por SQL Server, evaluar PostgreSQL. Ahorra licencia (en cloud), mejor
  ecosistema Python, mejor full-text, mejor JSON.
- **Read replica**: si tráfico crece, agregar replica para queries de catálogo.

---

## Prioridad 5 — DevOps / Producción

### Deploy
- NO usar Ferozo / hosting compartido. Recomendado:
  - **Railway / Render / Fly.io**: deploy simple desde GitHub.
  - **AWS ECS + RDS**: si requieren AWS.
  - **DigitalOcean App Platform**: balance precio/simplicidad.

### Containers
- El `Dockerfile` actual es OK para dev. Para producción:
  - Multi-stage build.
  - Usuario no-root.
  - Healthcheck más robusto (chequear DB).
  - Quitar el bind mount `./backend/app:/app/app` del compose.

### Monitoreo
- Uptime monitoring (UptimeRobot, Better Uptime).
- Métricas (Prometheus + Grafana, o vendor SaaS).
- Alertas (PagerDuty, OpsGenie, Slack webhook).

### Backups
- DB: backups automáticos diarios. SQL Server tiene comandos nativos.
- Storage: si se migra a S3, configurar versioning y lifecycle.

---

## Decisiones que el nuevo equipo debe tomar pronto

1. **¿Continuar con Fase II parcial o congelarla y solo mostrar Fase I?**
   - Continuar: completar ratings, services como marketplace, subcategorías
     dinámicas, geo search.
   - Congelar: agregar feature flags y ocultar features incompletas del
     frontend mientras se decide.

2. **¿Servicios como tipo de publicación es estratégico?**
   - Si sí: completar el flujo (publicación → búsqueda → contratación → pago).
   - Si no: simplificar el modelo y eliminar campos `publication_type`,
     `pricing_type`, etc.

3. **¿Mantener SQL Server o migrar a PostgreSQL?**
   - Costo, expertise del equipo, y requerimientos del cliente determinan esto.

4. **¿Mantener routing por estado o migrar a react-router?**
   - Si la app crece, react-router es prácticamente inevitable para SEO y deep linking.

5. **¿Storage de imágenes: S3 / Cloudinary / Spaces / Bunny?**
   - Cloudinary tiene transformaciones built-in (resize, optimize, WebP) que ahorran código.
   - S3 / Spaces más baratos en escala pero requieren CDN aparte.

---

## Lo que NO recomendamos hacer

- ❌ Hacer push al repositorio del equipo anterior. Crear un repo nuevo bajo
  la organización del nuevo equipo.
- ❌ Reusar las credenciales viejas de Mercado Pago, ngrok o FTP.
- ❌ Deployar el seed en producción sin cambiar passwords demo.
- ❌ Exponer el backend sin HTTPS.
- ❌ Permitir registros sin verificación de email en producción.
- ❌ Mantener `JWT_SECRET=CAMBIAR_*` en producción (verifico explícito en config).
