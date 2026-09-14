#!/usr/bin/env python3
"""Validate and idempotently import processed vegetation CSVs into PostGIS."""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path

from ingestion.ingest_precinct_overview import connect_from_environment


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TREE_PATH = REPOSITORY_ROOT / "Dataset" / "processed" / "city_urban_forest_trees.csv"
DEFAULT_BED_PATH = REPOSITORY_ROOT / "Dataset" / "processed" / "city_garden_bed_assets.csv"
DEFAULT_INVENTORY_PATH = REPOSITORY_ROOT / "Dataset" / "processed" / "city_garden_bed_inventory.csv"
EXPECTED_TREE_COUNT = 77_913
EXPECTED_BED_COUNT = 3_951
EXPECTED_INVENTORY_COUNT = 17_412

TREE_UPSERT = """
INSERT INTO vegetation_tree (
    tree_id, precinct_id, common_name, scientific_name, genus, family,
    diameter_breast_height_cm, year_planted, date_planted, age_description,
    useful_life_expectancy, useful_life_expectancy_years, source_precinct,
    located_in, location, easting, northing, source_dataset_id,
    source_record_id, source_retrieved_at_utc, processing_method_version
) VALUES %s
ON CONFLICT (tree_id) DO UPDATE SET
    precinct_id = EXCLUDED.precinct_id,
    common_name = EXCLUDED.common_name,
    scientific_name = EXCLUDED.scientific_name,
    genus = EXCLUDED.genus,
    family = EXCLUDED.family,
    diameter_breast_height_cm = EXCLUDED.diameter_breast_height_cm,
    year_planted = EXCLUDED.year_planted,
    date_planted = EXCLUDED.date_planted,
    age_description = EXCLUDED.age_description,
    useful_life_expectancy = EXCLUDED.useful_life_expectancy,
    useful_life_expectancy_years = EXCLUDED.useful_life_expectancy_years,
    source_precinct = EXCLUDED.source_precinct,
    located_in = EXCLUDED.located_in,
    location = EXCLUDED.location,
    easting = EXCLUDED.easting,
    northing = EXCLUDED.northing,
    source_dataset_id = EXCLUDED.source_dataset_id,
    source_record_id = EXCLUDED.source_record_id,
    source_retrieved_at_utc = EXCLUDED.source_retrieved_at_utc,
    processing_method_version = EXCLUDED.processing_method_version
"""
TREE_TEMPLATE = "(" + ",".join(["%s"] * 14) + ",ST_SetSRID(ST_MakePoint(%s,%s),4326)," + ",".join(["%s"] * 6) + ")"

BED_UPSERT = """
INSERT INTO garden_bed (
    bed_id, precinct_id, location, easting_epsg7855, northing_epsg7855,
    area_m2, source_neighbourhood, site_type, site_name, assessed_bed_types,
    botanical_names, common_names, inventory_row_count, source_dataset_id,
    source_record_id, source_retrieved_at_utc, processing_method_version
) VALUES %s
ON CONFLICT (bed_id) DO UPDATE SET
    precinct_id = EXCLUDED.precinct_id,
    location = EXCLUDED.location,
    easting_epsg7855 = EXCLUDED.easting_epsg7855,
    northing_epsg7855 = EXCLUDED.northing_epsg7855,
    area_m2 = EXCLUDED.area_m2,
    source_neighbourhood = EXCLUDED.source_neighbourhood,
    site_type = EXCLUDED.site_type,
    site_name = EXCLUDED.site_name,
    assessed_bed_types = EXCLUDED.assessed_bed_types,
    botanical_names = EXCLUDED.botanical_names,
    common_names = EXCLUDED.common_names,
    inventory_row_count = EXCLUDED.inventory_row_count,
    source_dataset_id = EXCLUDED.source_dataset_id,
    source_record_id = EXCLUDED.source_record_id,
    source_retrieved_at_utc = EXCLUDED.source_retrieved_at_utc,
    processing_method_version = EXCLUDED.processing_method_version
"""
BED_TEMPLATE = "(%s,%s,ST_SetSRID(ST_MakePoint(%s,%s),4326)," + ",".join(["%s"] * 14) + ")"

