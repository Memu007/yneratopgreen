# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Primero, urgente — PROD-LISTS-1: las marcas no llegaron a producción

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.
Va **antes** de la parte 2 y se entrega por separado. Si ya empezaste la
parte 2, dejala en un commit aparte y seguí después.

### Qué pasa

Emi abrió «Publicar un producto» en el sitio publicado (`792d709`), en
Maquinaria agrícola. El selector «Marca» aparece, pero ofrece sólo «Sin
declarar».

La causa está en el código:

- las 44 marcas son filas de `form_options` que carga **sólo la siembra**
  (`backend/app/seed.py`, grupo `"brand"`, desde `ed3e39f`, 15/09);
- la migración `e4a72c9b1f35` crea la columna y marca `usa_marca`, pero no
  carga la lista;
- en producción la siembra no corre.

Es el mismo defecto que vos encontraste y corregiste para los tipos
(`7177b2d`). Por eso el filtro de marca y su faceta tampoco tienen nada que
ofrecer en el sitio.

Lo reviso yo: mis aceptaciones de la marca no preguntaron por la carga en
producción. Lo corrijo en mi método.

### Qué entra

1. **Migración aditiva e idempotente** que cargue las 44 marcas de la
   siembra.
   - Inserta sólo las que falten, por `(type, value)`.
   - No toca las que existan.
   - No reactiva una que alguien desactivó desde el panel.
   - `downgrade`: borra sólo lo que esa migración insertó, o no hace nada;
     explicá cuál elegís y por qué.
2. **Inventario de lo que producción necesita y hoy sólo trae la siembra.**
   Recorré `seed.py` y listá cada grupo o tabla (`unit`, `pricing_type`,
   `availability`, `response_time`, categorías, subrubros, `usa_marca`,
   localidades…), y para cada uno:
   - si una migración lo carga;
   - qué se rompe en producción si falta;
   - cómo se carga allá.

   Lo que el producto necesita para publicar o filtrar entra en la misma
   migración. Lo demás va al informe.
3. **Caso nuevo en el smoke**, como el 196. En una copia de la base,
   con categorías y **sin** `form_options` de marca (lo que hay en
   producción), la migración deja las 44 iguales a las de la siembra.
   Correrla dos veces no duplica nada.

4. **Agregado por decisión de Emi (25/09, `DECISIONS.md`):** el filtro
   «Marca» del Mercado aparece **siempre** que la categoría elegida use marca
   (hoy, Maquinaria agrícola). Muestra las 44 marcas activas, cada una con su
   cantidad, **también las que tienen cero**.
   - El conteo sigue siendo del servidor, con los demás filtros aplicados,
     como la faceta de hoy.
   - Elegir una marca sin publicaciones muestra el vacío habitual del
     Mercado, sin error.
   - Actualizá los casos de la faceta que esperaban que el filtro se ocultara
     y la guía si lo menciona.
   - Negativo: ocultar las marcas en cero da rojo.

### Aceptación

- el caso nuevo más un negativo (la migración sin la carga da rojo);
- suite completa desde base nueva;
- `alembic check`;
- diff-check.

No integres ni despliegues: la publicación la hago yo con autorización de
Emi.

---

## Después — ATRIBUTOS-RUBRO-1, parte 2

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde PROD-LISTS-1.

### Decisión sobre la parte 1

**Aceptada en rama** sobre `d283cac`. Evidencia en
`REPRODUCCION-ATRIBUTOS-RUBRO-1-P1-2026-09-25.md`.

- **Casos:** 179, 194, 195 y 196 en 4/4.
- **Negativos:** los tres tuyos dan rojo, y también los tres míos:
  - bordes corridos, con 60 HP en compacto;
  - un tipo de cualquier subrubro;
  - cambiar de subrubro sin soltar el tipo.
- **Suite completa desde base nueva:** 195/196. Sólo cae el 169, de entorno.
  El 191 queda verde, así que el P3 del token está cerrado.
- **Auditorías:** a11y 78/78, contraste 86/86, móvil 12/12 y la guía
  coincide.

Muy bien visto lo de las listas en producción: sin `7177b2d`, el filtro no
habría aparecido en el sitio.

**Sobre tus consultas:**

- Los nombres completos en Cosecha y en Cercas se aceptan.
- La tarjeta sigue sin el tipo.
- Tierras no cambia.
- Los dos P2 entran en esta parte (ver abajo).

**Para tu próximo script de negativos (P3, sin tarea):** hoy depende de
`entorno_nativo.sh --reiniciar-api`. En mi entorno tuve que reemplazar ese
paso. Si podés, que el reinicio se pueda pasar por una variable.

### Qué entra en la parte 2

