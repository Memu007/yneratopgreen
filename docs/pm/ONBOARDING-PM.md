# Arranque para la PM

Sol: leé este archivo entero **una vez**. Después no vuelve a hacer falta.
Tu día a día pasa por `NOW.md`, `CRONOGRAMA.md` y los dos canales.

Escrito el 2026-08-04 por la PM saliente, que a partir de hoy es la dev.

---

## 1. Quién es quién

**Vos sos la PM.** Definís qué se construye y por qué, escribís los
criterios de aceptación, priorizás y revisás lo que se entrega.

**No escribís código de producto.** Sólo editás archivos dentro de
`docs/pm/`. Esto no es una formalidad: si la PM toca el código, se pierde
la única revisión independiente que tiene el proyecto.

**Yo soy la dev.** Escribo el código, corro las pruebas y te informo.

**Emi es el dueño del proyecto.** Habla con la clienta y toma las
decisiones comerciales. Todo lo que dependa de la clienta va por él.

### El cambio de roles es de hoy

Hasta el 2026-08-04 yo era la PM. Todo lo que está escrito en `PARA-DEV.md`,
`DECISIONS.md`, `NOW.md` y el archivo histórico lo escribí yo desde ese
lugar. **Ahora eso es tuyo y podés revisarlo entero**, incluido lo que
decidí mal.

Te dejo la lista de mis errores en la sección 8, porque heredás las
consecuencias.

---

## 2. Somos adversariales, en las dos direcciones

Esto es cómo trabajamos, no una advertencia.

**Si me pedís algo técnicamente mal, te lo voy a decir antes de hacerlo.**
No lo voy a implementar porque lo pidió la PM. Y espero lo mismo al revés.

Ya pasó varias veces, en las dos direcciones:

- La PM mandó a cargar *"las 43 subcategorías tal como figuran en el
  análisis"* cuando el análisis sólo tenía las cantidades. La dev frenó en
  vez de inventarlas. **Tenía razón y el error era de la PM.**
- La PM afirmó en un borrador de contrato que *"la plataforma no toca
  fondos"*. La dev demostró que era falso: el código heredado tenía split
  payments con comisión de marketplace y OAuth de vendedores, apagado sólo
  porque faltaban credenciales. **Ganó la dev**, y por eso hoy esos routers
  están desmontados.
- La dev dejó la categoría Acopio con cero publicaciones y dejó su informe
  desactualizado dos veces. **Lo encontró la PM revisando el código.**

**La regla operativa: se verifica contra el código, no contra el informe.**
No por desconfianza. Este repositorio llegó con ocho afirmaciones falsas en
su propia documentación —`docs/PROJECT_STATUS.md`— y aprendimos por las
malas.

Si te digo que algo funciona y no pegué la salida, tratalo como no hecho.

---

## 3. El proyecto, en un minuto

**TopGreen** es un marketplace agrícola argentino, para una clienta real,
a **precio cerrado**. Junta productores, proveedores y transportistas.

La diferencia con un marketplace común son dos cosas: **filtrado por
ubicación real** —con el padrón oficial de localidades del Estado
argentino, 4.028 cargadas— y un **módulo de logística** que conecta
compradores y vendedores con transportistas de la zona.

El proyecto **fue aprobado el martes 2026-07-28**. Se terminó la etapa de
conseguir el trabajo; ahora se entrega, con el reloj corriendo.

**Precio cerrado significa que lo que se construya de más lo pagamos
nosotros.** Es tu palanca principal y tu principal riesgo a la vez.

---

## 4. Las fechas mandan, y están en `CRONOGRAMA.md`

**Guiate por las fases y semanas del PDF del socio** —el documento de
especificación funcional que la clienta aprobó—. Están transcriptas y
ancladas a fechas reales en **`docs/pm/CRONOGRAMA.md`**. Abrilo ahora, es
lo segundo que tenés que leer.

El resumen que necesitás tener en la cabeza:

- Cinco fases, **semana 1 desde el viernes 2026-08-07**.
- Plazo **12 a 14 semanas**. Las doce cierran el **2026-10-29**.
- **Hoy es la preparacion anterior al inicio contractual.**
- Tres hitos de cobro atados a **entregables**, no a fechas.
- El trabajo contractual restante entra en el plazo estimado. El alcance
  nuevo de suscripciones **no esta en el PDF y va a Fase 6**.

La decision quedo cerrada por Emi el 2026-08-05 y esta desarrollada en la
seccion 6 del cronograma.

---

## 5. Cómo nos comunicamos

**No hay chat entre vos y yo. Hablamos por archivos, en el repositorio.**

| Archivo | Quién escribe | Para qué |
|---|---|---|
| `docs/pm/PARA-DEV.md` | **Sólo vos** | Mi tarea actual y sus criterios |
| `docs/pm/PARA-PM.md` | **Sólo yo** | Mis informes |

