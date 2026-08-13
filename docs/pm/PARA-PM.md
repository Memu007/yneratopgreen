# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-12. Tercer informe del día.

**Pieza MP-A entregada.** Un vendedor conecta su cuenta de Mercado Pago desde su
panel, ve en qué estado está, la renueva y la desconecta. No se creó ni una
preferencia, no se movió un peso, no toqué órdenes ni stock. `payments.py`
sigue desmontado y la comisión sigue sin restaurarse.

Antes de nada, dos cosas que quiero que leas aunque saltees el resto:

- **Encontré y arreglé un agujero de producto que no estaba en tu lista**: al
  volver de Mercado Pago, el vendedor caía en la portada sin ningún aviso. Ni
  «listo» ni «falló». Punto 3.
- **Rotar `MP_TOKEN_KEY` invalida todos los vínculos.** Está documentado y el
  sistema lo maneja solo —cada vendedor pasa a «reconectar»—, pero es una
  decisión de operación que alguien tiene que conocer antes de rotarla. Punto 7.

## 1. El contrato, punto por punto

| Lo que pediste | Cómo quedó |
|---|---|
| State aleatorio, de un solo uso, con vencimiento y ligado a quien lo pidió | Tabla `mp_oauth_states`: 32 bytes al azar, 15 minutos, se sella al usarse |
| Callback repetido, vencido, alterado o de otra sesión no vincula | Cuatro rechazos distintos, con motivo propio cada uno |
| Credenciales cifradas con clave fuera del repositorio | Fernet; sin clave la integración no se ofrece |
| Nada recuperable en claro en base, respuesta, URL ni log | Verificado en los cuatro lugares |
| La migración retira lo heredado sin conservar vínculos inseguros | Se van las dos columnas y además se invalida la cuenta y las fechas |
| Una cuenta de MP no puede quedar en dos cuentas de TopGreen | Chequeo + índice único que lo sostiene desde SQL |
| Refresh rota credenciales de manera atómica | Las dos y el vencimiento, en la misma transacción |
| Vencido, revocado, clave incorrecta o respuesta inválida fallan cerrado | Los cuatro dan «reconectar» con 200, ninguno da 500 |
| Desvincular borra todo lo local | Credenciales, cuenta, fechas y states pendientes |
| Se elimina `manual-link` | No existe; el esquema publicado tampoco lo menciona |
| Tres estados en el panel, sin secretos ni errores crudos | Tres más «no disponible», con la UI que ya estaba |
| Configuración ausente no degrada el resto | `no_configurado`, y catálogo y productos siguen en 200 |

## 2. Las cinco decisiones que tomé

**Se guarda la huella del state, no el state.** El valor viaja en una URL: queda
en el historial del navegador, en el `Referer` y en el log de acceso de
cualquier proxy. Lo que está en la base no tiene por qué servir para fabricar
un callback, así que guardo `SHA-256` y comparo huellas.

**El callback exige sesión.** Pediste que un callback «asociado a otra sesión»
no vincule. Fui un paso más allá: si no hay sesión, tampoco. Es más estricto y
tiene un costo que te debo decir: si al vendedor se le vence la sesión mientras
está autorizando en Mercado Pago, vuelve, ve «entrá de nuevo y volvé a
intentar» y tiene que repetir. Preferí eso a vincular una cuenta de cobro sin
saber con certeza de quién es la ventana que volvió.

**Consumir el state es una sola sentencia SQL.** `UPDATE … WHERE usado_el IS
NULL … RETURNING user_id`. Leer primero y sellar después dejaría una ventana en
la que dos callbacks simultáneos con el mismo state vinculan los dos. Así
compiten por la misma fila y la base deja pasar uno.

**El estado descifra de verdad.** `estado_de()` no se conforma con que haya algo
guardado: lo abre. Si la clave se rotó sin migrar, el vendedor ve «reconectar»
en el acto y no «conectado» hasta que una venta falle. Cuesta descifrar dos
textos cortos por consulta de estado; enterarse tarde cuesta más.

**Renovar nunca devuelve 500.** Cualquier falla —MP caído, permiso revocado,
clave cambiada, respuesta rara— contesta 200 con el estado «requiere_reconexion»
y un motivo de un enum nuestro. Un 500 no le dice nada a nadie y no se puede
accionar; «reconectá tu cuenta» sí.

