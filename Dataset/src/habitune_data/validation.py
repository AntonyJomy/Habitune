"""Proportional output checks that can run in CI without network access."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

from .geometry import geometry_area_m2


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

EXPECTED_PRECINCTS = {
    "Carlton",
    "Central City",
    "Docklands",
    "East Melbourne",
    "Fishermans Bend",
    "Kensington",
    "North and West Melbourne",
    "Parkville",
    "Southbank",
    "South Yarra",
}


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
    if len(rows) != 10:
        errors.append(f"expected 10 supported precincts, found {len(rows)}")
    if len(names) != len(set(names)):
        errors.append("suburb names are not unique")
    if set(names) != EXPECTED_PRECINCTS:
        errors.append("precinct names do not match the reviewed 10-precinct set")
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
        "animal_species_count",
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
        area = row.get("precinct_area_ha")
        if not isinstance(area, (int, float)) or area <= 0:
            errors.append(f"invalid precinct area for {row.get('suburb')}: {area}")
        expected_animals = row.get("pollinator_insect_species_count", 0) + row.get(
            "relevant_bird_species_count", 0
        )
        if row.get("animal_species_count") != expected_animals:
            errors.append(f"animal species total is inconsistent for {row.get('suburb')}")
        for field in (
            "canopy_score_0_100",
            "plant_density_score_0_100",
            "animal_density_score_0_100",
            "biodiversity_score_0_100",
        ):
            value = row.get(field)
            if not isinstance(value, (int, float)) or not 0 <= value <= 100:
                errors.append(f"invalid {field} for {row.get('suburb')}: {value}")
        component_mean = round(
            (
                row.get("canopy_score_0_100", 0)
                + row.get("plant_density_score_0_100", 0)
                + row.get("animal_density_score_0_100", 0)
            )
            / 3,
            2,
        )
        if row.get("biodiversity_score_0_100") != component_mean:
            errors.append(f"biodiversity score formula mismatch for {row.get('suburb')}")
        if row.get("pollination_corridor_count") is not None:
            errors.append(f"corridor count should remain null for {row.get('suburb')}")

    # Recalculate all three min-max components from the published inputs.
    score_inputs = {
        "canopy_score_0_100": "canopy_coverage_pct",
        "plant_density_score_0_100": "plant_density_per_ha",
        "animal_density_score_0_100": "animal_density_per_ha",
    }
    for score_field, input_field in score_inputs.items():
        values = [float(row[input_field]) for row in rows]
        low, high = min(values), max(values)
        for row in rows:
            expected = (
                50.0
                if high == low
                else round((float(row[input_field]) - low) / (high - low) * 100, 2)
            )
            if row.get(score_field) != expected:
                errors.append(f"{score_field} min-max mismatch for {row.get('suburb')}")

    # GeoJSON feature count must match the JSON suburb rows.
    geojson = json.loads(
        (processed_dir / "map_view1_suburbs.geojson").read_text(encoding="utf-8")
    )
    if geojson.get("type") != "FeatureCollection":
        errors.append("map_view1_suburbs.geojson is not a FeatureCollection")
    if len(geojson.get("features", [])) != len(rows):
        errors.append("GeoJSON feature count does not match JSON suburb count")
    rows_by_name = {row["suburb"]: row for row in rows}
    for feature in geojson.get("features", []):
        name = feature.get("properties", {}).get("suburb")
        expected_area = round(geometry_area_m2(feature["geometry"]) / 10_000, 4)
        if rows_by_name.get(name, {}).get("precinct_area_ha") != expected_area:
            errors.append(f"polygon area mismatch for {name}")

    with (processed_dir / "source_inventory.csv").open(encoding="utf-8", newline="") as stream:
        if sum(1 for _ in csv.DictReader(stream)) != 7:
            errors.append("source inventory must contain all seven pipeline inputs")

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
