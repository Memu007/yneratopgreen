# Reproducción PM — FORM-CONSISTENCY-1R — 2026-09-06

## Decisión

**Aceptada.** Producto/regresión `042a3e3`, informe `0922fc9`.

La corrección agrega un contador de avisos al formulario de registro para que
el efecto de vista/foco se ejecute en cada error, incluso cuando el texto no
cambia. El caso 151 existente se amplió; la suite sigue teniendo 151 casos.

## Árbol y diff

- base devuelta: `6837af1`;
- producto/regresión: `042a3e3`;
- informe Dev y `HEAD` revisado: `0922fc9`;
- árbol inicial limpio y sincronizado con `origin/main`;
- producto: 2 archivos, 45 inserciones y 11 eliminaciones;
- cambio funcional: 15 inserciones y 6 eliminaciones en
  `RegisterModal.tsx`; el resto amplía el bloque B del caso 151;
- hashes completos reproducidos por PM:

```text
1d549392f0bc1088c95b9d225a6f036d2d6146c8a97bcb2252c78d6e2f85450e  RegisterModal.tsx
a583ed78125091a543beffff4ab0a5e1e4b6a6a906c33d07c156d29b6e2ddf48  smoke.mjs
```

`diff-check` con `core.whitespace=cr-at-eol` quedó limpio. No se tocaron
Backend, API, modelos, migraciones, seed, pagos, estilos ni infraestructura.

## Rojo y verde independientes

PM usó dos checkouts temporales separados, una base PostgreSQL local dedicada
y recién migrada/sembrada, API local, Frontend local y Chrome del sistema.
Railway y los datos remotos no participaron. Mercado Pago permaneció apagado.

Contra `6837af1`, usando el caso 151 ampliado:

```text
[FAIL] 151 — no pasó a tiempo: el segundo intento con el mismo error dejó la alerta fuera de la ventana
0/1 pasaron; 1 fallaron
```

Contra `042a3e3`, desde otra base limpia:

```text
[PASS] 151 — error del registro anunciado, a la vista y con el foco en los dos intentos
1/1 pasaron; 0 fallaron
```

El segundo intento conserva nombre y contraseña, mantiene una sola alerta y
vuelve a llevarla a la ventana y al foco. El test la saca antes de la vista y
enfoca el botón, por lo que no puede pasar por inercia.

## Puertas PM

```text
npm run build                                             OK
npm run lint                                              OK
node --check scripts/smoke.mjs                            OK
python -m compileall backend/app                          OK
npm run a11y -- --todas                                   64/64, 0 bloqueantes
git -c core.whitespace=cr-at-eol diff --check             OK
```

El `pip check` del entorno nativo no es representativo: mezcló paquetes
globales ajenos al proyecto. Dev lo obtuvo verde en su entorno de entrega y la
corrección no modifica Backend, `requirements.txt` ni imagen.

PM no ejecutó la suite completa porque hacerlo exige encender localmente la
bandera de Mercado Pago que esta continuación ordena mantener en `false`.
Dev informa **150/151**, con todos los casos de producto verdes y el único rojo
ambiental en 131 por falta de Alpine. Esa corrida no se atribuye a PM. El caso
131 y los archivos de seguridad/infraestructura que mide no forman parte del
diff de esta corrección.

## Riesgo residual aceptado

Los fallos repetidos del padrón también vuelven a enfocar la alerta. Es
coherente con la regla vigente de que los errores propios o de API no queden
ocultos; no se abre una excepción sin evidencia de daño. El contador vive sólo
durante la apertura del modal y no justifica otra abstracción.
