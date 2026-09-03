# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-PAGE-1 — las tres listas del panel pasan de la fila veinte

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto y regresión: `fe2b151` — «ADMIN-PAGE-1: las tres listas del panel
  pasan de la fila veinte»
- Regresión nueva: caso **145**. La suite pasa a **145 casos**.

---

### 1. El estado anterior, medido antes de tocar nada

Con la base cargada, abrí el panel y miré las tres listas y lo que pedían:

```
lista       en la base   filas dibujadas   pie                        controles
Usuarios         61            20          «Total: 61 usuarios»          ninguno
Productos       164            20          «Total: 164 productos»        ninguno
Órdenes          72            20          «Total: 72 órdenes»           ninguno

lo que pidió la pantalla:
  /admin/users
  /admin/products
  /admin/orders
```

Ni `page` ni `page_size` en ninguna de las tres. El pie decía el total entero
—o sea que el dato existía— y no había un solo control para llegar a la fila
21. De 164 publicaciones se administraban 20.

Y el rojo del caso 145 contra `1ac4191`, con esas mismas palabras:

```
[FAIL] 145 … — usuarios: no hay ningun control para pasar de pagina,
  y hay 187 filas; el pie dice «Total: 187 usuarios»
```

### 2. Después

```
lista       pie
Usuarios    «Total: 61 usuarios · Anterior · Página 1 de 4 · Siguiente»
Productos   «Total: 164 productos · Anterior · Página 1 de 9 · Siguiente»
Órdenes     «Total: 72 órdenes · Anterior · Página 1 de 4 · Siguiente»

lo que pide la pantalla:
  /admin/users?page=1&page_size=20
  /admin/products?page=1&page_size=20
  /admin/orders?page=1&page_size=20
```

### 3. Lo que cambió

```
 src/components/AdminPanel/AdminPanel.tsx        | 222 ++++++++++++++--
 src/components/AdminPanel/AdminPanel.module.css |  39 ++-
 scripts/smoke.mjs                               | 321 ++++++++++++++++++++++++
```

**Sin Backend**: la paginación y los filtros ya estaban en la API; lo que
faltaba era pedirlos. Sin ruta nueva, sin migración, sin dependencia y sin
tocar el seed.

- Cada lista tiene **su propia página**. Se pueden dejar Usuarios en la 2,
  pasear por Productos y volver: sigue en la 2. El caso lo comprueba.
- El tamaño es **explícito**: veinte. El servidor ya usaba ese valor por
  omisión, pero la pantalla no puede deducir cuántas páginas hay de algo que no
  pidió.
- El pie es **un solo componente** para las tres listas, así no pueden
  divergir. «Anterior» y «Siguiente» dicen de qué lista son —«Página siguiente
  de órdenes»— y se deshabilitan en los extremos.
- **Cero resultados es «Página 1 de 1»** con la navegación apagada: la lista
  está vacía, que no es lo mismo que rota, y con «de 0» no habría dónde pararse.
- **Si la página queda fuera del total** —se filtró, se borró una fila, entró
  otro administrador— la carga cae a la última página que existe en vez de
  dibujar un vacío falso.

Controles mínimos, con el contrato que ya existía:

```
Usuarios    buscar por nombre o email · rol · activo/inactivo
Productos   estado
Órdenes     estado
```

Buscar es una acción y no cada tecla: se aplica con el botón «Buscar» o con
Enter. Cualquiera de los cuatro controles vuelve a la página 1, porque la que
se estaba mirando era de otra lista.

### 4. Lo que comprueba el caso 145

Arma sus propias filas por las rutas de siempre —21 usuarios por
`POST /admin/users`, 21 publicaciones por el alta del vendedor y 21 órdenes por
el checkout de transferencia— y después:

```
en la red        «Siguiente» pide /admin/users?page=2&page_size=20 (y sus dos hermanas)
contra la API    «Total: N» y «Página 1 de M» salen del total del servidor
contra la base   el total de usuarios coincide con SELECT COUNT(*)
la fila testigo  no está en la primera página y aparece en la segunda, en las tres listas
página propia    Usuarios vuelve a su página 2 después de pasear por las otras dos
los controles    buscar deja 21 filas en 2 páginas y vuelve a la página 1
cero resultados  «Página 1 de 1», sin filas y con los dos botones deshabilitados
los extremos     «Anterior» apagado en la 1, «Siguiente» apagado en la última
sin contradecir  ninguna fila visible contradice el rol, el estado o la búsqueda
```

Una nota sobre cómo se mide el paso de página, porque me costó un rojo: el
rótulo «Página 2 de N» cambia con el estado, apenas se hace clic, y las filas
cambian cuando **llega** la respuesta. El caso espera la respuesta —que es
además lo que hay que demostrar— y no el rótulo.

### 5. Puertas

```
base limpia + SMOKE_CASOS=145                   1/1
base limpia + suite completa                    144/145   (131 rojo)
base limpia + suite completa, otra vez          144/145   (131 rojo)
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         sin violaciones bloqueantes
npm run contraste                               TODO OK, cobertura completa
```

Cada corrida arrancó con su propia base limpia. El **131** es el de siempre
—acá no hay demonio de Docker— y no lo declaro yo: en tu Mac esto tiene que dar
**145/145**. Los casos 114, 121 y 144 pasaron en las dos corridas.

### 6. Hashes

```
src/components/AdminPanel/AdminPanel.tsx        654982ec528d6d78
src/components/AdminPanel/AdminPanel.module.css 0994e1efe027e073
scripts/smoke.mjs                               9503d98bc1c143fe
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 7. Riesgos residuales

1. **Veinte filas es fijo y no se puede cambiar desde la pantalla.** Es lo que
   pediste; lo anoto porque con listas grandes alguien va a querer 50.
2. **La página no viaja en la URL.** Recargar la aplicación vuelve a la página
   1 de cada lista. No lo abrí: el panel es un modal y no tiene ruta propia.
3. **Las acciones de una fila no conservan la posición del scroll**, aunque sí
   la página: al desactivar un usuario de la página 3 la lista se recarga en la
   página 3, pero arriba.
4. **Órdenes filtra por estado con los diez valores del contrato.** Si mañana
   se agrega uno, hay que sumarlo a la lista de opciones; no se generan solos.
5. **El caso 145 deja 21 usuarios, 21 publicaciones y 21 órdenes** en la base
   de la corrida. Corre último y no ensucia a nadie, pero engorda la base
   efímera; si querés que limpie al final, lo agrego.

### 8. Frenos

No toqué Backend, dashboard, categorías, documentación, estados traducidos,
navegación global, el modal, responsive, BOEDA, pagos ni Railway. No agregué
buscador de catálogo ni endpoints. No hay migración ni dependencia nueva. No
desplegué. `PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de
empujar.

Freno acá y te pido revisión.
