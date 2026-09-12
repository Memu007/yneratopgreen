# Estado actual

Actualizado: 2026-09-11.

`NOW.md` contiene sólo estado vigente, restricciones vivas, bloqueos y próxima acción. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

## Resumen ejecutivo

- **Fase contractual:** Fase 2 — Desarrollo base, semana 4. Ventana contractual: 04/09–24/09. El proyecto está funcionalmente adelantado en varias áreas; las fechas son ventanas/puertas contractuales, no una prohibición de terminar piezas antes.
- **Rama `main`:** base canónica actual `ab4165fc` antes de la poda documental.
- **Rama Dev:** `claude/dev-role-repo-3l0kp3`, diverge de `main`: 65 commits adelante y 4 atrás; merge-base `2877d2a0`.
- **Tarea/hilo vigente:** `COPY-CLEAR-1` entregada por Dev en su rama, **pendiente de revisión PM**. Producto/regresión: `9f25d59`. No está integrada ni desplegada.
- **No abrir una tarea nueva** hasta aceptar o devolver `COPY-CLEAR-1`.

## Entrega pendiente — COPY-CLEAR-1

Dev informa los seis puntos entregados: búsqueda por acción, FAQ sin planes/comisiones inventadas, salida honesta para contraseña olvidada, voseo es-AR, estados visibles traducidos y conservación de marca→Inicio.

Evidencia informada por Dev:

- focales 156 + 160 + 168: **3/3**;
- suite completa: **165/168**;
- rojos: 131 ambiental conocido y 167/168 afectados por interacción con el límite antifuerza-bruta;
- lint, TypeScript, sintaxis y `diff-check`: verdes;
- sin Backend, schema, pagos, Railway ni despliegue.

La PM debe revisar el diff y reproducir de manera independiente antes de aceptar.

### Dos hallazgos que no se deben mezclar con la pieza

1. **A11y/contraste:** Dev reporta que `npm run a11y` está rojo también sobre la base previa aceptada, en seis elementos de paneles con contraste medido 2.08:1 frente al requisito 4.5:1. No atribuirlo a `COPY-CLEAR-1` hasta reproducción PM. Si se confirma, abrir corrección separada y mínima.
2. **Aislamiento de suite:** los casos 167/168 pueden heredar el presupuesto de rate-limit consumido por el caso 134. La corrección esperada es aislamiento/reset del arnés; **no debilitar el rate-limit de producción para hacer pasar pruebas**.

## Última aceptación PM relevante

`TEST-SUITE-167S` quedó aceptada en rama Dev: arnés `d7e17f9`, informe `40131de`. PM reprodujo 139+143 juntos desde otra base limpia en 2/2; no cambió producto.

Las aceptaciones anteriores y sus reproducciones son historia consultable en Git y en los documentos de evidencia; no se vuelven a transcribir en este archivo.

## Estado de integración

La rama Dev acumuló trabajo aceptado y pendiente sin integrar porque históricamente `main` también se usó como fuente de despliegue. El resultado es una divergencia grande y una composición que debe tratarse explícitamente.

Reglas para cerrar esa deuda:

- no integrar la rama Dev completa “porque sí”;
- construir una **composición candidata** que incorpore `main` actual y el trabajo Dev aceptado;
- un commit documental nuevo en `main` no invalida por sí solo una composición de producto previamente probada; un cambio de producto sí exige recomposición/retest;
- Dev corre suite completa sobre el SHA candidato desde base limpia;
- PM corre suite completa independiente sobre **el mismo SHA** desde otra base limpia;
- si un rojo aparece sólo en un entorno, reproducirlo aislado en ambos antes de clasificarlo;
- hasta resolver diferencias, el candidato no está aceptado.

La arquitectura `main = integración aceptada` / `release = producción` es una recomendación auditada, todavía no se ejecuta sin inventario de Railway y decisión PM/Owner. Si se adopta, `release` sólo puede avanzar a un SHA ya contenido en `main`; no lleva commits exclusivos.

## Railway — estado y deuda viva

El 2026-09-11 se corrigió un incidente CORS de configuración: Backend sólo admitía el dominio histórico y el frontend vigente fallaba con `Failed to fetch`. Con autorización de Emi se agregó el dominio actual, se reinició Backend y se verificaron preflight, catálogo e ingreso demo. No cambió código, datos ni pagos.

Antes de cambiar ramas de despliegue o tratar un entorno como producción aceptada falta inventariar de forma explícita:

