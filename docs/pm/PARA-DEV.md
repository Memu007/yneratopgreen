# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — ATRIBUTOS-RUBRO-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Decisión sobre la entrega anterior

`MERCADO-UNICO-1` quedó **aceptada en rama** sobre `2b71709`.

- 193 en 1/1.
- Tus tres negativos dan rojo, y también los míos:
  - la reescritura hecha con `pushState`;
  - quitar la reescritura al volver por el historial.
- Suite completa en 191/193; a11y, contraste, auditoría móvil y guía del
  panel verdes.

Acepto tus dos recomendaciones:

- no se agrega ningún aviso nuevo;
- la cabecera queda en 2+2 en celular.

Las fotos sin uso se conservan. Evidencia en
`REPRODUCCION-MERCADO-UNICO-1-2026-09-25.md`.

### Problema y prioridad

Es la devolución de la clienta #9 más la taxonomía que mandó el 25/07 y
reenvió el 25/09. **Emi decidió absorberlo** (`DECISIONS.md`, 25/09).

La clienta quiere que quien publica cargue lo que identifica su producto, y
que eso alimente los filtros: «cuantos más datos aporta el vendedor mayor
probabilidad de aparecer al filtrar». Hoy el Mercado filtra por categoría y
subcategoría, pero no por el tercer nivel de su listado. Tampoco hay
potencia, modelo, año ni origen.

**La fuente de los datos** es `docs/pm/TAXONOMIA-CLIENTE.md`, que tiene
transcripto el tercer nivel de los 43 subrubros. No se usa el HTML de la
clienta: tomamos los datos, no el código.

### Decisiones PM

1. **El tercer nivel es un atributo de la publicación, no un nivel más de
   categorías.** Así lo decidimos el 15/09. Cada subrubro tiene su lista
   cerrada de «tipo», por ejemplo:
   - Preparación del suelo: arados, rastras…;
   - Riego por aspersión: pivotes, cañones, laterales.

   Al publicar se elige uno de la lista del subrubro. Es opcional: una
   publicación vieja sin tipo sigue siendo válida.
2. **Tractores:** su tercer nivel son rangos de potencia. Quien publica carga
   la potencia en HP como número, y el filtro ofrece los tres rangos de la
   clienta: compacto (<60), estándar (60–120) y alta (>120).
3. **Maquinaria agrícola:** además de la marca, que ya existe, suma modelo
   (texto) y año (número entre 1950 y el año próximo). El filtro de año es
   un rango, desde y hasta. El modelo no es un filtro propio: se encuentra
   con el buscador de texto.
4. **Origen** («Agencia / Concesionaria» o «Dueño directo»):
   - es opcional y sólo para productos, no para servicios;
   - se muestra siempre rotulado «declarado por quien vende», en la tarjeta,
     en la ficha y en el filtro;
   - nunca tiene el aspecto del distintivo de documentación revisada.
5. **El nulo no entra en un filtro positivo**, como la condición: pedir
   «arados» no trae publicaciones sin tipo.
6. **Los filtros nuevos siguen el contrato de los que ya existen:** se
   aplican en el servidor antes de contar y paginar, viajan en la URL,
   vuelven con Atrás y Adelante, y cambiarlos vuelve a la página 1. El
   filtro de tipo aparece cuando hay un subrubro elegido y ofrece sólo sus
   opciones.

### Dos partes, entregas separadas

- **Parte 1:** tipo (tercer nivel) en los siete rubros y potencia de
  tractores, con alta, edición, filtro, ficha y siembra de ejemplo.
- **Parte 2:** modelo y año en maquinaria, y origen declarado.

Cada parte se entrega y se revisa por separado. Si ves un corte mejor,
proponelo en `PARA-PM.md` antes de construir.

### Además, P3 del arnés

En mi suite completa, el 191 cayó con 401 «Token inválido o expirado» en
`PATCH /admin/products/…/status`. Solo, pasa. Algún camino del 191 usa un
token guardado sin renovar. Corregilo en la parte 1.

### Fuera de alcance

- Editar las listas de tipo desde el panel: salen de la siembra. Si la guía
  del panel las muestra en Configuración, se documentan.
- «Inversores».
- Cambiar la marca a otros rubros.
- El rediseño de Inicio.
- Integración y despliegue.

### Aceptación verificable (en cada parte)

1. **Casos nuevos en el smoke:**
   - alta y edición guardan y muestran cada atributo;
   - la validación rechaza lo inválido (un tipo que no es del subrubro, una
     potencia negativa, un año fuera de rango);
   - el filtro trae lo que corresponde y cuenta en el servidor;
   - el nulo no entra;
   - la URL y el historial funcionan;
   - cambiar un filtro vuelve a la página 1.
2. **Negativos:** el filtro aplicado después de contar, en el navegador o
   aceptando nulos. Cada uno da rojo por su motivo.
3. **Migración** aditiva, con `downgrade` probado en una copia de la base,
   como el caso 74. Las publicaciones existentes quedan intactas.
4. **Sin regresiones:** suite completa desde una base recién creada, a11y
   `--todas`, contraste, auditoría móvil y `guia-admin.mjs`.
5. Build, lint, tipos, `compileall` y diff-check con `cr-at-eol`.

### Frená y consultá

- Si un subrubro del listado no tiene tercer nivel claro, o si el del
  listado mezcla cosas que no son tipos. Proponé cómo tratarlo.
- Si el origen necesita algo más que un campo declarado.

### Entrega en `PARA-PM.md`, por parte

- SHA;
- qué se cargó por subrubro;
- los casos y los negativos;
- la migración;
- las puertas;
- los riesgos.

No integres ni despliegues.

---

## Después (no empezar todavía)

**`USER-GUIDE-1`**, las guías de uso de quien compra, vende y transporta,
cuando los atributos estén cerrados.
