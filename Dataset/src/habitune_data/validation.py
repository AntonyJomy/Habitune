"""Proportional output checks that can run in CI without network access."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


REQUIRED_OUTPUTS = (
    "map_view1.json",
    "map_view1_suburbs.csv",
    "map_view1_suburbs.geojson",
    "suburb_boundaries.geojson",
    "address_lookup.csv",
    "pollinator_insect_taxa.csv",
    "pollinator_flowering_plants.csv",
    "relevant_birds.csv",
    "main_pollinator_groups.csv",
    "source_inventory.csv",
    "data_quality_report.json",
    "street_level.csv",
    "street_level.json",
)


def validate_outputs(processed_dir: Path) -> list[str]:
    """Return validation errors found in the processed Map View 1 files."""

    # Stop early when a required contract file is missing.
    errors = []
    for filename in REQUIRED_OUTPUTS:
        if not (processed_dir / filename).is_file():
            errors.append(f"missing output: {filename}")
    if errors:
        return errors

    # Check the suburb contract before checking matching spatial output.
    contract = json.loads((processed_dir / "map_view1.json").read_text(encoding="utf-8"))
    rows = contract.get("suburbs", [])
    names = [row.get("suburb") for row in rows]
    if len(rows) != 11:
        errors.append(f"expected 11 supported suburbs, found {len(rows)}")
    if len(names) != len(set(names)):
        errors.append("suburb names are not unique")
    if "Carlton" not in names:
        errors.append("Carlton is missing")
    if contract.get("city_summary", {}).get("suburb_count") != len(rows):
        errors.append("city summary suburb count does not match suburb rows")

    # Species counts must come from distinct labels, never occurrence totals.
    detail_files = {
        "pollinator_insect_species_count": "pollinator_insect_taxa.csv",
        "relevant_bird_species_count": "relevant_birds.csv",
        "pollinator_flowering_plant_species_count": "pollinator_flowering_plants.csv",
    }
    for field, filename in detail_files.items():
        by_suburb: dict[str, set[str]] = defaultdict(set)
        all_species = set()
        with (processed_dir / filename).open(encoding="utf-8", newline="") as stream:
            for detail in csv.DictReader(stream):
                species = detail.get("scientific_name", "")
                if not species:
                    continue
                all_species.add(species)
                for suburb in detail.get("suburbs", "").split("|"):
                    if suburb:
                        by_suburb[suburb].add(species)
        for row in rows:
            expected = len(by_suburb[row.get("suburb")])
            if row.get(field) != expected:
                errors.append(
                    f"{field} for {row.get('suburb')} is {row.get(field)}; "
                    f"expected {expected} distinct species"
                )
        city_value = contract.get("city_summary", {}).get(field)
        if city_value != len(all_species):
            errors.append(
                f"city {field} is {city_value}; expected {len(all_species)} distinct species"
            )

    numeric_counts = (
        "plant_species_count",
        "pollinator_flowering_plant_species_count",
        "pollinator_insect_species_count",
        "relevant_bird_species_count",
    )
    for row in rows:
        coverage = row.get("canopy_coverage_pct")
        if not isinstance(coverage, (int, float)) or not 0 <= coverage <= 100:
            errors.append(f"invalid canopy percentage for {row.get('suburb')}: {coverage}")
        for field in numeric_counts:
            value = row.get(field)
            if not isinstance(value, int) or value < 0:
                errors.append(f"invalid {field} for {row.get('suburb')}: {value}")

    # GeoJSON feature count must match the JSON suburb rows.
    geojson = json.loads(
        (processed_dir / "map_view1_suburbs.geojson").read_text(encoding="utf-8")
    )
    if geojson.get("type") != "FeatureCollection":
        errors.append("map_view1_suburbs.geojson is not a FeatureCollection")
    if len(geojson.get("features", [])) != len(rows):
        errors.append("GeoJSON feature count does not match JSON suburb count")

    with (processed_dir / "source_inventory.csv").open(encoding="utf-8", newline="") as stream:
        if sum(1 for _ in csv.DictReader(stream)) != 7:
            errors.append("source inventory must contain all seven supplied CSV files")

    # Street keys must be unique so backend lookup returns one result.
    street_payload = json.loads(
        (processed_dir / "street_level.json").read_text(encoding="utf-8")
    )
    streets = street_payload.get("streets", [])
    street_keys = [street.get("street_key") for street in streets]
    if not streets:
        errors.append("street-level output contains no streets")
    if len(street_keys) != len(set(street_keys)):
        errors.append("street-level keys are not unique")
    for street in streets:
        if not street.get("street_name"):
            errors.append(f"street has no name: {street.get('street_key')}")
        if street.get("nearby_canopy_area_m2", -1) < 0:
            errors.append(f"street has invalid canopy area: {street.get('street_key')}")
        if any(key.startswith("pollinator_insect_") for key in street):
            errors.append(f"static insect fields remain in street output: {street.get('street_key')}")
    return errors
