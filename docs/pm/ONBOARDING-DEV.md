# Arranque para una dev nueva

Leé este archivo entero **una vez**. Después no vuelve a hacer falta: tu
día a día pasa por `NOW.md` y `PARA-DEV.md`.

---

## 1. Quién es quién

**Vos sos la dev.** Escribís todo el código del producto.

**La PM cambió dos veces; hay PM nueva desde el 2026-08-06.** Define qué se
construye y por qué, escribe los criterios de aceptación y revisa lo que
entregás. **No escribe código de producto**: sólo edita archivos dentro de
`docs/pm/`. Su arranque está en `ONBOARDING-PM.md`, por si querés saber con
qué reglas te lee.

El relevo del rol no cambia el calendario ni lo que ya está en
`DECISIONS.md`. Si una instrucción nueva contradice algo decidido, **frená y
preguntá** en vez de rehacerlo.

**Emi es el dueño del proyecto.** Es quien habla con la clienta y quien
toma las decisiones comerciales. Cuando algo depende de la clienta, va por
él.

### Somos adversariales, en las dos direcciones

Esto no es una formalidad, es cómo trabajamos.

**Si te pido algo técnicamente mal, decilo antes de hacerlo.** No lo
implementes "porque lo pidió la PM". Ya pasó: te voy a dar instrucciones
con errores, y frenar fue lo correcto. Hace poco mandé a cargar "las 43
subcategorías tal como figuran en el análisis" y el análisis sólo tenía
las cantidades, no los nombres. La dev anterior frenó en vez de
inventarlas. Tenía razón y el error era mío.

**Yo verifico lo que entregás contra el código.** No por desconfianza
personal: porque este repositorio vino con ocho afirmaciones falsas en su
documentación y aprendimos por las malas. Si decís que algo funciona, voy
a mirar si funciona.

---

## 2. El proyecto, en un minuto

**TopGreen** es un marketplace agrícola argentino. Se construye para una
clienta real, con contrato a precio cerrado.

Junta a **productores, proveedores y transportistas**. La diferencia con
un marketplace común son dos cosas: **filtrado por ubicación real** —con
el padrón oficial de localidades del Estado argentino— y un **módulo de
logística** que conecta compradores y vendedores con transportistas de la
zona.

**Fechas que importan:**

- **Martes 28 de julio de 2026: la clienta aprobó el proyecto.**
- **Viernes 21 de agosto de 2026: firma programada y comienzo de la semana 1.**
- **Plazo: 12 a 14 semanas.** Las doce cierran el **12 de noviembre** y el
  colchon llega al **26 de noviembre**.
- **Al 14 de agosto estamos antes del inicio contractual.**

Las cinco fases con sus fechas están en **`CRONOGRAMA.md`**. Salen del PDF
que aprobó la clienta, así que no son negociables por conveniencia
nuestra.

---

## 3. Cómo levantar el proyecto

El repositorio es **privado**. Emi te da el acceso.

```bash
git clone https://github.com/Memu007/yneratopgreen.git
cd yneratopgreen
```

Guía completa en `README_LOCAL_SETUP.md`. El camino corto, con Docker:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
# editar los placeholders CAMBIAR_* con valores locales inventados

docker compose up -d
docker exec topgreen-api alembic upgrade head
docker exec topgreen-api python -m app.seed

npm install
npm run dev
```

Frontend en `http://localhost:5173`, API en `http://localhost:8000/api`,
Swagger en `/api/docs`. Usuario de prueba: `admin@topgreen.com` /
`admin123`.

**Docker Desktop tiene que estar prendido.** Es el bloqueo más común y no
lo podés resolver sola: si está apagado, avisale a Emi.

### La suite de humo

```bash
npm run smoke
```

Veinte casos contra arranque limpio: API, base de datos y navegador real
con Chromium. **Es la red de seguridad del proyecto.** Verificamos que
falla de verdad rompiendo un caso a propósito.

Regla: **si tocaste algo y no corriste el smoke, no terminaste.**

---

## 4. El stack real, y las trampas conocidas

| Capa | Qué es |
|---|---|
| Backend | Python 3.11 + FastAPI + SQLAlchemy + Alembic |
| Base | PostgreSQL 16 + PostGIS 3.4.3 |
| Frontend | React 18 + TypeScript + Vite |
| Pruebas | Playwright + Chromium |

**Trampas que ya nos costaron tiempo. No las redescubras:**

- **No hay react-router.** La navegación es `useState` sobre
  `currentSection` en `App.tsx`. Si buscás rutas, no existen.
- **Vite tiene que correr en el puerto 5173.** El backend sólo acepta
  5173 y 5174 por CORS. Si el puerto está ocupado, Vite se corre solo a
  otro y todo falla con errores que no dicen nada.
- **`docs/PROJECT_STATUS.md` tiene ocho afirmaciones verificadas como
  falsas.** No lo leas y no lo edites. Se reescribe entero más adelante.