INVENTORY_UPSERT = """
INSERT INTO garden_bed_inventory (
    bed_id, object_id, assessment_date, assessed_bed_type, bed_type_origin,
    botanical_name, common_name, plant_origin, plant_form, level_of_certainty,
    dominant_species_over_25, plant_condition, plant_condition_score,
    overall_condition_rating, condition_rating_score, source_retrieved_at_utc,
    processing_method_version
) VALUES %s
ON CONFLICT (bed_id, object_id) DO UPDATE SET
    assessment_date = EXCLUDED.assessment_date,
    assessed_bed_type = EXCLUDED.assessed_bed_type,
    bed_type_origin = EXCLUDED.bed_type_origin,
    botanical_name = EXCLUDED.botanical_name,
    common_name = EXCLUDED.common_name,
    plant_origin = EXCLUDED.plant_origin,
    plant_form = EXCLUDED.plant_form,
    level_of_certainty = EXCLUDED.level_of_certainty,
    dominant_species_over_25 = EXCLUDED.dominant_species_over_25,
    plant_condition = EXCLUDED.plant_condition,
    plant_condition_score = EXCLUDED.plant_condition_score,
    overall_condition_rating = EXCLUDED.overall_condition_rating,
    condition_rating_score = EXCLUDED.condition_rating_score,
    source_retrieved_at_utc = EXCLUDED.source_retrieved_at_utc,
    processing_method_version = EXCLUDED.processing_method_version
"""


class VegetationContractError(ValueError):
    """Raised when processed vegetation files do not satisfy the contract."""


