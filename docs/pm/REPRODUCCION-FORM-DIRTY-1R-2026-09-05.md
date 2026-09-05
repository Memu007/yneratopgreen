# Reproducción PM — FORM-DIRTY-1R

Fecha: 2026-09-05  
Producto/regresión revisado: `83dba0a`  
Informe Dev: `db1bb10`

## Veredicto

**Aceptada.** La corrección elimina la reinstalación de la capa al escribir: el
efecto de apertura depende sólo de `activa`, Escape usa la versión vigente del
cierre por referencia y los tres consumidores dejan de depender del objeto
inestable de salida. No cambia la política de suciedad ni agrega otro gestor de
modales.

PM reprodujo de forma independiente que:

- el caso 150 conserva texto y foco después de cada tecla en alta, checkout y
  Mi Panel, mantiene una sola capa y conserva la protección de salida;
- el caso 149 conserva los cinco formularios y sus trece caminos de cierre;
- ambos casos vuelven a pasar dentro de la corrida completa actual.

## Diff revisado

- `src/hooks/useCapaModal.ts`: el cierre viaja por referencia y el ciclo de la
  capa ya no se reinicia por identidad de callback.
- `AddProductModal.tsx`, `CheckoutModal.tsx` y `UserDashboard.tsx`: cada uno
  desprende el `alSalir` estable del objeto de salida.
- `scripts/smoke.mjs`: el caso 150 escribe secuencialmente, comprueba valor y
  `document.activeElement` después de cada tecla y distingue los tres
  contenedores.

No se tocaron Backend, modelos, migraciones, seed, pagos, Railway ni datos
remotos. La implementación coincide con la causa que PM había reproducido
contra `7741b91`.

## Ejecución independiente

Docker Desktop no arrancó: falla al consultar el binario incluido de Compose.
PM no lo reseteó ni reemplazó. La ejecución usó PostgreSQL 17 local, una base
descartable exclusiva, API/Vite nativos y Google Chrome del sistema. Cada
corrida focal recreó base, migraciones y seed.

| Puerta | Resultado |
|---|---:|
| Caso 150 aislado | **1/1** |
| Caso 149 aislado | **1/1** |
| Suite completa PM actual | **142/150** |
| Casos 149 y 150 dentro de esa suite | **pasan** |
| 101–106 con sus prerrequisitos 2, 3, 5 y 6, desde otra base limpia | **10/10** |
| Caso 130 con el secreto coherente con la configuración local | **1/1** |
| Dev, suite completa actual | **149/150**; único rojo ambiental: 131 |

**No hubo una corrida PM actual de 150/150 y no se la atribuye.** Los ocho
rojos de la corrida completa nativa fueron:

1. 101–106: el token preparado al comienzo venció porque el stack nativo tardó
   más que sus 15 minutos. Con los cuatro prerrequisitos reales y una base
   limpia, los seis pasaron.
2. 130: el primer lanzador PM inyectaba un `JWT_SECRET` distinto del archivo
   que el caso usa como oráculo. Al retirar esa inconsistencia pasó aislado.
3. 131: requiere `docker run ... alpine:3`; el puente nativo rechaza esa
   operación en vez de simular GNU/Alpine con BSD/macOS.

Para 131 se reutiliza únicamente evidencia compatible: PM lo ejecutó **1/1**
en `b07ebce`. Entre `b07ebce` y `83dba0a`, el bloque completo del caso 131 es
idéntico —SHA-256
`e2db39707d481b9abfd66abc91476d852e863397c6748bfc605676016472eb26`— y no
hay diferencias en Backend, `Dockerfile.railway` ni
`infra/railway/nginx.conf.template`. No se extiende esa prueba a archivos que
sí cambiaron.

Los logs locales recuperables quedaron en
`docs/pm/evidencia-form-dirty-1r/`; el resultado y las salvedades que gobiernan
la aceptación quedan versionados en este informe.

## Puertas estáticas

- `npm run build`: verde.
- `npm run lint -- --max-warnings 0`: verde.
- `node --check scripts/smoke.mjs`: verde.
- `compileall` de Backend: verde.
- `git diff --check`: limpio.
- El `pip check` del Conda global de la máquina PM enumera conflictos de
  aplicaciones ajenas al proyecto y no constituye un entorno Backend aislado.
  Dev lo obtuvo verde; la entrega no modifica Backend, requirements ni imagen,
  y el último `pip check` PM dentro de esa imagen fue verde en `b07ebce`.

## Límites

- `MP_CHECKOUT_HABILITADO` se encendió sólo en el proceso local contra el doble
  de la suite; la configuración persistente sigue apagada.
- No hubo despliegue, datos remotos, secretos reales ni pagos.
- El red-team profundo no se inicia: todavía faltan cierre funcional,
  homologación MP de prueba y SHA operativo congelado.

