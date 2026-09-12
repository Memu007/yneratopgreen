# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en `docs/pm/PARA-PM.md` y no edita este archivo.

Este archivo contiene únicamente la tarea activa y su hilo de devoluciones hasta el cierre. La historia anterior permanece en Git; la instantánea previa a esta poda está en `ab4165fc`.

Antes de empezar:

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

---

## 2026-09-11 — COPY-CLEAR-1

Es una pasada editorial y de claridad funcional; no autoriza rediseño ni funciones nuevas.

1. **La marca vuelve a Inicio y no se reabre.** Los controles de marca de Header y Footer llevan a Inicio y el 156 lo prueba con teclado. Conservá ese comportamiento; no rehagas marca, activos, navegación ni estilos.
2. **Buscar tiene una acción real.** En Mercado, escribir no debe ejecutar una búsqueda distinta de la que promete el botón. Clic en «Buscar» y Enter aplican la consulta actual recortada, actualizan `q`, consultan el catálogo y muestran el resultado; una consulta vacía limpia el filtro. Retirá el `console.log`. No agregues motor, fuzzy search, índice, endpoint ni paginación.
3. **No se prometen planes ni comisiones inventadas.** En Contacto, retirá la referencia a planes inexistentes y explicá con precisión la regla vigente: AgroBoeda no cobra comisión por la venta en este MVP y el pago va al vendedor. No crees planes, suscripciones ni cobros.
4. **Contraseña: salida honesta, no recovery.** Login debe ofrecer una instrucción visible para quien olvidó la contraseña y llevar a Contacto. No prometas envío, recuperación automática ni plazo; no agregues token, email, endpoint, modal o formulario de reset. La herramienta manual de administración no se modifica.
5. **Voseo es-AR, con revisión humana.** Corregí frases visibles que mezclan tuteo en Login, registro, carrito, alta/edición, panel y errores. Usá voseo rioplatense natural sin alterar sustantivos correctos ni marcar coincidencias por regex sin contexto.
6. **Estados visibles en español; valores de API intactos.** Centralizá rótulos del panel administrativo para publicaciones y órdenes. Ninguna celda/badge muestra tokens crudos. Los `value` de selectores y cuerpos PATCH siguen usando tokens de Backend. No cambies enums ni inventes estados.

### Prueba y entrega

- Conservá el 156 verde. Extendé el 160 para comprobar rótulos es-AR exactos y que selector/PATCH mantienen tokens del Backend. Agregá el 168 para búsqueda por clic/Enter, limpieza de `q`, FAQ sin planes, salida de soporte desde Login y una muestra representativa de voseo.
- Mostrá rojo contra la base anterior para cada familia que el caso nuevo cubre y un negativo discriminante para búsqueda y estados.
- Corré 156+160+168 focales y después una suite completa desde base limpia.
- Corré lint, `node --check scripts/smoke.mjs`, a11y y `diff-check`; el smoke ya incluye build. Contraste/capturas sólo si realmente cambiás estilos.
- Producto/regresión en un commit e informe `PARA-PM.md` aparte.

### Fuera de alcance

Sin Backend, schema, dependencia, pagos, datos remotos, Railway, despliegue, activos de marca, mensajería ni recuperación automática.

No integres a `main` ni despliegues. Frená al entregar.

### Estado del hilo

Dev informó entrega en su rama con producto/regresión `9f25d59`; la PM todavía debe revisar y aceptar o devolver esa entrega. Hasta esa decisión no se abre una tarea nueva.
