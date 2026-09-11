# Auditoría adversarial convergida del cierre MVP — 2026-09-11

> **Documento aislado de análisis.** No es `NOW.md`, no reemplaza `CONTRATO.md`, no es una orden para Dev y no modifica por sí mismo el flujo PM/Dev vigente.
>
> Su objetivo es que una sesión de Work pueda leer una segunda auditoría independiente, contrastarla con el repositorio y decidir qué integrar al proceso real sin contaminar los canales operativos.
>
> Para la auditoría separada de roles/gobernanza leer también:
> `docs/pm/REVISION-ARQUITECTURA-OPERATIVA-2026-09-11.md`.

## 1. Alcance de esta auditoría

Esta revisión toma como fuente contractual principal `docs/pm/CONTRATO.md` y contrasta contra:

- `docs/pm/ALCANCE-Y-LIMITES.md`;
- `docs/pm/CRONOGRAMA.md`;
- `docs/pm/ROADMAP-CIERRE-MVP-2026-08-31.md`;
- `RAILWAY.md`;
- código actual;
- evidencia de pruebas y reproducción;
- estado de divergencia entre `main` y la rama Dev;
- dos rondas adversariales PM ↔ Dev realizadas el 11/09.

No se tocó producto, Railway, Mercado Pago, secretos, ramas ni datos para producir esta auditoría.

---

## 2. Estado contractual del MVP

### Esencialmente cubierto

- comprador y vendedor;
- registro/perfiles;
- catálogo y categorías;
- búsqueda por categoría y ubicación;
- carrito e historial;
- vendedor con publicación, stock y ventas;
- logística/directorio de transportistas con geolocalización;
- transferencia bancaria con CBU/Alias, comprobante y validación manual;
- PostgreSQL + PostGIS;
- base responsive suficiente para el MVP.

### Todavía no cerrado de forma entregable

- Mercado Pago de punta a punta con evidencia externa completa;
- composición integrada de todas las entregas aceptadas;
- suite final sobre esa composición exacta;
- inventario inequívoco del entorno Railway vigente;
- backups/restauración/persistencia del entorno que vaya a quedar;
- correo real para validación de usuarios en producción;
- red-team final;
- despliegue productivo definitivo;
- documentación/capacitación/accesos de cierre.

Conclusión: el faltante dominante ya no es construir otro marketplace; es convertir mucho trabajo ya aceptado en una versión integrada, verificable y operable.

---

## 3. Mercado Pago: separar contrato, mecanismo y operación

La discusión adversarial convergió en tres niveles.

### A — Resultado contractual

Esto es lo que debe poder demostrarse como comportamiento del MVP:

- el comprador puede pagar mediante Mercado Pago con los medios incluidos por el contrato;
- una compra aprobada termina reflejada como pagada;
- comprador y vendedor observan un estado coherente;
- el stock se descuenta una sola vez;
- un pago rechazado no genera una venta válida;
- transferencia directa mantiene CBU/Alias, comprobante y validación manual.

### B — Mecanismo necesario

No es una función comercial adicional ni debe venderse como alcance nuevo, pero es necesario para que A sea verdadero en la implementación elegida:

- OAuth por vendedor;
- vendedor cobra directo;
- TopGreen no usa `marketplace_fee`;
- Webhook firmado;
- idempotencia/descuento único;
- cierre de preferencia/link;
- cancelación segura y estados coherentes.

### C — Robustez operativa

Mantiene A verdadero en el tiempo y frente a fallos:

- reconciliador programado;
- barrido automático de vencimientos;
- recuperación frente a avisos perdidos;
- automatización operativa equivalente.

`CRONOGRAMA.md` ya exige evitar órdenes inmortales y registra reconciliación/vencimiento como parte del cierre. Por eso no conviene reducir MP a “una pantalla de checkout”: el observable contractual tiene que permanecer verdadero después del retorno del navegador.

### Estado actual

El código de MP está avanzado, pero la homologación externa sigue incompleta. Los intentos anteriores no demostraron el recorrido completo porque el vendedor terminó vinculado a la cuenta real equivocada. No deben reutilizarse como evidencia verde de pago/Webhook.