Ninguna de las dos edita el archivo de la otra. `PARA-DEV.md` es tuyo:
podés reescribirlo entero cuando quieras.

**Antes de escribirme:**

```bash
git pull origin main
cat docs/pm/PARA-PM.md
```

### Qué tiene que tener una tarea que me escribas

1. **Qué problema resuelve.** Sin esto no puedo decidir nada cuando la
   especificación no alcanza.
2. **Los criterios de aceptación**, escritos como abajo.
3. **Qué está explícitamente fuera de alcance.** Con precio cerrado, esto
   vale tanto como lo que está dentro.
4. **Qué pasa si un criterio no se cumple**: freno y te escribo, o
   improviso. Por defecto, freno.

### Cómo se escriben los criterios de aceptación acá

**Relacionales, no absolutos.** En vez de *"tiene que devolver 4
productos"*, va *"el resultado de la API tiene que coincidir con el de la
consulta SQL equivalente"*.

El motivo: se le pasaron a una dev números fijos que habían quedado viejos
cuando el seed creció. Ella reportó los reales en lugar de acomodarse, y
así se detectó. **Los números fijos envejecen mal.**

Cuando el número **es** la especificación —como *"43 subcategorías"*— ahí
sí va fijo, y se aclara que es fijo.

**Un criterio que sólo se puede verificar leyendo código no es un
criterio.** Tiene que haber un comando que corra y una salida que se pegue.

---

## 6. Las reglas que no se negocian

Estas están decididas y documentadas en `DECISIONS.md`. Podés discutirlas,
pero cambiarlas es una decisión de Emi, no tuya ni mía.

1. **La plataforma no recibe, retiene ni administra fondos de terceros.**
   Por eso el pago heredado de Mercado Pago está desmontado y el caso 19 de
   la suite verifica que esas rutas devuelvan `404`. Es una propiedad del
   código, no de la configuración.

   El cobro de **suscripciones** queda afuera de esta restricción: es
   servicio propio a cliente propio.
2. **Nunca se configuran credenciales reales de Mercado Pago** ni se sube
   ningún secreto al repositorio. Para local, valores inventados.
3. **Nada copiado de Agrofy ni de ningún otro sitio**: ni código, ni
   textos, ni diseño, ni marcas.
4. **La revisión de seguridad completa va al final, como condición para
   desplegar.** No se adelanta y no se saltea.

   **Matiz importante:** posponer la auditoría no es posponer un agujero
   encontrado. Apareció un `POST /payments/simulate-payment/{order_id}` que
   dejaba a un comprador pasar su propia orden a `PAID` sin pagar; se
   encontró en una revisión de alcance y se eliminó el mismo día.
5. **Una política de seguridad del entorno de la dev no se rodea nunca** —
   ni con CDP, ni con otro navegador, ni con un túnel. Se reporta.
6. **Los datos de contacto son de personas reales.** La API no devuelve el
   teléfono del comprador sin suscripción activa. Se hace en el backend, no
   escondiéndolo en la interfaz.
7. **`docs/PROJECT_STATUS.md` no se lee ni se edita.** Ocho afirmaciones
   verificadas como falsas. Se reescribe entero más adelante.
8. **Los términos comerciales no se versionan** —montos, porcentajes,
   participación—. Este repositorio se le entrega a la clienta.

---

## 7. Dónde está todo

| Archivo | Cuándo abrirlo |
|---|---|
| `NOW.md` | **Siempre primero.** Estado y prioridades |
| `CRONOGRAMA.md` | **Segundo.** Las fases y fechas del PDF |
| `PARA-DEV.md` | Lo que dejaste escrito para mí |
| `PARA-PM.md` | Mis informes |
| `CONTRATO.md` | El alcance. Si algo no está ahí, no es requisito |
| `ALCANCE-Y-LIMITES.md` | Guardas operativas por bloque y fuera de alcance |
| `MATRIZ.md` | Qué está verificado y con qué evidencia |
| `PROJECT.md` | Qué se construye y qué queda afuera |
| `DECISIONS.md` | Por qué se decidió cada cosa |
| `TAXONOMIA-CLIENTE.md` | Las 7 categorías y las 43 subcategorías, con nombres |
| `PAGOS-TRANSFERENCIA.md` | El análisis de la transferencia y los cuatro arreglos |
| `REPO_MAP.md` | Dónde está cada cosa en el código |
| `DEMO.md` | El guion de demostración |
| `ONBOARDING-DEV.md` | Lo que lee la dev el primer día |
| `archivo/PARA-DEV-historico.md` | Todo el canal de julio, verbatim |

---

## 8. Los errores de la PM anterior, porque heredás las consecuencias

No están acá por confesión. Están porque cada uno dejó una regla.

1. **Mandé a inventar datos que no existían** (las 43 subcategorías).
   Regla: si un criterio mío no cierra con lo que ve la dev, **el
   sospechoso soy yo**.
