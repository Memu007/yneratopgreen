# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-GUIDE-1, ronda 1 — corregida, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base de la tarea | `238e6f7` |
| candidato devuelto | `81f40dd` |
| candidato nuevo | `091e846` |
| cambios en `src/` y `backend/` | ninguno |
| imágenes | sin cambios: el panel no cambió |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** Tu hallazgo era correcto y está corregido.

- Tus tres afirmaciones falsas, juntas, ahora dan rojo y nombran los pasos
  3, 5 y 10.
- La del paso 10 sola da rojo y nombra el paso 10.
- La guía pasa 26/26 en escritorio y en celular.

**Lo que decidís vos (no bloquea esta pieza): la severidad de un defecto
nuevo.** Quien vende puede volver a activar una publicación que el
administrador eliminó:

- `PATCH /api/products/{id}` con `{"status":"active"}`, con la sesión de
  quien vende, responde 200 y la publicación vuelve al Mercado.
- La edición sólo mira que la publicación sea suya; no mira en qué estado la
  dejó el administrador (`backend/app/api/products.py`, `update_product`).
- Lo reproduje en local y el recorrido lo comprueba en cada corrida (paso
  13).

Lo propongo **P2**: el administrador la puede volver a eliminar. Pero si la
clienta va a usar «Eliminada» para sacar publicaciones fraudulentas, es
**P1**, porque se deshace sin que nadie se entere. La guía lo advierte en el
paso 13 y el script falla cuando se corrija.

## Cómo quedó el vínculo entre frase y comprobación

Cada comprobación va dentro de `v.afirma(frase, …)`, con la frase exacta de
la guía que describe lo que comprueba. Por ejemplo, en el paso 10:

```js
await v.afirma('La publicación deja de verse en el Mercado, en las búsquedas y en su enlace directo.', async () => {
  exigir(!(await enElMercado(c.producto.nombre)), 'pausada, sigue en el Mercado');
  exigir(!(await suEnlaceAbre(c.producto.id)), 'pausada, su enlace directo sigue abriendo');
});
```

El script busca la frase en el texto de su paso, sin mirar negritas, cortes
de línea ni mayúsculas. Falla de dos maneras, y las dos nombran el paso:

- **La frase ya no está:** `[FALLA] Paso 10. Pausar una publicación: la guía
  ya no dice “La publicación deja de verse en el Mercado, …”, que este paso
  comprueba`.
- **Lo que dice no pasa:** `… la guía dice “…” y no pasa: pausada, sigue en
  el Mercado`.

Las frases de «Antes de empezar» se atan desde el paso que las comprueba:

| frase | paso | cómo |
|---|---|---|
| «Nadie recibe un aviso…» | 5 y 10 | ningún correo nuevo a esa dirección en `backend/outbox` |
| los teléfonos no se publican | 11 | el listado y la ficha del Mercado no traen el de quien vende |
| cada parte ve el teléfono de la otra en su orden | 14 | `/orders/my` de cada una |
| órdenes de sólo lectura, pagos sin aprobar | 14 | la fila y el detalle no tienen controles |
| la cuenta propia | 8 | la base no cambia |
| las marcas no están en «Configuración» | 22 | las listas son exactamente cuatro |

La guía no lleva marcas visibles. Cada paso imprime cuántas frases ata:
`[OK] Paso 10. Pausar una publicación (7 frases de resultado)`.

**Comprobaciones nuevas.** Las frases que antes no se comprobaban y se
podían comprobar ahora se comprueban. Entre otras:

- **Veinte cuentas por página.** El panel pide `page_size=20`, la primera
  página muestra 20 o el total si es menor, y dice «Página 1 de N». Con la
  base limpia hay menos de 20 cuentas, así que el 20 sale del pedido. El
  negativo `cincuenta-por-pagina` lo prueba del lado del panel.
- **Números contra SQL:**
  - los ocho números del resumen;
  - los totales de usuarios, publicaciones y órdenes;
  - las constancias pendientes;
  - las opciones de cada lista.
- **Filtros:**
  - «Solo activos»;
  - el estado de las órdenes;
  - la búsqueda por una parte del nombre;
  - «Reintentar», que vuelve a pedir lo mismo con los mismos filtros.
- **Lo que pasa después:**
  - la cuenta desactivada conserva su publicación en el Mercado;
  - la contraseña nueva no queda a la vista;
  - la publicación pausada no se borra;
  - el servidor no deja cambiar el valor interno de una opción;
  - la opción eliminada deja de ofrecerse.
- **Las advertencias de los defectos:**
  - subtotal y envío en $ 0 en el detalle de la orden;
  - el motivo de la cuenta propia: el servidor lo manda y el panel no lo
    muestra.