## 3. Un agujero que no estaba en la lista

La vuelta de Mercado Pago es una **carga nueva de la página**, y el panel del
vendedor es un modal: en esa carga no está montado. El código heredado atendía
`?mp_linked=success` dentro del panel, así que el aviso lo escuchaba un
componente que no existía en ese momento.

Resultado real: el vendedor autorizaba en Mercado Pago, volvía a la portada de
TopGreen y **no pasaba nada**. Ni un cartel, ni el panel abierto, ni forma de
saber si había quedado vinculado, con `?mp=vinculado` colgado de la URL.

Lo pasé al encabezado, que sí está siempre montado: muestra el aviso, limpia la
URL y vuelve a abrir el panel. Con dos cuidados: espera a que la sesión termine
de restaurarse —al montar todavía no se sabe quién es— y si resulta que no hay
sesión no abre nada, porque el panel sin usuario no tiene qué mostrar.

## 4. Dos cosas más que aparecieron

**Tres colores heredados no llegaban a 4,5:1.** El botón de desvincular
(`#ef4444`, 3,28:1 sobre el degradado de la sección) y dos párrafos grises
(`#6b7280`, 4,21:1). La sección estuvo fuera del árbol desde antes de que
existieran las puertas de accesibilidad y contraste, así que nunca se midieron.
Los oscurecí a `#b91c1c` (5,64:1) y `#4b5563` (6,59:1). Mismos tamaños, mismos
pesos, misma estructura: no rediseñé nada, corregí tres valores.

**El caso 20 exigía que `/mp-oauth/status` diera 404.** Era correcto mientras el
módulo estaba desmontado. Sostenerlo hoy sería exigir que la parte que aceptaste
no exista, así que ese caso pasó a comprobar que las rutas de **cobro** siguen
en 404 y que el vínculo contesta su estado sin exponer credenciales. El
inventario completo de la superficie está en el caso 67.

## 5. El SDK: no lo toqué, y por qué

Pediste verificar si el SDK fijado se usa en esta pieza. **No se usa.** El
intercambio OAuth son dos POST a un endpoint de tokens; lo hace `httpx`, que ya
es una dependencia del proyecto.

Dejé `mercadopago==2.2.1` como estaba. Subir a 3.5.0 no aporta una API que esta
pieza use, y dejaría en el árbol un `payments.py` escrito contra 2.x que ni
siquiera importaría. Ese salto va con la pieza que reescriba el cobro, y ahí el
piso es **3.4.0**: hasta esa versión la validación de firma de webhooks del
propio SDK comparaba segundos contra un reloj en milisegundos.

## 6. Esquema final

En `users` se van `mp_access_token` y `mp_refresh_token` (`VARCHAR(500)`, en
claro) y quedan:

```
mp_user_id                VARCHAR(50)  UNIQUE   -- una cuenta, un vendedor
mp_access_token_cifrado   TEXT                  -- Fernet
mp_refresh_token_cifrado  TEXT                  -- Fernet
mp_token_expires_at       TIMESTAMP
mp_linked_at              TIMESTAMP
mp_requiere_reconexion    BOOLEAN NOT NULL DEFAULT false
```

Y la tabla nueva:

```
mp_oauth_states(id, user_id → users ON DELETE CASCADE,
                state_hash UNIQUE, creado_el, expira_el, usado_el)
```

**La migración no migra el contenido y frena si encuentra algo.** Un token que
estuvo en claro no se «convierte» en seguro: ya estuvo expuesto. Se descarta, y
se invalida el vínculo entero —cuenta y fechas incluidas— para no dejar a nadie
en «conectado» sobre una credencial que no existe. Si la base trae tokens no
nulos, `upgrade()` **se detiene y no borra nada**, con un mensaje que dice
cuántos son (nunca cuáles, ni de quién) y qué hacer. Recién con
`MP_MIGRACION_DESCARTAR_TOKENS=1` descarta.

En nuestra base había **cero**. Lo verifiqué antes de escribir la migración.

## 7. Riesgos residuales

Los digo yo antes de que los encuentres vos.

1. **Desvincular no le revoca el permiso a la aplicación del lado de Mercado
   Pago.** Borra todo lo local, que es lo que está bajo nuestro control, y la
   pantalla le dice al vendedor que lo revoque desde su cuenta. No inventé un
   endpoint de revocación porque no pude abrir la documentación para
   confirmarlo. **Averigualo vos**: si existe, es un agregado chico.
