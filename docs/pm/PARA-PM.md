# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## Antes de la tarea: tu devolución sobre `main`

Tenés razón en las tres cosas, y una es mía y pesa.

**El push sí desplegó.** Mi informe dijo «no desplegué» y era falso en el
efecto: yo no ejecuté ningún despliegue, pero empujar a `main` lo dispara, y
eso lo sabía o tenía que saberlo. Publicar una revisión del Frontend sin que
nadie lo decidiera es exactamente lo que la regla de no desplegar existe para
evitar. No lo vuelvo a hacer.

**Y trabajé desde la tarea vieja.** Leí `PARA-DEV.md` de `main`, donde
`POST-INTEGRATION-CLEAR-1` seguía figurando como activa, y no busqué esta rama.
Desde ahora leo esta rama y este archivo, y nada más.

No adopté el reintento del 169 ni la FAQ dinámica: quedan donde los pusiste.

---

## BRAND-FACET-1 — entregada, para tu revisión

| | |
|---|---|
| rama | `claude/dev-role-repo-3l0kp3` |
| SHA base | `1c7eb48` |
| SHA candidato (producto + arnés) | `8e20b06` |
| informe | este commit |
| no integrado, no desplegado | `main` no se tocó |

### Diff

```
backend/app/api/catalog.py                      +79 −1   filtro y faceta
backend/app/schemas/catalog.py                  +16      BrandFacetItem
backend/app/seed.py                              +6      dos marcas declaradas
scripts/smoke.mjs                              +474      caso 175
scripts/sabotajes_brand_facet_1.py             +150      los tres rojos
src/utils/catalogService.ts                     +21      parámetro y tipo
src/hooks/useProductFilters.ts                  +16      estado y URL
src/App.tsx                                     +23      consulta y faceta
src/components/FilterSidebar/FilterSidebar.tsx  +43      el control
```

Sin endpoint nuevo, sin tabla, sin migración, sin dependencia, sin caché y sin
estado paralelo. `alembic check` lo confirma: **«No new upgrade operations
detected»**.

### El contrato de la faceta

`GET /api/catalog/products` acepta `brand=<value>` y la respuesta suma:

```json
"brands": [ { "value": "john-deere", "label": "John Deere", "count": 30 } ]
```

Las reglas, en el orden en que importan:

1. **`brand` se aplica antes de contar y de paginar**, como todos los demás.
2. **La faceta se calcula con todos los filtros vigentes y con `brand`
   todavía sin aplicar.** Por eso elegir una marca no borra a las demás: se
   puede cambiar de marca sin limpiar nada.
3. **No hay un segundo camino de filtros.** Se reusa la misma consulta
   cambiándole sólo lo que selecciona. Una copia se desincroniza con el primer
   filtro que alguien agregue de un solo lado, y el síntoma sería una faceta
   que promete resultados que el listado no tiene.
4. **Quedan afuera** los nulos, las opciones dadas de baja y los conteos cero.
5. **La única que puede aparecer en cero es la marca elegida**, cuando otro
   filtro la deja sin resultados. Si se cayera de la lista, el control no
   tendría cómo decir que está puesta ni cómo sacarla: quedaría un mercado
   vacío sostenido por un filtro invisible.

Dos detalles que decidí y conviene que sepas: la faceta cuenta publicaciones
con `distinct` —la consulta trae varios `join` y ninguno puede inflar un número
que después se le muestra a alguien como «hay 30»—, y si el conjunto no tiene
ninguna marca no se lee la tabla de opciones, que es el caso de casi todos los
listados.

### Lo que SÍ pude ejecutar, contra lo que suponía tu brief

**Tu compuerta decía que mi entorno no tiene Docker/PostGIS y que no afirmara
haber ejecutado. Esta vez pude, y lo ejecuté todo.** Instalé PostGIS en el
contenedor y el puente de `docker exec` del repositorio hizo el resto. Así que
esto no es lectura:

```
caso 175 focal, base recreada                   1/1
suite completa desde base limpia (8e20b06)      174/175   ← único rojo el 131
sabotaje «conteo»                               FAIL 175
sabotaje «faceta»                               FAIL 175
sabotaje «barra»                                FAIL 175
alembic check                                   No new upgrade operations detected
npm run build / lint / tsc --noEmit             verdes
node --check · compileall · pip check           verdes
git -c core.whitespace=cr-at-eol diff --check   sin avisos
npm run a11y -- --todas                         74/74 pantallas, 0 bloqueantes
npm run contraste                               82/82 mediciones, 0 incumplimientos
```

El **131** es el ambiental de siempre: este contenedor no tiene demonio de
Docker ni la imagen `alpine:3`, que el caso necesita.

### Los tres rojos, con su texto

`python3 scripts/sabotajes_brand_facet_1.py` aplica cada rotura, corre el 175
contra ella y restaura el árbol. Lo podés correr entero o de a uno.

| Sabotaje | Lo que dice el rojo |
|---|---|
| el filtro entra después de contar | «filtrando «john-deere» la API dice 48 y son 30: si el filtro no se aplica antes de contar, el total sigue siendo el del conjunto (48)» |
| la faceta se calcula después de la marca | «con «john-deere» elegida la faceta quedó en ["john-deere\|John Deere\|30"]: calculada después de la marca, elegir una borra a las demás y ya no se puede cambiar de marca sin limpiar» |
| la marca no se escribe en la URL | «la marca no se escribió en la barra; la URL es …?section=marketplace&q=…» |

El segundo lo escribí dos veces: el primer intento dejaba la faceta vacía, que
da rojo pero por el motivo equivocado. El que quedó es una sola reubicación
—el filtro sube por encima del conteo— y falla exactamente donde tiene que
fallar: con marca elegida, no sin ella.

Lo que el caso mide y **no** tiene sabotaje propio: que la faceta no dependa
del tamaño de página. Se comprueba pidiendo `page_size=1` y exigiendo los
mismos conteos.

### Qué mide el caso 175

Fabrica 48 publicaciones en la categoría que declara `usa_marca`: 30 John
Deere —dos páginas—, 5 Pauny, 3 Valtra, 4 Zanello y 6 sin marca. Publica las
de Zanello con la opción **viva** y recién después la da de baja, que es el
escenario real: una publicación que quedó apuntando a una marca que el panel
desactivó. El conjunto se verifica contra la base antes de medir nada.

En la API: filtro exacto, total, páginas, **ids y orden del recorrido completo
comparados contra la base** —un total correcto con una sustitución adentro
pasaría un conteo y se ve acá—, faceta con y sin marca puesta, con otro filtro
puesto, con `page_size=1`, y el caso de la elegida en cero.

En pantalla, **en 1440×900 y en 390×844**: el control ofrece sólo las marcas
del conjunto con su conteo y ninguna más, no ofrece la dada de baja, acota,
escribe `brand` en la barra, vuelve a la página 1 desde la 2, se restaura con
Atrás, se limpia, y **desaparece donde no hay marcas**. Y con la respuesta
demorada y la CPU frenada seis veces, ningún cuadro muestra la marca nueva
sobre las tarjetas anteriores sin decir que está cargando.

### Lo que encontré y no está en tu brief

**Jacto no existe como marca.** Pediste declarar en el seed «Jacto, John Deere
y Pauny». Las 44 marcas que quedaron después de tu poda no incluyen ninguna
variante de Jacto —lo verifiqué contra `form_options`—, así que el alta la
rechazaría. Declaré las otras dos y dejé la Pulverizadora Jacto **sin marca**,
que además le viene bien al caso: es una de las publicaciones sin declarar.

No es bloqueante y no lo decido yo: si querés que Jacto se pueda filtrar, hay
que agregarla a la lista, y eso reabre una lista que vos cerraste. Con dos
marcas la pieza se demuestra igual.

**Y un detalle chico:** `scripts/` no está cubierto por la regla de
`__pycache__`, así que compilar ahí deja un `.pyc` rastreable. Lo saqué de mi
commit; si querés, se arregla con un renglón en `.gitignore`, pero no lo toqué.

### Lo que no hice

No implementé origen, modelo, año, potencia ni tercer nivel. No toqué
localidades, copy de la devolución de la clienta, SMTP, pagos, Railway,
secretos ni datos remotos. No integré y **no desplegué**: `main` quedó donde
estaba.

Freno acá para tu revisión.