def _read(path, expected_count):
    try:
        with Path(path).open(encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
    except OSError as exc:
        raise VegetationContractError(f"Vegetation input is unavailable: {path}") from exc
    if len(rows) != expected_count:
        raise VegetationContractError(
            f"Expected {expected_count} rows in {Path(path).name}; found {len(rows)}"
        )
    return rows


def _text(value):
    cleaned = str(value or "").strip()
    return None if not cleaned or cleaned == "NA" else cleaned


def _number(value, field, *, integer=False, required=False):
    if value in (None, "") or str(value).strip() == "NA":
        if required:
            raise VegetationContractError(f"{field} is required")
        return None
    try:
        parsed = int(value) if integer else float(value)
    except (TypeError, ValueError) as exc:
        raise VegetationContractError(f"{field} must be numeric") from exc
    if not math.isfinite(parsed):
        raise VegetationContractError(f"{field} must be finite")
    return parsed


def _coordinate(row, longitude_field="resolved_longitude", latitude_field="resolved_latitude"):
    longitude = _number(row.get(longitude_field), longitude_field, required=True)
    latitude = _number(row.get(latitude_field), latitude_field, required=True)
    if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
        raise VegetationContractError("Vegetation coordinate is outside WGS84 ranges")
    return longitude, latitude


def _json_array(value, field):
    try:
        parsed = json.loads(value or "[]")
    except json.JSONDecodeError as exc:
        raise VegetationContractError(f"{field} must be a JSON array") from exc
    if not isinstance(parsed, list) or any(not isinstance(item, str) for item in parsed):
        raise VegetationContractError(f"{field} must contain strings")
    return parsed


def load_and_validate(
    tree_path=DEFAULT_TREE_PATH,
    bed_path=DEFAULT_BED_PATH,
    inventory_path=DEFAULT_INVENTORY_PATH,
):
    trees = _read(tree_path, EXPECTED_TREE_COUNT)
    beds = _read(bed_path, EXPECTED_BED_COUNT)
    inventory = _read(inventory_path, EXPECTED_INVENTORY_COUNT)
    tree_ids, bed_ids, inventory_ids = set(), set(), set()
    for row in trees:
        tree_id = _text(row.get("com_id"))
        if not tree_id or tree_id in tree_ids:
            raise VegetationContractError("Tree com_id values must be present and unique")
        tree_ids.add(tree_id)
        _coordinate(row)
        if not _text(row.get("project_precinct_id")):
            raise VegetationContractError("Tree project_precinct_id is required")
    for row in beds:
        bed_id = _text(row.get("asset_id"))
        if not bed_id or bed_id in bed_ids:
            raise VegetationContractError("Garden asset_id values must be present and unique")
        bed_ids.add(bed_id)
        _coordinate(row)
        _number(row.get("easting_epsg7855"), "easting_epsg7855", required=True)
        _number(row.get("northing_epsg7855"), "northing_epsg7855", required=True)
        area = _number(row.get("area_m2"), "area_m2")
        if area is not None and area < 0:
            raise VegetationContractError("area_m2 must be non-negative")
        for field in ("assessed_bed_types", "botanical_names", "common_names"):
            _json_array(row.get(field), field)
    for row in inventory:
        bed_id, object_id = _text(row.get("asset_id")), _text(row.get("objectid"))
        if not bed_id or bed_id not in bed_ids or not object_id:
            raise VegetationContractError("Garden inventory row has no matching asset/object ID")
        key = (bed_id, object_id)
        if key in inventory_ids:
            raise VegetationContractError("Garden inventory (asset_id, objectid) must be unique")
        inventory_ids.add(key)
    return {"trees": trees, "beds": beds, "inventory": inventory}


def _tree_values(row):
    longitude, latitude = _coordinate(row)
    return (
        row["com_id"], row["project_precinct_id"], _text(row.get("common_name")),
        _text(row.get("scientific_name")), _text(row.get("genus")), _text(row.get("family")),
        _number(row.get("diameter_breast_height"), "diameter_breast_height"),
        _number(row.get("year_planted"), "year_planted", integer=True), _text(row.get("date_planted")),
        _text(row.get("age_description")), _text(row.get("useful_life_expectency")),
        _number(row.get("useful_life_expectency_value"), "useful_life_expectency_value", integer=True),
        _text(row.get("precinct")), _text(row.get("located_in")), longitude, latitude,
        _number(row.get("easting"), "easting"), _number(row.get("northing"), "northing"),
        row["source_dataset_id"], row["source_record_id"], row["source_retrieved_at_utc"],
        row["processing_method_version"],
    )


def _bed_values(row):
    longitude, latitude = _coordinate(row)
    return (
        row["asset_id"], row["project_precinct_id"], longitude, latitude,
        _number(row["easting_epsg7855"], "easting_epsg7855", required=True),
        _number(row["northing_epsg7855"], "northing_epsg7855", required=True),
        _number(row.get("area_m2"), "area_m2"), _text(row.get("neighbourhood")),
        _text(row.get("site_type")), _text(row.get("site")),
        json.dumps(_json_array(row.get("assessed_bed_types"), "assessed_bed_types")),
        json.dumps(_json_array(row.get("botanical_names"), "botanical_names")),
        json.dumps(_json_array(row.get("common_names"), "common_names")),
        _number(row.get("inventory_row_count"), "inventory_row_count", integer=True, required=True),
        row["source_dataset_id"], row["source_record_id"], row["source_retrieved_at_utc"],
        row["processing_method_version"],
    )


def _inventory_values(row):
    return (
        row["asset_id"], row["objectid"], _text(row.get("asessment_date_current")),
        _text(row.get("assessed_bed_type")), _text(row.get("bed_type_origin")),
        _text(row.get("botanical_name")), _text(row.get("common_name")),
        _text(row.get("origin")), _text(row.get("form")), _text(row.get("level_of_certainty")),
        _text(row.get("dominant_species_only_above_25")), _text(row.get("plant_condition")),
        _number(row.get("plant_condition_score"), "plant_condition_score"),
        _text(row.get("overall_condition_rating")),
        _number(row.get("condition_rating_score"), "condition_rating_score"),
        row["source_retrieved_at_utc"], row["processing_method_version"],
    )


def import_rows_with_connection(dataset, connection):
    from psycopg2.extras import execute_values

    with connection.cursor() as cursor:
        execute_values(cursor, TREE_UPSERT, [_tree_values(row) for row in dataset["trees"]], template=TREE_TEMPLATE, page_size=1000)
        execute_values(cursor, BED_UPSERT, [_bed_values(row) for row in dataset["beds"]], template=BED_TEMPLATE, page_size=500)
        execute_values(cursor, INVENTORY_UPSERT, [_inventory_values(row) for row in dataset["inventory"]], page_size=1000)


def import_rows(dataset):
    connection = connect_from_environment()
    try:
        import_rows_with_connection(dataset, connection)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trees", type=Path, default=DEFAULT_TREE_PATH)
    parser.add_argument("--beds", type=Path, default=DEFAULT_BED_PATH)
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY_PATH)
    parser.add_argument("--validate-only", action="store_true")
    arguments = parser.parse_args()
    dataset = load_and_validate(arguments.trees, arguments.beds, arguments.inventory)
    if arguments.validate_only:
        print(f"Validated {len(dataset['trees'])} trees, {len(dataset['beds'])} garden beds and {len(dataset['inventory'])} inventory rows; no database writes.")
        return
    import_rows(dataset)
    print(f"Imported {len(dataset['trees'])} trees, {len(dataset['beds'])} garden beds and {len(dataset['inventory'])} inventory rows.")


if __name__ == "__main__":
    main()
