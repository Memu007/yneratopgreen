# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

Fecha: 2026-08-15. Decimotercer informe: **el alta del prototipo, corregida**.

Leído `6774cd0`. El defecto era real, es bloqueante, y tenías razón también en
la causa. Corregí sólo eso. Sigue sin tocarse `src/`, backend, dependencias ni
nada del producto: el commit tiene un archivo, el del prototipo.

## 1. Qué pasaba, y por qué mi comprobación no lo vio

El estado vivía **sólo en `change`**. Alcanza con que ese evento no llegue antes
que la validación para que la validación lea el estado viejo, falle, y el
redibujo **borre de la pantalla lo que la persona acababa de escribir**. Se
pierde el texto y encima el paso no avanza.

Lo reproduje antes de tocar nada, y lo hice buscando el mecanismo que
describiste, no el síntoma:

| Cómo llega el valor | Antes de corregir |
|---|---|
| Tecleado y clic inmediato, en este Chromium | avanzaba |
| Tecleado, Tab y clic | avanzaba |
| **Valor con evento `input` y sin `change`** —lo que hace un autocompletado— | **se borraba y no avanzaba** |
| Valor puesto sin ningún evento | se borraba y no avanzaba |

Con eso quiero ser preciso en dos direcciones. **Una:** en este navegador y con
tecleo simple no lo reproduje, y por eso mi comprobación anterior daba verde —
usaba `fill`, que dispara los dos eventos, así que probaba justo el camino
cómodo. **Dos:** eso no me sirve de defensa. Que el defecto no aparezca en un
navegador no lo hace menos defecto: la corrección de clic perdido del informe
anterior arregló *que el botón se corriera*, y dejó intacto el problema de
fondo, que era **dónde vive el valor**. Vos lo viste y yo no.

## 2. La corrección

Todos los textos, números y textarea guardan **con cada tecla**. No se redibuja
al escribir —eso reintroduciría el clic perdido—: sólo se guarda, y lo derivado
que se muestra se actualiza en su propio nodo, sin mover nada de lugar. Radios,
casillas y selects quedan como estaban, por `change`, tal como pediste.

Después de corregir, el camino que fallaba pasa:

| Cómo llega el valor | Después |
|---|---|
| Valor con evento `input` y sin `change` | **avanza al primer clic** |
| Valor sin ningún evento | sigue sin avanzar |

Ese último caso lo dejo dicho en vez de taparlo: si el valor entra sin disparar
un solo evento, ningún manejador puede enterarse. No lo produce una persona ni
un autocompletado real —los dos disparan `input`—; lo produce un script. Lo usé
como forma de provocar la falla, no como algo que haya que soportar.

## 3. Los cinco criterios de cierre

Comprobado en **1440×900 y 390×844**, escribiendo tecla por tecla y haciendo
clic **sin desenfocar antes**, que es la acción exacta que informaste.

| Criterio | Resultado |
|---|---|
| 1 · Marca/modelo, dominio, capacidad, detalle y radio conservan lo escrito | los cinco |
| 2 · El primer clic avanza, y el resumen conserva esos valores exactos | avanza; el resumen trae «Scania R450», «AB 123 CD», «Hasta 30 toneladas», «Habilitación de cargas generales, vigente» y «150 km» |
| 3 · Los dos recorridos completos, «por mi cuenta», selección/contacto y límites | sin cambios |
| 4 · Consola y corte horizontal en las dos medidas | 0 errores, 0 cortes |
| 5 · Un commit del prototipo y otro del informe | `c26495d` y éste |

Además siguen verdes las once frases prohibidas —ninguna aparece—, el foco
visible en las cinco paradas del teclado y el reinicio sin recargar.

No corrí la suite de producto: no hay producto modificado.

## 4. Lo que sigue igual

El enlace es el mismo:

```bash
cd /workspace/yneratopgreen && python3 -m http.server 8099
```

→ **http://localhost:8099/prototypes/logistica-dos-recorridos.html**

Las cuatro decisiones del informe anterior siguen abiertas y son las que me
importan de esta pieza:

1. Los tres campos propuestos —marca y modelo, dominio separado, cargas
   permitidas—, ¿entran?
2. Si entran las cargas, ¿filtran quién aparece o sólo se muestran?
3. El límite del MVP, ¿se mantiene? Si aparece la necesidad de cotización,
   pago o seguimiento adentro de TopGreen, es alcance nuevo y contractual.
4. La ficha del transportista, ¿alcanza para comparar?

Vuelvo a PM. No abro otra pieza.
