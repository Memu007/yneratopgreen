# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — ADMIN-MOBILE-ACCESS-1

**Prioridad y problema.** El contrato exige interfaz responsive. En la rama
actual, el panel de administración tiene siete secciones y, a ancho móvil,
`AdminPanel.module.css` deja la navegación con `overflow-x: auto` y reduce el
botón Cerrar a 35 × 35 px. El relevamiento de `MATRIZ.md` ya marcaba pestañas
ocultas por desplazamiento horizontal y blancos táctiles menores a 44 px.
Esta pieza cierra sólo ese borde del panel admin antes del QA final.

**Alcance.** Reproducí primero el estado actual en el panel real con 360 × 800
y 390 × 844. Si se confirma, hacé visibles y alcanzables las siete secciones
sin depender de descubrir un desplazamiento horizontal, y llevá el blanco
táctil de Cerrar a por lo menos 44 × 44 px. Conservá los nombres, la sección
activa, el contenido, la jerarquía modal y la navegación por teclado. Usá la
solución más pequeña coherente con el diseño existente.

**Fuera de alcance.** Otros paneles, rediseño global, cambio de tokens,
backend, datos, permisos, integración y despliegue.

**Aceptación verificable.** En 360 × 800 y 390 × 844, las siete secciones
deben verse sin corte ni desplazamiento horizontal de la barra; cada botón
de navegación y Cerrar debe tener un blanco medido de al menos 44 × 44 px.
En 768 × 1024 el panel sigue utilizable. Al activar cada sección con tacto y
teclado se presenta su contenido y el estado activo correcto; foco visible,
sin desborde horizontal de la página ni errores de consola. Abrir/cerrar un
detalle de orden conserva sección, filtros y posición como antes. Medí
geometría real del navegador; no alcanza una inspección de CSS.

**Pruebas y evidencia.** Entregá antes/después de las tres medidas, el cambio
mínimo de producto y una regresión focal que falle sobre el comportamiento
anterior y pase con la corrección. Corré build, lint, tipos y las pruebas
existentes que tu entorno permita; informá el resultado exacto. Las puertas
que requieran Docker/PostGIS quedan a cargo de PM según `DECISIONS.md`. No
repitas la suite completa salvo que el cambio salga de este alcance o aparezca
un rojo inesperado: PM hará la revisión independiente proporcional.

**Leé antes:** `CONTRATO.md` (responsive), `MATRIZ.md` (hallazgo),
`ROADMAP-CIERRE-MVP-2026-08-31.md` (puerta de usabilidad) y los casos actuales
de panel/modal. Si el problema no se reproduce, o resolverlo exige alterar
permisos, jerarquía modal o diseño global, frená y respondé con evidencia antes
de editar más.

**Entrega.** Respondé en `PARA-PM.md` con SHA exacto, archivos cambiados,
medidas y capturas o trazas antes/después, pruebas y rojos discriminantes,
riesgos restantes. No integres ni despliegues.
