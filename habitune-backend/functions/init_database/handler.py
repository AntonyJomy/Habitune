"""Guarded one-time initializer for the private Habitune PostgreSQL database."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from ingestion.ingest_precinct_overview import (
    ContractError,
    import_rows_with_connection,
    load_and_validate,
)
from shared.db import get_connection


logger = logging.getLogger(__name__)

CONFIRMATION_FIELD = "confirm"
CONFIRMATION_VALUE = "INITIALIZE_HABITUNE_DATABASE"
# Resolve packaged schema and dataset paths relative to this source file.
PACKAGE_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = PACKAGE_ROOT / "database" / "schema.sql"
METRICS_PATH = PACKAGE_ROOT / "Dataset" / "processed" / "map_view1.json"
GEOJSON_PATH = PACKAGE_ROOT / "Dataset" / "processed" / "map_view1_suburbs.geojson"

VERIFY_INITIALIZED_STATE = """
SELECT
    (SELECT count(*) FROM precinct) AS precinct_count,
    (SELECT count(*) FROM precinct_biodiversity_metric) AS metric_count,
    (
        SELECT count(*)
        FROM precinct AS p
        FULL OUTER JOIN precinct_biodiversity_metric AS m USING (precinct_id)
        WHERE p.precinct_id IS NULL OR m.precinct_id IS NULL
    ) AS relationship_errors,
    (
        SELECT count(*)
        FROM precinct
        WHERE ST_SRID(geometry) <> 4326
           OR GeometryType(geometry) <> 'MULTIPOLYGON'
           OR NOT ST_IsValid(geometry)
    ) AS geometry_errors,
    (
        SELECT count(*)
        FROM precinct_biodiversity_metric
        WHERE canopy_coverage_pct NOT BETWEEN 0 AND 100
           OR canopy_score_0_100 NOT BETWEEN 0 AND 100
           OR plant_density_score_0_100 NOT BETWEEN 0 AND 100
           OR animal_density_score_0_100 NOT BETWEEN 0 AND 100
           OR biodiversity_score_0_100 NOT BETWEEN 0 AND 100
    ) AS score_errors,
    (
        SELECT count(*)
        FROM precinct_biodiversity_metric
        WHERE pollination_corridor_count IS NOT NULL
           OR pollination_corridor_status <> 'not_available_until_iteration_2_review'
    ) AS corridor_errors
"""


class InitializationError(RuntimeError):
    """Raised when initialization cannot safely produce the expected state."""


def _read_schema() -> str:
    try:
        return SCHEMA_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise InitializationError("Database schema is unavailable") from exc


def _verify(connection) -> dict[str, int]:
    """Confirm that ingestion produced the expected rows, geometry, and score ranges."""
    with connection.cursor() as cursor:
        cursor.execute(VERIFY_INITIALIZED_STATE)
        values = cursor.fetchone()
    names = (
        "precinct_count",
        "metric_count",
        "relationship_errors",
        "geometry_errors",
        "score_errors",
        "corridor_errors",
    )
    result = dict(zip(names, values, strict=True))
    expected = {
        "precinct_count": 10,
        "metric_count": 10,
        "relationship_errors": 0,
        "geometry_errors": 0,
        "score_errors": 0,
        "corridor_errors": 0,
    }
    if result != expected:
        raise InitializationError("Database verification did not match the expected state")
    return result


def initialize_database(rows: list[dict[str, Any]], schema_sql: str) -> dict[str, int]:
    """Execute schema, ingestion and verification as one transaction."""
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(schema_sql)
        import_rows_with_connection(rows, connection)
        result = _verify(connection)
        # Commit only after schema creation, import, and validation all succeed.
        connection.commit()
        return result
    except Exception:
        # A failure leaves the database unchanged instead of partially initialized.
        connection.rollback()
        raise
    finally:
        connection.close()


def lambda_handler(event, context):
    """Run initialization only after an explicit non-secret confirmation value."""
    del context
    if not isinstance(event, dict) or event.get(CONFIRMATION_FIELD) != CONFIRMATION_VALUE:
        return {
            "status": "refused",
            "message": f"Set {CONFIRMATION_FIELD} to the documented confirmation value",
        }

    try:
        # Contract validation intentionally precedes Secrets Manager and database access.
        rows = load_and_validate(METRICS_PATH, GEOJSON_PATH)
        schema_sql = _read_schema()
        result = initialize_database(rows, schema_sql)
        return {"status": "initialized", **result}
    except ContractError:
        logger.error("Database initialization refused because Dataset validation failed")
        return {"status": "failed", "message": "Dataset validation failed"}
    except Exception:
        # Do not log exception text: database drivers may include connection details.
        logger.error("Database initialization failed and was rolled back")
        return {"status": "failed", "message": "Database initialization failed"}