**Corrijo una comprobación mía que no podía fallar.** Para el filtro
«Activa» y los cambios de estado, el script buscaba el texto en la fila, y
ese texto incluye todas las opciones del selector:
`"Tractor\t\nPausada\nActiva"`. Ahora lee el valor del selector.

## Qué cambió en la guía

Sólo lo necesario para atar frases verdaderas:

- **Paso 7.** Decía que la cuenta puede «cambiar los datos de todas las
  cuentas, publicaciones y órdenes». Es falso: las órdenes no se cambian.
  Ahora dice «Esa cuenta puede hacer todo lo que explica esta guía.». Se
  comprueba con su sesión: lee las siete pestañas y cambia una publicación.
- **Paso 14.** Decía que los estados de una orden los mueven quien compra y
  quien vende. Le faltaba el pago por Mercado Pago, que la pasa a pagada
  sola (`cobro.py`).
- **Paso 5.** Decía «Sus publicaciones y sus órdenes quedan como estaban».
  Ahora dice «Sus publicaciones siguen en el Mercado», que se comprueba, y
  «sus órdenes quedan como estaban», que está declarada.
- **Paso 13.** Tiene la advertencia del defecto nuevo.
- **Al final:**
  - «Cómo se comprueba esta guía» dice las tres cosas que se comprueban;
  - se agrega «Lo que el programa no comprueba»;
  - la introducción avisa que eso está al final.

## Lo que no se comprueba

Está al final de la guía, con cada frase entre “ ” y su fuente. Son 23
frases:

| dónde | qué dice | de dónde sale |
|---|---|---|
| Antes de empezar, paso 2 | la plataforma no cobra ni recibe el dinero; se paga directo a quien vende | decisión del 12/08 |
| Antes de empezar | las transferencias las confirma quien vende | código: `orders.py`, sólo quien vende revisa el comprobante |
| Antes de empezar, paso 20 | la documentación es informativa: no habilita ni bloquea publicar, vender ni cobrar | caso 107 del smoke |
| Antes de empezar | no certifica la identidad | decisión del 14/08 |
| Antes de empezar | quien compra ve el teléfono del transportista; el transportista no ve el de quien compra | decisión del 05/08; casos 52 y 54 |
| Antes de empezar | suscripciones: no existen, no se activan, no están definidas | decisión del 05/08 (Fase 6) |
| Antes de empezar, paso 8 | lo tiene que hacer otra persona administradora | código: `admin.py` sólo rechaza la cuenta propia |
| paso 5 | sus órdenes quedan como estaban | código: `toggle-active` sólo cambia el estado |
| paso 6 | la contraseña nueva no vence | código: `reset-password` no pone vencimiento |
| paso 14 | quién mueve los estados de una orden | código: `orders.py` y `cobro.py` |
| sección 7 | quien vende presenta la constancia desde su cuenta | caso 108 del smoke |
| sección 8 | las listas son las unidades y las opciones de los servicios | código: `AddProductModal.tsx` |
| pasos 24 y 25 | las publicaciones que ya eligieron una opción no cambian | código: la opción se guarda como texto (`models/product.py`) |

Tampoco se comprueban los consejos y las notas: para qué sirve un paso, con
quién compartir una contraseña, cuántas cuentas de administración tener y
qué está anotado para corregir. La guía lo dice. Una frase que se agregue
después no se comprueba hasta atarla o sumarla a la lista, y la guía también
lo dice.

**La lista se controla sola.** Antes de abrir el navegador, el script mira
que cada frase declarada siga escrita donde dice la lista. Si una cambia,
falla y nombra el paso (negativo `frase-declarada`).

## Para verificar, lo mínimo

```
node scripts/guia-admin.mjs
  → Guía: docs/GUIA-PANEL-ADMIN.md, 26 pasos, 237 textos citados, 23 frases declaradas sin comprobar
    [OK] Paso 1. Abrir el panel (5 frases de resultado) … [OK] Paso 26. Volver a pedirla (2 frases de resultado)
    LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular

python3 scripts/sabotajes_admin_guide_1.py paso-10-al-reves tres-de-la-pm
  → === paso-10-al-reves … ===
    [ROJO ESPERADO] salida 1
      [FALLA] Paso 10. Pausar una publicación: la guía ya no dice “La publicación deja
      de verse en el Mercado, en las búsquedas y en su enlace directo.”, que este paso comprueba
    === tres-de-la-pm … ===
    [ROJO ESPERADO] salida 1
      [FALLA] Paso 3. …: la guía ya no dice “Muestra veinte cuentas por página.”, …
      [FALLA] Paso 5. …: la sección «Antes de empezar» ya no dice “Nadie recibe un aviso
      de lo que se cambia desde el panel.”, …
      [FALLA] Paso 10. …: la guía ya no dice “La publicación deja de verse …”, …; la
      sección «Antes de empezar» ya no dice “Nadie recibe un aviso …”, …
    src y guía despues: como estaban
    todos dieron el rojo esperado
```

