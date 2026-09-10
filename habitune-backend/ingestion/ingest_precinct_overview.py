#!/usr/bin/env python3
"""Validate and import the current Map View 1 precinct contract into PostGIS."""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
from typing import Any


EXPECTED_PRECINCT_COUNT = 10
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_METRICS_PATH = REPOSITORY_ROOT / "Dataset" / "processed" / "map_view1.json"
DEFAULT_GEOJSON_PATH = (
    REPOSITORY_ROOT / "Dataset" / "processed" / "map_view1_suburbs.geojson"
)

PRECINCT_FIELDS = (
    "precinct_id",
    "suburb",
    "boundary_source",
    "suburb_area_km2",
    "precinct_area_ha",
)
METRIC_FIELDS = (
    "canopy_area_km2",
    "canopy_coverage_pct",
    "plant_species_count",
    "animal_species_count",
    "plant_density_per_ha",
    "animal_density_per_ha",
    "species_density_per_ha",
    "pollinator_flowering_plant_species_count",
    "pollinator_insect_species_count",
    "relevant_bird_species_count",
    "tree_record_count",
    "garden_plant_row_count",
    "canopy_polygon_count",
    "pollinator_insect_occurrence_count",
    "relevant_bird_occurrence_count",
    "address_count",
    "pollination_corridor_count",
    "pollination_corridor_status",
    "canopy_score_0_100",
    "plant_density_score_0_100",
    "animal_density_score_0_100",
    "biodiversity_score_0_100",
    "biodiversity_score_version",
)
NULLABLE_FIELDS = {"pollination_corridor_count"}
INTEGER_FIELDS = {
    "plant_species_count",
    "animal_species_count",
    "pollinator_flowering_plant_species_count",
    "pollinator_insect_species_count",
    "relevant_bird_species_count",
    "tree_record_count",
    "garden_plant_row_count",
    "canopy_polygon_count",
    "pollinator_insect_occurrence_count",
    "relevant_bird_occurrence_count",
    "address_count",
    "pollination_corridor_count",
}
NON_NEGATIVE_NUMERIC_FIELDS = {
    "suburb_area_km2",
    "precinct_area_ha",
    "canopy_area_km2",
    "canopy_coverage_pct",
    "plant_density_per_ha",
    "animal_density_per_ha",
    "species_density_per_ha",
    *INTEGER_FIELDS,
    "canopy_score_0_100",
    "plant_density_score_0_100",
    "animal_density_score_0_100",
    "biodiversity_score_0_100",
}
SCORE_FIELDS = {
    "canopy_score_0_100",
    "plant_density_score_0_100",
    "animal_density_score_0_100",
    "biodiversity_score_0_100",
}

PRECINCT_UPSERT = """
INSERT INTO precinct (
    precinct_id, name, boundary_source, suburb_area_km2, precinct_area_ha, geometry
) VALUES (
    %s, %s, %s, %s, %s,
    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
)
ON CONFLICT (precinct_id) DO UPDATE SET
    name = EXCLUDED.name,
    boundary_source = EXCLUDED.boundary_source,
    suburb_area_km2 = EXCLUDED.suburb_area_km2,
    precinct_area_ha = EXCLUDED.precinct_area_ha,
    geometry = EXCLUDED.geometry
"""

METRIC_UPSERT = f"""
INSERT INTO precinct_biodiversity_metric (
    precinct_id, {', '.join(METRIC_FIELDS)}
) VALUES ({', '.join(['%s'] * (len(METRIC_FIELDS) + 1))})
ON CONFLICT (precinct_id) DO UPDATE SET
    {', '.join(f'{field} = EXCLUDED.{field}' for field in METRIC_FIELDS)}
"""

GEOMETRY_VALIDATION = """
SELECT
    ST_IsValid(candidate),
    ST_SRID(candidate),
    GeometryType(candidate)
FROM (
    SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)) AS candidate
) AS parsed
"""


