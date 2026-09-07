# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## BRAND-AGROBOEDA-1 — la identidad pública deja de ser TopGreen

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto/regresión: `f0913a7` — «BRAND-AGROBOEDA-1: la identidad publica
  pasa a AgroBoeda»
- La suite pasa a **156 casos**.

---

### 1. El inventario, antes de tocar nada

`rg` sobre todo el repositorio, sin `docs/`, `node_modules/` ni `dist/`:

```
Producto (src, backend/app, index.html, plantillas de entorno)
  TopGreen mayúscula                    67 apariciones en 30 archivos
  topgreen minúscula                    17 apariciones, todas identificadoras

Fuera de producto
  scripts/                              arnés, contenedores y prefijos temporales
  infra/, docker-compose.yml            red, servicios y volúmenes locales
  README.md, README_LOCAL_SETUP.md,     documentación operativa
    RAILWAY.md, DELIVERY_CHECKLIST.md
  prototypes/                           una maqueta suelta, no es producto
```

La clasificación completa está en el punto 6.

### 2. El rojo, contra `b5ee28d`

```
[FAIL] 156 … — 70 apariciones del nombre viejo sin clasificar:
  src/components/Auth/RegisterModal.tsx:529 dice el nombre viejo: Es tu
    declaración. TopGreen no la verifica y guarda la fecha en que la hacés.
  src/components/Checkout/CheckoutModal.tsx:580 … TopGreen no verifica esta
    habilitación.
  src/components/Footer/Footer.tsx:28 aparición técnica no declarada:
    src="/marca/topgreen-mono-light.svg"
  src/components/Footer/Footer.tsx:45 dice el nombre viejo:
    <div className={styles.titulo}>TopGreen</div>
  …
```

Setenta. El caso las cuenta y muestra las primeras ocho con archivo y línea,
que es lo que hace falta para arreglarlas.

### 3. Los derivados del logo

La fuente **no se tocó**: sigue en `docs/pm/originales/AGROBOEDA-LOGO-FUENTE.png`
con su SHA-256 intacto. Los derivados salen de un script versionado
—`scripts/derivar_marca.py`— que sólo **recorta margen y promedia píxeles**: no
redibuja, no vectoriza, no recolorea, no genera y no inventa transparencia.
Existe para que la derivación sea auditable y repetible, y verifica el SHA de la
fuente antes de leerla.

```
fuente        1536x1024, fondo #08281E (contado, no elegido)
monograma AB  x 195..1333, y 180..811 = 1138x631

public/marca/agroboeda-monograma.png  320x197  margen 8 %
public/marca/agroboeda-favicon.png     64x64   margen 4 % + encuadre
```

Dos, y no más:

- **`agroboeda-monograma.png`** — recorte con 8 % de margen, reducido. Conserva
  la proporción del recorte. Va en cabecera y pie.
- **`agroboeda-favicon.png`** — recorte más ajustado (4 %) y **encuadrado con el
  mismo fondo opaco de la fuente**, porque un favicon apaisado lo encoge el
  navegador hasta que no se lee. Rellenar con el color que el archivo ya tiene
  no es fingir transparencia ni inventar un color: es extender su propio fondo.

`python3 scripts/derivar_marca.py --verificar` no escribe: lee la fuente, mide y
dice qué SHA-256 tendría que tener cada derivado. Corrido contra los archivos
que están en el commit, coinciden — los tenés enteros en el punto 10.

Retiré los cuatro SVG de la marca vieja y `topG.png`, que ya no los referencia
nadie.

### 4. Dónde se ve ahora

**Cabecera y pie**: el monograma como placa opaca —con su propio verde, que no
es el de la banda— más **`AgroBoeda` escrito al lado**. La imagen va con `alt`
vacío a propósito: al lado del nombre es decorativa, y con texto alternativo el
botón se llamaría «AgroBoeda AgroBoeda». El nombre accesible del control es
«AgroBoeda», una sola vez.

**`index.html`**: título, descripción, `favicon`, `apple-touch-icon` y los
metadatos sociales —`og:` y `twitter:`—. No inventé dominio ni URL absoluta: se
declara el nombre, el texto y una imagen que existe en este mismo sitio.

**Lo emitido**: el asunto y el cuerpo del correo de verificación, la firma, la
notificación de bienvenida, el nombre del administrador sembrado
—`Administrador AgroBoeda`— y el remitente visible de las plantillas de entorno.

### 5. Un cambio de comportamiento que tu texto pedía y que hay que mirar

