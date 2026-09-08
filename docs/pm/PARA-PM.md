# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## LOGO-INTEGRATION-1 — el monograma se apoya en la banda

**Resultado: terminado.** La fuente raster sí permitió un recorte limpio, así
que no hubo que frenar.

- Producto/regresión: `d252a0c`
- La suite pasa a **159 casos**.
- **No desplegué, no toqué Railway, datos remotos, pagos ni secretos.** No
  cambié favicon, metadatos, paleta ni texto.

---

### 1. El archivo nuevo

```
public/marca/agroboeda-monograma-alfa.png   320x197  RGBA
sha256 837bb0feb7b2531694c605e2885931c3bc58c0e6033add133e1118d468c70958
```

Mide lo mismo que el opaco —320×197— a propósito: la caja que Header y Footer
ya reservaban es exactamente la misma, y las alturas renderizadas siguen siendo
40 px en escritorio y tablet, 30 en celular y 44 en el pie. El nombre del
archivo dice `alfa` para que ninguna caché vieja lo confunda con el otro.

Lo que **no** cambió, y lo verifica el caso:

```
docs/pm/originales/AGROBOEDA-LOGO-FUENTE.png  5606077c429b…  intacta
public/marca/agroboeda-favicon.png            1e1da0e55abf…  intacto
public/marca/agroboeda-monograma.png          697178b4873d…  intacto
```

El opaco sigue siendo la imagen social de `index.html`, como dijiste.

### 2. Cómo se separó el fondo, y por qué no alcanzaba con borrar un color

`derivar_marca.py` no borra el verde: **resuelve la mezcla**. Cada píxel del
borde de la fuente es el glifo dibujado sobre un fondo opaco conocido,
`p = a·F + (1−a)·fondo`. Con el fondo medido y los dos colores del glifo también
medidos, el alfa sale de proyectar el píxel sobre la recta fondo→glifo, y el
color limpio sale de **despejar `F`**.

Ese despeje es la descontaminación. Sin él, el semitransparente conserva el
verde oscuro del original y sobre otra banda se ve como halo —y transparencia
con halo, como escribiste, sigue pareciendo un recorte pegado—.

Dos cosas que sin medir salen mal, y que están en el commit:

- **El grano del fondo.** La fuente no tiene un fondo plano perfecto: la
  compresión le dejó grano, y ese grano da un alfa chico pero distinto de cero
  en *todo* el fondo. El piso se **mide** sobre el marco exterior —que es fondo
  y nada más— y dio `0,0190`; se descuenta y lo que queda se reestira. Sin eso,
  el PNG sale con un velo verde en vez de con fondo transparente.
- **El reescalado.** Promedia en alfa **premultiplicado**. Promediar color y
  alfa por separado mezcla el color de los píxeles invisibles con el de los
  visibles, y eso vuelve a manchar el borde después de haberlo limpiado.

El script sigue **sin dependencias**: lee y escribe PNG con la biblioteca
estándar, y el caso comprueba que todos sus `import` sigan siendo de ahí.

### 3. El rojo, contra `1c3aecc`, en dos pasos

```
1. tal cual está 1c3aecc
   [FAIL] 159 … — la derivación no informa agroboeda-monograma-alfa.png
2. con el archivo nuevo ya derivado, pero Header y Footer todavía apuntando al opaco
   [FAIL] 159 … — src/components/Header/Header.tsx no usa /marca/agroboeda-monograma-alfa.png
```

Y la medición que explica la pieza entera, hecha con la misma cuenta del caso
sobre la misma caja de 65×40 de la cabecera:

| | píxeles más oscuros que la banda | peor caída de luminancia | píxeles del marco distintos de la banda |
|---|---|---|---|
| monograma opaco | **1510** de 2600 | 32 | **404** de 404 |
| monograma nuevo | **0** | 0 | **0** |

Eso es la placa, medida. Todo el glifo es marfil y lima, más claro que el fondo
del sitio: cualquier placa y cualquier halo son, por definición, más oscuros que
la banda. Por eso el caso puede exigir **cero**.

### 4. El verde

```
[PASS] 159 … archivo 320x197: 62% transparente, 34% opaco, 1652 píxeles de
borde y ninguno contaminado; escritorio 1440x900/cabecera: 65x40 sobre rgb(30,
74, 52), 0 píxeles más oscuros que la banda; escritorio 1440x900/pie: 71x44 …;
tablet 768x1024/cabecera: 65x40 …; tablet 768x1024/pie: 71x44 …; movil
390x844/cabecera: 49x30 …; movil 390x844/pie: 71x44 …. La marca conserva su
único nombre accesible, la imagen sigue siendo decorativa, el foco se ve, Enter
lleva a Inicio y ninguna medida desborda
```

Y el **156 sigue verde**: la identidad, el nombre accesible y el recorrido no se
movieron.

### 5. Las seis capturas

En `/tmp/cap159`, fuera de Git:

```
159-cabecera-1440x900.png   159-pie-1440x900.png
159-cabecera-768x1024.png   159-pie-768x1024.png
159-cabecera-390x844.png    159-pie-390x844.png
```

El caso las escribe en una carpeta temporal única salvo que se le pase
`SMOKE_CAPTURAS`, así que reproducirlo no ensucia el árbol.

### 6. Lo que corrí y lo que no

```
SMOKE_CASOS=159 contra 1c3aecc                  rojo, en dos pasos
SMOKE_CASOS=156,159                             2/2
npm run build                                   verde
npm run lint                                    verde, 0 avisos
node --check scripts/smoke.mjs                  verde
python3 scripts/derivar_marca.py --verificar    verde, sin escribir
git -c core.whitespace=cr-at-eol diff --check   limpio
```