class ContractError(ValueError):
    """Raised when processed Dataset files do not satisfy the current contract."""


def _load_json(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as source:
            return json.load(source)
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"Unable to read valid JSON from {path}: {exc}") from exc


def _require_fields(row: dict[str, Any], fields: tuple[str, ...], context: str) -> None:
    missing = [field for field in fields if field not in row]
    if missing:
        raise ContractError(f"{context} is missing required fields: {', '.join(missing)}")
    unexpected_nulls = [
        field for field in fields if row[field] is None and field not in NULLABLE_FIELDS
    ]
    if unexpected_nulls:
        raise ContractError(
            f"{context} has NULL required fields: {', '.join(unexpected_nulls)}"
        )


def _validate_metric_values(row: dict[str, Any], context: str) -> None:
    for field in INTEGER_FIELDS:
        value = row[field]
        if value is not None and (isinstance(value, bool) or not isinstance(value, int)):
            raise ContractError(f"{context}.{field} must be an integer or NULL")
    for field in NON_NEGATIVE_NUMERIC_FIELDS:
        value = row[field]
        if value is not None and (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
            or value < 0
        ):
            raise ContractError(f"{context}.{field} must be a non-negative number")
    for field in SCORE_FIELDS | {"canopy_coverage_pct"}:
        value = row[field]
        if not 0 <= value <= 100:
            raise ContractError(f"{context}.{field} must be between 0 and 100")
    if row["suburb_area_km2"] <= 0 or row["precinct_area_ha"] <= 0:
        raise ContractError(f"{context} precinct areas must be greater than zero")
    for field in ("precinct_id", "suburb", "boundary_source", "pollination_corridor_status", "biodiversity_score_version"):
        if not isinstance(row[field], str) or not row[field].strip():
            raise ContractError(f"{context}.{field} must be a non-empty string")


def load_and_validate(
    metrics_path: Path = DEFAULT_METRICS_PATH,
    geojson_path: Path = DEFAULT_GEOJSON_PATH,
) -> list[dict[str, Any]]:
    """Return joined rows only after the complete transport contract is valid."""
    metrics_document = _load_json(metrics_path)
    geojson_document = _load_json(geojson_path)
    metrics = metrics_document.get("suburbs") if isinstance(metrics_document, dict) else None
    features = geojson_document.get("features") if isinstance(geojson_document, dict) else None
    if not isinstance(metrics, list):
        raise ContractError(f"{metrics_path} must contain a suburbs array")
    if (
        not isinstance(geojson_document, dict)
        or geojson_document.get("type") != "FeatureCollection"
        or not isinstance(features, list)
    ):
        raise ContractError(f"{geojson_path} must be a GeoJSON FeatureCollection")
    if len(metrics) != EXPECTED_PRECINCT_COUNT or len(features) != EXPECTED_PRECINCT_COUNT:
        raise ContractError(
            "Map View 1 must contain exactly "
            f"{EXPECTED_PRECINCT_COUNT} metrics and geometries; found "
            f"{len(metrics)} and {len(features)}"
        )

    metrics_by_id: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(metrics):
        context = f"suburbs[{index}]"
        if not isinstance(row, dict):
            raise ContractError(f"{context} must be an object")
        _require_fields(row, PRECINCT_FIELDS + METRIC_FIELDS, context)
        _validate_metric_values(row, context)
        precinct_id = row["precinct_id"]
        if precinct_id in metrics_by_id:
            raise ContractError(f"Duplicate metric precinct_id: {precinct_id}")
        metrics_by_id[precinct_id] = row

    geometries_by_id: dict[str, dict[str, Any]] = {}
    for index, feature in enumerate(features):
        context = f"features[{index}]"
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise ContractError(f"{context} must be a GeoJSON Feature")
        properties = feature.get("properties")
        geometry = feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(properties.get("precinct_id"), str):
            raise ContractError(f"{context} must have a string properties.precinct_id")
        precinct_id = properties["precinct_id"]
        if not precinct_id.strip():
            raise ContractError(f"{context} has an empty precinct_id")
        if precinct_id in geometries_by_id:
            raise ContractError(f"Duplicate GeoJSON precinct_id: {precinct_id}")
        if not isinstance(geometry, dict) or geometry.get("type") not in {
            "Polygon",
            "MultiPolygon",
        }:
            geometry_type = geometry.get("type") if isinstance(geometry, dict) else None
            raise ContractError(f"{context} has unsupported geometry type: {geometry_type}")
        if not isinstance(geometry.get("coordinates"), list) or not geometry["coordinates"]:
            raise ContractError(f"{context} geometry must have non-empty coordinates")
        geometries_by_id[precinct_id] = geometry

    metric_ids = set(metrics_by_id)
    geometry_ids = set(geometries_by_id)
    if metric_ids != geometry_ids:
        raise ContractError(
            "Metric and GeoJSON precinct IDs differ; "
            f"metrics-only={sorted(metric_ids - geometry_ids)}, "
            f"geometry-only={sorted(geometry_ids - metric_ids)}"
        )

    # The stable contract key, not a mutable display name, determines every join.
    return [
        {"metric": metrics_by_id[precinct_id], "geometry": geometries_by_id[precinct_id]}
        for precinct_id in sorted(metric_ids)
    ]


