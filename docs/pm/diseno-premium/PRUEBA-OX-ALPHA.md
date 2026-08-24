# Prueba controlada de dirección visual — Ox Alpha

Fecha: 2026-08-24  
Responsable de exploración: Ox Alpha  
Estado: **prueba aislada; no autoriza cambios en producto ni despliegue**.

## Objetivo

Comprobar si Ox Alpha puede construir una identidad visual fuerte para
TopGreen sin rehacer el producto desde cero. La prueba se limita al **primer
viewport real de Inicio**. Debe sentirse como un marketplace agroindustrial
argentino de alcance nacional, serio, contemporáneo y comercial.

No buscamos una landing institucional, una lámina de marca ni una explicación
verbal. Buscamos comparar tres alternativas ejecutables a tamaño real y decidir
con Emi mirando el navegador.

## Contexto mínimo obligatorio

Leer, en este orden:

1. `docs/pm/diseno-premium/DEVOLUCION-EMI-UX2C.md`
2. `src/components/Pages/HomePage.tsx`
3. `src/components/Pages/HomePage.module.css`
4. `src/components/Header/Header.tsx`
5. `src/components/Header/Header.module.css`
6. `src/tokens.css`
7. `docs/pm/diseno-premium/extension-comercial/COPY.md`
8. `docs/pm/diseno-premium/extension-comercial/ACTIVOS.md`

Después se puede inspeccionar el producto local para entender proporciones y
comportamiento. No hace falta leer todo el historial del proyecto ni
reinterpretar el alcance funcional.

## Fuente de verdad que debe conservarse

- El contenido, navegación, CTA y fotografía de la Home actual.
- La estructura hero dividido: copy y foto separados, sin texto superpuesto.
- El encabezado real y sus acciones; no inventar una navegación nueva.
- El wordmark actual como pieza provisoria.
- La intención comercial: comprar, vender y contratar dentro del agro.
- Funciones, datos, accesibilidad y responsive ya implementados.

Ox no debe diseñar una empresa distinta. Debe darle identidad al producto que
ya existe.

## Dirección de marca

**Agro industrial premium.** Campo productivo, escala, operación, precisión,
confianza entre empresas y conocimiento del territorio argentino.

La referencia combinada es:

- densidad y lectura de negocio de Agrofy;
- claridad transaccional de Mercado Libre;
- solidez industrial de una marca de maquinaria o infraestructura;
- fotografía agrícola real como evidencia, no como decoración verde.

No copiar componentes, paletas, logos ni composición de esas marcas.

### Señales buscadas

- blanco cálido limpio, verde campo profundo, grafito y un acento cereal o
  mineral muy medido;
- tipografía sans técnica y segura como voz principal;
- serif sólo si cumple una función muy puntual, nunca como tono dominante;
- jerarquía por escala, grilla, fotografía y datos;
- botones y controles comerciales evidentes;
- geometría sobria: no todo redondeado, no tarjetas flotantes por reflejo;
- sensación argentina y agroindustrial sin recurrir a folclore ni rusticidad.

La paleta sugerida en la devolución es un punto de partida, no una obligación.
Ox puede proponer valores mejores si explica su rol y mantienen contraste.

## Anti-tests obligatorios

Cada variante debe poder responder **no** a estas preguntas:

1. ¿Parece un diario económico o una revista editorial?
2. ¿Parece un banco, una aseguradora o un estudio jurídico?
3. ¿Parece una plantilla SaaS generada por IA?
4. ¿Parece una marca ecológica genérica con hojas y verde por todas partes?
5. ¿Parece una landing institucional en lugar de un mercado donde se opera?

Quedan prohibidos como atajo visual:

- emojis, hojas genéricas, íconos decorativos o ilustraciones IA;
- gradientes sin función, glassmorphism y sombras blandas generalizadas;
- exceso de píldoras, tarjetas y esquinas redondeadas;
- titulares serif gigantes, filetes de “tapa” y fondo color papel;
- claims nuevos, números inventados o funcionalidades inexistentes;
- fotos de stock o recursos externos.

## Entrega de esta prueba

Crear únicamente:

`docs/pm/diseno-premium/ox-alpha/index.html`

El archivo puede apoyarse en CSS y JavaScript locales dentro de esa misma
carpeta. Debe:

1. mostrar **tres variantes** seleccionables A/B/C del mismo primer viewport;
2. usar el copy, las acciones y la foto reales de la Home actual;
3. incluir el encabezado para juzgar la marca completa sobre el hero;
4. verse a 1440 px y 390 px sin corte horizontal;
5. incluir un selector fijo y discreto para alternar variantes sin recargar;
6. funcionar abriendo el HTML localmente o mediante un servidor estático;
7. indicar en un panel breve los tokens principales de la variante activa.

Las tres variantes no deben ser “verde, azul y beige”. Deben ser tres maneras
coherentes de resolver la misma dirección agroindustrial:

- **A — Operación de campo:** directa, robusta y orientada a volumen.
- **B — Mercado nacional:** más comercial y densa, con énfasis en oferta.
- **C — Precisión productiva:** más técnica, con énfasis en datos y control.

## Límites duros

- No editar `src/`, `backend/`, `public/`, configuración ni dependencias.
- No cambiar textos, rutas, arquitectura de información o flujos.
- No diseñar Servicios, Mercado, detalle, paneles ni sistema completo.
- No generar imágenes ni pedir activos nuevos.
- No preparar handoff para Dev todavía.
- No desplegar ni commitear por cuenta propia.

Si algo falta, resolverlo con una representación estática fiel dentro del
prototipo. No ampliar alcance.

## Criterio de aprobación

Esta prueba no se aprueba por tener HTML válido ni por “verse prolija”. Emi y
PM la abrirán en el navegador y elegirán una dirección sólo si:

- TopGreen se reconoce como mercado agroindustrial en menos de cinco segundos;
- la personalidad no depende únicamente del verde o de una foto de campo;
- las dos acciones principales son claras;
- desaparece la lectura de diario de UX-2C;
- la propuesta se siente propia y escalable al catálogo, sin obligar a rehacer
  las funciones existentes.

Si ninguna variante alcanza eso, Ox entrega el archivo como evidencia y se
detiene. No itera el resto del sitio.

## Respuesta esperada de Ox

Al terminar, informar solamente:

- archivos creados;
- cómo abrir el prototipo;
- diferencia conceptual A/B/C en una frase por variante;
- cualquier límite real encontrado.

No declarar una variante ganadora: la elección es de Emi.