- **Endpoints de catálogo, cuidado con id contra nombre:**
  `GET /catalog/localities/provinces` devuelve `{id, name}` con `id` de
  dos caracteres, pero `GET /catalog/products` filtra por
  `province=<nombre>` y `locality_id=<id>`. Mezclarlos da resultados
  vacíos sin error.
- **Las cuatro subcategorías "Otros"** de Riego, Insumos, Ganadería y
  Repuestos son registros distintos. Cualquier búsqueda por nombre tiene
  que ser `category_id + slug`, nunca sólo el nombre.

---

## 5. Cómo nos comunicamos

**No hay chat entre vos y yo. Hablamos por archivos, en el repositorio.**

| Archivo | Quién escribe | Para qué |
|---|---|---|
| `docs/pm/PARA-DEV.md` | Sólo la PM | Tu tarea actual y sus criterios |
| `docs/pm/PARA-PM.md` | Sólo vos | Tus informes |

**Antes de cada tarea:**

```bash
git pull origin main
cat docs/pm/PARA-DEV.md
```

**Al terminar**: commit, push, y escribís tu informe en `PARA-PM.md`.

`PARA-PM.md` es tuyo: podés reescribirlo entero cada vez. Ya pasó dos
veces que quedó desactualizado y la PM se enteró leyendo el código en vez
de tu informe. **Pisalo apenas termines una pieza.**

### Qué tiene que decir un informe

1. Qué hiciste.
2. **Qué corriste, con la salida pegada.** Consultas SQL, salida del
   seed, resultado del smoke.
3. Qué **no** corriste, dicho explícitamente.
4. Qué encontraste que no esperabas.
5. Qué necesitás de mí para seguir.

### Cómo escribirle a esta PM — regla permanente del rol dev

La PM trabaja con **GPT-5.6 Sol en razonamiento alto**. Usala como decisora y
revisora autónoma, no como una terminal a la que hay que narrarle cada paso.
Puede inspeccionar el repositorio, contrastar evidencia, correr verificaciones
y mantener `docs/pm/`; no escribe código de producto.

Cada informe en `PARA-PM.md` debe ser breve y autosuficiente, en este orden:

1. resultado: terminado, parcial o bloqueado;
2. commit exacto y alcance real del cambio;
3. evidencia reproducible y resultado, diferenciando lo corrido de lo no
   corrido;
4. desvíos, riesgos o hallazgos fuera de la tarea;
5. decisión concreta que necesitás, si existe, con recomendación y alternativa.

Reglas para aprovechar el modelo sin gastar de más:

- enlazá rutas, commits y salidas relevantes; no repitas la historia del
  proyecto ni pegues archivos enteros;
- encabezá una consulta con `DECISIÓN SOLICITADA` y explicá impacto, opciones,
  recomendación y qué queda bloqueado; evitá preguntas vagas;
- para aceptar una entrega, pedí aceptación o rechazo contra criterios
  enumerados; no pidas una opinión general;
- separá hechos comprobados, inferencias y propuestas;
- una mejora no solicitada se propone con beneficio, esfuerzo, riesgo y fase;
  no se mezcla con la entrega ni se implementa sin aprobación;
- no pidas que “piense mucho”, que revele razonamiento interno ni que haga un
  plan extenso. El modo alto ya está configurado;
- no repitas límites que ya están en `DECISIONS.md`; citá la decisión;
- si querés una respuesta corta, decí qué debe conservar: decisión, motivo,
  objeción material y próxima acción.

La PM es proactiva dentro de su rol: puede leer, diagnosticar y verificar sin
que le enumeres comandos. Señalá explícitamente cuando sólo pedís análisis y
cuando pedís una decisión. Cualquier cambio comercial, destructivo, externo o
que amplíe el alcance sigue requiriendo autorización de Emi.

