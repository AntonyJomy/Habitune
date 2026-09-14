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
from ingestion.ingest_street_ecosystem import (
    StreetContractError,
    import_rows_with_connection as import_street_rows_with_connection,
    load_and_validate as load_street_rows,
)
from ingestion.ingest_vegetation import (
    EXPECTED_BED_COUNT,
    EXPECTED_INVENTORY_COUNT,
    EXPECTED_TREE_COUNT,
    VegetationContractError,
    import_rows_with_connection as import_vegetation_rows_with_connection,
    load_and_validate as load_vegetation_rows,
)
from database.run_migrations import run_pending_migrations
from shared.db import get_connection


logger = logging.getLogger(__name__)

CONFIRMATION_FIELD = "confirm"
CONFIRMATION_VALUE = "INITIALIZE_HABITUNE_DATABASE"
# Resolve packaged schema and dataset paths relative to this source file.
PACKAGE_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = PACKAGE_ROOT / "database" / "schema.sql"
METRICS_PATH = PACKAGE_ROOT / "Dataset" / "processed" / "map_view1.json"
GEOJSON_PATH = PACKAGE_ROOT / "Dataset" / "processed" / "map_view1_suburbs.geojson"
ADDRESS_PATH = PACKAGE_ROOT / "Dataset" / "processed" / "address_lookup.csv"
STREET_PATH = PACKAGE_ROOT / "Dataset" / "processed" / "street_level.json"
TREE_PATH = PACKAGE_ROOT / "Dataset" / "processed" / "city_urban_forest_trees.csv"
BED_PATH = PACKAGE_ROOT / "Dataset" / "processed" / "city_garden_bed_assets.csv"
INVENTORY_PATH = PACKAGE_ROOT / "Dataset" / "processed" / "city_garden_bed_inventory.csv"

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
    ) AS corridor_errors,
    (SELECT count(*) FROM street_ecosystem_evidence) AS street_count,
    (SELECT count(*) FROM address_street_lookup) AS address_count,
    (SELECT count(*) FROM vegetation_tree) AS tree_count,
    (SELECT count(*) FROM garden_bed) AS garden_bed_count,
    (SELECT count(*) FROM garden_bed_inventory) AS garden_bed_inventory_count,
    (SELECT count(*) FROM schema_migrations) AS migration_count
"""

VEGETATION_COUNTS = """
SELECT
    (SELECT count(*) FROM vegetation_tree),
    (SELECT count(*) FROM garden_bed),
    (SELECT count(*) FROM garden_bed_inventory)
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
        "street_count",
        "address_count",
        "tree_count",
        "garden_bed_count",
        "garden_bed_inventory_count",
        "migration_count",
    )
    result = dict(zip(names, values, strict=True))
    expected = {
        "precinct_count": 10,
        "metric_count": 10,
        "relationship_errors": 0,
        "geometry_errors": 0,
        "score_errors": 0,
        "corridor_errors": 0,
        "street_count": 973,
        "address_count": 61413,
        "tree_count": EXPECTED_TREE_COUNT,
        "garden_bed_count": EXPECTED_BED_COUNT,
        "garden_bed_inventory_count": EXPECTED_INVENTORY_COUNT,
    }
    if any(result.get(name) != value for name, value in expected.items()) or result["migration_count"] < 1:
        raise InitializationError("Database verification did not match the expected state")
    return result


def _vegetation_counts(connection):
    with connection.cursor() as cursor:
        cursor.execute(VEGETATION_COUNTS)
        values = cursor.fetchone()
    return tuple(values)


def initialize_database(
    rows: list[dict[str, Any]],
    street_dataset: dict[str, Any],
    vegetation_dataset: dict[str, Any],
    schema_sql: str,
) -> dict[str, Any]:
    """Execute migrations, existing initialization, vegetation import and verification."""
    connection = get_connection()
    try:
        migrations_applied = run_pending_migrations(connection)
        with connection.cursor() as cursor:
            cursor.execute(schema_sql)
        import_rows_with_connection(rows, connection)
        precinct_ids_by_name = {
            joined["metric"]["suburb"]: joined["metric"]["precinct_id"] for joined in rows
        }
        import_street_rows_with_connection(street_dataset, precinct_ids_by_name, connection)
        expected_vegetation = (EXPECTED_TREE_COUNT, EXPECTED_BED_COUNT, EXPECTED_INVENTORY_COUNT)
        if _vegetation_counts(connection) == expected_vegetation:
            vegetation_status = "already_current"
        else:
            import_vegetation_rows_with_connection(vegetation_dataset, connection)
            vegetation_status = "ingested"
        result = _verify(connection)
        # Commit only after schema creation, import, and validation all succeed.
        connection.commit()
        return {
            "migrations_applied": migrations_applied,
            "vegetation_ingestion_status": vegetation_status,
            **result,
        }
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
        street_dataset = load_street_rows(ADDRESS_PATH, STREET_PATH)
        vegetation_dataset = load_vegetation_rows(TREE_PATH, BED_PATH, INVENTORY_PATH)
        schema_sql = _read_schema()
        result = initialize_database(rows, street_dataset, vegetation_dataset, schema_sql)
        return {"status": "initialized", **result}
    except (ContractError, StreetContractError, VegetationContractError):
        logger.error("Database initialization refused because Dataset validation failed")
        return {"status": "failed", "message": "Dataset validation failed"}
    except Exception:
        # Do not log exception text: database drivers may include connection details.
        logger.error("Database initialization failed and was rolled back")
        return {"status": "failed", "message": "Database initialization failed"}
