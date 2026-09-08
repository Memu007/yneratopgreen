# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## DEMO-USER-1R — las guías locales dicen la verdad

**Resultado: terminado.** Tenías razón en las dos cosas, y la segunda es la que
importa: el 157 quedaba verde con documentación que se contradecía a sí misma.

- Producto/regresión: `d9b4ab7`
- Alcance real: `README.md`, `docs/DATABASE.md`, `docs/USER_MANUAL.md` y el
  bloque final del 157 en `scripts/smoke.mjs`. **No reescribí el recorrido
  funcional ni las guías**, y no agregué el transportista a ninguna lista.
  **No desplegué, no corrí seed contra Railway y no toqué datos remotos, pagos
  ni secretos.**

---

### 1. Qué cambié

`docs/DATABASE.md` y `docs/USER_MANUAL.md` no nombraban la cuenta: ahora la
listan y llevan al lado la advertencia. `README.md` sí la listaba, pero su
único aviso era «Cambiar antes de producción», que no dice lo que hay que
decir; ahora dice también que las credenciales son públicas, que están escritas
en el repositorio y que sólo sirven sobre una base local descartable. Es la
misma frase que ya usaba `README_LOCAL_SETUP.md`, no una redacción nueva por
guía.

`README_LOCAL_SETUP.md` y las tres salidas de arranque no las toqué: ya estaban
completas, como decías.

### 2. La comprobación nueva del 157

Va al final, después del recorrido funcional, sobre las siete listas reales:
`README.md`, `README_LOCAL_SETUP.md`, `docs/DATABASE.md`,
`docs/USER_MANUAL.md`, `scripts/entorno_nativo.sh`, `scripts/init_local_db.sh`
y `scripts/init_local_db.ps1`.

Dos decisiones que conviene que sepas, porque cambian lo que el caso puede
detectar:

- **Se mide el contexto de la mención, no el archivo entero.** Toma doce líneas
  antes y dieciséis después del correo y exige ahí las tres ideas: pública,
  local, descartable. Si midiera el archivo completo, la palabra «local»
  apareciendo cien líneas más abajo, hablando de otra cosa, contaría como
  advertencia.
- **Se compara sin acentos.** `init_local_db.sh` y `.ps1` están escritas en
  ASCII a propósito y dicen «publicas»; exigir el acento las habría dado por
  incompletas.

### 3. El rojo, contra `53a9635`

El caso corre entero —cuenta, ingreso, publicación, segundo seed, freno de
entorno— y recién ahí se cae, nombrando las tres guías una por una:

```
[FAIL] 157 La cuenta de prueba entra, publica y sobrevive a un segundo seed
       — las guías locales no acompañan a la cuenta:
  README.md:130: nombra la cuenta pero no dice pública ni local ni descartable
  docs/DATABASE.md: no nombra pruba@agroboeda.com
  docs/USER_MANUAL.md: no nombra pruba@agroboeda.com
```

Que el rojo llegue después de los 21 segundos del recorrido y no antes es la
prueba de que lo funcional seguía en pie y lo único roto era la documentación.

### 4. El verde

```
[PASS] 157 … pruba@agroboeda.com existe una sola vez, normalizada, con bcrypt,
rol user, activa, verificada, sin transportista, sin datos bancarios ni de
Mercado Pago y sin publicaciones, órdenes ni calificaciones propias; entra por
el formulario real, no ve administración —403 en /admin/users—, publica
«Prueba de Emi 1788868904145» por la API (7bcde78d…) en Pergamino, Buenos
Aires, la ve en Mis publicaciones y aparece en el Mercado; el segundo seed deja
los 17 campos idénticos y conserva la publicación, y ENV=production sigue
saliendo con 2 sin abrir conexión; las siete guías locales —README, setup,
DATABASE, USER_MANUAL y las tres salidas de arranque— nombran la cuenta y
dicen, al lado, que la credencial es pública y sólo vale sobre una base local
descartable (9725 ms)
```

### 5. Lo que corrí y lo que no

**Corrido, con salida.**

```
SMOKE_CASOS=157 contra 53a9635 (base limpia)    rojo, por las tres guías
SMOKE_CASOS=157 desde base limpia               1/1
node --check scripts/smoke.mjs                  verde
git -c core.whitespace=cr-at-eol diff --check   limpio
```

**No corrido, y lo digo.** No repetí la suite completa, ni build, ni lint, ni
Backend, ni contraste, ni a11y, porque pediste que no y porque la corrección no
los toca: tres archivos de documentación y un bloque estático al final de un
caso. No desplegué ni toqué nada remoto.

### 6. Nota sobre de dónde salió esta corrección

Esta rama venía con una implementación **paralela** de `DEMO-USER-1` —commits
`aac814d` y `7596bbf`— que nunca se mergeó, porque `main` tomó `53a9635`. La
rama se reinició sobre `main` para que 1R fuera el delta que pediste y no una
segunda entrega compitiendo con la aceptada. Los dos commits viejos siguen en
el remoto por su SHA y no hay nada de ellos acá.

Aquella versión ya cubría `docs/DATABASE.md` y `docs/USER_MANUAL.md`, así que
las dos omisiones que devolviste eran reales y no una diferencia de criterio.
Lo que no cubría era lo que agregaste vos: exigir que el **contexto** diga
pública, local y descartable. Eso es nuevo acá.
