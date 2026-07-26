# Antes de firmar — 2026-07-30

Última ventana para corregir la propuesta. Después queda cerrado.

## 1. El precio se mantiene. Lo que hay que blindar es el alcance

El precio es deliberadamente accesible: el cliente viene de que le
cobraron mucho por muy poco, y este es el primer proyecto de la
consultora. Vale como reconstrucción de confianza y como caso de éxito,
más que la diferencia de honorarios. La propuesta ya lo dice: "primer
cliente estratégico", "caso de éxito conjunto".

Con el precio bajo a propósito, **el riesgo se muda al alcance**. Quedan 7
a 9 semanas de trabajo; cada pedido fuera de alcance duele el triple.

Tres cosas que tienen que estar en el papel que se firma:

1. **La lista de lo que NO incluye**, explícita. Está en `PROJECT.md`:
   publicidad, financiación, portal editorial, suscripciones,
   recomendaciones con IA, multi-país, multi-idioma, mensajería
   comprador–vendedor, reviews de productos, favoritos y cupones.
2. **Cláusula de cambios**: todo pedido fuera del alcance firmado se
   cotiza aparte. A un cliente que ya fue maltratado, la claridad le
   suma.
3. **Límite de la garantía de 90 días**: cubre errores del software, no
   funcionalidad nueva. Sin eso escrito, son tres meses de desarrollo
   gratis.

## 2. Definir lo ambiguo

Cada una cuesta cero hoy y es una discusión cara después.

| Punto | Ambigüedad | Definir como |
|-------|-----------|--------------|
| *"Registro con validación"* (3.1) | ¿Validar correo o validar identidad? | Validación de correo. La de identidad es otro precio |
| Cobertura del transportista (3.2) | Radio en km vs zonas declaradas | Zonas declaradas, si el cliente acompaña |
| *"Requerimientos del producto"* (3.2) | ¿Filtrar por capacidad? | Capacidad como dato visible, no como filtro |
| Comprobantes de transferencia (3.3) | ¿Dónde se guardan? | Almacenamiento privado, y ver si entra en el presupuesto de infraestructura |

## 2 bis. El riesgo legal del dinero, y por qué hoy es bajo

**No soy abogada y esto necesita una.** Pero la estructura importa y hay
que entenderla antes del jueves, porque cambia qué se firma.

### Lo que se construyó no toca la plata

En el flujo de transferencia bancaria, el dinero va **de la cuenta del
comprador a la cuenta del vendedor, directo**. TopGreen sólo muestra el
CBU y guarda una imagen. En ningún momento tiene los fondos.

Eso importa mucho: **la plataforma no es intermediaria de pagos.** Es lo
mismo que hace un sitio de clasificados. Ese es el modelo de riesgo bajo,
y es el que pide el contrato.

### Lo que sí sería un problema

El código heredado trae **split payments y OAuth de vendedores** de
Mercado Pago: un esquema donde la plataforma cobra, retiene una comisión
y le gira el resto al vendedor. **Ahí sí la plataforma maneja fondos de
terceros**, y en la Argentina eso entra en el terreno de los proveedores
de servicios de pago, con registro ante el Banco Central.

**El contrato no lo pide.** Dice "checkout básico" y nada más. Ya estaba
marcado como construido por encima del alcance; esto es una segunda razón,
más fuerte que la primera, para dejarlo apagado y no mencionarlo el
jueves.

Si en algún momento la clienta quiere quedarse con una comisión de cada
venta, esa conversación **empieza con un abogado**, no con nosotros.

### El punto que te preocupaba, ya resuelto en el diseño

Dijiste "quizás el vendedor da el ok si se transfiere". **Es exactamente
lo que hace el sistema**, y está bien así.

El comprobante que sube el comprador es una imagen: no prueba nada, se
falsifica en dos minutos. Por eso quien decide es el vendedor, **mirando
su propia cuenta bancaria**, no la imagen. La imagen queda como registro
de la conversación, no como verificación.

Conviene que eso esté escrito en la pantalla, para que ningún vendedor
apruebe mirando el archivo. Va como tarea.

### Tres cosas para el papel del jueves

1. **Cláusula de no intermediación.** Que diga explícitamente que la
   plataforma no participa de los pagos entre usuarios, no retiene fondos
   y no garantiza las operaciones. Protege a la clienta y a nosotros.