2. **El log de acceso del servidor sí ve el `code` y el `state`**, porque van en
   la URL del callback. Es inherente a OAuth y por eso el state es de un solo
   uso y dura 15 minutos. Lo que sí controlamos —lo que registra nuestro
   código— está medido: durante un rechazo de MP la aplicación escribe una sola
   línea, «Mercado Pago rechazó el pedido de tokens (HTTP 401)», sin cuerpo, sin
   token y sin `client_secret`.
3. **Rotar `MP_TOKEN_KEY` invalida todos los vínculos a la vez.** El sistema no
   se rompe: cada vendedor ve «reconectar». Pero es una molestia colectiva y
   hay que avisar antes. Está escrito en `SETUP_PAYMENTS.md`.
4. **Un intento de vinculación por vendedor.** Pedir la URL invalida el intento
   anterior. Si alguien abre dos pestañas, la primera deja de servir y ve «el
   pedido venció o ya se había usado». Es el precio de que un state viejo no
   quede vivo.
5. **`MP_COMMISSION_PERCENT` sigue en 5.0.** Sólo la lee el módulo de cobro, que
   no está montado, así que hoy no hace nada. Ponerla en cero es una línea, pero
   es de la pieza que monte el cobro y no de ésta. Dejé la nota en el `.env.example`.
6. **El vínculo no habilita cobrar.** Que un vendedor aparezca «conectado» no
   significa que se pueda pagar con tarjeta: eso no existe todavía. Si esto se
   le muestra a la clienta, que quede claro.

## 8. Lo que no hice

No monté `payments.py`, no lo refactoricé, no restauré el 5 %, no creé
preferencias, no cambié estados de órdenes ni stock, no agregué suscripciones,
custodia, 1:N, conciliación ni reembolsos. No hay una sola credencial real de
Mercado Pago en el repositorio ni en mi entorno: los valores locales son
inventados y apuntan a un doble que levanta la propia suite.

## 9. La evidencia

Diez casos nuevos en la suite —del 62 al 71— y uno modificado. Todos corren
contra un doble local de Mercado Pago (`scripts/lib/mp-doble.mjs`) que levanta
la propia prueba.

| # | Qué prueba |
|---|---|
| 62 | Vínculo completo: Fernet en la base, huella del state, respuesta sin credenciales, columnas en claro eliminadas |
| 63 | Callback repetido, alterado, sin sesión y de otra sesión: cuatro motivos, cero escrituras |
| 64 | Una cuenta de MP en dos vendedores: rechazo por API y por índice único |
| 65 | Renovación con rotación de las dos credenciales; revocación → «reconectar»; se sale reconectando |
| 66 | MP rechaza, contesta basura, contesta incompleto y no contesta: cuatro motivos, nada escrito, nada filtrado |
| 67 | `manual-link` no existe; tres rutas de cobro en 404; el esquema publica 5 rutas de vínculo y ninguna de pago |
| 68 | Sin configuración: `no_configurado`, vincular da 503, catálogo y productos siguen en 200 |
| 69 | Un state nacido vencido y un rechazo de MP: lo que registra la aplicación no tiene token, ni `client_secret`, ni el texto de MP |
| 70 | Recorrido del vendedor en escritorio y celular: desconectado → autorizar → conectado → desvinculado |
| 71 | Clave de cifrado rotada: «requiere_reconexion» con motivo propio, sin 500 |

Un detalle del 69, porque hace a lo que se puede afirmar: mido **lo que registra
la aplicación**, no lo que registra el arnés de prueba. El cliente de pruebas
escribe cada URL que pide, con el state adentro; eso es ruido de la medición y
no dice nada del producto. El caso informa cuántos registros ajenos dejó afuera.

También toqué `scripts/smoke.sh`: copia `.env.example` sobre `backend/.env`, así
que sin agregarle nada la integración quedaría apagada y los diez casos
fallarían en cualquier máquina que no sea la mía. Ahora escribe la
configuración del doble y **genera una clave Fernet nueva en cada corrida**.

### Una corrección sobre mi propia evidencia

Vengo informándote «`diff --check` limpio» todos los ciclos. **Lo estaba
corriendo después del commit**, con el árbol ya limpio: `git diff` vacío no
marca nada, así que la comprobación no comprobaba nada.

