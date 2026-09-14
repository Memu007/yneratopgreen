# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones
hasta el cierre. La historia anterior permanece en Git; la instantánea previa
a esta poda está en `0f89e78`.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-09-14 — CAT-PAGE-1

**Base excepcional autorizada por PM:** Emi postergó la publicación de `main`
para no disparar Railway. Continuá en `claude/dev-role-repo-3l0kp3` después de
traer el relevo PM que contiene esta tarea; ese relevo incorpora el merge
aceptado `c973c6f`. No vuelvas a basarte en el `origin/main` viejo ni publiques
producto. Registrá el SHA exacto de este relevo como base antes de editar.

### Problema reproducido

`GET /api/catalog/products` ya devuelve `total`, `page`, `pages`, `has_next` y
`has_prev`, pero el Mercado pide siempre `page=1&page_size=100`. Con más de cien
resultados, la publicación 101 es inaccesible.

Además, ordenar hoy reordena sólo la página descargada, y subcategoría y
calificación mínima se filtran en el navegador después de paginar. Por eso el
conteo, el orden y los filtros dejan de representar el conjunto completo.

Leé `docs/pm/ux2c/DEUDA-PAGINACION.md`, el patrón ya aceptado de paginación en
`AdminPanel.tsx` y el caso que agregues; no abras una investigación nueva.

### Decisión PM y alcance mínimo

1. Usá paginación simple de servidor: **Anterior**, **Página X de Y** y
   **Siguiente**, con 24 resultados por página. No scroll infinito ni “ver más”
   acumulativo.
2. Conservá `page` y `sort` en la URL del Mercado. Atrás/Adelante debe restaurar
   página, orden y filtros sin carreras. Cambiar búsqueda, filtro u orden vuelve
   a la página 1.
3. El total visible sale del servidor y describe todo el conjunto filtrado, no
   sólo las tarjetas de la página.
4. Todos los filtros visibles deben aplicarse en la API antes de contar y
   paginar. En particular, subcategoría y calificación mínima dejan de filtrar
   una página parcial en el navegador.
5. Todo orden visible se aplica en la API antes de paginar, con desempate
   determinista para que una publicación no salte entre páginas. Conservá:
   Más recientes, Menor precio, Mayor precio y Mejor calificados. Retirá “Más
   relevantes”: hoy no existe un ranking que sostenga esa promesa.
6. La vista Cuadrícula/Lista sigue siendo una preferencia visual local y no se
   reinicia al cambiar de página.

Reutilizá el contrato y estado existentes. No agregues dependencia, librería de
routing, caché paralela ni una segunda fuente de filtros.

### Regresión exigida

Agregá el caso 171. Debe fabricar de forma determinista y retirar al final más
de 100 publicaciones activas de un mismo conjunto, y comprobar en UI + API:

- total completo correcto y 24 tarjetas como máximo por página;
- una publicación posterior a la 100 es alcanzable desde los controles;
- páginas consecutivas no repiten ni pierden publicaciones;
- precio, fecha y calificación ordenan el conjunto completo, no cada página;
- subcategoría y calificación mínima producen total y páginas coherentes;
- cambiar filtro/orden vuelve a página 1 y Atrás/Adelante restaura el estado;
- los controles extremos quedan deshabilitados y son operables por teclado.

El caso debe dar rojo contra la base publicada que contiene `c973c6f` y verde
contra la candidata. No lo hagas pasar leyendo fuente ni fabricando en el
navegador el estado que debería producir el servidor.

### Compuertas

- caso 171 focal desde base limpia y su rojo discriminante;
- suite smoke completa desde base limpia;
- build, lint, `tsc --noEmit`, `node --check` y `git diff --check`;
- a11y y contraste, incluyendo paginador en escritorio y celular;
- revisión visual explícita 1440×900 y 390×844.

### Fuera de alcance

- No tocar imágenes ni resolver `QUERY-IMG-1`.
- No cambiar taxonomía, seed canónico, búsqueda geográfica, carrito, checkout,
  pagos, Railway ni datos remotos.
- No agregar carga automática, scroll infinito, selector de tamaño de página o
  números para saltar a cualquier página.
- No empezar `QUERY-IMG-1` ni otra tarea.
- No integrar ni desplegar.

### Entrega

Entregá rama, SHA base, SHA candidato, diff completo, rojo contra base,
comandos y resultados. Reemplazá `PARA-PM.md` con un informe breve y frená.
