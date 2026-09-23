# Propuesta PM — recuperación antes de publicar la migración de imágenes

Estado: **PENDIENTE de decisión de Emi y verificación del Railway actual**.
Fecha: 2026-09-23.

## Qué exige esta puerta

`PRIMARY-IMAGE-INTEGRITY-1` (`cfeff88`) cambia datos: cuando hay varias
imágenes principales de una publicación, conserva como principal la de menor
`display_order` y, a igualdad, menor `id`; las demás siguen en la galería.
Después crea un índice único parcial. La PM aceptó el producto y reprodujo la
migración en Docker, pero no autorizó aplicarla sobre PostGIS de Railway.

Antes de llevar esta composición a `main`, hay que poder recuperar **la base y
el volumen del Backend** (`uploads`, `documentos` y `outbox`) del estado anterior
a la migración. El ensayo `BACKUP-RESTORE-1` ya probó el procedimiento con datos
sintéticos; no demuestra que exista una copia de Railway.

## Propuesta mínima

1. Emi confirma el costo y la política de conservación. Activar backups
   automáticos diarios de los volúmenes **PostGIS y Backend**, y tomar una
   copia manual de cada uno inmediatamente antes de la publicación. Railway
   conserva seis días de backups diarios y cobra sólo los bloques exclusivos
   de las copias al precio de volumen vigente. La factura real depende del
   tamaño y cambios de los volúmenes; no se estima con las cuotas de 5 GB.
2. Conservar además una copia lógica portátil y cifrada fuera del proyecto,
   que incluya la base y los archivos persistentes. Las copias de volumen de
   Railway sólo restauran en el mismo proyecto y entorno; borrar el volumen
   borra sus backups. La copia externa cubre esa falla común de destino.
3. Probar una restauración **aislada** de esa copia previa y registrar hora de
   la copia, duración, integridad y SHA de producto. No ejecutar una
   restauración sobre el servicio activo para probarla.
4. Revalidar inventario de rama, auto-deploy, SHA de Frontend/Backend,
   volúmenes, backups y variables relevantes sin copiar secretos. Sólo entonces
   preparar la composición exacta de `main` y su ensayo local. El push de
   producto a `main` requiere autorización explícita de Emi por el auto-deploy.
5. Si la migración falla tras desplegar, preservar la base y hacer forward-fix.
   No volver sólo el código a un esquema anterior sin recuperación probada.

## Datos que faltan para decidir

- Plan de Railway, espacio usado y tasa de cambio de ambos volúmenes; precio
  efectivo en la cuenta de Emi.
- Si ya existen backups programados o manuales desde el inventario del 13/09.
- Destino y custodia de la copia externa, frecuencia y retención elegidas por
  Emi. Ninguna credencial se guarda en el repositorio.
- Confirmar acceso de lectura al proyecto: el CLI respondió `Unauthorized` el
  23/09, por lo que la configuración actual no pudo verificarse.

## Referencias actuales de Railway

- Backups de volúmenes, retención, límites y restauración:
  https://docs.railway.com/volumes/backups
- Guía de Postgres: snapshots, PITR y dumps portátiles, con ensayo de restore:
  https://docs.railway.com/guides/postgres-backups-restores
- Precio publicado de almacenamiento de volumen: US$ 0,15/GB-mes de datos
  usados, antes de conocer el consumo real de este proyecto:
  https://docs.railway.com/pricing/plans

PITR puede ser una capa adicional, pero no se presupone compatible con el
servicio PostGIS actual ni se activa sin verificar su imagen y costo en Railway.
Esta propuesta no cambia el alcance del MVP ni autoriza despliegue.
