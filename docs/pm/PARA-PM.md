# Dev → PM

## Estado

Terminé y subí, en piezas separadas:

- `2c5a589` — cierre de los pagos heredados.
- `d8420e9` — snapshot bancario en la orden.
- `61eeb96` — avisos de transferencia para comprador y vendedor.
- `f470b71` — respaldo compartido para imágenes rotas.

## Pagos heredados: inalcanzables

- Eliminé `simulate-payment` de `payments.py`.
- `main.py` ya no importa ni monta `payments.router` ni `mp_oauth.router`.
- Quité Mercado Pago del checkout.
- Quité OAuth y vinculación de Mercado Pago del panel.
- Contacto ya no dice que se acepta Mercado Pago ni efectivo.
- El código heredado restante sigue en Git, como pediste.

Caso nuevo:

```text
PASS 19 Las rutas financieras heredadas no están expuestas
  payments, mp-oauth y simulate-payment respondieron HTTP 404
```

La prueba cubre:

```text
GET  /api/payments/public-key                       -> 404
GET  /api/mp-oauth/status                           -> 404
POST /api/payments/simulate-payment/inexistente     -> 404
```

No depende de que falten credenciales: los routers no existen en runtime.

## Snapshot bancario

Migración autogenerada:

`20260726_0104_63c3ab99fea0_guardar_snapshot_bancario_en_orden.py`

Detectó únicamente:

```text
orders.transfer_cbu
orders.transfer_alias_bancario
orders.transfer_account_holder
```

Las tres columnas son anulables. Al crear la orden se copian CBU, alias y
titular; las respuestas posteriores leen la orden y no el perfil.

El caso 14 ahora:

1. configura CBU y alias;
2. crea la orden;
3. cambia ambos datos en el perfil del vendedor;
4. consulta la orden como comprador;
5. contrasta API y SQL.

Resultado:

```text
PASS 14 Datos bancarios correctos y orden esperando comprobante
  snapshot API=SQL intacto tras cambiar el perfil
```

La migración aplicó desde una base vacía dentro del smoke. Chequeo posterior:

```text
$ alembic check
No new upgrade operations detected.
```

## Tarea 5 bis

Comprador, antes y después de crear la orden:

> El pago es una transferencia directa a la cuenta del vendedor. TopGreen no
> recibe ni retiene el dinero.

Vendedor, antes de los botones:

> **Verificá el dinero en tu cuenta bancaria antes de aprobar.** Este
> comprobante es sólo un registro: no confirma que la transferencia se haya
> acreditado. No apruebes si el importe acreditado no coincide con el total de
> la orden.

El caso 18 abre una sesión de comprador y otra de vendedor. Comprueba que
ambos textos sean visibles y que el aviso del vendedor preceda en el DOM a
`Aprobar comprobante`.

Primera corrida de esta pieza:

```text
18/19 pasaron
```

El test había acotado la búsqueda al encabezado de la tarjeta (`../..`) y no a
la tarjeta completa. Corregí el selector a `../../..` y repetí la suite:

```text
19/19 pasaron; 0 fallaron
```

## Tarea 5: respaldo de imágenes

Extraje el comportamiento aprobado de `ProductCard` a un único
`ProductImage`: ante `onError`, reemplaza la imagen por el nombre sobre el
mismo fondo verde, incluido el tema oscuro.

Se usa en:

- tarjetas del catálogo;
- detalle y miniaturas;
- carrito;
- checkout;
- publicaciones del vendedor y editor;
- administración;
- formulario de publicación;
- imágenes institucionales de Nosotros y Servicios.

La única etiqueta `<img>` que queda en `src/` está dentro de
`ProductImage.tsx` y tiene `onError`.

El caso 20 intercepta `https://picsum.photos/**`, responde `404`
intencionalmente y verifica el reemplazo en:

1. detalle;
2. carrito;
3. checkout;
4. panel del vendedor;
5. administración.

También cuenta que Playwright haya bloqueado al menos una URL real de
`picsum.photos`, para que el caso no pase sólo por una publicación sin imagen.

Hubo dos corridas previas `19/20`, ambas por selectores del test:

1. tomó el encabezado transitorio `Cargando productos...`;
2. el nombre de la publicación aparecía a la vez en el `h3` de la tarjeta y el
   `h2` del detalle.

La prueba final busca un producto seed conocido por nombre y nivel de
encabezado.

## Smoke final

Ejecutado desde cero después del último cambio:

```text
PASS 01 Salud del servicio
PASS 02 Registro de usuario
PASS 03 Ingreso y obtención del token
PASS 04 Catálogo con categoría y precio
PASS 05 Catálogo con provincia y localidad
PASS 06 Detalle de producto
PASS 07 Agregar al carrito y verlo
PASS 08 Crear orden desde el carrito
PASS 09 Publicar producto como vendedor desde la interfaz
PASS 10 Fallo de imagen visible sin perder la publicación
PASS 11 Ver mis compras y mis ventas
PASS 12 Administración: usuarios, productos y órdenes
PASS 13 Transferencia exige CBU o alias del vendedor
PASS 14 Datos bancarios correctos y orden esperando comprobante
PASS 15 Comprobante fallido visible y comprobante válido asociado
PASS 16 Sólo el vendedor correcto valida el comprobante
PASS 17 Rechazo de comprobante guarda el motivo
PASS 18 Transferencia completa desde la interfaz
PASS 19 Las rutas financieras heredadas no están expuestas
PASS 20 Respaldo de imágenes en el recorrido de demostración
-------------------
20/20 pasaron; 0 fallaron
```

El mismo smoke compiló el frontend, aplicó las cuatro migraciones desde una
base vacía, sembró datos y recorrió Chromium.

## No cambiado

- No implementé Mercado Pago nuevo.
- No definí el flujo de transferencia insuficiente.
- No cambié la lógica de aprobación/rechazo.
- No agregué dependencias.
- No hice cambios de interfaz móvil.
