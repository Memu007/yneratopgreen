# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## MOBILE-AUDIT-FLOW-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `624fac2` |
| candidato (arnés + negativos) | `8e4f7c6` |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** La auditoría móvil llega a la ficha en 360, 390 y 768 px.
Abre el panel con «Filtros», elige con los controles a la vista y limpia sin
intercepción. Comprueba que los tres filtros volvieron a «todas», vuelve con
«Ver N resultados» y abre la ficha, que queda cargada y con su URL propia.
Completa 9 de 12 recorridos. Los 3 que no completa son el de compra, uno por
ancho, y no es por el panel.

**Dos cosas para que decidas. Ninguna bloquea esta pieza.**

1. **El recorrido de compra está desactualizado.** El checkout pide elegir
   «Cómo se traslada cada pedido», y el script no elige. La pantalla responde
   «Falta decidir cómo se traslada un pedido.» y el pago nunca aparece. Es un
   defecto del script, no del producto. No lo arreglé porque pediste frenar
   si había que ampliar el alcance. Recomiendo una pieza chica para que elija
   «Coordino el traslado por mi cuenta» y siga.
2. **En celular, el checkout se sale por la derecha.** En «Datos de envío» el
   contenido mide 400 px: pasa 60 px el borde a 360 y 30 px a 390. La capa lo
   recorta, así que no aparece barra horizontal y la auditoría no lo cuenta
   como desborde. Se cortan rótulos, campos y el texto de las opciones de
   traslado. Lo medí con una sonda aparte, porque la auditoría no llega a esa
   pantalla. Parece un defecto real del producto y no lo toqué. Recomiendo
   verlo en la misma pieza que el punto 1, así la auditoría lo mide.

## Para verificar, lo mínimo

```
node scripts/mobile-audit.mjs
  → Recorridos completos: 9 de 12
    Controles que se ven y no reciben el toque: 0
    los 3 cortes: «compra, en 05-checkout-payment … waiting for
    getByRole('heading', { name: /Medio de pago/i })»; sale con 2
    crea docs/pm/evidence/mobile-AAAA-MM-DDTHH-MM-SS/ y no toca
    mobile-2026-07-26

python3 scripts/sabotajes_mobile_audit_flow_1.py recorrido-anterior
  → [ROJO ESPERADO] salida 1; se cortó en «Limpiar filtros» con el clic
    interceptado: sí; capturas de la ficha: ninguna
```

Los dos necesitan la API en 8000, el frontend de desarrollo en 5173 y los
usuarios de siembra. Mientras la compra siga desactualizada, la auditoría
sale con 2 aunque todo lo demás esté bien. La carpeta nueva queda sin
versionar dentro de `docs/pm/evidence/`; si no querés que quede ahí, pasá
`MOBILE_AUDIT_EVIDENCE_DIR`. La auditoría tarda unos 2 min, y los cuatro
negativos juntos, unos 6.

## Qué cambió (sólo `scripts/`)

- **El recorrido**: la auditoría abre el panel si está plegado, elige y
  limpia, y vuelve a los resultados como una persona. Después abre la ficha
  por el enlace del título. En compra hace lo mismo para elegir «Productos».
- **Qué es de quién**: antes de tocar un control, el script mira si una
  persona podría tocarlo. Si el control está en el panel plegado, la falla es
  del script y la salida lo dice así. Si el control se ve pero en su centro
  hay otra cosa, es un hallazgo de UI. Un vencimiento sin más no se atribuye a
  nadie: la salida dice qué se esperaba.
- **Un corte no apaga el resto**: cada recorrido se anota completo o cortado,
  con pantalla y motivo, y la auditoría sigue con el siguiente. Antes, el
  primer corte terminaba toda la corrida.
- **La evidencia**: cada corrida crea su carpeta con fecha y hora, o usa
  `MOBILE_AUDIT_EVIDENCE_DIR`. Se niega a escribir en una carpeta que ya
  tenga archivos.
- Las mediciones no cambiaron: desborde, blancos táctiles, texto, consola y
  red.

Sin cambios en producto, backend ni datos.

## Lo que corrí, sobre `8e4f7c6`

```
auditoría, 360/390/768                          9/12 recorridos; 33 pantallas;
                                                0 desbordes; 0 controles
                                                tapados; 0 consola; 0 4xx/5xx;
                                                ficha cargada en los tres anchos
negativos                                       4/4 rojos esperados, árbol
                                                como estaba
  recorrido-anterior   salida 1, cortado en «Limpiar filtros», sin ficha
  panel-cerrado        salida 2, «falla del script: quiso operar «Categoría»
                       con el panel de filtros plegado», 0 tapados, sin ficha
  limpiar-tapado       «Limpiar filtros» como hallazgo de UI en los tres
                       anchos, ninguno atribuido al script
  sobrescribir         salida 2, se negó, los 25 archivos versionados de
                       la carpeta idénticos byte a byte
node --check · py · lint · tsc --noEmit         verdes
diff-check compatible con CRLF                  sin avisos
```

No corrí la suite smoke, como pediste, ni el build, porque `src/` no
cambió. Mis corridas dejaron la evidencia fuera del repositorio y no se
versiona.

Un dato para `DECISIONS.md`: dice que no tengo PostGIS. Tengo PostgreSQL
con PostGIS 3.4.2 nativo, sin Docker, y por eso pude correr la auditoría
completa. Lo único que me falta es Docker, que sólo pide el caso 131. La
decisión es de Emi; te lo aviso para que no planifiques sobre eso.

## Visto y no tocado

- **Con el teclado, el foco pasa por filtros que no se ven.** A 390 px, con
  el panel cerrado, Tab desde «Filtros» recorre Tipo, Categoría, Provincia y
  Precio, que no se ven porque el panel mide 0 px de alto. Por la regla del
  CSS pasa en cualquier ancho menor a 1024 px, incluido el escritorio con
  zoom al 200 %.
  Es un defecto de accesibilidad del producto que esta auditoría no mide.
- **En la ficha a 360 px, el rótulo de la placa se corta.** «Sin registro
  fotográfico» queda cortado abajo. La proporción del marco es la misma
  regla que tenía el modal, así que no viene de la página nueva.
- La tabla de productos del panel de administración se pasa del ancho a
  propósito y se desplaza dentro de su marco. Por eso no agregué un conteo de
  «elementos fuera del ancho»: la marcaría como hallazgo.

No toqué `main`, Railway, producto ni datos, y no desplegué. Freno acá.
