# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## ATRIBUTOS-RUBRO-1 — consulta antes de construir la parte 1

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| base | `10e0008` |
| entregado | `2a0c461`: el P3 del caso 191 |
| parte 1 | **sin construir**: freno, como pide la tarea |
| no integrado, no desplegado | `main` sigue en `0bd7fbc` |

**Resultado.** Cotejé las 43 listas de `TAXONOMIA-CLIENTE.md` con los 43
subrubros de la base, que coinciden uno a uno.

- 29 tienen una lista clara, y tractores va por potencia.
- **13 caen en tu «frená y consultá»:**
  - 4 mezclan dos cosas distintas en la misma lista;
  - 4 «Mejoras» no son tipos;
  - 5 tienen una sola opción.

Abajo va la propuesta para cada caso. El P3 del 191 ya está corregido.

**Para decidir vos (bloqueante para cargar las listas).**

1. **Cargar la tabla de abajo.** Es lo que recomiendo.
   - En las 4 listas mezcladas queda una sola dimensión.
   - Las 4 «Mejoras» y las 5 de una sola opción quedan sin tipo.
2. **Cargar todo tal cual lo escribió la clienta.** Como una publicación
   elige un solo tipo, las superposiciones rompen el filtro. Por ejemplo,
   una sembradora neumática de precisión para maíz entra en tres opciones:
   si se carga como «de granos gruesos», quien filtra «neumáticas» no la
   encuentra.

El corte en dos partes me sirve; no propongo otro.

## Las 13 que hay que decidir

### Mezclan dos cosas en la misma lista (4)

| subrubro | lista de la clienta | propuesta | qué queda afuera y por qué |
|---|---|---|---|
| Siembra y plantación | sembradoras de precisión, neumáticas, hortalizas, granos gruesos/finos, otros | sembradoras de granos gruesos · de granos finos · de hortalizas · otras | «de precisión» y «neumáticas»: dicen cómo dosifica la máquina, no para qué cultivo es |
| Fertilizantes | orgánicos, minerales, líquidos, liberación controlada | orgánicos · minerales | «líquidos» y «de liberación controlada»: dicen la forma del producto, no su origen. Un mineral líquido entraba en dos |
| Compra-venta definitiva (Tierras) | campo agrícola (secano/riego), campo ganadero (pasturas naturales/mejoradas), parcela hortícola/frutícola, campo mixto, otros | campo agrícola · campo ganadero · parcela hortícola/frutícola · campo mixto · otros | los paréntesis: son una segunda característica del campo |
| Alquiler por campaña (Tierras) | siembra directa, siembra convencional, con/sin mejora de suelos, otros | siembra directa · siembra convencional · otros | «con/sin mejora de suelos»: es otra característica, y además son dos opciones en una |

### No son tipos (4)

Son los cuatro subrubros de Tierras que empiezan con «Mejoras»: compra,
alquiler, alquiler transitorio y leasing. Sus listas —alambrados, aguadas,
electrificación, molinos, monte…— describen el campo que se ofrece. Un
mismo campo tiene varias a la vez.

- **Propuesta: sin tipo.**
- Tratarlas bien pide elegir varias, y eso es otra pieza.
- Además, si Tierras entra en esta etapa sigue siendo una pregunta abierta
  desde julio.

### Tienen una sola opción (5)

| subrubro | la única opción |
|---|---|
| Otros (Riego) | accesorios para riego |
| Otros (Insumos) | otros insumos |
| Otros (Ganadería) | equipos varios |
| Otros (Repuestos) | accesorios generales |
| Alquiler con opción a compra (Tierras) | leasing de tierra |

**Propuesta: sin tipo.** Un filtro con una sola opción no separa nada.

## Las 29 claras: se cargan tal cual

Las opciones, en el orden de la clienta:

