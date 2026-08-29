"""End-to-end builder for Habitune Map Interaction 1 - View 1.

The output is intentionally compact: raw council exports and repeated ALA
observations stay out of the frontend contract, while counts retain enough
provenance to be audited and rebuilt.
"""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from .ala import ALAClient, facet_map
from .cleaning import (
    CERTAINTY_DEFINITION,
    clean_text,
    family_filter,
    load_bird_traits,
    load_pollinator_evidence,
    name_key,
    number,
    valid_lon_lat,
)
from .config import (
    BIRD_FILTERS,
    BIRD_QUERY,
    INSECT_FILTERS,
    INSECT_QUERY,
    SOURCE_FILES,
    project_paths,
)
from .geometry import (
    feature_collection,
    find_area,
    geometry_area_m2,
    geometry_to_wkt,
    load_areas,
    normalize_area_name,
)
from .street import build_street_outputs, street_key


# A few canopy polygons contain GeoJSON cells larger than Python's conservative
# 128 KiB CSV default. The source file is trusted local input, and 64 MiB still
# provides a finite guardrail against accidental unbounded fields.
csv.field_size_limit(64 * 1024 * 1024)


def _write_json(path: Path, value: object) -> None:
    """Write readable UTF-8 JSON with a final newline."""

    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    """Write rows using a fixed column order."""

    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def _initial_area_state(features: list[dict]) -> dict[str, dict]:
    """Create empty counters and species sets for each supported suburb."""

    state = {}
    for feature in features:
        name = feature["properties"]["suburb"]
        state[name] = {
            "suburb": name,
            "suburb_area_m2": geometry_area_m2(feature["geometry"]),
            "canopy_area_m2": 0.0,
            "canopy_polygon_count": 0,
            "tree_record_count": 0,
            "garden_plant_row_count": 0,
            "address_count": 0,
            "tree_species": set(),
            "garden_species": set(),
            "pollinator_flowering_plants": set(),
            "pollinator_insect_species": set(),
            "pollinator_insect_occurrence_count": 0,
            "relevant_bird_species": set(),
            "relevant_bird_occurrence_count": 0,
        }
    return state


def _process_canopies(path: Path, features: list[dict], state: dict[str, dict]) -> dict:
    """Clean canopy polygons and add their area to suburb totals."""

    # Each accepted polygon contributes area to its containing suburb.
    report = Counter(rows=0)
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            report["rows"] += 1
            try:
                lat_text, lon_text = row["Geo Point"].split(",", 1)
                lat, lon = float(lat_text), float(lon_text)
                geometry = json.loads(row["Geo Shape"])
            except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                report["rejected_invalid_geometry"] += 1
                continue
            if not valid_lon_lat(lon, lat):
                report["rejected_invalid_coordinates"] += 1
                continue
            suburb = find_area(lon, lat, features)
            if not suburb:
                report["rejected_outside_supported_areas"] += 1
                continue
            try:
                area = geometry_area_m2(geometry)
            except (KeyError, TypeError, ValueError):
                report["rejected_invalid_geometry"] += 1
                continue
            if area <= 0:
                report["rejected_zero_area"] += 1
                continue
            state[suburb]["canopy_area_m2"] += area
            state[suburb]["canopy_polygon_count"] += 1
            report["accepted"] += 1
    return dict(report)


def _process_trees(
    path: Path,
    features: list[dict],
    state: dict[str, dict],
    pollinator_plant_keys: set[str],
) -> tuple[dict, dict[str, dict]]:
    """Clean tree records and track pollinator-linked plant matches."""

    # Tree names are also checked against plants linked to pol=1 study rows.
    report = Counter(rows=0)
    matched_plants: dict[str, dict] = {}
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            report["rows"] += 1
            species = clean_text(row.get("Scientific Name"))
            lon, lat = number(row.get("Longitude")), number(row.get("Latitude"))
            if not species:
                report["rejected_missing_species"] += 1
                continue
            if not valid_lon_lat(lon, lat):
                report["rejected_invalid_coordinates"] += 1
                continue
            suburb = find_area(lon, lat, features)
            if not suburb:
                report["rejected_outside_supported_areas"] += 1
                continue
            state[suburb]["tree_record_count"] += 1
            state[suburb]["tree_species"].add(species)
            key = name_key(species)
            if key in pollinator_plant_keys:
                state[suburb]["pollinator_flowering_plants"].add(species)
                entry = matched_plants.setdefault(
                    key,
                    {"scientific_name": species, "sources": set(), "suburbs": set(), "asset_rows": 0},
                )
                entry["sources"].add("urban_forest_trees")
                entry["suburbs"].add(suburb)
                entry["asset_rows"] += 1
            report["accepted"] += 1
    return dict(report), matched_plants


