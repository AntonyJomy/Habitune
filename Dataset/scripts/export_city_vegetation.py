"""Export City of Melbourne trees and garden beds inside Habitune project areas.

The script downloads the complete source CSV exports, assigns records with the
reviewed ten-precinct geometry, and writes transport-neutral CSV/JSON snapshots
for later database ingestion. It does not access the Habitune database.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import sys
import tempfile
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from habitune_data.cleaning import clean_text, number, valid_lon_lat  # noqa: E402
from habitune_data.geometry import find_area, load_areas  # noqa: E402
from habitune_data.street import utm55s_to_wgs84  # noqa: E402

TREE_DATASET = "trees-with-species-and-dimensions-urban-forest"
GARDEN_DATASET = "renewals-for-nature-city-of-melbourne-garden-bed-inventory-2024"
EXPORT_BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
METHOD_VERSION = "city_vegetation_project_polygon_v1"
EXTRA_FIELDS = (
    "project_precinct_id",
    "project_precinct",
    "resolved_longitude",
    "resolved_latitude",
    "source_dataset_id",
    "source_record_id",
    "source_retrieved_at_utc",
    "processing_method_version",
)

csv.field_size_limit(64 * 1024 * 1024)


def _slug(value: str) -> str:
    return "_".join(value.casefold().replace("'", "").split())


def _download_export(dataset_id: str, destination: Path) -> None:
    params = urlencode(
        {
            "lang": "en",
            "timezone": "Australia/Melbourne",
            "use_labels": "false",
            "delimiter": ",",
        }
    )
    request = Request(
        f"{EXPORT_BASE}/{dataset_id}/exports/csv?{params}",
        headers={"Accept": "text/csv", "User-Agent": "Habitune data export/1"},
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    last_error = None
    for attempt in range(3):
        descriptor, temporary_name = tempfile.mkstemp(prefix=f"{dataset_id}-", suffix=".csv")
        os.close(descriptor)
        temporary = Path(temporary_name)
        try:
            with urlopen(request, timeout=180) as response, temporary.open("wb") as stream:
                shutil.copyfileobj(response, stream)
            temporary.replace(destination)
            return
        except Exception as error:  # Network failures are retried, then surfaced.
            last_error = error
            temporary.unlink(missing_ok=True)
            if attempt < 2:
                time.sleep(2**attempt)
    raise RuntimeError(f"Could not download {dataset_id}: {last_error}")


def _read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames:
            raise ValueError(f"Source export has no header: {path}")
        rows = [{key: clean_text(value) for key, value in row.items()} for row in reader]
        return list(reader.fieldnames), rows


def _spatial_fields(
    area: str,
    longitude: float,
    latitude: float,
    dataset_id: str,
    source_id: str,
    retrieved_at: str,
) -> dict:
    return {
        "project_precinct_id": _slug(area),
        "project_precinct": area,
        "resolved_longitude": round(longitude, 8),
        "resolved_latitude": round(latitude, 8),
        "source_dataset_id": dataset_id,
        "source_record_id": source_id,
        "source_retrieved_at_utc": retrieved_at,
        "processing_method_version": METHOD_VERSION,
    }


def process_trees(rows: list[dict[str, str]], features: list[dict], retrieved_at: str):
    report = defaultdict(int)
    report["source_rows"] = len(rows)
    by_id: dict[str, dict] = {}
    for row in rows:
        source_id = clean_text(row.get("com_id"))
        if not source_id:
            report["rejected_missing_com_id"] += 1
            continue
        longitude, latitude = number(row.get("longitude")), number(row.get("latitude"))
        if not valid_lon_lat(longitude, latitude):
            report["rejected_invalid_coordinates"] += 1
            continue
        area = find_area(longitude, latitude, features)
        if not area:
            report["rejected_outside_project_area"] += 1
            continue
        cleaned = {**row, **_spatial_fields(area, longitude, latitude, TREE_DATASET, source_id, retrieved_at)}
        if source_id in by_id:
            report["deduplicated_com_id_rows"] += 1
            continue
        by_id[source_id] = cleaned
    records = sorted(by_id.values(), key=lambda row: (row["project_precinct"], row["source_record_id"]))
    report["accepted_unique_records"] = len(records)
    report["accepted_by_precinct"] = dict(sorted(Counter(row["project_precinct"] for row in records).items()))
    for key in ("rejected_missing_com_id", "rejected_invalid_coordinates", "rejected_outside_project_area", "deduplicated_com_id_rows"):
        report.setdefault(key, 0)
    return records, dict(report)


def _garden_identity(row: dict[str, str], index: int) -> str:
    asset_id = clean_text(row.get("asset_id"))
    if asset_id:
        return f"asset:{asset_id}"
    object_id = clean_text(row.get("objectid"))
    x_coord, y_coord = clean_text(row.get("x_coord")), clean_text(row.get("y_coord"))
    return f"fallback:{object_id or 'missing'}:{x_coord or 'x'}:{y_coord or 'y'}:{index}"


def process_gardens(rows: list[dict[str, str]], features: list[dict], retrieved_at: str):
    report = defaultdict(int)
    report["source_rows"] = len(rows)
    grouped: dict[str, list[tuple[int, dict[str, str]]]] = defaultdict(list)
    for index, row in enumerate(rows):
        grouped[_garden_identity(row, index)].append((index, row))
    report["source_asset_groups"] = len(grouped)

    inventory_records = []
    asset_records = []
    for identity, members in grouped.items():
        coordinate_candidates = []
        for _, row in members:
            easting, northing = number(row.get("x_coord")), number(row.get("y_coord"))
            if easting is None or northing is None:
                continue
            try:
                longitude, latitude = utm55s_to_wgs84(easting, northing)
            except (ValueError, OverflowError):
                continue
            if valid_lon_lat(longitude, latitude):
                coordinate_candidates.append((easting, northing, longitude, latitude))
        if not coordinate_candidates:
            report["rejected_assets_without_valid_coordinates"] += 1
            report["rejected_inventory_rows_without_asset_coordinates"] += len(members)
            continue
        easting, northing, longitude, latitude = coordinate_candidates[0]
        if len({(round(item[0], 3), round(item[1], 3)) for item in coordinate_candidates}) > 1:
            report["assets_with_conflicting_coordinates"] += 1
        area = find_area(longitude, latitude, features)
        if not area:
            report["rejected_assets_outside_project_area"] += 1
            report["rejected_inventory_rows_outside_project_area"] += len(members)
            continue

        asset_id = clean_text(members[0][1].get("asset_id"))
        source_id = asset_id or identity
        spatial = _spatial_fields(area, longitude, latitude, GARDEN_DATASET, source_id, retrieved_at)
        seen_rows = set()
        accepted_members = []
        for _, row in members:
            row_key = tuple(sorted(row.items()))
            if row_key in seen_rows:
                report["deduplicated_exact_inventory_rows"] += 1
                continue
            seen_rows.add(row_key)
            accepted_members.append(row)
            inventory_records.append({**row, **spatial})

        def distinct(field: str) -> list[str]:
            return sorted({clean_text(row.get(field)) for row in accepted_members if clean_text(row.get(field)) and clean_text(row.get(field)) != "NA"})

        representative = next((row for row in accepted_members if row.get("x_coord") and row.get("y_coord")), accepted_members[0])
        asset_records.append(
            {
                "asset_id": asset_id or None,
                "object_ids": distinct("objectid"),
                "project_precinct_id": spatial["project_precinct_id"],
                "project_precinct": area,
                "resolved_longitude": spatial["resolved_longitude"],
                "resolved_latitude": spatial["resolved_latitude"],
                "easting_epsg7855": easting,
                "northing_epsg7855": northing,
                "area_m2": number(representative.get("area_m2")),
                "neighbourhood": clean_text(representative.get("neighbourhood")) or None,
                "site_type": clean_text(representative.get("site_type")) or None,
                "site": clean_text(representative.get("site")) or None,
                "assessed_bed_types": distinct("assessed_bed_type"),
                "botanical_names": distinct("botanical_name"),
                "common_names": distinct("common_name"),
                "inventory_row_count": len(accepted_members),
                "source_dataset_id": GARDEN_DATASET,
                "source_record_id": source_id,
                "source_retrieved_at_utc": retrieved_at,
                "processing_method_version": METHOD_VERSION,
            }
        )

    inventory_records.sort(key=lambda row: (row["project_precinct"], row["source_record_id"], row.get("botanical_name", "")))
    asset_records.sort(key=lambda row: (row["project_precinct"], row["source_record_id"]))
    report["accepted_unique_assets"] = len(asset_records)
    report["accepted_inventory_rows"] = len(inventory_records)
    report["accepted_assets_by_precinct"] = dict(sorted(Counter(row["project_precinct"] for row in asset_records).items()))
    report["accepted_inventory_rows_by_precinct"] = dict(sorted(Counter(row["project_precinct"] for row in inventory_records).items()))
    for key in (
        "rejected_assets_without_valid_coordinates",
        "rejected_inventory_rows_without_asset_coordinates",
        "assets_with_conflicting_coordinates",
        "rejected_assets_outside_project_area",
        "rejected_inventory_rows_outside_project_area",
        "deduplicated_exact_inventory_rows",
    ):
        report.setdefault(key, 0)
    return inventory_records, asset_records, dict(report)


def _write_csv(path: Path, records: list[dict], preferred_fields: list[str] | None = None) -> None:
    fields = preferred_fields or []
    seen = set(fields)
    for record in records:
        for field in record:
            if field not in seen:
                fields.append(field)
                seen.add(field)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for record in records:
            writer.writerow({key: json.dumps(value, ensure_ascii=False) if isinstance(value, (list, dict)) else value for key, value in record.items()})


def _write_json(path: Path, dataset_id: str, retrieved_at: str, records: list[dict]) -> None:
    payload = {
        "metadata": {
            "source_dataset_id": dataset_id,
            "source_url": f"{EXPORT_BASE}/{dataset_id}",
            "source_retrieved_at_utc": retrieved_at,
            "processing_method_version": METHOD_VERSION,
            "spatial_assignment": "point-in-polygon against processed/suburb_boundaries.geojson",
            "record_count": len(records),
        },
        "records": records,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def export(root: Path, refresh: bool = False) -> dict:
    processed = root / "processed"
    cache = root / "cache" / "city_of_melbourne"
    processed.mkdir(parents=True, exist_ok=True)
    boundaries = processed / "suburb_boundaries.geojson"
    features = load_areas(boundaries)
    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    source_paths = {
        TREE_DATASET: cache / f"{TREE_DATASET}.csv",
        GARDEN_DATASET: cache / f"{GARDEN_DATASET}.csv",
    }
    for dataset_id, path in source_paths.items():
        if refresh or not path.is_file():
            _download_export(dataset_id, path)

    tree_fields, tree_rows = _read_csv(source_paths[TREE_DATASET])
    garden_fields, garden_rows = _read_csv(source_paths[GARDEN_DATASET])
    trees, tree_report = process_trees(tree_rows, features, retrieved_at)
    garden_inventory, garden_assets, garden_report = process_gardens(garden_rows, features, retrieved_at)

    _write_csv(processed / "city_urban_forest_trees.csv", trees, tree_fields + list(EXTRA_FIELDS))
    _write_json(processed / "city_urban_forest_trees.json", TREE_DATASET, retrieved_at, trees)
    _write_csv(processed / "city_garden_bed_inventory.csv", garden_inventory, garden_fields + list(EXTRA_FIELDS))
    _write_json(processed / "city_garden_bed_inventory.json", GARDEN_DATASET, retrieved_at, garden_inventory)
    _write_csv(processed / "city_garden_bed_assets.csv", garden_assets)
    _write_json(processed / "city_garden_bed_assets.json", GARDEN_DATASET, retrieved_at, garden_assets)

    report = {
        "generated_at_utc": retrieved_at,
        "processing_method_version": METHOD_VERSION,
        "authoritative_boundary": str(boundaries.relative_to(root)),
        "precincts": [feature["properties"]["suburb"] for feature in features],
        "trees": tree_report,
        "garden_beds": garden_report,
    }
    (processed / "city_vegetation_export_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Dataset project root")
    parser.add_argument("--refresh", action="store_true", help="redownload complete source exports")
    arguments = parser.parse_args()
    report = export(arguments.root.resolve(), refresh=arguments.refresh)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