| rubro | subrubros |
|---|---|
| Maquinaria agrícola | Preparación del suelo · Fertilización y protección · Cosecha · Postcosecha · Forrajes y ganadería |
| Riego y drenaje | Riego por aspersión · Riego localizado · Riego superficial y subterráneo · Bombas, motobombas y accesorios hidráulicos · Drenaje y control hídrico |
| Insumos agrícolas | Semillas y plántulas · Correctivos · Agroinsumos biológicos · Agroquímicos · Sustratos y coberturas |
| Ganadería y forrajes | Cercas y bebederos · Manejo animal · Ordeño y sanidad · Suplementación |
| Repuestos y mantenimiento | los cinco que no son «Otros» |
| Agricultura de precisión y tecnología | los cuatro |
| Tierras y parcelas | Alquiler por uso transitorio |

**Tres notas, que no cambian nada si no decís lo contrario:**

- **Fertilización y protección.** Escribo completos los nombres que la
  clienta abrevia: «pulverizadoras autopropulsadas», «pulverizadoras de
  arrastre», «fertilizadoras centrífugas», «fertilizadoras de disco». Los
  drones siguen en dos lugares, como la pregunta abierta de julio.
- **Cercas y bebederos.** No tiene una opción para bebederos, y **Sustratos y
  coberturas** no la tiene para sustratos. No invento ninguna: quien publique
  eso deja el tipo vacío, que es válido. Si querés, se le pregunta a la
  clienta.
- **Tractores.** No lleva lista: quien publica carga la potencia en HP, y el
  filtro ofrece los tres rangos de la clienta, como decidiste.

## El P3 del 191 (`2a0c461`)

**La causa.** `tokenDeAdmin` comprobaba que el token guardado sirviera al
*empezar* el caso, pero el caso lo usa durante toda su corrida. El token local
dura 15 minutos: uno que pasaba la comprobación con segundos de vida vencía
en el medio del 191.

**Cómo lo reproduje.** Fabriqué un token de administrador que vence a los
nueve segundos, con el propio `create_access_token` de la API, y lo inyecté
en una copia descartable del smoke:

```
smoke de 10e0008:  [FAIL] 191 … PATCH /admin/products/…/status respondió HTTP 401: Token inválido o expirado
smoke de 2a0c461:  [PASS] 191 … eliminada, pausada y agotada: las dos rutas responden 400 …
```

**El arreglo.** Ahora también lee el vencimiento del token y lo renueva si le
quedan menos de diez minutos. Vale para los nueve lugares del smoke que lo
piden.

## Para verificar el P3, lo mínimo

```
./scripts/entorno_nativo.sh --recrear
INYECTAR='s/^const state = {};$/const state = {}; if (process.env.SONDA_TOKEN_ADMIN) state.docAdminToken = process.env.SONDA_TOKEN_ADMIN;/'
ADMIN=$(docker exec topgreen-db psql -U topgreen -d topgreen -At -c "SELECT id FROM users WHERE email='admin@topgreen.com'")
corto() { docker exec topgreen-api python -c "from datetime import timedelta; from app.core.security import create_access_token; print(create_access_token({'sub': '$ADMIN'}, timedelta(seconds=9)))"; }
git show 10e0008:scripts/smoke.mjs | sed "$INYECTAR" > scripts/.sonda-vieja.mjs
sed "$INYECTAR" scripts/smoke.mjs > scripts/.sonda-nueva.mjs
SONDA_TOKEN_ADMIN=$(corto) SMOKE_CASOS=191 node scripts/.sonda-vieja.mjs   → [FAIL] 191 … HTTP 401: Token inválido o expirado
SONDA_TOKEN_ADMIN=$(corto) SMOKE_CASOS=191 node scripts/.sonda-nueva.mjs   → [PASS] 191 …
rm scripts/.sonda-vieja.mjs scripts/.sonda-nueva.mjs
```

Estos comandos los corrí tal cual y dieron eso.

**Puertas del arreglo:** `node --check` y diff-check con `cr-at-eol`, verdes.
No toca `src/` ni `backend/`.

No toqué `main`, Railway ni datos reales, y no desplegué.