- proyecto Railway de Frontend y Backend;
- rama configurada por servicio;
- auto-deploy;
- SHA realmente publicado en cada servicio;
- Backend consumido por Frontend;
- PostGIS asociado;
- backups activos y, idealmente, restauración ejercitada;
- volumen persistente para imágenes/outbox cuando corresponda;
- variables operativas relevantes sin copiar secretos.

`MP_CHECKOUT_HABILITADO` debe permanecer en `false` hasta la ejecución controlada de homologación de Mercado Pago.

Runtime no es sólo SHA: CORS, SMTP, dominios y variables pueden romper una composición correcta. Todo cambio operativo debe quedar registrado sin secretos.

## Mercado Pago — pendiente externo

El código de checkout existe, pero la homologación real no está cerrada.

Dos intentos controlados anteriores no demostraron el flujo porque el OAuth enlazó un usuario real de Emi en lugar de un vendedor de prueba. No se ejecutó pago.

Falta demostrar, con **vendedor de prueba correcto + comprador de prueba**:

- pago aprobado;
- webhook firmado;
- decremento de stock exactamente una vez;
- rechazo/cancelación segura;
- reconciliación/expiración según el flujo definido.

Adquirir las cuentas/credenciales de prueba es dependencia humana. No enlazar OAuth, habilitar la bandera ni ejecutar pagos hasta que la PM abra formalmente esa ejecución y Emi autorice el paso correspondiente.

## Alcance contractual vivo

Fuente vinculante: `CONTRATO.md`. Guardas: `ALCANCE-Y-LIMITES.md`.

Puntos que no deben volver a inferirse desde roadmaps históricos:

- comprador y vendedor/prestador son los roles contractuales; transportista es un tipo especial de proveedor;
- búsqueda por categoría y ubicación;
- logística por cercanía, con cobertura/capacidad y selección o contacto directo;
- Mercado Pago checkout básico como resultado contractual;
- transferencia directa al vendedor con CBU/Alias, comprobante y validación manual;
- TopGreen/AgroBoeda no recibe, retiene, divide ni gira fondos de terceros;
- OAuth de vendedor con comisión marketplace cero es mecanismo técnico, no una feature comercial adicional;
- PostgreSQL + PostGIS;
- QA, despliegue, accesos administrativos, capacitación y documentación de despliegue forman parte del cierre contractual.

Suscripciones, planes, mensajería interna, tierras/parcelas, chatbot/IA y otras ampliaciones no bloquean el MVP salvo que código ya existente introduzca riesgo real.

## Producción — puertas pendientes

Antes de una publicación final deben quedar demostrados, como mínimo:

- composición candidata integrada y doble suite independiente sobre el mismo SHA;
- inventario Railway y política de ramas/deploy resuelta;
- backups y persistencia;
- SMTP real para el flujo de validación por correo; `outbox` no satisface producción;
- secretos/configuración revisados;
- homologación Mercado Pago real;
- auditoría general + red-team de seguridad final;
- datos/demo/credenciales públicas retirados o rotados;
- documentación de despliegue, capacitación y accesos administrativos;
- propiedad/pago de Railway y dominio acordados para el cierre.

Después de una migración de esquema no se hace rollback ciego sólo de código. La recuperación normal es forward-fix; un downgrade necesita procedimiento probado y backup recuperable.

## Restricciones operativas

- PM sólo modifica `docs/pm/` durante el flujo normal; no implementa producto.
- Dev no integra ni despliega sin tarea explícita.
- Auditorías externas son consultivas; la PM decide qué adopta.
- Un documento de auditoría no se convierte en una fuente de verdad paralela.
- `docs/PROJECT_STATUS.md` es histórico y no se usa como estado.
- Los fósiles `docs/PM_ROADMAP.md` y `docs/PM_DEV_GUIDE.md` se retiraron en la poda documental; su historia sigue en Git.
- No copiar secretos ni credenciales a documentación.

## Próxima secuencia

1. **PM revisa `COPY-CLEAR-1`** sobre la rama Dev: diff, focales y hallazgos.
2. PM reproduce `a11y` y el problema de contaminación de 167/168 para separarlos de la entrega.
3. PM acepta o devuelve `COPY-CLEAR-1`.
4. Sin nueva tarea de producto, inventariar Railway antes de cambiar arquitectura de ramas/deploy.
5. Preparar la composición excepcional `main + trabajo Dev aceptado` y probar el mismo SHA de forma independiente.
6. Después de converger integración, continuar el roadmap contractual; Mercado Pago/red-team/producción permanecen al final de la secuencia acordada, sin esperar artificialmente a una fecha si las dependencias ya están listas.
