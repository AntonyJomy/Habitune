#!/usr/bin/env python3
"""Validate and import existing Dataset address/street evidence into PostGIS."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ADDRESS_PATH = REPOSITORY_ROOT / "Dataset" / "processed" / "address_lookup.csv"
DEFAULT_STREET_PATH = REPOSITORY_ROOT / "Dataset" / "processed" / "street_level.json"
EXPECTED_ADDRESS_COUNT = 61_413
EXPECTED_STREET_COUNT = 973

STREET_UPSERT = """
INSERT INTO street_ecosystem_evidence (
    street_key, source_street_id, precinct_id, street_name, centroid,
    address_count, planted_tree_count, planted_tree_species_count,
    garden_plant_row_count, garden_plant_species_count, plant_species_count,
    pollinator_flowering_plant_species_count, nearby_canopy_area_m2,
    nearby_canopy_polygon_count, source_file, source_schema_version,
    assignment_method, maximum_assignment_distance_m, canopy_metric_note
) VALUES %s
ON CONFLICT (street_key) DO UPDATE SET
    source_street_id = EXCLUDED.source_street_id,
    precinct_id = EXCLUDED.precinct_id,
    street_name = EXCLUDED.street_name,
    centroid = EXCLUDED.centroid,
    address_count = EXCLUDED.address_count,
    planted_tree_count = EXCLUDED.planted_tree_count,
    planted_tree_species_count = EXCLUDED.planted_tree_species_count,
    garden_plant_row_count = EXCLUDED.garden_plant_row_count,
    garden_plant_species_count = EXCLUDED.garden_plant_species_count,
    plant_species_count = EXCLUDED.plant_species_count,
    pollinator_flowering_plant_species_count = EXCLUDED.pollinator_flowering_plant_species_count,
    nearby_canopy_area_m2 = EXCLUDED.nearby_canopy_area_m2,
    nearby_canopy_polygon_count = EXCLUDED.nearby_canopy_polygon_count,
    source_file = EXCLUDED.source_file,
    source_schema_version = EXCLUDED.source_schema_version,
    assignment_method = EXCLUDED.assignment_method,
    maximum_assignment_distance_m = EXCLUDED.maximum_assignment_distance_m,
    canopy_metric_note = EXCLUDED.canopy_metric_note
"""
STREET_TEMPLATE = "(" + ",".join(["%s"] * 4) + ",ST_SetSRID(ST_MakePoint(%s,%s),4326)," + ",".join(["%s"] * 14) + ")"

ADDRESS_UPSERT = """
INSERT INTO address_street_lookup (
    address, search_key, precinct_id, street_key, location,
    source_file, source_schema_version
) VALUES %s
ON CONFLICT (search_key, street_key, location) DO UPDATE SET
    address = EXCLUDED.address,
    precinct_id = EXCLUDED.precinct_id,
    source_file = EXCLUDED.source_file,
    source_schema_version = EXCLUDED.source_schema_version
