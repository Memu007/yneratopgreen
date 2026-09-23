# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## MOBILE-AUDIT-FLOW-1 — entregada, con tres objeciones

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

**Tres objeciones a tu planteo, con evidencia.** La pieza está hecha dentro
del alcance que diste. Pero ese alcance deja la auditoría en rojo y con un
punto ciego, y el diagnóstico del panel quedó corto.

1. **El panel sí tiene un defecto de producto, aunque el botón no.** Tenés
   razón en que «Limpiar filtros» funciona con el panel abierto. Pero plegar
   con `max-height: 0` deja los controles en el orden del teclado. A 390 px,
   con el panel cerrado, Tab desde «Filtros» recorre Tipo, Categoría,
   Provincia y Precio, y ninguno se ve: el panel mide 0 px de alto. Por la
   regla del CSS pasa en todo ancho menor a 1024 px, incluido el escritorio
   con zoom al 200 %. Para reproducirlo: Mercado a 390 px, foco en «Filtros»
   sin abrir, Tab cuatro veces; el foco desaparece las cuatro. Recomiendo
   una pieza de producto propia; es chica.
2. **Con este alcance, «complete sus recorridos» no se cumple.** Eso dice
   `NOW.md`. Pero la compra se corta en otro lado, sin relación con el panel:
   el checkout pide elegir «Cómo se traslada cada pedido», el script no
   elige, y la pantalla responde «Falta decidir cómo se traslada un
   pedido.». Como pediste frenar ahí, la auditoría termina 9 de 12 y sale
   con 2. O ampliás esta pieza, o la aceptás con la auditoría en rojo y abrís
   otra. Recomiendo ampliarla: es el mismo archivo y es poco —elegir
   «Coordino el traslado por mi cuenta»; lo probé con una sonda y llega a
   «Medio de pago»—, y sin eso la auditoría no llega a la pantalla del
   punto 3.
3. **La medición de desborde que pediste conservar no ve un desborde dentro
   de una capa.** Sólo compara el ancho del documento. En el checkout,
   «Datos de envío» mide 400 px dentro de una capa de 320 a 360 px, y la capa
   se desplaza de costado: 432 px de contenido para 320 de ancho. A la
   vista, rótulos, campos y opciones de traslado quedan cortados a la
   derecha, 60 px pasado el borde a 360 y 30 px a 390. El documento sigue
   midiendo 360 y 390, así que la auditoría daría «Desbordes horizontales:
   0». Lo medí con una sonda aparte, con el mismo cálculo que usa la
   auditoría. Recomiendo contar también los contenedores que se desplazan de
   costado. La tabla del panel de administración hace lo mismo, pero a
   propósito: hay que nombrarla como excepción, porque por el CSS no se
   distingue de la capa del checkout. Iría con el punto 2. El checkout
   parece un defecto real del producto y no lo toqué.

**Y una premisa que no es cierta: `DECISIONS.md` dice que no tengo PostGIS.**
Tengo PostgreSQL con PostGIS 3.4.2 nativo: `select postgis_lib_version()`
responde `3.4.2`. Corrí la suite completa desde base limpia en la pieza
anterior, que aceptaste, y ahora la auditoría completa. Lo único que no
tengo es Docker, y sólo lo pide el caso 131. Esa premisa hace que cargues
corridas que no hacen falta. La decisión es de Emi.

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

## Visto y no tocado

- **En la ficha a 360 px, el rótulo de la placa se corta.** «Sin registro
  fotográfico» queda cortado abajo. La proporción del marco es la misma
  regla que tenía el modal, así que no viene de la página nueva.
- No agregué en esta pieza el conteo del punto 3: sin la excepción de la
  tabla de administración, marcaría como hallazgo algo que es a propósito,
  y decidir qué desplazamiento lateral se acepta te toca a vos.

No toqué `main`, Railway, producto ni datos, y no desplegué. Freno acá.
