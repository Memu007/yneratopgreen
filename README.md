# TopGreen / AgroBoeda

Marketplace agropecuario web para Argentina con catálogo, búsqueda por categoría y ubicación, carrito, pedidos, logística de cercanía, Mercado Pago y transferencia bancaria.

## Fuente de verdad

Este README es sólo la puerta técnica del repositorio. No usarlo para decidir alcance, estado contractual ni aceptación de entregas.

Para trabajo de PM o relevo, empezar por [`AGENTS.md`](AGENTS.md) y seguir su orden de lectura.

Documentos canónicos principales:

- [`docs/pm/CONTRATO.md`](docs/pm/CONTRATO.md) — alcance contractual del MVP.
- [`docs/pm/CRONOGRAMA.md`](docs/pm/CRONOGRAMA.md) — fases y fechas vigentes.
- [`docs/pm/NOW.md`](docs/pm/NOW.md) — estado operativo vigente.
- [`docs/pm/ALCANCE-Y-LIMITES.md`](docs/pm/ALCANCE-Y-LIMITES.md) — límites e interpretaciones técnicas aceptadas.
- [`docs/pm/PARA-DEV.md`](docs/pm/PARA-DEV.md) / [`docs/pm/PARA-PM.md`](docs/pm/PARA-PM.md) — canal PM ↔ Dev.

`docs/PROJECT_STATUS.md` es un documento histórico y no debe usarse como estado actual.

## Pagos

El MVP contempla:

- Mercado Pago Checkout para el pago del comprador al vendedor, sin comisión de marketplace de TopGreen/AgroBoeda;
- transferencia bancaria directa al vendedor, con comprobante y validación manual.

No asumir un esquema de split 5%/95% ni comisión del marketplace: esa descripción histórica quedó obsoleta.

## Stack actual

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | FastAPI + Python |
| Base de datos | PostgreSQL + PostGIS |
| Migraciones | Alembic |
| Infraestructura aprobada para el proyecto | Railway |

## Desarrollo local

La guía operativa de levantamiento local está en [`README_LOCAL_SETUP.md`](README_LOCAL_SETUP.md).

En términos generales:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
./scripts/init_local_db.sh
```

Luego seguir la guía local para Backend, Frontend, migraciones, seed y pruebas.

## Documentación técnica bajo demanda

Según la tarea pueden ser relevantes:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DATABASE.md`](docs/DATABASE.md)
- [`docs/API_ENDPOINTS.md`](docs/API_ENDPOINTS.md)
- [`docs/SETUP_PAYMENTS.md`](docs/SETUP_PAYMENTS.md)
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md)
- [`RAILWAY.md`](RAILWAY.md)

No interpretar documentación histórica o de entrega previa como fuente de verdad cuando contradiga los documentos PM canónicos o la evidencia actual de Git.