La dependencia humana que sí puede adelantarse ahora es conseguir las cuentas/credenciales de prueba correctas. **Eso no autoriza todavía vincular OAuth, encender `MP_CHECKOUT_HABILITADO` ni ejecutar el guion.**

---

## 4. Railway: decisión técnica cerrada, riesgo operativo todavía abierto

Railway ya fue aprobado internamente por Emi. No se propone migrar a AWS/Render/Supabase sólo porque el PDF los mencione.

Lo que sí falta cerrar es el entorno real:

```text
Frontend vigente → proyecto Railway → branch → SHA
Backend consumido → proyecto Railway → branch → SHA
PostGIS asociada
backups activos: sí/no
restauración ensayada: sí/no
auto-deploy: sí/no
último deploy: push/redeploy manual
volúmenes/persistencia
```

La aparición de `yneratopgreen-production.up.railway.app` y el histórico `strong-playfulness` obliga a inventariar antes de reorganizar ramas o integrar el lote acumulado.

### Riesgo comercial separado

No hay una decisión clara documentada sobre:

- titularidad de la cuenta Railway después de la entrega;
- quién paga el hosting después del período inicial;
- dominio definitivo y titularidad.

Esto no es un bloqueo técnico del MVP, pero sí una conversación barata de cerrar antes del hito final. Conviene incluirla en la presentación del hito intermedio, no abrirla como alarma aislada.

---

## 5. Causa de la divergencia de ramas

La divergencia entre `main` y la rama Dev no fue simple desorden.

La PM ordenó repetidamente no integrar porque `main` estaba acoplada a producción. Por lo tanto:

```text
integrar código aceptado == potencialmente publicar
publicar Backend == potencialmente ejecutar migraciones
```

Retener entregas aceptadas fuera de `main` fue una consecuencia racional de esa arquitectura.

La corrección estructural propuesta es:

```text
rama de tarea
   ↓ revisión PM
main = integración aceptada
   ↓ decisión de release
release = producción
   ↓
Railway
```

### Guardas mínimas

- Railway debe observar sólo `release`.
- `release` no recibe commits propios; sólo avanza a una revisión ya contenida en `main`.
- antes de publicar debe verificarse la relación de ancestro (`git merge-base --is-ancestor ...`).
- `main` y `release` no deben reescribirse.
- una entrega nueva se acepta contra el `main` vigente, no contra una base histórica.

### Migraciones y rollback

El backend productivo ejecuta `alembic upgrade head` antes de servir.

Por lo tanto, después de una migración **retroceder sólo el código está prohibido**: el esquema puede quedar adelantado respecto del binario.

Regla propuesta:

- recuperación normal = forward-fix;
- downgrade de esquema sólo con procedimiento explícito, probado y backup recuperable;
- nunca asumir que mover `release` hacia atrás revierte la base.

---

## 6. Configuración también forma parte del release

El incidente CORS del 11/09 mostró que igualdad de SHA no implica un sistema correcto.

Código y configuración pueden divergir.

Por eso cada release debe registrar, sin exponer secretos:

- qué variables existen por servicio;
- qué servicio cambió;
- qué variable/configuración cambió;
- motivo;
- quién autorizó;
- evidencia de verificación posterior.

No se versionan valores secretos. Se versiona el contrato de configuración y el cambio operativo.

---

## 7. Gate para sanear la integración acumulada

La primera integración del lote grande necesita una puerta excepcional.

Propuesta convergida:

1. crear una composición candidata exacta;
2. congelar su SHA;
3. Dev corre suite completa desde base limpia sobre ese SHA;
4. PM corre la misma suite desde otra base limpia sobre el mismo SHA;
5. ambos ejecutan las puertas estáticas aplicables;
6. si un caso falla sólo en un entorno, se reproduce aislado en ambos antes de clasificarlo;
7. hasta resolver la discrepancia, la composición no queda aceptada.

Esto demuestra más que dos corridas del mismo actor porque desacopla entorno, máquina, base y lectura del resultado.

---

## 8. COPY-CLEAR-1

La auditoría inicial la clasificó demasiado cerca de “pulido”. La revisión Dev corrigió esa lectura.

Debe continuar porque contiene defectos de verdad funcional:

- botón Buscar que no cumple lo que promete;
- planes/comisiones inexistentes mostrados al usuario;
- recuperación de contraseña no implementada presentada como si existiera;
- estados crudos/idioma inconsistente.