def _process_gardens(
    path: Path,
    state: dict[str, dict],
    pollinator_plant_keys: set[str],
    matched_plants: dict[str, dict],
) -> dict:
    """Clean garden rows and add valid plant species to suburb totals."""

    # Garden rows already contain a neighbourhood label for suburb totals.
    report = Counter(rows=0)
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            report["rows"] += 1
            species = clean_text(row.get("Botanical name"))
            suburb = normalize_area_name(row.get("Neighbourhood"))
            if not species or species.upper() == "NA":
                report["rejected_missing_species"] += 1
                continue
            if suburb not in state:
                report["rejected_unknown_or_missing_area"] += 1
                continue
            state[suburb]["garden_plant_row_count"] += 1
            state[suburb]["garden_species"].add(species)
            key = name_key(species)
            if key in pollinator_plant_keys:
                state[suburb]["pollinator_flowering_plants"].add(species)
                entry = matched_plants.setdefault(
                    key,
                    {"scientific_name": species, "sources": set(), "suburbs": set(), "asset_rows": 0},
                )
                entry["sources"].add("garden_bed_inventory")
                entry["suburbs"].add(suburb)
                entry["asset_rows"] += 1
            report["accepted"] += 1
    return dict(report)


def _process_addresses(
    path: Path,
    output: Path,
    features: list[dict],
    state: dict[str, dict],
) -> dict:
    """Build the address lookup and assign each address by geometry."""

    # The cleaned lookup connects user input to one stable street key.
    report = Counter(rows=0)
    rows: list[dict] = []
    seen = set()
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            report["rows"] += 1
            address = clean_text(row.get("address_pnt"))
            lon, lat = number(row.get("longitude")), number(row.get("latitude"))
            if not address:
                report["rejected_missing_address"] += 1
                continue
            if not valid_lon_lat(lon, lat):
                report["rejected_invalid_coordinates"] += 1
                continue
            # Source labels such as South Wharf do not align exactly with the
            # CLUE areas. Geometry is the canonical Map View 1 assignment.
            suburb = find_area(lon, lat, features)
            if not suburb:
                report["rejected_outside_supported_areas"] += 1
                continue
            identifier = clean_text(row.get("gisid")) or (name_key(address), lon, lat)
            if identifier in seen:
                report["rejected_duplicate"] += 1
                continue
            seen.add(identifier)
            street_id = clean_text(row.get("street_id"))
            street_name = clean_text(row.get("str_name"))
            if not street_name:
                report["rejected_missing_street"] += 1
                continue
            rows.append(
                {
                    "address": address,
                    "search_key": name_key(address),
                    "suburb": suburb,
                    "street_id": street_id,
                    "street_name": street_name,
                    "street_key": street_key(suburb, street_id, street_name),
                    "latitude": f"{lat:.8f}",
                    "longitude": f"{lon:.8f}",
                }
            )
            state[suburb]["address_count"] += 1
            report["accepted"] += 1
    rows.sort(key=lambda item: (item["search_key"], item["address"]))
    _write_csv(
        output,
        rows,
        [
            "address",
            "search_key",
            "suburb",
            "street_id",
            "street_name",
            "street_key",
            "latitude",
            "longitude",
        ],
    )
    return dict(report)