No corrí suite completa, contraste, a11y total ni Backend, como pediste.

### 7. Dos cosas que quiero que sepas antes de aceptar

- **Quité del CSS el borde redondeado y el relleno verde del monograma.** Eran
  la presentación de la placa: la esquina redondeada ya no tiene qué redondear y
  el relleno pintaba un rectángulo del color de la banda detrás de un glifo que
  ahora es transparente. No cambian tamaño ni alineación —el alto sale de
  `.marca img` y de las medidas declaradas en la etiqueta— y no agregué borde,
  sombra, filtro ni `mix-blend-mode`. Si preferís que vuelvan, se revierten en
  dos líneas, pero dejarlos sería documentar una caja que ya no está.
- **El monograma transparente es para fondo oscuro.** Sobre blanco, la «A»
  marfil casi desaparece: es el color que tiene en el original, no algo que haya
  hecho la separación. Hoy no importa —Header y Footer son la banda verde y el
  social sigue siendo el opaco—, pero si alguna vez se usa sobre una superficie
  clara, hay que usar el opaco o pedir una variante a la clienta. Lo dejo dicho
  para que no se descubra en producción.

### 8. Deuda que sigue abierta, sin tocar

El token global `--tg-color-focus` sigue valiendo `#1e4a34`, el mismo color que
`--tg-color-brand`. Cualquier superficie nueva pintada con el verde de marca va
a nacer con el foco invisible. Está anotado desde `FOOTER-FOCUS-1`.

---

## DECISIÓN SOLICITADA — la cuenta de prueba en el sitio publicado

Emi quiere entrar con `pruba@agroboeda.com` **en la página, no en local**. Antes
de nada, tres hechos medidos, porque el pedido tiene una premisa que no se
cumple sola:

1. **La cuenta ya está en el repositorio.** Está en `main` desde `53a9635`, en
   el seed y en las siete guías. Subir algo más no agrega nada por ese lado.
2. **Desplegar no la crea.** El servicio corre `alembic upgrade head` y el seed
   no se ejecuta solo (`RAILWAY.md:74`). Y si alguien lo corriera a mano, con
   `ENV=production` termina con estado 2 sin abrir la base (`RAILWAY.md:81-95`).
3. **Un cambio en el seed ni siquiera redespliega.** Los `watchPatterns` de
   `railway.toml` son `src/**`, `public/**`, `index.html`, los configs del build
   y el Dockerfile. `backend/**` no está.

Para que exista en el sitio hay que **crear esa fila en la base remota**. Eso es
producción y no lo hago desde acá.

### La objeción, antes de la operación

El candado de `ENV=local` no es burocracia: existe porque estas credenciales
están escritas en el repositorio. Poner `pruba@agroboeda.com` / `@agroboeda` en
el sitio publicado es, literalmente, **publicar un acceso**: cualquiera que lea
el repositorio entra. Con rol `user` el alcance es acotado —no ve
administración— pero puede publicar en el Mercado, comprar y aparecer como
vendedor ante otras personas.

**Recomendación: en el remoto, otra contraseña.** El correo y el nombre visible
quedan iguales, así que el recorrido de Emi es el mismo; lo único que cambia es
que la clave no está escrita en ningún archivo público. La clave local sigue
siendo `@agroboeda` porque ahí la base es descartable.

Alternativa, si Emi prefiere la clave tal cual: que la cuenta viva sólo mientras
dure la demostración y se borre después, con fecha puesta.

### La operación, lista para quien tenga producción

Va limitada a esa cuenta. **No abre el seed, no relaja el candado de `ENV`, no
agrega variable de escape, endpoint ni alta automática**, y es idempotente: si
la cuenta ya está, no la toca. Se corre en el servicio desplegado, donde vive la
aplicación y su `DATABASE_URL`:

```python
# CLAVE_DEMO='<la que decidan>' python -
import os
from app.db.base import SessionLocal
from app.models.user import User, UserRole
from app.core.security import hash_password

db = SessionLocal()
try:
    ya = db.query(User).filter(User.email == 'pruba@agroboeda.com').first()
    if ya:
        print('ya existe, no se toca:', ya.email, ya.role)
    else:
        db.add(User(
            email='pruba@agroboeda.com',
            password_hash=hash_password(os.environ['CLAVE_DEMO']),
            full_name='Prueba AgroBoeda',
            role=UserRole.USER,
            is_active=True,
            is_verified=True,
            is_carrier=False,
        ))
        db.commit()
        print('creada pruba@agroboeda.com con rol user')
finally:
    db.close()
```

La clave entra por variable de entorno y no por el archivo, así que si eligen
una distinta no queda escrita en ningún lado del repositorio.

### Qué necesito

Autorización de Emi y una pieza tuya que diga: qué contraseña va en el remoto,
si la cuenta se borra después de la demostración y quién corre la operación.
**Yo no la corro**: `CLAUDE.md` dice que desde el desarrollo no se despliega y
que producción no es nuestra, y el contrato de la cuenta pide autorización y una
operación separada.

### Nota sobre el logo, para que no te sorprenda

A pedido de Emi integré `LOGO-INTEGRATION-1` a `main` (`712f98b`) para que la
página publicada muestre el monograma sin la placa. **Tu revisión sigue
pendiente**: la integración no la reemplaza, y si devolvés la pieza se corrige
como cualquier otra. Lo aviso porque esta vez la integración no salió de una
devolución tuya.

Y algo que recién veo con el `railway.toml` delante: como `src/**` y `public/**`
están en los `watchPatterns`, **toda integración a `main` que toque el frontend
dispara un redespliegue**. Las tres anteriores lo hicieron. No fue una decisión
de desplegar —eran integraciones que pediste— pero el efecto es ese y prefiero
que esté escrito.
