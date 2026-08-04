# Alcance contractual — transcripción funcional

Fuente: *Documento de Especificación Funcional y Propuesta Comercial —
Marketplace del Sector Agropecuario (Fase Nacional)*, Ynera.

> ✅ **Aprobado por la clienta el martes 2026-07-28.** Desde esa fecha el
> alcance de abajo **queda cerrado**: lo que no está acá no es requisito,
> y lo que se construya de más lo pagamos nosotros.
>
> El plazo de 12 a 14 semanas está anclado a fechas reales en
> **`CRONOGRAMA.md`**. Ese archivo es la referencia para cualquier
> conversación de plazos.
>
> Alcance agregado después de la aprobación —hoy, las suscripciones con
> cobro recurrente— **no está cubierto por este documento**. Ver
> `CRONOGRAMA.md` sección 5.

Transcripción de las secciones **funcionales** (1 a 5). Las secciones
comerciales (costos, forma de pago) **no se versionan acá** — están en el
PDF original, fuera del repositorio, porque este repositorio es público.

Este documento es la única fuente de verdad del alcance. Si algo no está
acá, no es requisito.

---

## 1. Objetivos

- Conectar productores, proveedores de insumos, prestadores de servicios
  y transportistas en una plataforma centralizada.
- Validar el modelo con un MVP a escala nacional antes de expandir.
- Motor de búsqueda avanzado **con geolocalización**, desde semillas y
  maquinaria hasta servicios tecnológicos y logística de cercanía.

## 2. Categorías del catálogo

1. **Insumos y Materia Prima** — semillas, fertilizantes, agroquímicos.
2. **Bienes y Ganado** — animales de cría y comerciales.
3. **Maquinaria y Servicios** — alquiler y prestación de maquinaria.
4. **Tecnología para el Cultivo** — drones, sensores IoT, software de
   gestión de campo.
5. **Módulo de Logística Integrada** — catálogo de fletes y
   transportistas vinculados por proximidad geográfica.

Plataforma web responsive.

## 3. MVP

### 3.1 Roles

El contrato define **dos roles**:

- **Comprador** (agricultor/productor): registro con validación, perfil,
  buscador avanzado con filtros **por categoría y ubicación**, carrito,
  historial de pedidos.
- **Vendedor** (proveedor/prestador): registro con validación, **panel de
  control básico**, gestión de stock y catálogo (publicación con
  imágenes, descripción, precio y ubicación), gestión de ventas.

El **transportista no es un tercer rol**: según 3.2 se registra como
*"un tipo especial de proveedor"*.

### 3.2 Logística — directorio, no motor de ruteo

El contrato es explícito: *"en lugar de un complejo algoritmo
automatizado de ruteo, se propone un modelo de Directorio de Logística
por Geolocalización"*.

- El transportista se registra detallando: ubicación base, transporte
  habilitado certificado, zona de cobertura (radio en km) y capacidad de
  carga (ej. "hasta 40 toneladas de semillas").
- En la compra, el sistema detecta la ubicación del comprador y del
  vendedor y **lista transportistas disponibles en la zona** que
  coincidan con los requerimientos del producto.
- El comprador puede **seleccionar el transportista e incluirlo en la
  transacción**, o **coordinar el envío directo con los datos de
  contacto provistos**.

No hay flujo de cotización al transportista en el contrato.

### 3.3 Pagos

- **Mercado Pago**: *"integración mediante checkout básico"* para
  tarjetas de crédito, débito y dinero en cuenta.
- **Transferencia bancaria directa**: el sistema muestra el **CBU/Alias
  del vendedor**, el comprador **adjunta el comprobante**, y el
  **vendedor lo valida manualmente**.

El contrato **no menciona split payments, OAuth de vendedores ni
comisión del marketplace**.

## 4. Tecnologías

- **Frontend**: React.js o Next.js. Responsive móvil y escritorio.
- **Backend**: Python (FastAPI o Django) o Node.js.
- **Base de datos**: **PostgreSQL con extensión PostGIS**, para resolver
  consultas de ubicación y cercanía de forma nativa. Sin alternativa
  ofrecida.
- **Infraestructura**: AWS o Supabase / Render.

## 5. Cronograma

Plazo total estimado: **12 a 14 semanas**.

| Fase contractual | Contenido | Semanas |
|------------------|-----------|---------|
| 1 — Diseño y UX/UI | Pantallas, flujo de comprador, vendedor y logística | 1–2 |
| 2 — Desarrollo base | Arquitectura, base de datos, registro de roles y perfiles | 3–5 |
| 3 — Buscador y catálogo | Motor de búsqueda y **módulo de geolocalización de fletes** | 6–8 |
| 4 — Pagos y checkout | Mercado Pago y **validación de transferencias** | 9–10 |
| 5 — QA y lanzamiento | Pruebas, usabilidad, carga inicial, despliegue | 11–12 |

Ancladas a fechas reales en **`CRONOGRAMA.md`**, junto con el contraste
fase por fase contra lo que está realmente hecho.

Ojo: estas fases **no** son las mismas que las del roadmap interno
`PM_ROADMAP.md`. No confundirlas al reportar avance al cliente. **Hacia
afuera se reporta con estas cinco fases**, aunque internamente se trabaje
en otro orden.

## Incluido en la propuesta

- Garantía por bugs: **90 días** post lanzamiento.
- Capacitación básica del panel de administración.
- Documentación técnica del despliegue.

## Hitos de cobro

Existen tres, atados a entregables. El segundo depende de **demostrar
catálogo, búsquedas y geolocalización funcionando** (fase contractual 3).
Montos y porcentajes: ver PDF original, no se versionan acá.
