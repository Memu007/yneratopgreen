# PM → Dev 2

Canal de la PM hacia la segunda dev. **Sólo lo escribe la PM.** Vos leelo,
no lo edites.

Para responder, escribí en `docs/pm/PARA-PM-2.md` y pusheá. Ese archivo es
tuyo y la PM no lo toca.

**Antes de cada tarea:**

```bash
git pull origin main
cat docs/pm/PARA-DEV-2.md
```

---

## Quiénes somos

Yo soy la PM: defino qué se construye, apruebo y reviso. No escribo código.
Vos sos la dev: escribís el código y traés evidencia de que funciona.

**Sos adversarial, y lo espero en serio.** Si te pido algo técnicamente
mal, decilo antes de hacerlo. Si algo no cierra, frená y preguntá. Yo
también lo soy: leo tu código, no sólo tu informe, y te voy a contradecir
cuando corresponda.

## Las cuatro reglas que más importan

1. **Si no lo corriste, decí que no lo corriste.** Un "debería funcionar"
   cuenta como no hecho. Ocultarlo es el único error grave.
2. **Una tarea por vez.** Terminás, commiteás, pusheás, informás.
3. **Commit y push apenas termina cada pieza**, antes del informe. Ya se
   perdió trabajo por dejarlo sin subir.
4. **Cuando la documentación y el código se contradigan, gana el código.**
   Y avisá, porque hay un documento para corregir.

## Empezar no necesita permiso

Lo que está escrito acá ya está aprobado. No preguntes si arrancás:
arrancá. Frená sólo si algo se rompe en el medio.

## El proyecto en cinco líneas

Marketplace agropecuario argentino. React 18 + TypeScript + Vite adelante,
FastAPI + Python atrás, PostgreSQL 16 con PostGIS.

El código se heredó de otro equipo y estaba muy mal: la base no se podía
crear y la documentación afirmaba cosas falsas. Ya está reconstruido y
funcionando, con el ~46 % del producto contratado.

El contrato es a **precio cerrado**: no se construye nada que no esté
pedido.

## Contexto, todo en `docs/pm/`

- `NOW.md` — estado y tareas. **Leé sólo esto primero.**
- `CONTRATO.md` — el alcance. Si algo no está ahí, no es requisito.
- `PROJECT.md` — qué se construye y qué queda afuera.
- `REPO_MAP.md` — dónde está cada cosa.
- `DECISIONS.md` — por qué se decidió cada cosa.

**No uses `docs/PROJECT_STATUS.md`.** Tiene ocho afirmaciones verificadas
como falsas.

## Levantar el proyecto

```bash
./scripts/init_local_db.sh
npm install && npm run dev
```

Cuentas de prueba: `cliente@ejemplo.com` / `cliente123`,
`vendedor@ejemplo.com` / `vendedor123`, `admin@topgreen.com` / `admin123`.

---

## Tu tarea: filtro por ubicación en el catálogo

Cierra el requisito 3.1 del contrato. Es además lo que se muestra en la
reunión con el cliente del 30 de julio, así que tiene que verse prolijo.

**Trabajá en una rama**, no en `main`:

```bash
git checkout -b dev/filtro-ubicacion-frontend
```

Pusheá ahí. Yo la reviso y la integro.

### Lo que ya existe y no tenés que construir

El backend está listo y verificado. Tres endpoints:

| Endpoint | Devuelve |
|----------|----------|
| `GET /api/catalog/localities/provinces` | `[{id, name}]` — `id` es el código de 2 caracteres |
| `GET /api/catalog/localities?province_id=XX` | Localidades de esa provincia |
| `GET /api/catalog/products?province=...&locality_id=...` | Catálogo filtrado |

**Ojo con esto, es la trampa principal:** el endpoint de provincias
devuelve `id` de 2 caracteres **y** `name`. Para pedir las localidades se
usa el **`id`**. Para filtrar productos se usa el **`name`**, no el id.
Son dos campos distintos en dos llamadas distintas.

### Qué construir

En `src/components/FilterSidebar/FilterSidebar.tsx`, junto a los filtros
que ya existen:

1. **Selector de provincia.** Se llena con el endpoint de provincias.
2. **Selector de localidad.** Empieza deshabilitado. Al elegir provincia,
   se llena con las localidades de esa provincia. Si se cambia la
   provincia, se limpia la localidad elegida.
3. Los dos filtros **se combinan** con los que ya están: categoría,
   precio y stock. No rompas ninguno.
4. **El estado se guarda en la URL**, para que el filtro sobreviva a un
   refresco y el enlace se pueda compartir.

### Criterio de aceptación

Verificalo en el navegador, no sólo por API:

1. Elegir "Buenos Aires" muestra **4 productos**. Córdoba **2**. Santa Fe
   **2**. Sin filtro, **12**.
2. Elegir provincia y después localidad "Balcarce" muestra **2**.
3. Combinar provincia con una categoría funciona y no se pisan.
4. Recargar la página mantiene el filtro aplicado.
5. Cambiar de provincia limpia la localidad anterior.
6. Sin errores en la consola del navegador.

Si algún número no te da, **no asumas que tu código está mal**: corré la
misma consulta contra la base y comparame los dos resultados. Ese
contraste es la prueba real.

### Qué no tocar

- El backend. Los endpoints ya están y funcionan.
- El esquema de la base.
- Funcionalidad que no te pedí, por obvia que parezca.
- Credenciales de Mercado Pago.

### Qué mandar en `PARA-PM-2.md`

- El diff **completo**, sin abreviar.
- Los comandos que corriste con su salida textual exacta.
- Los seis puntos del criterio, uno por uno: qué hiciste, qué esperabas,
  qué viste.
- Los errores de consola del navegador, aunque estén vacíos.
- Todo lo que **no** corriste, explícito.
- El nombre de la rama y el hash del commit.
- **Observaciones adversariales:** lo que viste y no te cerró.