Pediste que cabecera y pie «**enlacen a Inicio**», y en el resultado 4 decís que
eso «debe **seguir** funcionando». **No funcionaba**: la marca llevaba al
Mercado, no a Inicio. Lo cambié, porque el pedido es explícito y porque el
comentario del propio Header decía por qué era así — «hasta ahora la única forma
de volver al catálogo era hacer clic en la marca», de cuando «Mercado» no estaba
en la barra. Ahora ese destino tiene su celda, así que la marca hace lo que hace
en cualquier sitio.

Es un cambio de navegación adentro de una pieza de marca. **Si el destino viejo
era una decisión y no una herencia, decímelo y lo devuelvo en una línea.** Dos
ayudantes del arnés que usaban la marca para llegar al catálogo ahora usan el
destino «Mercado».

### 6. La clasificación, entera

**Se migró** (visible o emitido): 67 apariciones en 30 archivos de `src/`,
`backend/app/`, `index.html` y las tres plantillas de entorno.

**Se conserva** (técnico), y el caso 156 lo exige presente:

```
no-responder@topgreen.local          remitente heredado, no hay dominio nuevo
admin@topgreen.com                   credencial de ingreso demo
demo.topgreen.admin / .juanv         referencias externas de Mercado Pago
topgreen-  (cobro, mp_preferencia)   claves de idempotencia y referencia externa
topgreen/  (storage)                 carpeta de los archivos ya subidos
info@topgreen.com.ar                 dirección operativa real (deuda, punto 8)
video-topgreen.mp4                   ruta de un activo ya servido
service_topgreen                     identificador de la plantilla de EmailJS
DB_NAME / DB_USER / DATABASE_URL     base, usuario y cadena de conexión
```

**Fuera de producto y sin tocar**: `scripts/` (contenedores `topgreen-db` y
`topgreen-api`, prefijos temporales, credenciales del arnés), `infra/` y
`docker-compose.yml` (red y volúmenes), los cuatro README/RAILWAY/CHECKLIST
(documentación operativa) y `prototypes/` (una maqueta). Ninguno es superficie
de una persona; renombrarlos sería la migración operativa que todavía no
autorizaste.

En el arnés sí cambié los textos y localizadores que nombraban la marca —el
botón de la cabecera, el reclamo prohibido de la portada, la paridad del caso
128 y el nombre del servicio en `/health`—, porque si no la regresión seguiría
midiendo el nombre viejo.

### 7. El caso 156

Mide los dos lados, y con la lista de permitidas en la mano:

- recorre **los archivos de producto** y falla si aparece el nombre viejo o si
  aparece una minúscula que no esté declarada; y falla **también** si una
  declarada desapareció, que es la otra forma de romper esto;
- `index.html` declara título, favicon y metadatos, y **cada archivo de marca al
  que apunta existe**;
- el seed dice `Administrador AgroBoeda` y su credencial sigue entrando, con el
  mismo correo y el mismo rol;
- da de alta una cuenta de verdad y lee **el correo del outbox**: dice AgroBoeda,
  conserva el destinatario y conserva el enlace de verificación; después
  confirma, entra y lee la **notificación de bienvenida** real;
- en 1440 × 900, 768 × 1024 y 390 × 844: el monograma dibujado de verdad
  —`naturalWidth`, no «está en el DOM»—, el nombre escrito al lado, el control
  llamado «AgroBoeda» una sola vez, **el foco visible llegando con el teclado** y
  Enter llevando a Inicio, sin desborde; y ni la barra, ni el pie, ni las cuatro
  públicas, ni Ingresar, ni Registro con la ampliación abierta dicen el nombre
  viejo;
- los paneles de vendedor y de administración tampoco.

Nueve capturas —cabecera, pie y registro por medida— **fuera de Git**:

```
/tmp/topgreen-marca-NRP1cS/
  cabecera-1440x900.png   cabecera-768x1024.png   cabecera-390x844.png
  pie-1440x900.png        pie-768x1024.png        pie-390x844.png
  registro-1440x900.png   registro-768x1024.png   registro-390x844.png
```

El destino por omisión es un temporal nuevo por corrida —`mkdtemp`—, y se puede
fijar con `SMOKE_CAPTURAS`. Es la lección del caso 154: una prueba no escribe
sobre archivos versionados.

### 8. Deuda operativa, enumerada como pediste

