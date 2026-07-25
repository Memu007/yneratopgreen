"""Seed reproducible de localidades desde la copia versionada de Georef v2."""
import csv
import hashlib
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session


DATA_FILE = Path(__file__).parent / "data" / "georef_localidades.csv"
EXPECTED_SHA256 = "7743fd6a6af96fce138696680afe297e71fc41f37f8d1986b3763913d0c86197"

UPSERT_SQL = text(
    """
    INSERT INTO localities (
        id,
        name,
        province_id,
        province_name,
        department_id,
        department_name,
        source,
        latitude,
        longitude,
        coordinates
    ) VALUES (
        :id,
        :name,
        :province_id,
        :province_name,
        :department_id,
        :department_name,
        :source,
        :latitude,
        :longitude,
        ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        province_id = EXCLUDED.province_id,
        province_name = EXCLUDED.province_name,
        department_id = EXCLUDED.department_id,
        department_name = EXCLUDED.department_name,
        source = EXCLUDED.source,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        coordinates = EXCLUDED.coordinates
    """
)


def seed_localities(db: Session, batch_size: int = 500) -> int:
    """Inserta o actualiza todas las localidades de la copia oficial."""
    digest = hashlib.sha256(DATA_FILE.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA256:
        raise RuntimeError(
            f"Hash inesperado para {DATA_FILE.name}: {digest} "
            f"(esperado {EXPECTED_SHA256})"
        )

    total = 0
    batch = []
    with DATA_FILE.open(encoding="utf-8-sig", newline="") as csv_file:
        for row in csv.DictReader(csv_file):
            batch.append(
                {
                    "id": row["id"],
                    "name": row["nombre"],
                    "province_id": row["provincia_id"],
                    "province_name": row["provincia_nombre"],
                    "department_id": row["departamento_id"] or None,
                    "department_name": row["departamento_nombre"] or None,
                    "source": row["fuente"] or None,
                    "latitude": float(row["centroide_lat"]),
                    "longitude": float(row["centroide_lon"]),
                }
            )
            if len(batch) >= batch_size:
                db.execute(UPSERT_SQL, batch)
                total += len(batch)
                batch.clear()

        if batch:
            db.execute(UPSERT_SQL, batch)
            total += len(batch)

    db.commit()
    print(
        f"  ✅ {total} localidades Georef sembradas "
        f"(sha256: {EXPECTED_SHA256})"
    )
    return total


if __name__ == "__main__":
    from app.db.base import SessionLocal

    session = SessionLocal()
    try:
        seed_localities(session)
    finally:
        session.close()