def connect_from_environment():
    """Connect locally using DB_* settings without calling AWS Secrets Manager."""
    try:
        import psycopg2
    except ImportError as exc:
        raise RuntimeError("psycopg2 is required to import precinct data") from exc

    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing database environment variables: {', '.join(missing)}")
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=os.environ["DB_PORT"],
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )


def import_rows_with_connection(rows: list[dict[str, Any]], connection) -> None:
    """Validate with PostGIS and UPSERT rows on the caller-owned transaction."""
    with connection.cursor() as cursor:
        for joined in rows:
            metric = joined["metric"]
            geometry_json = json.dumps(joined["geometry"], separators=(",", ":"))
            cursor.execute(GEOMETRY_VALIDATION, (geometry_json,))
            is_valid, srid, geometry_type = cursor.fetchone()
            if not is_valid or srid != 4326 or geometry_type != "MULTIPOLYGON":
                raise ContractError(
                    f"Invalid PostGIS geometry for precinct {metric['precinct_id']}: "
                    f"valid={is_valid}, srid={srid}, type={geometry_type}"
                )

        for joined in rows:
            metric = joined["metric"]
            geometry_json = json.dumps(joined["geometry"], separators=(",", ":"))
            cursor.execute(
                PRECINCT_UPSERT,
                (
                    metric["precinct_id"],
                    metric["suburb"],
                    metric["boundary_source"],
                    metric["suburb_area_km2"],
                    metric["precinct_area_ha"],
                    geometry_json,
                ),
            )
        for joined in rows:
            metric = joined["metric"]
            cursor.execute(
                METRIC_UPSERT,
                (metric["precinct_id"], *(metric[field] for field in METRIC_FIELDS)),
            )


def import_rows(rows: list[dict[str, Any]]) -> None:
    """Open a local/admin connection and atomically UPSERT validated rows."""
    connection = connect_from_environment()
    try:
        import_rows_with_connection(rows, connection)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate and import Map View 1 precinct data into PostgreSQL/PostGIS."
    )
    parser.add_argument("--metrics", type=Path, default=DEFAULT_METRICS_PATH)
    parser.add_argument("--geojson", type=Path, default=DEFAULT_GEOJSON_PATH)
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate Dataset files without connecting to PostgreSQL.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rows = load_and_validate(args.metrics, args.geojson)
    if args.validate_only:
        print(f"Validated {len(rows)} precinct metric/geometry records; no database writes.")
        return 0
    import_rows(rows)
    print(f"Imported {len(rows)} precinct metric/geometry records.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