2. **Términos y condiciones del sitio**: quién responde si una operación
   sale mal. Hoy no existen y **no están en el alcance ni presupuestados**.
   Definir si los redacta ella con su abogado —lo natural— o si es trabajo
   nuestro, y en ese caso se cotiza.
3. **Datos bancarios y personales.** El sistema va a guardar CBU, alias,
   teléfonos y direcciones de gente real. Eso cae bajo la ley de
   protección de datos personales. Preguntar si tiene asesoramiento legal;
   si no lo tiene, recomendárselo por escrito. Que quede el registro de
   que se avisó.

**Cómo plantearlo en la reunión.** No como problema nuestro ni como
excusa: como cuidado hacia ella.

> "Una cosa que queremos dejar clara: la plataforma no toca la plata en
> ningún momento. La transferencia es directa de comprador a vendedor.
> Eso la deja a usted fuera de tener que registrarse como proveedor de
> pagos, que es un trámite pesado. Si en algún momento quiere cobrar una
> comisión de cada venta, eso cambia y conviene verlo con un abogado
> antes."

Eso te posiciona como alguien que le está cuidando el negocio, que es
justo lo que necesita después de que la hayan estafado.

## 2 ter. La suscripción es alcance nuevo, y es la palanca más fuerte que tenés

Se definió que **el teléfono del comprador se ve sólo con suscripción
paga**. Eso no estaba: la propuesta lista "suscripciones para vendedores"
como fuera de alcance.

**Se partió en dos a propósito**, y esa división es la que hay que llevar
a la reunión:

| Pieza | Estado | Por qué |
|---|---|---|
| **El candado** de acceso a contactos | **Se incluye sin cargo** | Son horas y es estructural. Después cuesta diez veces más |
| **El sistema de suscripciones**: cobro, renovación, planes, vencimientos | **Se cotiza aparte** | Módulo entero |

### Por qué esto es lo más importante de la reunión

El candado es **el mecanismo de ingresos de ella**. Sin eso, la plataforma
no tiene cómo cobrarle a nadie: el transportista entra, ve todos los
teléfonos y no paga nunca.

Eso te da dos cosas.

**Primero, un regalo que se siente enorme y cuesta poco.** Decir *"esto lo
incluimos sin cargo porque sin eso su negocio no cobra"* vale muchísimo
más que la hora que lleva. Es el tipo de gesto que un cliente recién
estafado no espera.

**Segundo, y más importante: es la puerta natural a la conversación de
participación.** Vos ya querés arreglar una parte de los ingresos de la
web. El momento para plantearlo es exactamente este, cuando estás
entregando el mecanismo que los genera:

> "El candado que habilita el cobro lo incluimos. El sistema de
> suscripciones completo —cobro automático, renovaciones, vencimientos— es
> un desarrollo aparte. Y ahí tenemos una propuesta: en vez de cobrárselo,
> lo hacemos a cambio de un porcentaje de lo que la plataforma recaude.
> Nos alinea: si a usted le va bien, a nosotros también."

Eso es mucho mejor que pedir un porcentaje en abstracto. Estás pidiendo
participación **sobre el módulo que vos construís y que produce el
ingreso**, no sobre el trabajo ya pactado.

### Definiciones que faltan y son de ella

- **¿Quién paga la suscripción?** Lo natural es el transportista, que es
  quien recibe los contactos. ¿También los vendedores?
- **¿Cuánto y cada cuánto?** No hace falta para construir el candado, sí
  para cotizar el sistema.
- **¿Hay período de prueba?** Si lo hay, el candado tiene que
  contemplarlo, y es mejor saberlo ahora.

## 3. Aprovechar la ventaja

- El **segundo hito de cobro** se paga contra demostrar catálogo,
  búsquedas y geolocalización. Está casi listo, así que ese cobro llega
  muy rápido después de firmar.
- Se puede **demostrar producto funcionando** en la reunión de firma. Es
  un argumento de venta fuerte.

## 4. Cuidado en la reunión

Mostrar que funciona ayuda a cerrar. **No** reencuadrar el alcance ni el
precio a partir de eso: si el cliente percibe que ya está casi hecho,
aparece la presión para bajar el precio o para agregar alcance sin pagarlo.

El trabajo previo a la firma es capital propio, no un descuento.
