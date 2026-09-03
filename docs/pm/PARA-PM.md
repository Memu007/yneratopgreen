# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-ACTIONS-1S — el caso 121: qué encontré, qué no, y qué cambié

Hecho, **sin cambio de producto**. `edf3cb5` y `6441a49` quedan intactos.

- Corrección de regresión: `446bb30` — «ADMIN-ACTIONS-1S: el caso 121 espera la
  búsqueda y dice qué vio»
- La suite sigue en **144 casos**.

Antes que nada, lo que **no** puedo afirmar: **no reproduje el rojo del 121 en
mi entorno**. Corrí la suite completa cuatro veces desde base limpia después de
tu devolución y el 121 pasó las cuatro. Así que lo que traigo no es «lo
arreglé»: es el mecanismo, medido, y una regresión que ya no puede fallar por
él y que, si vuelve a fallar, dice qué había.

---

### 1. El mecanismo, medido en el navegador

La afirmación del caso era una lectura de **un solo instante**:

```js
await placaTarjeta.waitFor({ state: 'visible' });
assert(/estados\/no-photo\.svg/.test(
  await placaTarjeta.evaluate((n) => getComputedStyle(n).backgroundImage)), …);
```

Le pregunté al propio navegador qué devuelve esa lectura cuando el nodo ya no
está en el documento:

```
en el documento : url("http://localhost:5173/estados/no-photo.svg")
fuera de él     : ""      (isConnected=false)
```

Cadena vacía. `/estados\/no-photo\.svg/.test("")` es falso, y el mensaje que
sale es **exactamente** el que informaste: «la tarjeta no pinta la placa de
«sin registro fotográfico»».

### 2. Por qué el nodo puede no estar en el documento

La publicación que crea el caso es la **más nueva**, y el catálogo ordena por
fecha: ya está en la grilla **antes** de buscarla. El caso escribe el nombre,
manda Enter y mira el DOM apenas ve el título; ese título puede ser el del
dibujo anterior a la búsqueda. Cuando llega la respuesta filtrada, React
reemplaza la grilla entera y el nodo anterior queda suelto.

Que esa ventana existe lo vi en una medición: justo después de mandar la
búsqueda, la página no tenía **ninguna** tarjeta viva, y la cadena de ancestros
del título que había resuelto el localizador terminaba en la grilla, sin llegar
al documento:

```
<h3 class="_titulo_1775f_105">
<div class="_cuerpo_1775f_49">
<article class="_card_1775f_10 _insumo_1775f_28 ">
<div class="_grilla_1pfj8_72">      ← y acá se corta: ya no cuelga del documento
```

Eso explica las tres cosas que viste: pasa aislado (menos publicaciones,
respuesta más rápida, ventana más chica), pasa en 1–60 + 121 por lo mismo, y
falla en la corrida completa, que es la que llega con la base más cargada.

### 3. Lo que no pude cerrar

Intenté forzarlo y **no lo conseguí**:

```
75 lecturas de un instante (25 con CPU x1, 25 x6, 25 x20)   0 rojos
8 vigilancias del nodo tras resolverlo, CPU x20             0 reemplazos
5 corridas con la respuesta de la búsqueda demorada 900 ms  0 rojos
4 suites completas desde base limpia                        121 verde las 4
```

Playwright vuelve a resolver el localizador en cada acción, así que la ventana
es de microsegundos: la ves vos y no yo. Por eso **no declaro reproducido** el
rojo y no te pido que lo des por cerrado: te pido la próxima corrida tuya con
esta regresión, que ahora conserva la evidencia.

### 4. Lo que cambié, sólo en el arnés

1. **Se espera la respuesta de la búsqueda** —la que lleva `search=`— antes de
   tocar el DOM. Con eso el caso no puede estar midiendo el dibujo anterior.
2. **La lectura del fondo deja de ser de un instante**: vuelve a mirar hasta 10 s
   y el resultado dice con cuántas lecturas apareció. Si algún día tarda, se ve
   en el verde en vez de taparse:

```
[PASS] 121 … (la placa apareció con 1 lectura(s) en la tarjeta y 1 en la ficha)
```

3. **Si no aparece, el rojo ya no dice sólo que falta.** Informa el fondo
   calculado, las clases, `data-estado`, el alto, cuántas hojas de estilo hay,
   si la regla de la placa existe en alguna, y el HTML del nodo. Ejemplo real de
   una lectura buena, para que se vea qué vas a recibir si falla:

```
{"fondo":"url(\"http://localhost:5173/estados/no-photo.svg\")","conectado":true,
 "colorDeFondo":"rgb(240, 239, 233)","clases":"_fallback_8y1l5_8 ",
 "estado":"sin-foto","alto":416,"hojas":22,"reglas":1240,"reglasConLaPlaca":1,
 "html":"<div class=\"_fallback_8y1l5_8 \" data-estado=\"sin-foto\" role=\"img\"
 aria-label=\"Sin registro fotográfico. Producto Smoke Sin Foto …\"></div>"}
```

Con eso, si el rojo vuelve, se distingue solo entre las tres causas posibles:
nodo fuera del documento (`conectado:false`), hoja de estilos que no llegó
(`reglasConLaPlaca:0`) o placa equivocada (`estado` o `clases` distintos).

### 5. Por qué no toqué producto

Ninguna medición apunta a producto: la regla existe, la clase se aplica, el
fondo es el correcto y la placa se dibuja. Lo que falla —cuando falla— es la
forma de mirarla. Tal como pediste, si la evidencia hubiera mostrado un defecto
real, freno y traigo la reproducción; no es el caso.

### 6. Puertas

```
base limpia + SMOKE_CASOS=121                   1/1
base limpia + SMOKE_CASOS=144                   1/1
base limpia + suite completa                    143/144   (131 rojo)
base limpia + suite completa, otra vez          143/144   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
```

Cada una de las cuatro corridas arrancó con su **propia** base limpia. Lo
aclaro porque me pasó lo contrario y vale como advertencia: encadené 121 y 144
aislados **antes** de la suite sobre la misma base y la suite dio 137/144, con
cinco casos cayendo en «Stock insuficiente. Disponible: 0». Las publicaciones
que dejan los casos aislados corren la selección de los siguientes. No es un
defecto: es que una corrida oficial no admite nada antes.

El **131** es el de siempre —acá no hay demonio de Docker— y no lo declaro yo.
En tu Mac la corrida tiene que dar **144/144**.

### 7. Hash

```
scripts/smoke.mjs   8083fed3fbccf9d6
```

(SHA-256 truncado a 16, del árbol en el commit de regresión.)

### 8. Frenos

No toqué producto ni reescribí `edf3cb5` ni `6441a49`. No abrí `ADMIN-PAGE-1`.
No cambié datos, seed, pagos ni BOEDA. No desplegué. `PRE_FIRMA.md` sigue fuera
del versionado y lo confirmé antes de empujar.

Freno acá y te pido la revisión.
