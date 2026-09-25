# PM → Dev

Canal de la PM hacia la dev. **Sólo lo escribe la PM.** La dev responde en
`docs/pm/PARA-PM.md` y no edita este archivo.

---

## Tarea activa — USER-GUIDE-1

**Rama y base:** `claude/dev-role-repo-3l0kp3`, desde el último commit PM.

### Decisión sobre la entrega anterior

`COPY-AGRO-1` quedó **aceptada en rama** sobre `2b92988`.

- 192 en 1/1.
- Tus tres negativos dan rojo. El mío, un `aria-label` con «AGRO» en
  mayúsculas en el pie, también.
- 24/24 relacionados; auditoría móvil, a11y y contraste verdes.

**Bajada de la portada:** Emi decidió que quede en dos renglones en los
celulares angostos, como lo pidió la clienta. El tuteo de Quiénes somos
queda como P3, junto al #14. Evidencia en
`REPRODUCCION-COPY-AGRO-1-2026-09-25.md`.

**Publicación:** el 25/09 subió a `main` `e9cf4c6`, con todo hasta
`BRAND-LOSS-1`, y Emi verificó el sitio. `COPY-AGRO-1` sale en la próxima
tanda.

### Problema y prioridad

El contrato incluye la capacitación y la documentación de uso. El panel de
administración ya tiene su guía verificada. Quienes compran, venden y
transportan todavía dependen de las secciones de `docs/USER_MANUAL.md`, que
no se comprueban contra la aplicación y tienen afirmaciones viejas. No
depende de Emi ni de la clienta.

### Alcance

Una guía de uso en español llano, con la misma técnica que
`GUIA-PANEL-ADMIN.md`:

- pasos con textos de pantalla entre «»;
- frases de resultado atadas a su comprobación;
- una lista declarada de lo que no se comprueba, con su fuente;
- capturas generadas por script en escritorio y celular.

Tres secciones:

- **Quien compra:**
  - registrarse y confirmar el correo;
  - buscar y filtrar por categoría, ubicación y el resto de los filtros;
  - la página de la publicación;
  - carrito y checkout;
  - elegir cómo se traslada: transportista o por cuenta propia;
  - pagar por transferencia y subir el comprobante;
  - «Mis compras»;
  - cancelar.
- **Quien vende:**
  - publicar: categoría, ubicación, fotos y marca donde corresponda;
  - editar, pausar, activar y eliminar;
  - stock;
  - datos bancarios;
  - revisar el comprobante: aprobar o rechazar con motivo;
  - el estado de envío;
  - presentar la constancia fiscal.
- **Quien transporta:**
  - activar el perfil de transportista: base, radio, capacidad y
    habilitación declarada;
  - qué ve cuando lo eligen;
  - cómo se contactan.

Además:

- **Los límites** van al principio, con la misma redacción que la guía del
  panel: la plataforma no maneja fondos de terceros, la transferencia la
  valida quien vende, y el teléfono y las suscripciones figuran como
  **PENDIENTE**.
- **Mercado Pago** figura como **PENDIENTE de homologación**. No se documenta
  como si funcionara con cuentas reales.
- **La confirmación por correo** se documenta como funciona. Agregá una nota:
  en el sitio demostrativo todavía falta el correo real.
- **`USER_MANUAL.md`:** sus secciones de comprador y vendedor se reemplazan
  por un enlace a la guía, sin dejar afirmaciones falsas. Proponé la ruta
  del archivo.

**Si es demasiado para una sola entrega**, proponé en `PARA-PM.md` cómo
partirla, por ejemplo quien compra primero, **antes** de construir.

### Fuera de alcance

- Cambios en `src/` o `backend/`. Los defectos que encuentres se informan con
  reproducción y no se corrigen.
- La guía del panel de administración.
- La documentación del despliegue.
- Suscripciones, planes y mensajería.

### Aceptación verificable

1. El script recorre la guía en el navegador, sobre la base demo, en los dos
   anchos. Falla y nombra el paso si falta un texto, si una frase de
   resultado cambia o no se cumple, o si se cambia una frase declarada.
2. **Negativos:**
   - un texto de pantalla falso;
   - una frase de resultado invertida;
   - un cambio en la aplicación que la guía debería detectar.
3. La lista de lo que no se comprueba, con su fuente.
4. Sin credenciales reales ni términos comerciales. Las cuentas demo, si
   aparecen, van marcadas como públicas.
5. `git diff` vacío en `src/` y `backend/`. Build y diff-check con
   `cr-at-eol` verdes.

### Frená y consultá

- Si documentar algo exige afirmar un comportamiento que no está decidido.
  Marcalo `PENDIENTE` y seguí con el resto.

### Entrega en `PARA-PM.md`

- SHA;
- la ruta de la guía;
- la salida del script y de los negativos;
- la lista declarada;
- los defectos encontrados;
- riesgos.

No integres ni despliegues.
