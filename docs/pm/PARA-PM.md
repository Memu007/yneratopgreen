# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ADMIN-GUIDE-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `238e6f7` |
| candidato | `81f40dd` |
| guía | `docs/GUIA-PANEL-ADMIN.md` |
| imágenes | `docs/guia-panel-admin/` (14 PNG, 1,3 MB) |
| cambios en `src/` y `backend/` | ninguno |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** La guía cubre las siete pestañas del panel en 26 pasos. Para
cada acción dice qué hacer, qué no se puede y qué pasa después, incluido
qué ve quien vende. Abre con los límites de la plataforma.

`scripts/guia-admin.mjs` la recorre en el navegador, en escritorio y en
celular, sobre la base demo, y comprueba tres cosas:

- **Textos:** los 237 textos entre «» aparecen en la pantalla en su paso.
- **Resultados:** lo que el paso dice que pasa, pasa. Por ejemplo:
  - la cuenta desactivada no entra y se le corta la sesión;
  - la publicación pausada sale del Mercado;
  - quien vende la puede reactivar.
- **Inventario:** ningún control de las pestañas queda sin nombrar en la
  guía.

Con `--capturas` rehace las imágenes. `USER_MANUAL.md` ahora enlaza la guía
en vez de su sección de administración.

**Lo que decidís vos (no bloquea): suscripciones y teléfono.** Tu tarea pide
decir que «el teléfono de contacto sólo sale con suscripción activa». Hoy
eso no es lo que hace la plataforma:

- `DECISIONS.md` pasa «los candados de contacto por plan» a la Fase 6.
- No existe ninguna suscripción, ni un control en el panel para activarla.
- La decisión del 26/07 decía que el administrador la activaba a mano; no
  está construido.

La guía dice lo que pasa hoy:

- en el Mercado y en las fichas no aparece el teléfono de nadie;
- quien compra y quien vende ven el del otro en su orden;
- quien compra ve el del transportista después de elegirlo;
- el transportista no recibe el contacto de quien compra.

Y marca **suscripciones y planes: PENDIENTE**. Si la regla vigente es otra,
se cambia ese párrafo. Conviene que Emi resuelva la contradicción entre las
dos decisiones.

## Para verificar, lo mínimo

```
node scripts/guia-admin.mjs
  → [OK] Paso 1. Abrir el panel … [OK] Paso 26. Volver a pedirla   (26 por ancho)
    LA GUÍA Y EL PANEL COINCIDEN: 26 pasos en escritorio y celular

python3 scripts/sabotajes_admin_guide_1.py
  → [ROJO ESPERADO] salida 1
      [FALLA] Paso 5. Desactivar y volver a activar una cuenta: la guía nombra
      «Suspender cuenta» y el panel no lo mostró en este paso
    [ROJO ESPERADO] salida 1
      [FALLA] Paso 6. Restablecer una contraseña: el panel no muestra
      «Restablecer contraseña», que el recorrido tenía que tocar
      [FALLA] inventario: la pestaña «Usuarios» muestra «Nueva contraseña» y
      su sección de la guía no lo nombra
    src y guía despues: como estaban
```

**Antes de correrlos:**

- Los dos necesitan la API en 8000, el frontend de desarrollo en 5173 y la
  siembra demo, con `admin@topgreen.com`.
- Para los conteos del resumen usan el mismo `docker exec topgreen-db psql`
  que el smoke.
- La guía tarda unos 4 min en los dos anchos. Los negativos, unos 3 min:
  corren sólo en escritorio.
- **Cada corrida deja cosas creadas:**
  - cuatro cuentas;
  - dos publicaciones, que termina eliminando;
  - una orden por transferencia;
  - dos presentaciones de documentación.

  La categoría y la opción que crea las elimina el propio recorrido. Anda
  sobre una base limpia o con restos: lo corrí de las dos formas.
- `boton-inventado` usa una copia de la guía en una carpeta temporal.
  `panel-cambiado` toca `AdminPanel.tsx` y lo restituye.

## Defectos encontrados, sin corregir

Cada uno tiene su reproducción. La guía recorre los cuatro tal como están
hoy, con una advertencia, así que si se corrigen el script falla y avisa que
hay que actualizar la guía.

1. **«Agotada» no hace lo que dice su confirmación.** El cuadro dice «Sigue
   visible pero no se puede comprar.», pero la publicación sale del Mercado
   y su enlace da 404: el catálogo y la ficha sólo muestran las activas.
   Reproducción: `PATCH /api/admin/products/{id}/status` con
   `{"status":"sold_out"}`; después `GET /api/catalog/products?search=…`
   da 0 y `GET /api/catalog/products/{id}` da 404. Es el paso 12.
2. **Quien vende ve «Activo» una publicación «Agotada» con stock.** «Mis
   publicaciones» sólo reconoce pausada, o agotada por stock en cero
   (`UserDashboard.tsx`, alrededor de la línea 372). Es el paso 12.