def _query_birds(
    client: ALAClient,
    features: list[dict],
    bird_traits: dict[str, dict],
    state: dict[str, dict],
    workers: int,
) -> tuple[list[dict], dict]:
    """Filter ALA birds by supplied diet traits and supported suburb."""

    # Start with the explicit city-wide bird query and species facet.
    base_payload = client.search(
        q=BIRD_QUERY,
        filters=BIRD_FILTERS,
        facets=("species",),
        page_size=0,
    )
    lga_species = facet_map(base_payload, "species")
    relevant: dict[str, dict] = {}
    unmatched = []
    matched_not_relevant = []
    for observed_name, occurrence_count in lga_species.items():
        trait = bird_traits.get(name_key(observed_name))
        if not trait:
            unmatched.append(observed_name)
            continue
        if not trait["relevant"]:
            matched_not_relevant.append(observed_name)
            continue
        relevant[observed_name] = {**trait, "occurrence_count": occurrence_count}

    def query_area(feature: dict) -> tuple[str, dict[str, int]]:
        """Fetch the bird species facet for one suburb polygon."""

        suburb = feature["properties"]["suburb"]
        payload = client.search(
            q=BIRD_QUERY,
            filters=BIRD_FILTERS,
            facets=("species",),
            wkt=geometry_to_wkt(feature["geometry"]),
            page_size=0,
        )
        return suburb, facet_map(payload, "species")

    # Suburb facet queries are independent, so run a small number in parallel.
    area_facets: dict[str, dict[str, int]] = {}
    with ThreadPoolExecutor(max_workers=max(1, min(workers, 4))) as executor:
        futures = {executor.submit(query_area, feature): feature for feature in features}
        for future in as_completed(futures):
            suburb, species_counts = future.result()
            area_facets[suburb] = species_counts

    species_rows = []
    for observed_name, trait in sorted(relevant.items()):
        present_suburbs = []
        for suburb, counts in area_facets.items():
            count = counts.get(observed_name, 0)
            if not count:
                continue
            present_suburbs.append(suburb)
            state[suburb]["relevant_bird_species"].add(observed_name)
            state[suburb]["relevant_bird_occurrence_count"] += count
        species_rows.append(
            {
                "scientific_name": observed_name,
                "trait_scientific_name": trait["trait_scientific_name"],
                "common_name": trait["common_name"],
                "feeding_guild": trait["feeding_guild"],
                "diet_invertebrates_pct": trait["diet_percent"]["invertebrates"],
                "diet_nectar_pct": trait["diet_percent"]["nectar"],
                "diet_fruit_pct": trait["diet_percent"]["fruit"],
                "diet_seed_pct": trait["diet_percent"]["seed"],
                "role_pollination": trait["roles"]["pollination"],
                "role_seed_dispersal": trait["roles"]["seed_dispersal"],
                "role_insect_food_web": trait["roles"]["insect_food_web"],
                "diet_certainty": trait["certainty"],
                "diet_certainty_definition": CERTAINTY_DEFINITION.get(
                    trait["certainty"], "not supplied"
                ),
                "trait_match_basis": trait["trait_match_basis"],
                "lga_occurrence_count": trait["occurrence_count"],
                "suburb_count": len(present_suburbs),
                "suburbs": "|".join(sorted(present_suburbs)),
            }
        )
    report = {
        "query": BIRD_QUERY,
        "query_basis": "explicit Birds taxon query replacing the equivalent supplied qid",
        "api_total_occurrence_records": int(base_payload.get("totalRecords", 0)),
        "api_species_count": len(lga_species),
        "trait_matched_relevant_species_count": len(relevant),
        "trait_matched_excluded_species_count": len(matched_not_relevant),
        "unmatched_species_count": len(unmatched),
        "unmatched_species": sorted(unmatched),
        "area_query_count": len(area_facets),
    }
    return species_rows, report


