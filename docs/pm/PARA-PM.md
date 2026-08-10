# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-10.

## 1. Resultado

**Terminado.** `d4623b4`, este informe aparte. La suite pasa de 38 a **39
casos**.

Un aviso arriba de todo, porque cambia cómo leer la evidencia: **el entorno
perdió las imágenes y los contenedores Docker**, y el registro sigue bloqueado
por egreso. Está explicado en el punto 6; la suite igual corrió entera.

## 2. Situación encontrada

Confirmo tu diagnóstico y agrego el alcance exacto. Los cinco datos se guardan
en el alta y `/auth/me` los devuelve, pero no había ningún camino de edición:

| Pieza | Estado |
|---|---|
| `UserUpdateRequest` | sin los cinco campos |
| `PATCH /auth/me` | no los leía ni los escribía |
| `AuthContext.updateProfile` | no los mandaba |
| Panel de perfil | no los mostraba |

Como `UserUpdateRequest` es un modelo común de Pydantic, mandarlos igual no
fallaba: los descartaba en silencio y devolvía 200. Es la peor forma de no
funcionar y es lo que reproduce el rojo del punto 5.

## 3. Qué hice

**Backend.** Los cinco campos entran al esquema. `is_carrier` **no**: quién
puede volverse transportista, o dejar de serlo, es la política que marcaste
como no decidida, así que el endpoint no la puede tomar por su cuenta. Una
cuenta que no es transportista recibe 400 y ningún dato de transporte.

La validación trabaja sobre el estado **prospectivo** —lo enviado sobre lo
guardado— y recién asigna cuando el conjunto entero es válido. Es el mismo
patrón del carrito y responde a tu criterio de que un envío parcial no puede
dejar un estado inválido:

| Envío parcial | Respuesta |
|---|---|
| localidad fuera del padrón | 400 "La localidad base no pertenece al padrón" |
| radio `0` o negativo | 422, igual que en el alta |
| transporte en blanco | 400 "El transporte es obligatorio para transportistas" |
| habilitación retirada | 400 "El transporte debe estar habilitado" |
| cuenta que no es transportista | 400, y sigue sin datos de transporte |

Ninguno escribe: la validación termina antes de tocar el modelo y antes del
`commit`.

**Un agregado que me pareció imprescindible.** `/auth/me` devolvía sólo
`carrier_base_locality_id`. Con un identificador no se puede ni mostrar la
localidad ni abrir el selector en la provincia correcta. Agregué tres derivados
de **sólo lectura** —nombre de localidad, id y nombre de provincia— resueltos
por la relación que ya existía. Sin columnas nuevas y sin migración.

**Interfaz.** La sección aparece únicamente si la cuenta es transportista.
Lectura con los nombres del padrón; edición con selector de provincia y
localidad, transporte, radio, capacidad y la casilla de declaración.

## 4. Tres decisiones que conviene que mires

1. **Cancelar ahora restaura los datos de transporte.** Antes el formulario
   conservaba lo tipeado, así que una edición abandonada volvía a enviarse en
   el guardado siguiente. Lo acoté a los campos nuevos; los de comprador y
   vendedor siguen comportándose igual.
2. **El error visible del perfil pasa a ser el motivo real de la API**, con el
   texto genérico anterior como respaldo cuando no hay mensaje. Es un desvío
   chico de "los mensajes actuales no cambian" y lo hice a propósito: sin eso,
   un rechazo de padrón se veía como "Error al guardar el perfil". Si preferís
   el genérico, lo vuelvo en una línea.
3. **El radio se frena en el cliente antes de enviar.** El formulario del panel
   no está dentro de un `<form>`, así que no hay validación nativa: sin ese
   freno el campo vacío salía sin radio y el backend conservaba el anterior sin
   avisar.

## 5. La regresión

Caso **39**, integral y por el camino real:

```text
[PASS] 39 El transportista edita su perfil y los cambios quedan —
  panel + API + SQL: Pergamino → 11 de Septiembre, 320.5 km;
  6 rechazos sin escritura
```

Cubre alta y confirmación, `/auth/me` con el padrón resuelto, los cinco datos
editados desde el panel —incluida la casilla, que se destilda y se vuelve a
tildar—, recarga, **nuevo ingreso**, contraste con SQL y los seis rechazos con
comprobación de que el registro quedó intacto.

