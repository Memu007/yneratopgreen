# Reproducción independiente de la suite local — 2026-08-31

Base revisada: `main` `5cb71efd2f9507d31997173255791be041867e01`.

## Alcance y resguardos

- Se usó Docker Desktop sobre los contenedores y volúmenes locales descartables
  de TopGreen. No se tocó `caca_db`, Railway, Mercado Pago real ni datos remotos.
- Se recrearon únicamente `topgreen-api`, `topgreen-db`,
  `topgreen_db_data` y `topgreen_uploads_data`.
- El seed se ejecutó sólo con `ENV=local`.
- Para probar Mercado Pago se usaron valores inventados y el doble local de la
  suite. `MP_CHECKOUT_HABILITADO` no cambió en Railway ni en Git.
- `.env` y `backend/.env` fueron archivos locales ignorados. El árbol
  versionado permaneció limpio antes de escribir este informe.

## Primera ejecución: el lanzador oficial no llega a los casos

`npm run smoke` compiló el Frontend, reconstruyó los contenedores y creó una
base nueva, pero `scripts/init_local_db.sh` se detuvo antes de migraciones:

```text
ERROR: DB_NAME o DB_USER contienen caracteres no permitidos
```

La causa está aislada: `scripts/smoke.sh` copia `.env.example` y el archivo
versionado mezcla terminadores CRLF/LF. `init_local_db.sh` extrae `DB_NAME` y
`DB_USER` con `sed` sin quitar `\r`; el valor efectivo termina en carriage
return y no pasa `^[A-Za-z0-9_]+$`.

Esto es una falla reproducible del arnés local. No es una falla de base,
migración ni producto.

## Corrida funcional válida

Se reconstruyó la base descartable desde cero, se aplicaron todas las
migraciones, se cargaron 4.028 localidades y 30 publicaciones del seed, se
levantó Vite y se ejecutó directamente `scripts/smoke.mjs` con la configuración
local completa.

Resultado del ejecutor: **136/140**, con cuatro rojos clasificados abajo. Los
136 casos verdes incluyen catálogo por provincia/localidad, órdenes,
transferencias, concurrencia de stock, correo, logística/PostGIS, OAuth y
Checkout Pro contra doble, webhook e idempotencia, documentación fiscal,
cookies/CSRF, las cuatro anatomías, accesibilidad al 200 %, navegación de Login,
ubicación oficial y prohibición de compra propia.

En particular:

- caso 05: provincia y localidad coinciden entre API y SQL;
- caso 116: las cuatro mutaciones rechazan cookie sola y aceptan Bearer;
- caso 121: publicar sin foto muestra `Sin registro fotográfico`;
- caso 137: cada filtro provincial devuelve sólo publicaciones de esa
  provincia y la ubicación mostrada sale de la publicación;
- caso 140: tarjeta, carrito, sync, medios y ambos checkouts frenan compra
  propia sin efectos parciales.

### Los cuatro rojos no son defectos del producto

1. **Caso 86 — URL de webhook con query.** El caso agrega una segunda
   `MP_NOTIFICACION_URL` al final de una plantilla que ya declara la clave. La
   lectura dotenv conserva la primera y el caso concluye erróneamente que la
   configuración insegura fue aceptada. Una reproducción directa con una sola
   clave insegura produce `ValidationError` y nombra
   `MP_NOTIFICACION_URL`/`source_news=webhooks`.
2. **Caso 105 — archivo nuevo de documentación.** La API guarda en el
   filesystem del contenedor, pero Node ejecuta `existsSync()` desde macOS sobre
   la ruta interna. La comprobación posterior dentro de Docker encontró cinco
   rutas en SQL y exactamente los mismos cinco PDF en disco: cero faltantes y
   cero huérfanos.
3. **Caso 110 — documentos dentro de uploads.** Repite el problema de claves
   duplicadas del caso 86. Una reproducción directa con
   `UPLOAD_DIR=uploads` y `DOCUMENTOS_DIR=uploads` se niega a cargar con
   `ValidationError` y explica la exposición pública.