def _query_insects(
    client: ALAClient,
    candidate_families: list[str],
    locally_positive_species: set[str],
    features: list[dict],
    state: dict[str, dict],
) -> tuple[list[dict], dict]:
    """Build ALA insect candidates from families containing a pol=1 record."""

    # Limit ALA insects to families with local pol=1 study evidence.
    filters = INSECT_FILTERS + (
        family_filter(candidate_families),
    )
    # ALA returned HTTP 503 for this query at page sizes of 1,000-5,000 on
    # 2026-08-28, while pages of 100 were stable. Explicit pagination keeps the
    # result complete and makes each response cheap to retry/cache.
    page_size = 100
    first_payload = client.search(
        q=INSECT_QUERY,
        filters=filters,
        page_size=page_size,
    )
    total = int(first_payload.get("totalRecords", 0))
    if total > 5000:
        raise RuntimeError(
            f"Evidence-backed insect query returned {total} records; "
            "ALA search is capped at 5,000, so a download workflow is required."
        )

    records = list(first_payload.get("occurrences", []))
    for start in range(page_size, total, page_size):
        page = client.search(
            q=INSECT_QUERY,
            filters=filters,
            page_size=page_size,
            start=start,
        )
        records.extend(page.get("occurrences", []))

    report = Counter(api_total_occurrence_records=total)
    taxa: dict[str, dict] = {}
    seen = set()
    local_species_keys = {name_key(name) for name in locally_positive_species}
    for record in records:
        report["downloaded_records"] += 1
        if clean_text(record.get("taxonRank")).casefold() != "species":
            report["rejected_non_species_taxon"] += 1
            continue
        species = clean_text(record.get("species") or record.get("scientificName"))
        lon, lat = number(record.get("decimalLongitude")), number(record.get("decimalLatitude"))
        if not species:
            report["rejected_missing_species"] += 1
            continue
        if not valid_lon_lat(lon, lat):
            report["rejected_invalid_coordinates"] += 1
            continue
        identifier = clean_text(record.get("uuid") or record.get("occurrenceID"))
        if not identifier:
            identifier = (name_key(species), lon, lat, record.get("eventDate"))
        if identifier in seen:
            report["rejected_duplicate_identifier"] += 1
            continue
        seen.add(identifier)
        suburb = find_area(lon, lat, features)
        if not suburb:
            report["rejected_outside_supported_areas"] += 1
            continue

        entry = taxa.setdefault(
            species,
            {
                "scientific_name": species,
                "family": clean_text(record.get("family")),
                "order": clean_text(record.get("order")),
                "lga_occurrence_count": 0,
                "suburb_occurrences": Counter(),
                "exact_local_species_evidence": name_key(species) in local_species_keys,
            },
        )
        entry["lga_occurrence_count"] += 1
        entry["suburb_occurrences"][suburb] += 1
        state[suburb]["pollinator_insect_species"].add(species)
        state[suburb]["pollinator_insect_occurrence_count"] += 1
        report["accepted"] += 1

    rows = []
    for species, entry in sorted(taxa.items()):
        exact_evidence = entry["exact_local_species_evidence"]
        rows.append(
            {
                "scientific_name": species,
                "family": entry["family"],
                "order": entry["order"],
                "lga_occurrence_count": entry["lga_occurrence_count"],
                "suburb_count": len(entry["suburb_occurrences"]),
                "suburbs": "|".join(sorted(entry["suburb_occurrences"])),
                "exact_local_species_evidence": exact_evidence,
                "evidence_level": "exact_species_label" if exact_evidence else "family_candidate",
                "classification_basis": (
                    "species labelled pol=1 in supplied Melbourne functional-group study"
                    if exact_evidence
                    else "family candidate; another family member is labelled pol=1 in the supplied Melbourne study"
                ),
            }
        )
    report["accepted_species_count"] = len(rows)
    return rows, dict(report)


def _metrics_rows(state: dict[str, dict]) -> list[dict]:
    """Convert mutable suburb aggregation state into serialisable metric rows."""

    rows = []
    for suburb in sorted(state):
        value = state[suburb]
        plant_species = value["tree_species"] | value["garden_species"]
        coverage = 100 * value["canopy_area_m2"] / value["suburb_area_m2"]
        rows.append(
            {
                "suburb": suburb,
                "suburb_area_km2": round(value["suburb_area_m2"] / 1_000_000, 4),
                "canopy_area_km2": round(value["canopy_area_m2"] / 1_000_000, 4),
                "canopy_coverage_pct": round(coverage, 2),
                "plant_species_count": len(plant_species),
                "pollinator_flowering_plant_species_count": len(
                    value["pollinator_flowering_plants"]
                ),
                "pollinator_insect_species_count": len(value["pollinator_insect_species"]),
                "relevant_bird_species_count": len(value["relevant_bird_species"]),
                "tree_record_count": value["tree_record_count"],
                "garden_plant_row_count": value["garden_plant_row_count"],
                "canopy_polygon_count": value["canopy_polygon_count"],
                "pollinator_insect_occurrence_count": value[
                    "pollinator_insect_occurrence_count"
                ],
                "relevant_bird_occurrence_count": value["relevant_bird_occurrence_count"],
                "address_count": value["address_count"],
            }
        )
    return rows


