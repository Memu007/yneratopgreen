# Incidente CORS de Railway — 2026-09-11

## Síntoma

El frontend publicado en
`https://yneratopgreen-production.up.railway.app` mostraba `Failed to fetch`
al iniciar sesión y no podía cargar las operaciones.

## Diagnóstico

- Frontend y Backend estaban `Online`.
- El Backend respondía 200 y el catálogo contenía 32 operaciones.
- `CORS_ORIGINS` admitía sólo el origen histórico
  `https://ynerav.up.railway.app`, hoy inaccesible.
- El preflight desde el dominio vigente era rechazado como origen no admitido.

Por lo tanto, el defecto era de configuración entre servicios y no de la cuenta
demo, del catálogo ni de la base de datos.

## Cambio autorizado

Con autorización expresa de Emi se cambió únicamente `CORS_ORIGINS` en el
servicio Backend de Railway a:

```text
["https://ynerav.up.railway.app","https://yneratopgreen-production.up.railway.app"]
```

Se conservó el dominio anterior por compatibilidad. Railway reinició el Backend
y lo dejó `Online`. No se cambió código, datos remotos, secretos ni pagos;
`MP_CHECKOUT_HABILITADO` no se tocó.

## Verificación independiente de PM

- Preflight `OPTIONS /api/auth/login`: **HTTP 200**.
- `Access-Control-Allow-Origin`: dominio vigente exacto.
- Página pública: **32 operaciones visibles**, sin el vacío por error de red.
- Cuenta demo: ingreso correcto; aparecen `Vender`, `Carrito`, `Mi cuenta` y
  `Salir`.

Resultado: incidente operativo cerrado. Este cambio de configuración no acepta
ni integra las entregas de producto que continúan en la rama Dev.