No es razón para abrir funciones nuevas ni rediseñar. Es corrección mínima de comportamiento y honestidad del producto.

Además conviene terminarla antes de integrar el lote porque toca archivos que ya están divergidos; posponerla volvería a abrir divergencia inmediatamente después del saneamiento.

---

## 9. Calendario

El ancla contractual vigente es 21/08/2026. El 11/09 comienza la semana 4, dentro de Fase 2.

El proyecto está adelantado funcionalmente respecto del cronograma.

Eso no implica esperar artificialmente hasta octubre si una puerta anterior ya está cerrada, pero sí conserva el orden acordado por Emi:

```text
cierre funcional / limpieza
→ integración y verificación
→ Mercado Pago
→ red-team / QA final
→ producción
```

Las dependencias humanas con latencia pueden iniciarse antes sin adelantar ejecución técnica.

Ejemplo válido ahora:

- obtener cuenta vendedora de prueba correcta;
- obtener conformidades/titularidad/dominio;
- preparar credenciales.

Ejemplo que ya es ejecución de Fase 4 y no entra en ese permiso:

- vincular OAuth;
- encender la bandera de checkout;
- crear pagos;
- ejecutar el guion de homologación.

---

## 10. Inconsistencias documentales detectadas

No se corrigen desde este documento; se dejan enumeradas para que Work decida cómo incorporarlas sin mezclar esta auditoría con los canales vivos.

1. `README.md` todavía afirma Split Payments 5%/95%, contradictorio con el producto actual.
2. `README.md` sigue enviando a `docs/PROJECT_STATUS.md` como lectura prioritaria aunque ya no es fuente confiable.
3. `ALCANCE-Y-LIMITES.md` conserva el ancla contractual vieja del 07/08; `CRONOGRAMA.md` la reemplazó por 21/08.
4. `main` continúa documentada/operada como producción en partes del material histórico.
5. La configuración de Railway no tiene aún la misma disciplina de trazabilidad que el código.

---

## 11. Camino crítico propuesto

### En paralelo desde ahora

- cuenta vendedora de prueba de Mercado Pago correcta;
- definición/conformidad de hosting, titularidad/costo y dominio;
- inventario real de Railway.

Estas acciones se frenan antes de ejecutar MP.

### Secuencial

1. terminar `COPY-CLEAR-1`;
2. corregir contradicciones documentales de alto riesgo de contexto;
3. inventariar y elegir el entorno Railway real;
4. cerrar la semántica `main`/`release`;
5. integrar el acumulado sin publicar;
6. ejecutar las dos suites independientes sobre el mismo SHA candidato;
7. continuar el cronograma: MP-D completo;
8. red-team, QA final, SMTP, backups/restauración y producción;
9. capacitación, documentación y accesos;
10. acta de lanzamiento e inicio de los 90 días de garantía.

---

## 12. Qué NO debe hacer una sesión de Work al leer esto

- no tratar esta auditoría como nueva fuente de verdad contractual;
- no reemplazar `CONTRATO.md` ni `CRONOGRAMA.md`;
- no editar `PARA-DEV.md` o `PARA-PM.md` sólo porque este documento lo sugiere;
- no reorganizar ramas sin inventario Railway y autorización de Emi;
- no tocar Mercado Pago ni credenciales por haber leído el apartado MP;
- no convertir decisiones propuestas en reglas permanentes sin contrastarlas contra el estado actual del repo.

## 13. Encargo recomendado a Work

Leer conjuntamente:

1. `docs/pm/REVISION-ARQUITECTURA-OPERATIVA-2026-09-11.md`;
2. `docs/pm/AUDITORIA-MVP-CONVERGIDA-2026-09-11.md`.

Después:

- contrastar ambos documentos contra el repo actual;
- identificar qué conclusiones siguen vigentes;
- proponer el mínimo conjunto de cambios necesarios;
- separar claramente cambios de gobernanza, documentación, producto e infraestructura;
- no implementar nada hasta devolver ese plan para autorización de Emi.

Este archivo es deliberadamente externo al flujo vivo PM/Dev para que la auditoría no se convierta accidentalmente en una orden operativa.