4. **Caso 131 — receta CSP.** El caso extrae una instrucción destinada a Alpine
   y la ejecuta con el `sed` BSD de macOS, que no acepta esa forma de `-i`. La
   imagen productiva real `Dockerfile.railway` se construyó completa sobre
   Alpine con ambos orígenes, CSP sustituida, TypeScript y Vite verdes.

Por lo tanto no corresponde informar `140/140` oficial: el proceso sigue
saliendo con código 1. Sí queda evidencia independiente de que las cuatro
propiedades de producto señaladas por los falsos rojos funcionan.

## Puertas adicionales

- `npm run lint`: verde, cero advertencias.
- construcción productiva con `Dockerfile.railway`: verde.
- `npm audit --omit=dev`: **0 vulnerabilidades** en dependencias de runtime.
- `npm ci` informa 17 avisos en dependencias de desarrollo/build
  (1 bajo, 2 moderados, 14 altos). No se copian a la imagen final de Nginx,
  pero deben revisarse en el cierre de supply chain; no ejecutar
  `npm audit fix --force` a ciegas.

## Deuda de arnés a abrir después de TEST-IMG-1

Una pieza separada debe:

1. normalizar o tolerar CRLF al leer `DB_NAME`/`DB_USER`;
2. permitir que el API en Docker alcance el doble local sin romper el URL que
   usa el navegador;
3. probar archivos de documentación dentro del contenedor o mediante la API,
   no con una ruta interna desde el host;
4. reemplazar claves de plantilla en vez de duplicarlas en 86/110;
5. ejecutar la receta CSP dentro de Alpine o hacer su prueba portable.

No se mezcla con TEST-IMG-1: esa tarea sigue acotada a quitar el azar del caso
116. Hasta cerrar ambas piezas, una afirmación de suite oficial completamente
verde debe venir de una ejecución cuyo sistema operativo y topología se
declaren explícitamente.

## Revisión de TEST-HARNESS-MAC-1 sobre `4b1a493`

PM ejecutó `npm run smoke` oficial desde cero en macOS con Docker Desktop. El
bootstrap CRLF ya pasa, Compose construye, migraciones y seed terminan y los
140 casos llegan a ejecutarse. Resultado: **96/140; 44 fallaron**. Por lo tanto
la pieza no queda aceptada y no se hizo una segunda corrida completa.

Los 44 rojos se explican por tres raíces reproducidas:

1. **33 casos MP/retorno:** `docker-compose.yml` apunta correctamente la API a
   `host.docker.internal`, pero `scripts/lib/mp-doble.mjs` continúa escuchando
   sólo en `127.0.0.1`. El contenedor no puede alcanzar un servidor ligado
   exclusivamente al loopback del host. Fallan 62–66, 70, 75–100 y 117.
2. **10 casos de documentación/CSRF:** el contenedor recibe
   `DOCUMENTOS_DIR=documentos`; resuelve `/app/documentos` y el usuario
   `appuser` no puede crearlo. Los logs muestran `PermissionError: [Errno 13]
   Permission denied: '/app/documentos'`. Fallan 101–109 y 116. La lectura de
   archivos dentro del contenedor es correcta, pero no puede medirse hasta que
   Compose provea una carpeta privada escribible, fuera de `/data/uploads`.
3. **Caso 131:** la detección de compatibilidad ejecuta una sola expresión
   `sed -i -e`; BSD sed la acepta creando un backup `-e`, por lo que se clasifica
   erróneamente como compatible. La receta real usa dos `-e` y falla en el host
   con `sed: -e: No such file or directory`. Dado que la suite oficial ya exige
   Docker, el camino mínimo y fiel es ejecutar siempre esa receta dentro de
   Alpine, sin heurística por sistema operativo.

Una corrida filtrada posterior confirmó que la raíz documental es independiente
de los fallos MP: con casos 2, 3, 6 y 101–109 dio 3/12 y el primer POST de
documentación volvió a 500 por el mismo permiso. No se tocó Railway ni producto.
