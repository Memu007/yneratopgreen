# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en `docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones hasta el cierre. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-09-13 — BACKUP-RESTORE-1

`INTEGRATION-CANDIDATE-1` quedó **aceptada** en `c565e6e`, con informe
`ad914a3`. Ese SHA queda congelado y no se integra todavía. La siguiente puerta
es demostrar que los datos pueden recuperarse antes de cambiar ramas o publicar
la composición.

### Problema y prioridad

Railway conserva hoy PostGIS y `/data` en volúmenes, pero no tiene backups/PITR
activos ni una restauración ensayada. Persistencia no es backup. Sin una copia
recuperable, una migración, un error operativo o la pérdida de un volumen puede
dejar el entorno sin vuelta segura. Esta puerta precede a la separación
`main`/`release` y a la integración de `c565e6e`.

### Objetivo

Dejá en el repositorio un mecanismo pequeño y reproducible para:

1. generar un backup lógico de PostgreSQL/PostGIS y una copia íntegra de los
   archivos persistentes de `/data`;
2. restaurarlos en un entorno local descartable y separado;
3. verificar que base, extensión PostGIS, revisión Alembic y archivos coinciden;
4. documentar el procedimiento equivalente para Railway y señalar exactamente
   qué paso requiere plan, credenciales o autorización de Emi.

### Alcance

- Usá herramientas estándar de PostgreSQL (`pg_dump`/`pg_restore` o equivalente
  justificado) y formatos verificables. No agregues una dependencia de aplicación.
- Incluí todo `/data`: imágenes públicas, documentos privados y outbox actual.
- Generá un manifiesto sin secretos con fecha, formato, versión de PostgreSQL,
  revisión Alembic, archivos incluidos y hashes necesarios para detectar una
  copia incompleta o corrupta.
- Los artefactos de backup contienen datos sensibles: deben quedar fuera de Git,
  con permisos locales restrictivos y una ruta de salida explícita. Agregá las
  exclusiones mínimas que falten.
- La clave `MP_TOKEN_KEY` y las demás variables no viajan dentro del backup.
  El runbook debe enumerar qué secretos externos hacen falta para que una
  restauración sea operativa, sin copiar valores ni mostrarlos en logs.
- Corregí únicamente documentación de backup que hoy contradiga el stack real.
  En particular, no perpetúes las instrucciones SQL Server obsoletas de
  `docs/DATABASE.md`.

### Fuera de alcance

- No tocar Railway, GitHub settings, dominios, servicios, volúmenes remotos,
  datos remotos, planes ni facturación.
- No integrar ni desplegar `c565e6e`, no crear todavía `release` y no cambiar el
  auto-deploy.
- No hacer una migración de esquema, no cambiar producto y no empezar
  `CAT-PAGE-1`.
- No guardar dumps, archivos reales, secretos, tokens ni datos personales en Git.

### Criterios de aceptación ejecutables

1. Desde una base local descartable con PostGIS y datos conocidos, el backup
   termina con salida 0 y produce DB, archivos y manifiesto fuera del repositorio.
2. La restauración se hace en un destino local limpio y distinto del origen; no
   vale restaurar encima y leer los mismos volúmenes.
3. La evidencia compara antes/después: revisión Alembic, extensión PostGIS, al
   menos conteos de tablas representativas y hashes de un archivo público y uno
   privado. Todo coincide.
4. Un backup incompleto o con hash alterado da rojo antes de declarar éxito.
5. Ningún comando imprime contraseñas, URLs con credenciales, claves ni contenido
   sensible. Los artefactos quedan con acceso restringido y Git no los ofrece.
6. La documentación distingue: backup lógico, snapshot/backup administrado del
   proveedor y copia del volumen `/data`. No presenta uno como sustituto de los
   otros y contiene pasos de restauración, no sólo de creación.
7. El árbol queda limpio salvo los archivos intencionales; `diff-check`, sintaxis
   de los scripts y cualquier prueba focal agregada quedan verdes.

### Evidencia que tenés que leer

- `docs/pm/NOW.md`, sección Railway y próxima secuencia.
- `docs/pm/ALCANCE-Y-LIMITES.md`, infraestructura y hosting.
- `docs/pm/DECISIONS.md`, decisión de Railway y condiciones de producción.
- `RAILWAY.md`, `docker-compose.yml`, `backend/app/core/cifrado.py` y
  `docs/DATABASE.md`.

### Frená y consultá si

- el mecanismo exige una credencial real, acceso remoto, compra o cambio en
  Railway;
- para restaurar necesitás destruir un volumen que no creaste vos como
  descartable;
- encontrás datos o credenciales reales en el repositorio o en la evidencia;
- la restauración exige cambiar esquema o producto.

### Entrega

Trabajá después de `ad914a3`, preservando `c565e6e` como candidata aceptada.
Entregá un SHA único y reemplazá `PARA-PM.md` con un informe breve: cambio,
comandos reproducibles, rojo discriminante, verde de backup→destrucción del
destino→restore→comparación, riesgos pendientes y commit. No integres ni
despliegues; frená al entregar para que la PM repita la restauración.