**El rojo forzado encontró un defecto mío, y lo agradezco.** Saqué los cinco
campos del esquema para simular el estado anterior y el caso falló, pero por
una razón equivocada: un tiempo de espera agotado en el selector de localidad.
Investigándolo apareció un error real de mi propio código: elegir **la misma**
provincia vaciaba la lista de localidades y no la volvía a cargar, porque el
estado no cambiaba y el efecto no se repetía. En la corrida verde había pasado
por casualidad, ganándole la carrera al vaciado. Corregí las dos cosas —el
cambio nulo y una respuesta vieja que podía pisar a la nueva— y recién ahí el
rojo salió por el motivo correcto:

```text
[FAIL] 39 — tras recargar falta "11 de Septiembre" en "…Transporte habilitado
  Camión chico original Radio de cobertura (km) 40 km Capacidad de carga
  Hasta 8 toneladas…"
```

Es decir: el panel avisa "Perfil actualizado exitosamente" y no guardó nada.
Ese es exactamente el fallo silencioso que la pieza cierra.

## 6. El entorno perdió Docker, y cómo corrí igual la suite

`docker images` y `docker ps -a` vienen **vacíos**: no quedó ninguna imagen ni
contenedor de los que usaste en Gate A. Levanté el demonio, pero reconstruir
exige descargar y el registro sigue bloqueado:

```text
docker pull postgis/postgis:16-3.4
failed to copy: … production.cloudfront.docker.com/…/blobs/… : Forbidden
```

No lo rodeé. La suite habla con la base y con la aplicación por
`docker exec topgreen-db` y `docker exec topgreen-api`, así que sobre la
instalación **nativa** —el Camino B que aceptaste en `896386a`— no arranca.

Lo resolví **sin tocar la suite**: un puente ejecutable llamado `docker`,
adelante en el `PATH`, que traduce esas dos invocaciones exactas al `psql` y al
Python nativos y **rechaza cualquier otra**. No está versionado, no relaja
ninguna comprobación y el archivo que ejecuta la suite es el mismo que está en
el repo. Prefiero esto a modificar `querySql`: un respaldo silencioso adentro
del guion podría tapar mañana un Docker roto de verdad.

Con eso, base recreada desde cero cada vez —borrar, crear, PostGIS, seis
migraciones, seed, outbox vacío—:

| Corrida | Resultado |
|---|---|
| Con el esquema anterior | **38/39**, sólo el 39 en rojo |
| Con la corrección | **39/39** |

Queda pendiente para vos, si querés cerrarlo: **repetir la suite sobre Docker**
en tu entorno. Es la misma división que usamos en Gate A.

## 7. Estado final

| Comprobación | Resultado |
|---|---|
| Suite completa, base recreada | **39/39** |
| Caso 39 con el código anterior | rojo, y por el motivo correcto |
| `npm run build` | verde |
| `npm run a11y -- --todas` | 44/44 pantallas, 0 violaciones de cualquier impacto |
| `npm run contraste` | 36/36 mediciones, 0 textos fuera de umbral |
| `git -c core.whitespace=cr-at-eol diff --cached --check` | sin avisos |

Los dos barridos los corrí porque toqué el panel. Ninguna de sus cuentas es
transportista, así que la sección nueva no entra en lo medido; lo corro para
demostrar que no rompí las 44 pantallas que ya estaban.

## 8. Riesgos y hallazgos

**Sin migración.** Ninguna hacía falta: las columnas ya existían.

**Tres cosas que vi y no toqué**, porque estaban fuera del alcance:

1. **El formulario de perfil arranca con datos inventados.** `phone`,
   `whatsapp`, `province`, `city` y `address` se inicializan con constantes
   —`+54 9 11 5555-4444`, `CABA`, `Av. Corrientes 1234`— en vez de con los
   datos de la cuenta. Quien guarda su perfil se escribe encima el teléfono con
   uno falso. Es previo a esta pieza y toca la edición general que pediste no
   cambiar, pero es un defecto de verdad y conviene una pieza corta.
2. **Los campos previos del formulario no tienen nombre accesible** en modo
   edición: la etiqueta no está asociada al control. Los míos sí. No lo detecta
   la puerta porque el barrido mide el panel en lectura, nunca en edición.
3. **La edición del perfil no está en el barrido de accesibilidad.** Es la
   misma familia que los marcadores `?token=` que dejaste anotados: cuando se
   vuelvan a tocar esos guiones, entra.

**Sigue abierto el `float` del checkout**, obligatorio antes de Fase 4.

El entorno local sigue levantado: API en `:8000`, Vite en `:5173`, base
recreada y con seed.