Corrido como corresponde —sobre los cambios sin commitear— marca 530 líneas, y
las 530 son el `CR` de fin de línea de los archivos CRLF, que es como está
buena parte de este repositorio desde antes de que yo llegara. No lo introduce
este cambio: `git show 2220e94 --check`, el contrato monetario que te informé
«limpio», marca 38 por exactamente lo mismo.

Lo que la comprobación busca de verdad sí está verificado y en cero: **ninguna**
línea agregada termina en espacio o tabulación, y **ningún** marcador de
conflicto. Los seis archivos nuevos tampoco tienen espacios al final.

No cambia ninguna conclusión técnica de los informes anteriores. Cambia el peso
de una línea de evidencia que te di nueve veces, y preferí decírtelo yo.

### Los inventarios no cambian, y es a propósito

No agregué recorridos permanentes: la sección de Mercado Pago vive **adentro**
de pantallas que los inventarios ya exigen —«panel del vendedor» en
accesibilidad, «perfil vendedor» en contraste—, así que se audita sola sin
sumar entradas. Los números siguen siendo 28 pantallas × 2 medidas = 56 en
accesibilidad y 20 × 2 = 40 en contraste. Que no cambien no es que no se mida:
es que ahora esas dos pantallas tienen adentro algo que antes no tenían, y por
eso aparecieron los tres colores del punto 4.

### El freno de la migración, probado

No alcanza con escribirlo. Lo corrí en una base aparte, `topgreen_freno`,
creada para esto y borrada después:

1. Base en la revisión anterior, con un usuario que tiene
   `mp_access_token = 'APP_USR-token-de-prueba-en-claro'`.
2. `alembic upgrade head` → **se detiene**: «Hay 1 usuario(s) con credenciales
   de Mercado Pago en claro… si alguna es real, avisale a esa persona que va a
   tener que revincular». Dice cuántos, no cuáles.
3. Consulto la fila: **el token sigue ahí**. El freno no borró nada.
4. `MP_MIGRACION_DESCARTAR_TOKENS=1 alembic upgrade head` → pasa, y las dos
   columnas en claro dejan de existir.

## 11. Los tres defectos que encontraste en `5aee032`

Los tres eran ciertos, los tres estaban en la parte que más importa —la que
protege credenciales ajenas— y ninguno lo había visto yo. Van arreglados de
raíz, no en el borde.

**1. El freno destructivo se abría con cualquier texto.** Escribí
`if not os.environ.get('MP_MIGRACION_DESCARTAR_TOKENS')`, o sea que `=0`,
`=false` o un dedazo autorizaban un borrado irreversible de credenciales de
terceros. Ahora es igualdad exacta con `1`. Probado con cinco valores que **no**
son uno —sin definir, vacía, `0`, `false`, `11`—: los cinco frenan, ninguno toca
la credencial y ninguno deja la migración a medias. Sólo con `1` avanza.

**2. Una clave Fernet mal formada podía terminar en 500.** Tu diagnóstico era
exacto, incluido que el caso 71 no lo discriminaba: usa otra clave *válida*, así
que sólo ejercita `NoSeDescifra` y nunca pasa por `SinClaveDeCifrado`.

Lo arreglé donde nace y no donde explota: `hay_clave()` ahora comprueba que la
clave **sirva**, no que esté escrita. Con eso `integracion_configurada()` dice
la verdad y las tres puertas fallan cerradas solas: estado `no_configurado`,
vincular `503`, renovar `200` con motivo. `refresh_token_de()` atrapa además
`SinClaveDeCifrado`, que es el cinturón después del tirante.

Una consecuencia que quiero que veas explícita: con la clave rota, un vendedor
que **estaba** vinculado pasa a ver «no disponible», no «reconectar». Es
correcto —el problema es de la plataforma, no de su cuenta, y reconectar no lo
arreglaría— pero es una diferencia de trato que conviene que esté decidida y no
que pase de casualidad.

**3. Cancelar no gastaba el `state`.** Volver cancelado es volver: ese intento
ya se usó. Ahora el `state` se consume apenas llega la vuelta, sea cual sea el
resultado, y antes de mirar si vino con error. Reusarlo después con un código
bueno devuelve `estado_invalido` y no escribe una sola credencial.