"""
ADDRESS_TEMPLATE = "(%s,%s,%s,%s,ST_SetSRID(ST_MakePoint(%s,%s),4326),%s,%s)"


class StreetContractError(ValueError):
    pass


def _number(value, field, *, integer=False):
    if value is None or value == "":
        return None
    try:
        parsed = int(value) if integer else float(value)
    except (TypeError, ValueError) as exc:
        raise StreetContractError(f"{field} must be numeric or null") from exc
    if parsed < 0 or not math.isfinite(parsed):
        raise StreetContractError(f"{field} must be a non-negative finite number")
    return parsed


def load_and_validate(address_path=DEFAULT_ADDRESS_PATH, street_path=DEFAULT_STREET_PATH):
    try:
        payload = json.loads(Path(street_path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StreetContractError("street_level.json is unavailable or invalid") from exc
    streets = payload.get("streets") if isinstance(payload, dict) else None
    if not isinstance(streets, list) or len(streets) != EXPECTED_STREET_COUNT:
        raise StreetContractError(f"Expected {EXPECTED_STREET_COUNT} street records")

    required = ("street_key", "street_id", "street_name", "suburb")
    street_keys = set()
    for index, street in enumerate(streets):
        if not isinstance(street, dict) or any(not str(street.get(key) or "").strip() for key in required):
            raise StreetContractError(f"streets[{index}] is missing a stable identifier or name")
        if street["street_key"] in street_keys:
            raise StreetContractError(f"Duplicate street_key: {street['street_key']}")
        street_keys.add(street["street_key"])
        for field in (
            "address_count", "planted_tree_count", "planted_tree_species_count",
            "garden_plant_row_count", "garden_plant_species_count", "plant_species_count",
            "pollinator_flowering_plant_species_count", "nearby_canopy_polygon_count",
        ):
            _number(street.get(field), field, integer=True)
        _number(street.get("nearby_canopy_area_m2"), "nearby_canopy_area_m2")
        latitude = float(street["centroid_latitude"])
        longitude = float(street["centroid_longitude"])
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            raise StreetContractError(f"Invalid centroid for {street['street_key']}")

    try:
        with Path(address_path).open(encoding="utf-8", newline="") as stream:
            addresses = list(csv.DictReader(stream))
    except OSError as exc:
        raise StreetContractError("address_lookup.csv is unavailable") from exc
    if len(addresses) != EXPECTED_ADDRESS_COUNT:
        raise StreetContractError(f"Expected {EXPECTED_ADDRESS_COUNT} address records")
    for index, address in enumerate(addresses):
        if not address.get("search_key") or address.get("street_key") not in street_keys:
            raise StreetContractError(f"addresses[{index}] has no matching stable street key")
        latitude = float(address["latitude"])
        longitude = float(address["longitude"])
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            raise StreetContractError(f"Invalid address coordinate at row {index}")
    return {"metadata": payload, "streets": streets, "addresses": addresses}


def import_rows_with_connection(dataset, precinct_ids_by_name, connection):
    from psycopg2.extras import execute_values

    metadata = dataset["metadata"]
    schema_version = str(metadata.get("schema_version") or "unknown")
    assignment_method = str(metadata.get("assignment_method") or "not documented")
    maximum_distance = _number(metadata.get("maximum_assignment_distance_m"), "maximum_assignment_distance_m")
    canopy_note = metadata.get("canopy_metric_note")

    def precinct_id(suburb):
        result = precinct_ids_by_name.get(suburb)
        if not result:
            raise StreetContractError(f"No precinct row matches Dataset suburb: {suburb}")
        return result

    street_values = [(
        row["street_key"], row["street_id"], precinct_id(row["suburb"]), row["street_name"],
        float(row["centroid_longitude"]), float(row["centroid_latitude"]),
        *(_number(row.get(field), field, integer=True) for field in (
            "address_count", "planted_tree_count", "planted_tree_species_count",
            "garden_plant_row_count", "garden_plant_species_count", "plant_species_count",
            "pollinator_flowering_plant_species_count",
        )),
        _number(row.get("nearby_canopy_area_m2"), "nearby_canopy_area_m2"),
        _number(row.get("nearby_canopy_polygon_count"), "nearby_canopy_polygon_count", integer=True),
        "street_level.json", schema_version, assignment_method, maximum_distance, canopy_note,
    ) for row in dataset["streets"]]
    address_values = [(
        row["address"], row["search_key"], precinct_id(row["suburb"]), row["street_key"],
        float(row["longitude"]), float(row["latitude"]), "address_lookup.csv", schema_version,
    ) for row in dataset["addresses"]]
    with connection.cursor() as cursor:
        execute_values(cursor, STREET_UPSERT, street_values, template=STREET_TEMPLATE, page_size=500)
        execute_values(cursor, ADDRESS_UPSERT, address_values, template=ADDRESS_TEMPLATE, page_size=2000)