Las decisiones PM 3 a 6 de la parte 1 siguen vigentes. Se repiten acá para
que no tengas que buscarlas.

1. **Modelo** (sólo Maquinaria agrícola). Es texto opcional y se ve en la
   ficha.
   - No es un filtro propio: se encuentra con el buscador de texto.
2. **Año** (sólo Maquinaria agrícola). Es un número opcional entre 1950 y el
   año próximo.
   - El filtro es un rango, «desde» y «hasta», y cualquiera de los dos puede
     ir solo.
3. **Origen**, «Agencia / Concesionaria» o «Dueño directo»:
   - es opcional y sólo para productos, no para servicios;
   - se muestra siempre rotulado «declarado por quien vende», en la tarjeta,
     en la ficha y en el filtro;
   - nunca tiene el aspecto del distintivo de documentación revisada.
4. **El nulo no entra en un filtro positivo.** Pedir años desde 2015 no trae
   publicaciones sin año, y pedir «Dueño directo» no trae las que no
   declararon origen.
5. **Los filtros siguen el contrato de los que ya existen:**
   - se aplican en el servidor antes de contar y paginar;
   - viajan en la URL y vuelven con Atrás y Adelante;
   - cambiarlos vuelve a la página 1.
6. **P2 — la marca queda cargada en la publicación siguiente**
   (`AddProductModal.tsx:212`). `limpiarFormulario` tiene que soltar la
   marca, y también el modelo, el año y el origen nuevos.
   - Caso: publicar un John Deere y abrir otra alta; el selector aparece
     vacío.
   - Negativo: sin limpiar la marca, el caso da rojo.
7. **P2 — «Mercado» dentro del Mercado saca filtros de la barra**
   (`politica.ts:74`). La condición, el orden, la marca, el año y el origen
   tienen que sobrevivir a «Mercado» y a recargar, como ya sobreviven el tipo
   y la potencia.
   - Negativo: sacar uno de `PARAMETROS_DEL_MERCADO` da rojo y lo nombra.

8. **P2 visto por PM después de aceptar — dos filtros se llaman «Tipo».**
   El de productos y servicios (`catalog-type`) y el del tercer nivel
   (`catalog-subtype`) tienen el mismo rótulo en el mismo panel. El primero
   pasa a llamarse «Productos o servicios»; el del tercer nivel sigue siendo
   «Tipo».
   - Ajustá los casos y la guía que lean el rótulo viejo.
   - a11y: los dos rótulos tienen que ser distintos.

La siembra de ejemplo suma modelo, año y origen a algunas máquinas, y deja
otras sin esos datos a propósito, para probar el nulo.

### Fuera de alcance

- Filtro propio de modelo.
- Origen en servicios.
- Editar listas desde el panel.
- Marca en otros rubros.
- Mostrar el tipo en la tarjeta.
- «Inversores».
- Rediseño de Inicio.
- Integración y despliegue. No avances a `USER-GUIDE-1`.

### Aceptación verificable

1. **Casos nuevos en el smoke:**
   - alta y edición guardan y muestran modelo, año y origen;
   - la validación rechaza:
     - un año de 1949 y uno de dos años adelante;
     - un origen inventado;
     - un origen en un servicio;
     - modelo o año fuera de Maquinaria;
   - el filtro de año y el de origen cuentan en el servidor, y el nulo no
     entra;
   - «desde» mayor que «hasta» no rompe: devuelve cero o se rechaza, y el
     informe dice cuál;
   - URL, historial y vuelta a la página 1;
   - el rótulo «declarado por quien vende» se ve en la tarjeta, la ficha y el
     filtro, sin el aspecto del distintivo;
   - los dos P2, cada uno con su caso.
2. **Negativos:** el filtro aplicado después de contar, en el navegador o
   aceptando nulos, y uno por cada P2. Cada uno da rojo por su motivo.
3. **Migración** aditiva, con `downgrade` probado en una copia de la base.
   Las publicaciones existentes, con su tipo y su potencia, quedan intactas.
4. **Sin regresiones:** suite completa desde una base recién creada, a11y
   `--todas`, contraste, auditoría móvil y `guia-admin.mjs`.
5. Build, lint, tipos, `compileall`, `alembic check` y diff-check con
   `cr-at-eol`.

### Frená y consultá

- Si el origen necesita algo más que un campo declarado.
- Si el rango de año choca con publicaciones que ya existen.

### Entrega en `PARA-PM.md`

- SHA;
- los casos y los negativos;
- la migración;
- las puertas;
- los riesgos.

No integres ni despliegues.

---

## Después (no empezar todavía)

**`USER-GUIDE-1`**, las guías de uso de quien compra, vende y transporta,
cuando los atributos estén cerrados.
