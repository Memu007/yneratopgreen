# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## DEMO-USER-1 — la cuenta de prueba de Emi

Hecho. Producto/regresión e informe en commits separados. **No desplegué y no
corrí el seed contra Railway.**

- Producto/regresión: `53a9635` — «DEMO-USER-1: la cuenta de prueba entra,
  publica y sobrevive al seed»
- La suite pasa a **157 casos**.

---

### 1. Alcance: qué toqué y qué no

```
backend/app/seed.py            la cuenta, y el resumen de credenciales
scripts/smoke.mjs              caso 157 + la lista de credenciales del 132
scripts/entorno_nativo.sh      el cartel de cuentas del entorno local
scripts/init_local_db.sh       ídem, camino Docker
scripts/init_local_db.ps1      ídem, camino Docker en Windows
README.md                      tabla de credenciales demo
README_LOCAL_SETUP.md          tabla de datos de prueba
```

No toqué el modelo, ni las migraciones, ni la autenticación, ni el alta, ni el
catálogo. **No hay migración, ni endpoint, ni alta automática al arrancar, ni
variable de escape.** La cuenta entra por donde ya entraban las otras cuatro.

### 2. El rojo, contra `d63158c`

Con el `seed.py` de `d63158c` —el resto del árbol igual, base local recreada—:

```
[FAIL] 157 La cuenta de prueba entra, publica y sobrevive a un segundo seed —
  el seed dejó 0 filas para pruba@agroboeda.com y tiene que dejar exactamente una
0/1 pasaron; 1 fallaron
```

Falla donde tiene que fallar: en la primera lectura, porque la cuenta no
existe. No es un rojo de pantalla ni de locator.

### 3. La cuenta: qué es, y sobre todo qué no

```
correo      pruba@agroboeda.com      la grafía es la que entregó Emi
clave       @agroboeda               guardada con bcrypt, nunca en claro
nombre      Prueba AgroBoeda
rol         user                     no admin, no transportista
estado      activa y verificada
```

Verificada **desde el seed** y no por un atajo del producto: el correo no
existe, así que sin eso el ingreso se traba en una confirmación que no va a
llegar nunca. Es exactamente lo que ya hacen las otras cuatro cuentas demo.

Y arranca vacía. No le puse teléfono, ni ubicación, ni biografía, ni CBU, ni
alias, ni vínculo de Mercado Pago: **ni un dato de más**. Lo único que tiene es
lo que hace falta para entrar.

### 4. El seed repetido

La rama de creación es `if not prueba:` y **no hay `else` que escriba**: cuando
la cuenta está, el seed imprime que está y sigue de largo. No repone la clave,
no reacomoda el rol, no completa campos vacíos —que es lo que sí hace, a
propósito, con el transportista demo— y no borra nada.

El caso lo mide de la única forma que vale: publica algo con la cuenta, corre
el seed **de verdad** —el mismo `python -m app.seed`— y después compara los 17
campos uno por uno y busca la publicación por su id.

```
antes  → recorrido real: entra, publica, la ve en su cuenta y en el Mercado
seed   → «Cuenta de prueba ya existe, no se toca»
después→ 17/17 campos idénticos, la publicación intacta y el ingreso funciona
```

Si algún día alguien le agrega un `else` que "arregla" la cuenta, el caso dice
qué campo se movió, con el valor de antes y el de después.

### 5. El caso 157

Ocho tramos, todos por rutas reales:

- **la fila**: una sola, con el correo tal cual —normalizado, sin espacios—,
  nombre, rol `user`, activa, verificada, no transportista, y la clave con la
  forma de bcrypt y distinta del texto plano;
- **arranca limpia**: sin CBU, alias, ni ninguna de las cinco columnas de
  Mercado Pago; sin publicaciones, órdenes, calificaciones, documentación ni
  ítems en el carrito. Todo **preguntado por esta cuenta**, nunca por un total
  del seed: un conteo fijo lo rompe cualquier caso que corra antes;
- **la clave que tiene Emi es la que entra**: `/auth/login` con las credenciales
  exactas y `/auth/me` diciendo `user`;
- **no tiene permisos de más**: no basta con que no aparezca el botón, así que
  el caso le pide `/admin/users` y exige **403**;
- **entra por el formulario real** —no inyectando el token—, y la barra no le
  muestra un solo control de administración;
- **publica**: abre Vender, completa el alta mínima y el caso mira **la
  respuesta del POST**, no el cartel de la pantalla, que lo podría pintar
  cualquiera. La fila queda con su `seller_id`;
