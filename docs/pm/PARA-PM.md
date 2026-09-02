# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## TRANSFER-REC-1 — la transferencia se retoma desde Mis compras

Hecho. Producto/regresión e informe en commits separados. **No desplegué.**

- Producto y regresión: `14d561b` — «TRANSFER-REC-1: la transferencia se retoma
  desde Mis compras»
- Regresión nueva: caso **141**. La suite pasa a **141 casos**.

---

### 1. El rojo, contra `d24fece`, y es el recorrido entero

El caso 141 compra por transferencia **en el navegador**, cierra el checkout sin
adjuntar, recarga la aplicación completa y vuelve a Mis compras. Contra
`d24fece`:

```
[FAIL] 141 … — Mis compras no muestra ni el CBU ni el alias del vendedor:
  «Pedido #ORD-20260902-7F7D68E6 2/9/2026 Esperando Comprobante
   Insecticida Lambda Cihalotrina 1L x1 $ 18.500 Total: $ 18.500
   Traslado Coordinás el traslado por tu cuenta. Cancelar Pedido»
```

Ahí está el defecto completo, dicho por la propia pantalla: la orden está
correctamente en espera de comprobante, se ve el total… y lo único que se puede
hacer es **cancelar**. Ni titular, ni CBU, ni alias, ni concepto, ni por dónde
adjuntar.

Dicho de otro modo: la única forma de pagar una compra que ya existía era **no
haber cerrado esa ventana**.

### 2. Lo que cambió, y lo que no

**No toqué el Backend.** Todo el contrato ya estaba: la orden del comprador
manda `seller_cbu`, `seller_alias_bancario`, `seller_bank_holder`,
`payment_method` y `order_number` (`orders.py:557-559` y `611-613`), y
`POST /orders/{id}/transfer-receipt` ya existía. Lo que faltaba era **consumirlo**:
el mapeo de la compra descartaba los tres campos bancarios.

Sin endpoint nuevo, sin estado nuevo, sin migración, sin almacenamiento, sin
dependencias y sin refactor del checkout ni del panel. Dos archivos:

```
 src/components/UserDashboard/UserDashboard.tsx | 138 ++++++++++++++++-
 scripts/smoke.mjs                              | 198 +++++++++++++++++++++++++
```

### 3. Lo que ve ahora el comprador

Cuando el servidor dice que la orden es por transferencia **y** que espera el
comprobante —la pantalla no deduce el estado—, la tarjeta muestra:

- **titular**, **CBU** y **alias**, del snapshot de la orden;
- el **importe**;
- el **número de orden como concepto**, con el porqué: es lo que le permite al
  vendedor reconocer el pago en su resumen bancario;
- y por dónde **adjuntar**, con la misma ruta y el mismo contrato de archivo que
  el checkout (`.jpg,.jpeg,.png,.webp,.pdf`).

Un error queda legible, en `role="alert"`, y se puede reintentar sin recargar.

### 4. El snapshot, que es el punto fino

Los datos bancarios salen de la **orden**, no del perfil del vendedor. Lo probé
en el caso: después de crear la orden, el vendedor cambia su CBU y su alias por
la API real, y el comprador sigue viendo los de la compra.

```
CBU nuevo del vendedor : 0000009000000000000999
alias nuevo            : alias.cambiado.despues
lo que ve el comprador : los originales del snapshot
```

Si mostráramos el dato de hoy, el comprador transferiría a una cuenta que esa
orden nunca declaró, y el vendedor no tendría cómo reconocer el pago. El caso
deja el vendedor como estaba al terminar.

### 5. Al adjuntar, manda la fuente real

La pantalla **no parchea la orden en memoria**: al terminar la carga vuelve a
pedirle las órdenes al servidor. El caso lo comprueba en la base y en la
pantalla, en ese orden:

```
en la base   : TRANSFER_RECEIPT_SUBMITTED, con su transfer_receipt_url
en pantalla  : «Comprobante a Revisar»
y además     : ya no dice «Esperando Comprobante»
               y ya no ofrece adjuntar otro como si faltara
```

### 6. La continuidad sobrevive de verdad

El caso no simula la vuelta: cierra el checkout con su botón, hace un `goto`
completo a la raíz —recarga entera, no navegación de la SPA—, abre el panel y
entra a Mis compras. Y lo hace **dos veces**, porque entre medio cambia los
datos del vendedor y vuelve a entrar.

### 7. Puertas

```
base limpia + node scripts/smoke.mjs            140/141
base limpia otra vez                            140/141
npm run build                                   ok
npm run lint                                    ok (--max-warnings 0)
node --check scripts/smoke.mjs                  ok
python -m compileall backend/app                ok
python -m pip check                             ok
git -c core.whitespace=cr-at-eol diff --check   limpio
npm run a11y -- --todas                         sin violaciones bloqueantes
npm run contraste                               TODO OK, cobertura completa
npm run hito                                    6/6 pasos
```

**El único rojo de las dos corridas es el caso 131**, y es el de siempre: acá no
hay demonio de Docker, así que la receta CSP no puede correr en `alpine:3`. En
tu Mac ese caso pasa —lo verificaste vos con 140/140—, así que allá la suite
tiene que dar **141/141**. No lo declaro yo.

El caso 141 nuevo pasó en las dos corridas completas y también aislado.

### 8. Hashes

```
src/components/UserDashboard/UserDashboard.tsx  50c076df6a6eec48
scripts/smoke.mjs                               80ae524b6e715418
```

(SHA-256 truncado a 16, del árbol en el commit de producto.)

### 9. Riesgos residuales

1. **El bloque aparece sólo con `payment_method === 'transfer'` y estado
   esperando comprobante.** Una orden vieja sin `payment_method` no lo muestra.
   Preferí eso a deducirlo del estado: si el servidor no lo dice, la pantalla no
   lo inventa.
2. **Si la orden no trae ningún dato bancario en el snapshot** —vendedor sin CBU
   ni alias al momento de comprar—, el bloque no aparece y el comprador sigue
   viendo sólo cancelar. No lo cubrí porque el checkout no deja llegar ahí: sin
   medio de pago disponible, esa orden no se crea. Lo digo porque es el borde
   que quedaría si eso cambiara.
3. **Reutilicé las clases del panel de pago pendiente** en vez de crear estilos
   nuevos. Contraste y accesibilidad quedan verdes, pero visualmente el bloque
   de transferencia y el de Mercado Pago se parecen. Si querés distinguirlos, es
   una tarea de diseño y no la abrí.
4. **No toqué el panel del vendedor.** Sigue revisando el comprobante como
   siempre; TRANSFER-REVIEW-1 queda cerrada, como pediste.

### 10. Frenos

No cambié Backend: ninguna prueba discriminante mostró que faltara contrato,
así que no había motivo. No agregué endpoint, migración, estado, almacenamiento
ni dependencias. No hice refactor del checkout ni del panel. Conservé
cancelación, permisos y la validación de archivo. No abrí TRANSFER-REVIEW-1,
FORM-DIRTY-1, navegación, administración, Mercado Pago ni BOEDA. No desplegué.
`PRE_FIRMA.md` sigue fuera del versionado y lo confirmé antes de empujar.

Freno acá y te pido revisión.