2. **Bloqueé el módulo de transportistas esperando una definición de la
   clienta que ya estaba en el contrato** —*"zona de cobertura (radio en
   km)"*—. Perdí días por no leer bien mi propia transcripción. Regla:
   antes de declarar un bloqueo, releer `CONTRATO.md`.
3. **Dije que una pieza "no tenía nada discutible" mientras yo misma pedía
   discutir su contenido.** Regla: si mando a arrancar, arranca; si mando a
   discutir, no arranca.
4. **Afirmé una propiedad del sistema que era falsa** ("no toca fondos").
   Regla: las propiedades del sistema se afirman contra el código.
5. **Tres commits me quedaron en la rama equivocada** porque corrí
   `git commit && git push origin main` estando en otra rama y un `| tail -1`
   me tapó el error. `NOW.md` estuvo horas desactualizado en `main`. Regla:
   **verificar el push explícitamente**, no encadenarlo.
6. **Dejé crecer `PARA-DEV.md` a 1.378 líneas** hasta que se volvió
   inservible. Hoy quedó archivado y el canal arranca en 494 líneas. Regla:
   archivar lo cerrado antes de que la dev empiece a saltear secciones.

---

## 9. El estado real, sin maquillar

La ultima medicion heredada fue **~53%**, ponderada por esfuerzo. Quedo
desactualizada despues de la Pieza A y del alcance nuevo; el control actual
se hace por puertas de fase en `CRONOGRAMA.md`. El detalle requisito por
requisito esta en `MATRIZ.md`.

| Bloque | Peso | Avance |
|---|---|---|
| Comprador y vendedor | 30 % | 90 % |
| **Logística y transportistas** | **25 %** | **Pieza A parcial; B/C en 0** |
| Pagos | 15 % | 50 % |
| Catálogo y categorías | 8 % | 90 % |
| Stack y responsive | 10 % | 70 % |
| Cierre, despliegue y entrega | 12 % | 35 % |

**Cómo leer ese número sin engañarte:**

- El mayor salto lo dio el **recorte de alcance**, no el código. Esa
  palanca ya se usó.
- Buena parte del trabajo hecho fue **arqueología** sobre un repositorio
  heredado a medias, no construcción.
- **Lo que queda es construcción nueva con incógnitas.** La velocidad de
  julio no se repite.
- El número **bajó** cuando se desmontó Mercado Pago, que estaba contado
  como medio hecho. Fue la decisión correcta y aun así el porcentaje la
  castiga. Así tiene que ser un porcentaje honesto.

**Funciona y está verificado con evidencia de ejecución:**

- Arranque desde cero: PostgreSQL 16 + PostGIS 3.4.3, migraciones, seed
  idempotente, build en verde.
- Recorrido de compra completo en navegador real, con tres perfiles.
- Geolocalización con 4.028 localidades de Georef, `Geography(POINT,4326)`
  con índice GIST, `ST_Distance` contrastado de forma independiente.
- Filtro por provincia y localidad de punta a punta, con estado en la URL.
- Taxonomía real de la clienta: 7 categorías, 43 subcategorías, verificado
  por SQL 7/6/7/5/6/4/8.
- **Suite de 21 casos de humo** contra arranque limpio, con criterios
  relacionales y navegador real. Verificada rompiendo un caso a propósito.
- Pago por transferencia bancaria, con autorización correcta y snapshot de
  los datos bancarios en la orden.

**Roto o sin empezar:**

- Órdenes de transferencia que quedan colgadas si no se sube comprobante.
- El seed no carga CBU ni alias, así que en instalación limpia la
  transferencia no se puede usar.
- El camino de instalación sin Docker no funciona siguiendo la guía.
- Perfil del transportista no editable.
- Transportistas: Piezas B y C en cero.
- Suscripciones: **la tarea ni siquiera está escrita**.
- Tierras y parcelas como aviso de consulta.
- Mercado Pago para compras, sin split.
- Vista en celular: relevada, no corregida.
- Despliegue: preparación de Railway subida, sin desplegar.
- Revisión de seguridad final.

---

## 10. Lo que te espera decidir

1. Revisar la entrega de la orden de transferencia inmortal.
2. Cerrar el flujo UX/UI de logistica antes del 20/08.
3. Especificar la validacion por correo dentro de Fase 2.
4. Mantener suscripciones, planes, mensajeria y tierras fuera del camino
   critico hasta Fase 6.

---

## 11. Tu primera tarea

Leé `NOW.md` y `CRONOGRAMA.md`, en ese orden. Después decidime qué hago
primero, escribilo en `PARA-DEV.md` y pusheá.

Mi propuesta —y la vas a discutir, para eso estás— es que arranque por lo
roto de lo ya entregado antes de abrir un módulo nuevo. El argumento y el
orden están en `NOW.md`. Si preferís otro orden, decilo con el motivo y
lo hago.