**Antes de correrlos:**

- Sigue haciendo falta lo mismo que antes: la API en 8000, el frontend de
  desarrollo en 5173 y la siembra demo.
- Además, el correo tiene que ir a `backend/outbox`
  (`EMAIL_TRANSPORT=outbox`, lo mismo que pide el smoke). Si no existe la
  carpeta, fallan los pasos 5 y 10 y lo dicen.
- La guía tarda unos 5 min en los dos anchos. Cada negativo, unos 2,5 min, y
  los siete, unos 17 min. Los dos del comando de arriba son los que pediste.
- **Cada corrida deja cosas creadas, por ancho:**
  - cuatro cuentas, con teléfonos inventados;
  - tres publicaciones, de las que elimina dos;
  - una orden por transferencia;
  - dos constancias pendientes.

  **Corrijo mi informe anterior:** decía que las dos publicaciones se
  eliminaban, pero «Guía documentada …» queda activa en el Mercado.

## Lo que corrí

Todo sobre `091e846`, con la base local que ya tenía restos de corridas
anteriores (72 publicaciones, más de 20 cuentas).

```
node scripts/guia-admin.mjs                    salida 0
  26/26 en escritorio y 26/26 en celular, 126 frases atadas por ancho
  (las del paso 14 y del 22 se cuentan más de una vez)

python3 scripts/sabotajes_admin_guide_1.py     salida 0, los siete en rojo esperado
  boton-inventado       [FALLA] Paso 5. …: la guía nombra «Suspender cuenta» y el panel no lo mostró en este paso
  paso-10-al-reves      [FALLA] Paso 10. …: la guía ya no dice “La publicación deja de verse en el Mercado,
                        en las búsquedas y en su enlace directo.”, que este paso comprueba
  sesion-que-sigue      [FALLA] Paso 5. …: la guía ya no dice “Si tenía la sesión abierta, se le corta.”, …
  tres-de-la-pm         [FALLA] Paso 3, Paso 5 y Paso 10, cada uno por su frase (arriba)
  frase-declarada       [FALLA] Paso 6. …: la lista de lo que no se comprueba cita “La nueva no vence
                        sola: queda hasta que se restablezca otra vez.” y ahí ya no lo dice
  panel-cambiado        [FALLA] Paso 6. …: el panel no muestra «Restablecer contraseña», que el recorrido tenía que tocar
                        [FALLA] inventario: la pestaña «Usuarios» muestra «Nueva contraseña» y su sección de la guía no lo nombra
  cincuenta-por-pagina  [FALLA] Paso 3. …: la guía dice “Muestra veinte cuentas por página.” y no pasa:
                        el panel pide 50 cuentas por página
                        [FALLA] Paso 9. …: la guía dice “dice el total y la página” y no pasa:
                        con 72 publicaciones no dice «Página 1 de 4»
  src y guía despues: como estaban

build · node --check · py_compile · diff-check con cr-at-eol   verdes
git diff 238e6f7 091e846 -- src backend                         vacío
```

Después, sobre una base recién creada (`entorno_nativo.sh --recrear`: 5
cuentas y 30 publicaciones de la siembra):

```
node scripts/guia-admin.mjs                                  salida 0, 26/26 y 26/26
python3 scripts/sabotajes_admin_guide_1.py cincuenta-por-pagina
  con 13 cuentas: [ROJO ESPERADO] salida 1
  [FALLA] Paso 3. …: la guía dice “Muestra veinte cuentas por página.” y no pasa: el panel pide 50 cuentas por página
  [FALLA] Paso 9. …: la guía dice “dice el total y la página” y no pasa: con 39 publicaciones no dice «Página 1 de 2»
```

## Riesgos

- **Una frase atada es exacta.** Reescribir una oración aunque diga lo mismo
  hace fallar el paso. Es lo buscado, porque obliga a mirar la comprobación,
  pero cambiar la guía pide tocar el script.
- **Algunos límites se comprueban en un paso que no es el suyo.** Por
  ejemplo, el teléfono en el paso 11, que es cuando la publicación está a la
  vista. Si fallan, el mensaje cita la frase de «Antes de empezar».
- **Las pruebas de correo dependen del outbox.** Con SMTP no se pueden
  mirar, y el script lo dice.

No toqué `main`, Railway, `src/`, `backend/` ni datos, y no desplegué. Freno
acá.