3. **El detalle de una orden en el panel sale incompleto.**
   - Dice «No hay detalles de items disponibles».
   - El correo y la dirección de quien compra aparecen con un guion.
   - El subtotal y el envío aparecen en $ 0, con el total correcto.

   La causa es que `GET /api/admin/orders` no devuelve `items`,
   `buyer_email`, `shipping_address`, `subtotal` ni `shipping_cost`
   (`backend/app/api/admin.py:349-390`). Es el paso 14; la imagen
   `ordenes-celular.png` lo muestra.
4. **Desactivar tu propia cuenta no dice por qué no se puede.** El panel
   muestra «Error al cambiar estado del usuario». El backend manda «No
   puedes desactivar tu propia cuenta», pero `handleToggleUserActive` lo
   descarta (`AdminPanel.tsx:855-863`). Con el rol propio sí muestra el
   motivo. Es el paso 8.

## Inventario: el panel contra la guía

| pestaña | controles, según el código | pasos |
|---|---|---|
| — | abrir con «Admin», cerrar con «×» o Escape | 1 |
| Dashboard | ocho números, cada uno comparado con un conteo propio en SQL | 2 |
| Usuarios | búsqueda, filtros por rol y estado, paginador; «+ Crear Usuario» (campos, rol, errores); por fila: rol, «Desactivar»/«Activar», «Restablecer contraseña»; lista vacía | 3–8 |
| Productos | filtro por estado, paginador; por fila: los cuatro estados | 9–13 |
| Órdenes | filtro con los nueve estados, paginador, «Ver» y el detalle, que es de sólo lectura | 14 |
| Categorías | filtro, «+ Nueva Categoría»; por categoría: mostrar u ocultar subcategorías, «Editar», «Eliminar»; subcategoría: agregar y eliminar | 15–18 |
| Documentación | filtro, constancia, «Aprobar», «Rechazar» con motivo | 19–21 |
| Configuración | cuatro listas, «+ Nueva Opción»/«Cerrar»; por opción: «Editar» (etiqueta, orden, estado), «Eliminar» | 22–25 |
| todas | el aviso de carga fallida con «Reintentar» | 26 |

**Del código, sin paso, y por qué:**

- **Provincias** en Configuración: el panel las retiró de la pantalla
  (`TIPOS_RETIRADOS`).
- **Activar o desactivar una categoría:** el panel dejó de ofrecerlo.
- **Editar una subcategoría y borrar una publicación del todo:** existen en
  la API, pero la pantalla no los ofrece.
- **Marcas:** no se administran desde el panel. La guía lo dice. Quién las
  carga en producción queda abierto.

**Del manual viejo, que eran falsos y la guía no repite:**

- sincronizar pagos por endpoint;
- cancelar órdenes;
- filtros de productos por categoría o vendedor;
- «ver perfil completo» de un usuario.

En «Atajos útiles» también saqué el botón de tema oscuro y la campana, que
no existen, y cambié «Avatar → Cerrar sesión» por **Salir**. Las secciones
de comprador y vendedor no las toqué: van en otra pieza.

## Lo que corrí

```
sobre 81f40dd, base limpia
  node scripts/guia-admin.mjs                 26/26 en escritorio y 26/26 en celular
  python3 scripts/sabotajes_admin_guide_1.py  los dos en rojo esperado, src y guía como estaban
antes, con el mismo producto y la misma guía
  --capturas sobre base limpia                26/26 y 26/26, 14 imágenes
build · node --check · py_compile · diff-check   verdes
git diff 238e6f7 81f40dd -- src backend          vacío
```

- Las imágenes salen de la corrida anterior al último ajuste del script,
  que sólo cambió cómo se escribe el motivo de una falla.
- En las capturas, los avisos de pasos anteriores se ocultan sólo en la
  imagen; la aplicación no se toca.
- La contraseña temporal del paso 6 no se captura.

**Credenciales y términos comerciales:**

- La única cuenta que aparece es la demo de administración, marcada como
  pública y a cambiar antes de producción.
- El alias de cobro de la vendedora del script es inventado, y los CUIT son
  los de prueba del arnés.
- La guía no nombra montos, porcentajes ni comisiones. Los importes de las
  imágenes son de la base demo.

## Riesgos

- El script reconoce partes del panel por fragmentos de nombres de clase
  (`categoryCard`, `statCard`, `_toastContainer_`) y por sus textos. Si se
  renombran, falla y lo dice. Es lo buscado, pero puede pedir ajustar el
  script además de la guía.
- Las imágenes quedan en el repositorio y no se rehacen solas: hay que
  correr `--capturas` cuando el panel cambie.

No toqué `main`, Railway, `src/`, `backend/` ni datos, y no desplegué. Freno
acá.