Este protocolo sigue la guía oficial de OpenAI para GPT-5.6: prompts más
livianos, cada instrucción una sola vez, contexto de dominio, límites de
autonomía y criterios de éxito verificables:
[Model guidance — GPT-5.6](https://developers.openai.com/api/docs/guides/latest-model).

---

## 6. Reglas permanentes

1. **Si no lo corriste, decí que no lo corriste.** Un "debería funcionar"
   cuenta como no hecho. Un "probado" sin salida pegada cuenta como no
   probado. Declararlo nunca es problema; ocultarlo sí.
2. **Una tarea por vez.** Terminás, commiteás, pusheás, informás.
3. **Commit y push apenas termina cada pieza**, antes del informe. Ya se
   perdió trabajo por dejarlo sin subir.
4. **Cuando la documentación y el código se contradigan, gana el código.**
   Y avisá, porque hay un documento para corregir.
5. **Empezar no necesita permiso.** Lo que está en `PARA-DEV.md` ya está
   aprobado. No preguntes si arrancás: arrancá.

### Cuándo parás y me esperás

1. Un criterio de aceptación no se cumple y no sabés por qué.
2. Aparece un error que te obliga a cambiar algo fuera de la tarea.
3. Tendrías que tomar una decisión de diseño.
4. Algo que ya funcionaba dejó de funcionar.
5. Tendrías que tocar algo de la lista de abajo.

En cualquiera de esos casos: **commit de lo hecho, escribilo y frená. No
improvises para destrabarte.**

### Qué no tocar nunca

- El esquema de la base, modelos y migraciones, sin aprobación previa.
- **Funcionalidad que no se pidió**, por obvia que parezca. El contrato es
  a precio cerrado: lo que construimos de más lo pagamos nosotros.
- **Credenciales reales de Mercado Pago.** Para local, valores
  inventados. Nunca subas un secreto real al repositorio.
- **Nada copiado de Agrofy ni de ningún otro sitio**: ni código, ni
  textos, ni diseño, ni marcas.
- `docs/PROJECT_STATUS.md`.

### Cómo escribo los criterios de aceptación

**Relacionales, no absolutos.** En vez de "tiene que devolver 4
productos", va "el resultado de la API tiene que coincidir con el de la
consulta SQL equivalente".

Le pasé a una dev números fijos que habían quedado viejos cuando el seed
creció. Ella reportó los reales en lugar de acomodarse al número que yo
esperaba, y así se detectó el error. **Si un criterio mío no cierra con lo
que ves, el sospechoso soy yo.**

Cuando el número **es** la especificación —como "43 subcategorías"— ahí sí
va fijo, y lo aclaro.

---

## 7. Qué está hecho y qué no

Estado honesto. El detalle requisito por requisito está en `MATRIZ.md`.

La ultima medicion heredada fue **~53%**, pero ya no se usa como control.
Las puertas contractuales vigentes estan en `CRONOGRAMA.md` y el desglose
por requisito en `MATRIZ.md`.

**Funciona y está verificado:**

- Arranque desde cero con un comando: PostgreSQL 16 + PostGIS 3.4.3,
  migraciones, seed idempotente, build en verde.
- Recorrido de compra completo probado en navegador: registro, ingreso
  con tres perfiles, catálogo con filtros, detalle, carrito, checkout
  hasta el botón de pago, publicación, panel de vendedor y las cuatro
  vistas de administración.
- Geolocalización: 4.028 localidades del padrón oficial,
  `Geography(POINT,4326)` con índice GIST.
- Filtro por provincia y localidad de punta a punta, con estado en la URL.
- Taxonomía de la clienta cargada: 7 categorías con 43 subcategorías, más
  Bienes y Ganado, más 4 servicios. 30 publicaciones en 12 categorías y
  9 provincias.
- **Pago por transferencia bancaria**: CBU y alias con snapshot, comprobante
  opcional, referencia, cancelacion/decision completa y atomicidad.
- **Suite de 25 casos de humo**, con navegador real y rojo previo para los
  cuatro casos que cerraron la orden inmortal.

**Pendientes operativos de lo ya entregado:**

- **El seed no carga CBU ni alias de nadie**, así que sobre instalación
  limpia la transferencia no se puede usar. La suite no lo detecta porque
  el caso 13 configura los datos bancarios él mismo.
- **El camino de instalación sin Docker no funciona** siguiendo la guía.

**Falta, y es lo grande:**

- **Módulo de transportistas.** Es el diferencial del producto. La Pieza A
  —registro y campos— está hecha con dos objeciones abiertas; las Piezas B
  y C, en cero.
- **Suscripciones con Mercado Pago**, dos planes y mensajería premium.
  Alcance nuevo de Fase 6; no compite con el MVP contractual.
- **Mercado Pago para compras**: el código heredado está desmontado
  —tenía split con comisión de marketplace, que el contrato no pide— y se
  reconstruye sin split cuando haya credenciales.
- **Despliegue**: hay preparación de Railway subida, nadie lo levantó en
  un servidor real.
- **Vista en celular**: relevada en 36 pantallas, sin corregir. Aparcada a
  propósito.

---

## 8. Dónde está el resto del contexto

Todo en `docs/pm/`. **No los leas todos ahora.**

| Archivo | Cuándo abrirlo |
|---|---|
| `NOW.md` | **Siempre primero.** Estado y prioridades |
| `PARA-DEV.md` | Tu tarea actual |
| `CRONOGRAMA.md` | Las fases y fechas comprometidas con la clienta |
| `CONTRATO.md` | El alcance. Si algo no está ahí, no es requisito |
| `PAGOS-TRANSFERENCIA.md` | La transferencia y sus cuatro arreglos |
| `archivo/PARA-DEV-historico.md` | Por qué se decidió algo de julio |
| `MATRIZ.md` | Qué está verificado y con qué evidencia |
| `REPO_MAP.md` | Dónde está cada cosa en el código |
| `TAXONOMIA-CLIENTE.md` | Las categorías y subcategorías, con sus nombres |
| `DECISIONS.md` | Por qué se decidió cada cosa |
| `PROJECT.md` | Qué se construye y qué queda afuera |

---

## 9. Tu primera tarea

Está en `docs/pm/PARA-DEV.md`. Andá para allá.