def build(
    root: Path,
    *,
    refresh_api: bool = False,
    offline: bool = False,
    workers: int = 3,
) -> dict:
    """Rebuild all Map View 1 outputs from the seven CSVs and cached/live ALA data."""

    # Load paths and create the initial suburb aggregation state.
    paths = project_paths(root)
    paths["processed"].mkdir(parents=True, exist_ok=True)
    features = load_areas(paths["boundaries"])
    state = _initial_area_state(features)

    # Prepare local ecological evidence before filtering ALA observations.
    pollinator = load_pollinator_evidence(paths["insect_plant_study"])
    bird_traits, bird_trait_report = load_bird_traits(paths["bird_traits"])
    pollinator_plant_records = pollinator["plant_positive_records"]
    pollinator_plant_keys = {name_key(name) for name in pollinator_plant_records}

    # Clean and aggregate all council source files.
    local_report = {}
    local_report["canopies"] = _process_canopies(paths["canopies"], features, state)
    local_report["trees"], matched_plants = _process_trees(
        paths["trees"], features, state, pollinator_plant_keys
    )
    local_report["garden_beds"] = _process_gardens(
        paths["garden_beds"], state, pollinator_plant_keys, matched_plants
    )
    local_report["addresses"] = _process_addresses(
        paths["addresses"],
        paths["processed"] / "address_lookup.csv",
        features,
        state,
    )
    local_report["insect_plant_study"] = {
        "rows": pollinator["rows"],
        "invalid_pollinator_flag": pollinator["invalid_pollinator_flag"],
        "candidate_family_count": len(pollinator["candidate_families"]),
        "pollinator_linked_plant_species_count": len(pollinator_plant_records),
    }
    local_report["bird_traits"] = bird_trait_report

    # Use cached ALA responses unless a refresh is requested.
    client = ALAClient(paths["cache"], refresh=refresh_api, offline=offline)
    bird_rows, bird_api_report = _query_birds(client, features, bird_traits, state, workers)
    insect_rows, insect_api_report = _query_insects(
        client,
        pollinator["candidate_families"],
        pollinator["positive_species"],
        features,
        state,
    )
    local_report["street_level"] = build_street_outputs(paths, pollinator_plant_keys)

    # Convert the final state into files consumed by frontend and backend code.
    metric_rows = _metrics_rows(state)
    metric_fields = list(metric_rows[0])
    _write_csv(paths["processed"] / "map_view1_suburbs.csv", metric_rows, metric_fields)

    metric_by_suburb = {row["suburb"]: row for row in metric_rows}
    output_features = []
    for feature in features:
        suburb = feature["properties"]["suburb"]
        output_features.append(
            {
                "type": "Feature",
                "properties": metric_by_suburb[suburb],
                "geometry": feature["geometry"],
            }
        )
    _write_json(paths["processed"] / "suburb_boundaries.geojson", feature_collection(features))
    _write_json(paths["processed"] / "map_view1_suburbs.geojson", feature_collection(output_features))

    _write_csv(
        paths["processed"] / "relevant_birds.csv",
        bird_rows,
        [
            "scientific_name",
            "trait_scientific_name",
            "common_name",
            "feeding_guild",
            "diet_invertebrates_pct",
            "diet_nectar_pct",
            "diet_fruit_pct",
            "diet_seed_pct",
            "role_pollination",
            "role_seed_dispersal",
            "role_insect_food_web",
            "diet_certainty",
            "diet_certainty_definition",
            "trait_match_basis",
            "lga_occurrence_count",
            "suburb_count",
            "suburbs",
        ],
    )
    _write_csv(
        paths["processed"] / "pollinator_insect_taxa.csv",
        insect_rows,
        [
            "scientific_name",
            "family",
            "order",
            "lga_occurrence_count",
            "suburb_count",
            "suburbs",
            "exact_local_species_evidence",
            "evidence_level",
            "classification_basis",
        ],
    )

    group_rows = pollinator["main_groups"]
    _write_csv(
        paths["processed"] / "main_pollinator_groups.csv",
        group_rows,
        [
            "group",
            "pollinator_classified_record_count",
            "all_study_record_count",
            "pollinator_share",
        ],
    )
    plant_rows = []
    for key, entry in sorted(matched_plants.items(), key=lambda item: item[1]["scientific_name"]):
        evidence_name = next(
            name for name in pollinator_plant_records if name_key(name) == key
        )
        plant_rows.append(
            {
                "scientific_name": entry["scientific_name"],
                "study_name": evidence_name,
                "pollinator_linked_study_record_count": pollinator_plant_records[evidence_name],
                "asset_row_count": entry["asset_rows"],
                "sources": "|".join(sorted(entry["sources"])),
                "suburb_count": len(entry["suburbs"]),
                "suburbs": "|".join(sorted(entry["suburbs"])),
                "classification_basis": "plant associated with an insect labelled pol=1 in the supplied study",
            }
        )
    _write_csv(
        paths["processed"] / "pollinator_flowering_plants.csv",
        plant_rows,
        [
            "scientific_name",
            "study_name",
            "pollinator_linked_study_record_count",
            "asset_row_count",
            "sources",
            "suburb_count",
            "suburbs",
            "classification_basis",
        ],
    )

    city_summary = {
        "suburb_count": len(metric_rows),
        "canopy_coverage_pct": round(
            100
            * sum(value["canopy_area_m2"] for value in state.values())
            / sum(value["suburb_area_m2"] for value in state.values()),
            2,
        ),
        "plant_species_count": len(
            set().union(
                *(value["tree_species"] | value["garden_species"] for value in state.values())
            )
        ),
        "pollinator_flowering_plant_species_count": len(plant_rows),
        "pollinator_insect_species_count": len(insect_rows),
        "relevant_bird_species_count": len(bird_rows),
    }
    contract = {
        "schema_version": "2.0.0",
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "view": "Map Interaction 1 - suburb overview with street-level location detail",
        "location_behavior": {
            "with_location": "resolve address or lon/lat, return street assets, and query ALA birds and pollinator insect candidates within the same radius",
            "without_location": "return city_summary plus every suburb object",
        },
        "animals_near_location": {
            "display_label": "Animals near your location",
            "default_radius_m": 250,
            "source": "ALA occurrence search at runtime",
            "birds_filter": "species in relevant_birds.csv with nectar or fruit diet greater than zero",
            "pollinator_insect_filter": "species in pollinator_insect_taxa.csv derived from local pol=1 family evidence",
        },
        "street_level_output": "street_level.json",
        "evidence_note": (
            "ALA values are quality-filtered occurrence observations from the 2020 decade, "
            "not confirmed habitat area or population size. Nearby birds and insect candidates "
            "use the same input point and radius. Insect taxa are evidence-filtered pollinator "
            "candidates; pol=1 is a functional-group label, not an observed interaction."
        ),
        "city_summary": city_summary,
        "main_pollinator_groups": group_rows[:5],
        "suburbs": metric_rows,
    }
    _write_json(paths["processed"] / "map_view1.json", contract)

    source_inventory = []
    for key, filename in SOURCE_FILES.items():
        path = paths[key]
        source_inventory.append(
            {
                "source_key": key,
                "filename": filename,
                "bytes": path.stat().st_size,
                "included_in_pipeline": True,
            }
        )
    _write_csv(
        paths["processed"] / "source_inventory.csv",
        source_inventory,
        ["source_key", "filename", "bytes", "included_in_pipeline"],
    )

    quality_report = {
        "schema_version": "1.0.0",
        "local_sources": local_report,
        "ala_birds": bird_api_report,
        "ala_pollinator_insects": insect_api_report,
        "known_limitations": [
            "ALA records are sightings/occurrences and must not be labelled as habitat polygons.",
            "The supplied qc=-*nest_parent*:* query context returned HTTP 400 on 2026-08-28; stable identifier deduplication is used instead.",
            "Canopy polygons are allocated by their supplied representative point; a polygon crossing a suburb boundary is not clipped.",
            "Suburb-level garden rows without a supported Neighbourhood label are excluded; street-level garden coordinates are interpreted as MGA/UTM zone 55 south and assigned to the nearest address.",
            "CLUE boundaries cover 11 merged Map View 1 areas; address labels are normalised spatially against those polygons.",
            "The source data has no street polygons, so tree, garden and canopy assets are assigned to the nearest address within 250 m and canopy is reported as nearby area rather than street coverage percentage.",
            "Nearby animals require live ALA access or a matching cached query; an unavailable query is returned with status and does not change the local street assets.",
            "Pollinator insect classification is family-level evidence; it identifies candidates, not proof that every included species pollinates.",
            "Only manually verified fuzzy bird aliases are accepted; rejected suggestions are listed in this report.",
            "Bird relevance for Iteration 1 requires nectar or fruit in the trait table; invertebrate diet is retained only as supporting detail.",
        ],
    }
    _write_json(paths["processed"] / "data_quality_report.json", quality_report)
    return contract