- **la ve como propia** en Mis publicaciones, y **cualquiera la encuentra** en
  el Mercado buscándola por un título único de la corrida —no se depende del
  orden del catálogo—;
- **el segundo seed no la pisa**: los 17 campos idénticos uno por uno, la
  publicación intacta y el ingreso funcionando después; y `ENV=production`
  sigue saliendo con 2 sin abrir conexión.

Categoría y localidad salen de la base, no de una constante: el caso se para
solo aunque cambie el catálogo.

### 6. Lo que declaro

**Un control que extendí.** El caso 132 —el freno de entorno de `SEC-4`—
comprobaba que el mensaje de rechazo no nombrara **ocho** credenciales demo.
Ahora hay diez: le agregué `pruba@agroboeda.com` y `@agroboeda`. Sin eso el
control seguía verde mientras dejaba de cubrir la credencial nueva.

**Un detalle del esquema que me costó dos corridas y conviene que quede
escrito.** La columna `users.role` guarda el **nombre** del enum —`USER`— y la
API devuelve su **valor** —`user`—. Mi primera aserción comparaba contra `user`
en SQL y salía roja con la cuenta bien creada. Ahora compara sin distinguir
mayúsculas y el comentario dice por qué: lo que se afirma es que el rol no es
el de administración, no la forma en que Postgres lo almacena.

**Y una del arnés.** Al volver del alta, la publicación recién creada está
dibujada dos veces: en el panel y en el catálogo de atrás. Buscar el título en
la página entera encontraba dos y además no probaba nada sobre «Mis
publicaciones». El caso ahora busca **dentro del panel**, por su rol y su
nombre accesible.

### 7. Puertas

```
base limpia + SMOKE_CASOS=157                   1/1
base limpia + SMOKE_CASOS=41,132,133            3/3
base limpia + suite completa                    156/157 (rojo: 131)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
npx tsc --noEmit                                ok
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
```

No corrí `contraste` ni `a11y`: no toqué una sola línea de interfaz, así que no
agregan señal. Lo dijiste vos y coincido.

El **131** es el ambiental de siempre: mi entorno no tiene demonio de Docker.
**157/157 es lo que tiene que dar en tu máquina.**

### 8. Hashes

```
backend/app/seed.py              a69e8ce189e4b7ac
scripts/smoke.mjs                44bd6f2ea990b08d
scripts/entorno_nativo.sh        d7ce9ab8a2cef00b
scripts/init_local_db.sh         bbc30e2b218fd969
scripts/init_local_db.ps1        5e5f05e290b3e86c
README.md                        15343aa9fef55053
README_LOCAL_SETUP.md            9a60056f10b1d33c
```

(SHA-256 truncado a 16.)

### 9. Riesgos residuales

1. **La credencial es pública y está escrita en el repositorio.** Es lo que
   pediste y es lo que ya pasa con las otras cuatro, pero conviene decirlo con
   todas las letras: `pruba@agroboeda.com` / `@agroboeda` sirve para cualquiera
   que tenga el código. Por eso el seed sigue corriendo sólo con `ENV=local` y
   por eso las cuatro listas del setup ahora lo dicen al lado de la tabla.
2. **Llevarla a Railway es otra operación y no está hecha.** No corrí el seed
   contra el entorno remoto, no cambié datos remotos y no autorizo yo esa
   migración: es una decisión tuya y de Emi, limitada a esa cuenta.
3. **La cuenta acumula lo que Emi haga.** Es idempotente, no es reversible: el
   seed no le borra publicaciones ni órdenes, así que la base local se va a ir
   ensuciando con las pruebas. Se limpia recreando la base, no volviendo a
   sembrar.
4. **`pruba` es una errata deliberada.** Si algún día alguien la "corrige", la
   clave de ingreso de Emi deja de funcionar y el caso 157 se pone rojo. Eso es
   exactamente lo que tiene que pasar, pero que quede escrito.
5. Sigue en pie: `FOOTER-FOCUS-1` —el anillo de foco del pie— y la decisión
   pendiente sobre el copy del Login, `COPY-CLEAR-1`.

### 10. Frenos

No mezclé `FOOTER-FOCUS-1`. No desplegué, no corrí seed contra Railway, no
cambié datos remotos, pagos, secretos ni la configuración externa de Mercado
Pago. No agregué endpoint administrativo, migración, auto-seed de arranque ni
variable de escape. No toqué la fuente en `docs/pm/originales/`. `PRE_FIRMA.md`
sigue fuera del versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