1. **`info@topgreen.com.ar`** sigue a la vista en el pie y en Contacto. Es la
   dirección real y no inventé una cuenta que no existe. Mientras siga ahí, el
   sitio dice AgroBoeda y ofrece escribir a topgreen.
2. **`no-responder@topgreen.local`** es el remitente técnico del correo. El
   nombre visible ya es AgroBoeda; la casilla espera un dominio propio.
3. **`service_topgreen`** es el identificador de la plantilla de EmailJS: se
   renombra en EmailJS, no acá.
4. **`TopGreen Agro Argentina`**, la aplicación externa de Mercado Pago, queda
   como está hasta que autorices la migración operativa.
5. Contenedores, base, red y servicio de Railway conservan el nombre viejo. No
   son marca, pero quien abra la consola los va a ver.

### 9. Puertas

```
base limpia + SMOKE_CASOS=156                   1/1
base limpia + suite completa                    155/156 (rojo: 131)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
npx tsc --noEmit                                ok
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
npm run contraste                               ok (52 mediciones, 0 por debajo)
npm run a11y -- --todas                         ok (64 pantallas, 0 serious/critical,
                                                    0 minor/moderate)
git -c core.whitespace=cr-at-eol diff --check   limpio
```

`compileall` y `pip check` corresponden porque toqué Backend: los textos
emitidos —correo, notificación, seed, nombre del servicio— viven ahí.

El **131** es el ambiental de siempre: mi entorno no tiene demonio de Docker.
**156/156 es lo que tiene que dar en tu máquina.**

### 10. Hashes

```
index.html                                  dba6ff8eeeacb2ee
src/components/Header/Header.tsx            a1cf309bd65be859
src/components/Header/Header.module.css     76ac63057cf81dbd
src/components/Footer/Footer.tsx            a6ae343f3df7d87f
src/components/Footer/Footer.module.css     a1e272c9d3343d47
backend/app/seed.py                         265301c2e3d0ae0e
backend/app/services/verificacion.py        aa915710cb614007
scripts/derivar_marca.py                    706ab8834a7bde14
scripts/smoke.mjs                           d85430b9d3b93e89
```

Los tres archivos de imagen, completos —la fuente primero, para que se vea que
no la toqué—:

```
docs/pm/originales/AGROBOEDA-LOGO-FUENTE.png
  5606077c429b20edecb62986d6b7500c7142c6a6230c006fdfb33c4978b206cf
public/marca/agroboeda-monograma.png
  697178b4873dc7fe9dbccf4fae19ab2517e6a3354df240656f569ac4a50558e2
public/marca/agroboeda-favicon.png
  1e1da0e55abf72cdd99aedd3882d67bf649ae1603807ef6d0d7b5bcf7237b96f
```

(SHA-256 truncado a 16 en el primer bloque; completo en el segundo.)

### 11. Riesgos residuales

1. **El monograma es opaco y su verde no es el de la banda.** Se presenta como
   placa a propósito: la alternativa era recortar el fondo y dejar halos, que la
   identidad prohíbe. Si querés que se funda con la banda, hace falta una fuente
   con transparencia, no un retoque mío.
2. **El favicon está encuadrado con relleno del propio fondo.** Es la única
   operación que agrega píxeles en vez de sacarlos, y la hice porque un favicon
   apaisado se vuelve ilegible. Está en el script y se puede revertir.
3. **La suite no mide `docs/`, `scripts/` ni `infra/`.** Si mañana alguien
   escribe el nombre viejo en un README, nada lo va a frenar.
4. **`backend/.env` es estado local y no se versiona.** Si el tuyo quedó de
   antes, el correo va a salir con el remitente viejo aunque el producto esté
   bien: el caso lo detecta y te dice exactamente eso en vez de un rojo mudo.
5. Sigue en pie lo del informe anterior: el copy del Login —`Iniciar Sesión`,
   `¿No tienes cuenta?`, `Regístrate aquí`— espera tu decisión sobre
   `COPY-CLEAR-1`.

### 12. Frenos

No rediseñé páginas ni paleta, no toqué copy ajeno a la marca y no creé la
cuenta `pruba@agroboeda.com` —eso es `DEMO-USER-1`—. No desplegué, no corrí seed
contra Railway, no cambié datos remotos, pagos, secretos ni la aplicación externa
de Mercado Pago. No toqué la fuente en `docs/pm/originales/`. `PRE_FIRMA.md`
sigue fuera del versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión: sobre todo el punto 5, que es un cambio de
navegación, y la fidelidad del monograma.
