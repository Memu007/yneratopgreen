# Dev → PM

Este archivo es mío y vos no lo tocás. Acá te informo.

## BACKUP-RESTORE-1 R4

| | |
| --- | --- |
| **Rama** | `claude/dev-role-repo-3l0kp3` |
| **SHA base** | `24dcca8`; `origin/main` (`0f89e78`) incorporado por merge |
| **SHA candidato** | `52ba294` |
| **SHA anteriores, intactos** | `79af761`/`2ffb08a` · `b9d0036`/`6f02c32` · `f3e9d54`/`5e84385` |
| **Diff total desde `24dcca8`** | `scripts/respaldo.sh`, `docs/RESPALDO_Y_RESTAURACION.md`, tres líneas de `.gitignore` y este canal. **No toca producto** |
| **Estado** | en mi rama. No integré, no desplegué, no toqué Railway ni datos remotos. No abrí otra tarea |

Gracias por la corrida real: encontró en el primer paso algo que mi doble no
podía encontrar.

---

### El defecto que te rompió la corrida

Era mío y de la misma familia que los otros: **leía el índice del volcado con el
`pg_restore` del anfitrión**. Tu Mac tiene 14.20 y el contenedor 16.4, así que
un volcado nuevo leído por una herramienta vieja da «unsupported version (1.15)
in file header». El volcado estaba bien; lo estaba leyendo quien no podía.

Ahora, en modo Docker, **`pg_dump`, `pg_restore` —índice incluido— y `psql`
corren siempre dentro del contenedor que hizo la copia**, y la versión del
manifiesto sale de ahí. En el anfitrión no se usa ninguna herramienta de
PostgreSQL.

**Cómo lo probé, ya que no tengo Docker.** Puse en el PATH un `pg_dump`,
`pg_restore`, `psql` y `pg_isready` que **fallan a propósito** —«el guión llamó
a X del anfitrión en modo Docker»— y corrí el ciclo Docker entero contra ellos:

```
con el código anterior (f3e9d54):
   NEGATIVO: el guión llamó a pg_restore del anfitrión en modo Docker
   ERROR: el volcado no es un archivo de pg_restore válido      ← tu síntoma exacto
con el código nuevo (52ba294):
   bundle creado, índice legible, "pg_dump": "16.13" en el manifiesto
```

Es un negativo discriminante: si vuelve a colarse una herramienta del anfitrión,
esto lo caza sin necesidad de una Mac.

### Las dos guardas que faltaban

**1. El servidor definitivo, no el temporal.** La imagen levanta un PostgreSQL
provisorio durante `initdb` y `pg_isready` ya contesta que sí; restaurar ahí es
restaurar sobre algo que el entrypoint va a apagar. Ahora se exige además que el
**PID 1 del contenedor sea `postgres`**. Medido en los dos sentidos:

```
PID 1 nunca llega a postgres → ERROR: no llegó a servidor definitivo (PID 1 = «bash»)
                                y el rescate no deja nada colgado
PID 1 pasa a postgres a los 4 s → espera, restaura y verifica verde
```

**2. Las dos etiquetas, en los dos borrados.** `limpiar` y el rescate exigen
ahora `topgreen.respaldo=pieza` **y** `topgreen.respaldo.ejecucion=<id>`, en el
contenedor y en el volumen:

| Sabotaje | Resultado |
| --- | --- |
| contenedor con la etiqueta de ejecución pero **sin** la de la pieza | `limpiar` frena: «no es de esta pieza y esta ejecución (`topgreen.respaldo=«nada»` …)». Sobrevive |
| volumen sin ninguna etiqueta | frena igual, y sobrevive |
| **rescate** de una restauración a medias con recursos sin etiquetar | «no lleva las etiquetas de esta ejecución; se deja como está». Sobrevive |
| con las dos etiquetas puestas | limpia el contenedor, el volumen y el directorio, y nada más |

### El ciclo Docker completo, contra el doble

Con las herramientas del anfitrión escondidas: respaldo → restauración →
verificación verde con las seis comprobaciones —incluida «`topgreen-db` no tiene
ninguna base de restauración adentro»— → los tres marcadores del otro lado
(`uploads`, `documentos`, `outbox`) → negativo de integridad rojo con ruta y
sha256 → los tres negativos de propiedad → limpieza.

**Lo que el doble sigue sin poder probar** es la semántica real de Docker:
`docker cp -a` contra tu versión, los tiempos del `postgis/postgis` real, el
formato exacto de `docker inspect -f`. Eso lo ve tu corrida, no la mía. Lo que
sí puedo decir es que la clase de defecto que te rompió esta vez —depender de
una herramienta del anfitrión— ahora tiene su propio negativo automático.

### Compuertas

| Puerta | Resultado |
| --- | --- |
| `bash -n` · `diff-check` sobre el HEAD final | verdes |
| Ciclo Docker contra el doble, sin herramientas del anfitrión | verde, con los cuatro negativos |
| Negativo del `pg_restore` del anfitrión | rojo con el código anterior, verde con el nuevo |
| Ruta nativa y suite funcional | **no repetidas**, como pediste: la corrección no las toca |
| Entorno al terminar | una sola base, `topgreen`; API en 200; sin bundles ni destinos |

### Lo que sigue en pie

La corrida Docker real es tuya: yo no tengo demonio. Sigue abierta la pregunta
de R3 —si preferís, dame un entorno con Docker y la corro yo—, pero con este
negativo automático la ruta ya no depende de que yo adivine bien.

### Lo que sigue esperando tu palabra

- el carrito sin sesión;
- la FAQ de Contacto dice «Aceptamos transferencias bancarias directas al
  vendedor» y el producto también cobra por Mercado Pago
  (`src/components/Pages/ContactPage.tsx:305`).
