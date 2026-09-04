# Plan de red-team para el cierre del MVP

Registrado: 2026-09-04.

## Decisión

La auditoría integral de seguridad se ejecutará como puerta previa a producción.
Emi autorizó pruebas adversariales sobre TopGreen/BOEDA, un producto propio.
Esta autorización no alcanza a servicios de terceros ni habilita pruebas
destructivas.

La auditoría se hará en una sesión nueva e independiente con **Astra Alto**. La
Dev corregirá un hallazgo por vez y la PM reproducirá cada corrección antes de
cerrarla.

## Momento de inicio

`FORM-DIRTY-1` debe estar cerrado, pero no es la única condición. La PM inicia
el red-team cuando se cumplan todas estas puertas:

1. recorridos principales y cambios visuales/UX congelados;
2. autenticación, permisos, órdenes, stock, logística y carga de archivos con
   sus regresiones verdes;
3. Mercado Pago homologado únicamente en modo de prueba, con webhook e
   idempotencia comprobados;
4. Docker y Railway descartable publican el SHA exacto que se auditará;
5. datos y cuentas exclusivamente de prueba, backups verificados y
   `MP_CHECKOUT_HABILITADO=false` fuera de la ventana controlada.

La PM debe avisarle a Emi cuando estas cinco condiciones estén cerradas. No se
habilita producción ni dinero real antes del informe final y el retest.

## Alcance técnico

- análisis estático y de dependencias de React/TypeScript y FastAPI/Python;
- XSS, CSRF, inyecciones, manipulación de parámetros, cabeceras, cookies,
  sesiones, recuperación de acceso y carga de archivos;
- autorización por rol e intento de acceso a publicaciones, perfiles, órdenes,
  comprobantes y datos de otros usuarios;
- concurrencia y manipulación de carrito, stock, logística, checkout, webhook,
  reintentos e idempotencia;
- exposición de secretos, logs y datos personales; configuración aplicable de
  Railway, dominios, almacenamiento, backups y restauración;
- abuso razonable: enumeración, fuerza bruta y rate limiting sin degradar el
  servicio compartido.

La capacidad para 5.000 visitas mensuales se mide en una prueba de carga
separada y controlada. No se confunde disponibilidad con pentesting.

## Límites

- Sólo Docker local y el Railway descartable `strong-playfulness`, sobre el SHA
  previamente autorizado.
- No atacar Mercado Pago, GitHub, Railway ni ninguna infraestructura de
  terceros; sus integraciones se prueban mediante flujos y cuentas de prueba.
- No denegación de servicio, ingeniería social, persistencia, borrado masivo,
  dinero real ni extracción de datos más allá de la prueba mínima necesaria.
- Un hallazgo crítico durante cualquier fase se contiene y corrige de
  inmediato; no espera a la auditoría final.
- Credenciales, tokens, documentos y datos personales nunca entran al informe
  ni al repositorio.

## Evidencia y salida

El informe debe identificar cada hallazgo, severidad, impacto, SHA, recorrido
de reproducción seguro y corrección propuesta. La Dev entrega evidencia roja y
verde; la PM revisa el diff y reproduce el caso. Para cerrar la puerta:

- cero hallazgos críticos o altos abiertos;
- suite completa desde base limpia y puertas de build/lint/dependencias verdes;
- retest adversarial independiente de los hallazgos corregidos;
- registro de riesgos medios/bajos aceptados, con responsable y fecha;
- verificación final de secretos, backups/restauración y configuración de
  Railway.

Este plan no abre una tarea activa hoy. Se activa únicamente al alcanzar las
condiciones de entrada anteriores.