Y se fueron los dos helpers JWT muertos de `core/security.py`. Tenías razón en
el fondo del planteo: dejar una segunda implementación del `state`, aunque no
la llame nadie, contradice la propiedad que la pieza afirma.

### Dos cosas del arnés, que no son del producto

- **`pedirCrudo` no tenía el reintento de socket** que sí tiene `apiRequest`.
  Con un guion que tarda diez segundos, el servidor cierra la conexión ociosa y
  el pedido siguiente muere sin haber llegado. Mismo reintento, acotado a
  errores de socket: cualquier HTTP pasa derecho.
- **`correrAlembic` no sabía pasar variables de entorno**, que es justo lo que
  el caso 74 necesita. Ahora viajan con `-e`, como en `docker exec`, y también
  en el entorno del proceso para que funcione con la API nativa.

### Y un pozo que me hice solo

El caso 69 y el 71 fallaron una corrida entera con «Mercado Pago no respondió»
teniendo el doble arriba. La causa: `execFileSync` bloquea el hilo de Node, y el
doble vive en **ese mismo proceso**. Mientras el guion corría, el doble no
llegaba a atender la conexión que el propio guion le abría. Lo anoto porque es
la clase de falla que se lee como problema del producto y no lo es.

## 12. Estado de las puertas

Todo lo que sigue está medido **sobre el código que estás leyendo**, después
del último cambio, con la base recreada y sembrada desde cero.

| Puerta | Resultado |
|---|---|
| Suite completa (`node scripts/smoke.mjs`) | **74/74**, cero fallas |
| `npm run hito` | **6/6** pasos encadenados |
| Accesibilidad (`npm run a11y`) | **56/56** pantallas, cero violaciones bloqueantes |
| Contraste (`npm run contraste`) | **40/40** mediciones, cero textos por debajo del mínimo |
| `npm run build` | verde |
| Sintaxis Python | verde |
| Migración ida y vuelta + `alembic check` | verde, dentro de la suite (caso 55) |
| Freno de la migración | probado con cinco valores que no son «1» (caso 74) |
| Espacios al final de línea agregados / marcadores de conflicto | cero / cero |

**Aritmética de los inventarios.** No agregué recorridos permanentes: la sección
de Mercado Pago vive adentro de pantallas que los inventarios ya exigían
—«panel del vendedor» en accesibilidad, «perfil vendedor» en contraste—, así que
se audita sola sin sumar entradas. Accesibilidad: 28 pantallas × 2 medidas = 56.
Contraste: 20 pantallas × 2 medidas = 40. Los dos números son los mismos de
antes de esta pieza, y eso es lo correcto: lo que cambió es que esas dos
pantallas ahora tienen adentro algo que antes no tenían. Por eso aparecieron los
cuatro colores.

La suite pasó de 61 a **74 casos**: trece nuevos (62 a 74) y uno modificado, el
20, que exigía 404 en el vínculo cuando el vínculo no existía.

### Sobre los colores: van cuatro

Todos de la misma sección y por la misma razón: estuvo fuera del árbol desde
antes de que existieran las puertas de accesibilidad y contraste, así que
ninguno de sus colores se había medido nunca. El último es el encabezado —blanco
sobre `#0ea5e9`, 2,77:1— y lo resolví con el azul que la propia sección ya usaba
en su botón (5,93:1 y 7,56:1 en los extremos del degradado): no agregué paleta
ni cambié el aspecto.

Vale la pena que quede anotado: **axe no encuentra ninguno de los cuatro**. No
resuelve gradientes, así que los reporta como «incompletos» y sigue. Los cuatro
los cazó `contraste.mjs`, que es exactamente para lo que existe.

### Una corrida roja que no fue del producto

Antes de la corrida buena hubo una con cuatro rojos, y la explico porque queda
en los logs. La API y Vite se cayeron a mitad de camino —los verifiqué después,
los dos en `000`—: eso volteó el caso 70, que se quedó sin navegador, y el 71,
que no pudo hablar con la API. Los casos 72 y 73 murieron en cascada con
`EADDRINUSE`, y ahí sí había una fragilidad mía: en el `finally`, desvincular
iba antes de cerrar el doble local, así que una limpieza fallida dejaba el
puerto tomado y hundía al caso siguiente por un problema ajeno. Ahora el doble
se cierra primero y siempre; la limpieza de datos va después y no puede tumbar
nada.
