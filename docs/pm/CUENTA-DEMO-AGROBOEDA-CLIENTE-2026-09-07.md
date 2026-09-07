# Cuenta de demostración pedida por Emi

Fecha: 2026-09-07.

## Objetivo

Emi necesita una cuenta estable para recorrer las superficies autenticadas y
simular el alta de una publicación sin usar una identidad personal.

Credenciales exactas pedidas:

- usuario: `pruba@agroboeda.com`;
- contraseña: `@agroboeda`;
- nombre visible sugerido: `Prueba AgroBoeda`.

La grafía `pruba` se conserva porque fue la que Emi entregó expresamente. Es
una credencial de demostración conocida, no un secreto ni una cuenta apta para
producción.

## Permisos y estado inicial

- Rol `user`: puede comprar y vender como cualquier persona registrada.
- Activa y verificada desde el seed descartable, para que el correo ficticio no
  bloquee el ingreso.
- No es administradora ni transportista y no recibe accesos por fuera del flujo
  normal.
- Empieza sin publicaciones, órdenes, calificaciones, carrito, datos bancarios
  ni vinculación con Mercado Pago. Lo que Emi cree durante la prueba puede
  persistir hasta que se descarte esa base.
- Debe poder ingresar, abrir `Vender`, completar el formulario real, crear una
  publicación por la API real y verla en su cuenta/Mercado.

## Implementación segura

La pieza `DEMO-USER-1` agrega la cuenta al seed local idempotente ya existente.
El seed conserva su candado actual: sólo `ENV=local` y corte antes de abrir la
base en cualquier otro entorno. No se agrega una excepción, variable de escape,
endpoint administrativo ni alta automática al arrancar la aplicación.

No se ejecuta el seed contra Railway. Llevar esta cuenta a un entorno remoto de
demostración requiere una autorización y una operación separadas, limitadas a
esa cuenta; no forma parte del commit de producto.

## Cierre mínimo futuro

1. Prueba roja contra el SHA anterior: el login exacto no existe.
2. Desde base local limpia, el seed crea una sola cuenta con correo normalizado,
   hash de contraseña, rol `user`, `is_active=true` e `is_verified=true`.
3. Dos corridas del seed son idempotentes y no cambian una publicación creada
   por Emi ni elevan permisos.
4. Una regresión de UI inicia sesión con las credenciales exactas, comprueba que
   no aparece `Admin`, abre `Vender`, crea una publicación mínima válida por el
   recorrido real y la encuentra como propia.
5. El test demuestra también que el seed sigue bloqueado fuera de `ENV=local`.
6. Dev entrega focal, suite completa y puertas estáticas habituales por SHA. No
   despliega ni toca datos remotos.

## Orden

`MARKET-VIEWS-1` continúa como única tarea activa. Después se ejecuta
`BRAND-AGROBOEDA-1` y luego esta pieza corta `DEMO-USER-1`. No se mezclan las
tres entregas.
