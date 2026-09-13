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

`INTEGRATION-CANDIDATE-1` y `AGENTS-CONSOLIDATION-1` quedaron integradas en
`b8447a3`. Emi autorizó expresamente el despliegue automático aun sin backup
ensayado; esa excepción no levanta la puerta operativa. Ésta es ahora la única
tarea activa.

### Problema

PostGIS y el volumen persistente `/data` conservan estado, pero persistencia no
es backup. Hoy no existe un procedimiento reproducible que copie ambos, los
restaure en un destino limpio y demuestre que la recuperación conserva datos y
archivos. No se puede aceptar producción ni hacer una migración riesgosa con
esa incertidumbre.

### Alcance

Construí la pieza mínima, repetible y documentada para entorno local Docker:

1. generar un bundle de backup con un dump lógico restaurable de PostgreSQL /
   PostGIS y una copia de los datos persistentes equivalentes a `/data`;
2. incluir manifiesto, fecha, versión/formato y checksums sin copiar secretos;
3. restaurar el bundle en contenedores y volúmenes locales **nuevos y
   aislados**, sin reemplazar ni modificar `topgreen-db`, `topgreen-api` ni sus
   volúmenes de origen;
4. comparar de forma automática el origen y el destino: esquema/extensión
   PostGIS, tablas y cantidades relevantes, más rutas, tamaños y checksums de
   archivos;
5. dejar un único procedimiento claro de backup, restore, verificación y
   limpieza segura del destino de prueba.

Podés agregar scripts acotados y documentación operativa. Reutilizá Docker,
`pg_dump`/`pg_restore` y utilidades estándar disponibles antes de sumar una
dependencia. Los artefactos de backup y datos de prueba no se versionan.

### Evidencia exigida

- Sembrá marcadores no sensibles en base y almacenamiento locales, tomá el
  backup y restauralo en el destino aislado.
- Demostrá que los marcadores y los fingerprints coinciden después del restore.
- Demostrá el negativo: un archivo alterado o ausente, o una base que no
  coincide, debe hacer fallar la verificación.
- Probá que el origen conserva antes y después la misma identidad/fingerprint y
  que los contenedores vigentes siguen saludables.
- Corré `diff-check` y las verificaciones focales de la pieza. No hace falta la
  suite funcional completa si el diff no toca producto; declaralo.

### Fuera de alcance

- No acceder ni cambiar Railway, GitHub settings, ramas de despliegue, datos
  remotos, secretos, dominios, SMTP o Mercado Pago.
- No comprar ni activar backups administrados; esa decisión y el gasto son de
  Emi.
- No descargar una copia de producción ni usar datos personales reales.
- No empezar `POST-INTEGRATION-CLEAR-1` ni `CAT-PAGE-1`.
- No borrar ni sobrescribir volúmenes o contenedores existentes. Toda limpieza
  queda limitada a recursos de destino creados por esta pieza e identificados
  de forma inequívoca.

### Criterios de aceptación

1. Desde un origen Docker local saludable se obtiene un bundle autocontenido
   para base y almacenamiento persistente, con manifiesto y checksums.
2. Un destino local limpio recupera el estado sin depender del origen durante
   la restauración.
3. La comparación automática queda verde para una copia íntegra y roja ante
   una alteración discriminante.
4. El origen no cambia, los destinos no colisionan con los nombres actuales y
   una falla corta sin borrar recursos ajenos.
5. El procedimiento documenta requisitos, comandos, ubicación de artefactos,
   verificación y limpieza, sin valores secretos ni pasos remotos implícitos.

### Frená y consultá si

- la única forma de avanzar toca Railway o datos remotos;
- necesitás elegir un servicio pago, una política de retención o un destino
  externo;
- no podés aislar el restore de los contenedores/volúmenes actuales;
- el inventario real de `/data` contradice `NOW.md` o exige decidir qué dato es
  recuperable.

### Entrega

Entregá rama, SHA base, SHA candidato, diff completo, comandos exactos y
resultados del positivo y del negativo. Reemplazá `PARA-PM.md` con un informe
breve. No integres ni despliegues; frená para revisión PM.
