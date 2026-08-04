# Dev → PM

Sol: este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-04. **Primer informe con los roles cambiados.**

---

## Qué hice hoy, y es trabajo de traspaso, no de producto

Hasta hoy yo era la PM. Antes de soltar ese rol dejé el repositorio en
condiciones de que lo agarres sin arqueología:

- **`ONBOARDING-PM.md`**, nuevo. Tu arranque. Incluye la lista de mis
  errores como PM, porque heredás las consecuencias.
- **`CRONOGRAMA.md`**, nuevo. Las cinco fases del PDF que aprobó la
  clienta, ancladas a fechas reales, con el contraste contra lo que está
  realmente hecho.
- **`PARA-DEV.md`** archivado: de 1.378 líneas a 494. El historial completo
  quedó verbatim en `archivo/PARA-DEV-historico.md`. No se borró nada.
- **`NOW.md`**, `CONTRATO.md` y `ONBOARDING-DEV.md` actualizados al
  2026-08-04.

**No toqué una sola línea de código de producto.** El árbol de trabajo
tiene sólo cambios en `docs/pm/`.

---

## Lo que verifiqué contra el código, hoy, para pasártelo confirmado

No te lo paso porque lo diga un informe viejo. Estos son los cuatro
hallazgos abiertos, cada uno con dónde mirarlo:

### 1. Las órdenes de transferencia quedan colgadas

`backend/app/api/orders.py:709`:

```python
if order.status not in [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PAID]:
    raise HTTPException(status_code=400, detail="Solo se pueden cancelar órdenes pendientes, pagadas o confirmadas")
```

Los dos estados de transferencia —`AWAITING_TRANSFER_RECEIPT` y
`TRANSFER_RECEIPT_SUBMITTED`, declarados en `backend/app/models/order.py:23-24`—
**no están en esa lista**. Si el comprador no sube el comprobante, esa
orden no se puede cancelar nunca más, ni por el comprador ni por el
vendedor. Queda con el stock comprometido para siempre.

El análisis completo y los cuatro arreglos están en
`PAGOS-TRANSFERENCIA.md`.

### 2. El seed no carga datos bancarios de nadie

Buscando `cbu` y `alias_bancario` en todo el seed: **cero resultados.**

Consecuencia: sobre una instalación limpia, el pago por transferencia
—que es la única vía de pago que existe hoy— no se puede usar. Ningún
vendedor tiene CBU.

**La suite no lo detecta** porque el caso 13 configura los datos bancarios
él mismo antes de probar. Prueba la regla, y nadie prueba cómo queda el
sistema recién instalado.

### 3. El camino de instalación sin Docker no arranca

`backend/.env.example` declara seis claves que `Settings` no acepta:
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `BASE_URL`.
`backend/app/core/config.py:75` usa `class Config` sin declarar `extra`,
y el valor por defecto rechaza claves desconocidas. Copiar el ejemplo tal
cual y levantar el backend falla.

Y `vite.config.ts` proxea `/api` a `http://localhost` —puerto 80, que sólo
existe con nginx—. Sin Docker el frontend no ve la API.

### 4. La pantalla de pago muestra un error que no corresponde

Cuando la API devuelve *"Administrador TopGreen no configuró CBU ni alias
bancario"*, la interfaz muestra **"⚠️ Producto no encontrado en el
carrito"**. Manda a mirar al lugar equivocado.

---

## Lo que la dev anterior dejó sin informar

Subió `382bcbe chore: preparar despliegue en Railway` —`Dockerfile.railway`,
`railway.toml`, `RAILWAY.md`, `backend/railway-entrypoint.sh` y
`infra/railway/nginx.conf.template`— **sin escribir informe**.

**No lo revisé.** No sé si funciona, y no se despliega nada antes de la
revisión de seguridad. Te lo dejo señalado para que decidas si lo audito o
lo dejamos para la fase 5.

---

## Lo que no corrí

Digo lo que no hice, explícitamente:

- **No corrí la suite de humo hoy.** El último resultado registrado es
  20/20, del 2026-07-26, y es anterior al commit de Railway.
- **No levanté el entorno hoy.** Los hallazgos 1, 2 y 3 salen de leer el
  código; el hallazgo 4 salió de correr la aplicación el 2026-07-28.
- **No revisé el commit de Railway.**
- **No toqué nada de producto.**

---

## Lo que necesito de vos para arrancar

1. **Decime qué hago primero.** Escribilo en `PARA-DEV.md` y pusheá.

   Mi propuesta es cerrar los cuatro arreglos de la transferencia antes de
   abrir cualquier módulo nuevo, porque hoy hay órdenes que se pueden
   dejar muertas en producción. Pero es tu decisión y la vas a discutir.

2. **Para los arreglos de transferencia pido un criterio explícito:** el
   caso nuevo de la suite tiene que **fallar contra el código de hoy**
   antes del arreglo. Si pasa antes, el caso no prueba nada. Lo voy a
   pegar en el informe, la corrida en rojo y la corrida en verde.

3. **Suscripciones: no puedo empezar.** El alcance está decidido en
   `DECISIONS.md` y `PROJECT.md` —Mercado Pago recurrente, dos planes,
   mensajería sólo en el premium— pero **no hay enunciado con criterios**.
   Sin eso tendría que inventar decisiones de diseño, y no lo voy a hacer.

4. **Las cuatro preguntas de diseño de transportistas** siguen abiertas y
   bloquean las Piezas B y C. Definen quién ve los datos de contacto de
   quién. Si se definen al empezar son un parámetro; si se definen después,
   es reescribir el módulo.

---

## Una cosa que te discuto de entrada

En `CRONOGRAMA.md` vas a ver que el **hito intermedio** se dispara *"contra
entrega y demostración del módulo de catálogo, búsquedas y geolocalización
funcional"*, y que catálogo, búsquedas y geolocalización de productos ya se
demuestran hoy, en la semana 2.

**No lo reclames todavía.** Esa frase incluye la geolocalización de
**fletes**, y ese módulo está en cero. Reclamar el hito ahora es cobrar por
algo que no se puede mostrar completo, y en un proyecto que arrancó con una
clienta quemada por otro estudio, eso cuesta más que lo que entra.

Lo pongo por escrito para que quede la discusión, no para cerrarla.
