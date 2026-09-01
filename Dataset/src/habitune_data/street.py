"""Build street-level asset aggregates from point-like source records.

Street boundaries are not present in the supplied data. Assets are therefore
assigned to the nearest City of Melbourne address point within 250 metres and
aggregated by the source street ID. The limit is explicit so park assets can be
associated with a nearby street without pulling distant observations into it.
"""

from __future__ import annotations

import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

from .cleaning import clean_text, name_key, number, valid_lon_lat
from .geometry import EARTH_RADIUS_M, find_area, geometry_area_m2, load_areas


csv.field_size_limit(64 * 1024 * 1024)

GRID_DEGREES = 0.001
MAX_ASSIGNMENT_DISTANCE_M = 250.0


def distance_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Fast local equirectangular distance, accurate for street-scale lookup."""

    mean_lat = math.radians((lat1 + lat2) / 2)
    x = math.radians(lon2 - lon1) * math.cos(mean_lat)
    y = math.radians(lat2 - lat1)
    return EARTH_RADIUS_M * math.hypot(x, y)


def utm55s_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """Convert GDA/MGA-style zone 55 south coordinates to lon/lat.

    The supplied garden export contains Melbourne MGA easting/northing values
    but no WGS84 columns. The standard inverse UTM formula is implemented here
    to avoid adding a heavyweight GIS dependency solely for this conversion.
    """

    a = 6_378_137.0
    eccentricity_squared = 0.00669438
    k0 = 0.9996
    x = easting - 500_000.0
    y = northing - 10_000_000.0
    longitude_origin = 147.0  # central meridian for UTM/MGA zone 55

    eccentricity_prime_squared = eccentricity_squared / (1 - eccentricity_squared)
    m = y / k0
    mu = m / (
        a
        * (
            1
            - eccentricity_squared / 4
            - 3 * eccentricity_squared**2 / 64
            - 5 * eccentricity_squared**3 / 256
        )
    )
    e1 = (1 - math.sqrt(1 - eccentricity_squared)) / (
        1 + math.sqrt(1 - eccentricity_squared)
    )
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
    )
    n1 = a / math.sqrt(1 - eccentricity_squared * math.sin(phi1) ** 2)
    t1 = math.tan(phi1) ** 2
    c1 = eccentricity_prime_squared * math.cos(phi1) ** 2
    r1 = (
        a
        * (1 - eccentricity_squared)
        / (1 - eccentricity_squared * math.sin(phi1) ** 2) ** 1.5
    )
    d = x / (n1 * k0)
    latitude = phi1 - (n1 * math.tan(phi1) / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * eccentricity_prime_squared)
        * d**4
        / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * eccentricity_prime_squared - 3 * c1**2)
        * d**6
        / 720
    )
    longitude = math.radians(longitude_origin) + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * eccentricity_prime_squared + 24 * t1**2)
        * d**5
        / 120
    ) / math.cos(phi1)
    return math.degrees(longitude), math.degrees(latitude)


def street_key(suburb: str, street_id: str, street_name: str) -> str:
    """Create the key shared by address and street output files."""

    stable = street_id or name_key(street_name)
    return f"{suburb}|{stable}"


class AddressIndex:
    """Small grid index used for repeatable nearest-street assignment."""

    def __init__(self, rows: list[dict]) -> None:
        """Group address points into small cells for quick nearby searches."""

        # A small grid avoids scanning every address for every source record.
        self.rows = rows
        self.cells: dict[tuple[int, int], list[dict]] = defaultdict(list)
        for row in rows:
            self.cells[self._cell(float(row["longitude"]), float(row["latitude"]))].append(row)

    @staticmethod
    def _cell(lon: float, lat: float) -> tuple[int, int]:
        """Return the grid cell containing a WGS84 point."""

        return math.floor(lon / GRID_DEGREES), math.floor(lat / GRID_DEGREES)

    def nearest(
        self,
        lon: float,
        lat: float,
        max_distance_m: float = MAX_ASSIGNMENT_DISTANCE_M,
        suburb: str | None = None,
    ) -> tuple[dict | None, float | None]:
        """Return the nearest address within the same resolved suburb."""

        centre_x, centre_y = self._cell(lon, lat)
        # At Melbourne latitude, a 0.001-degree cell is about 88 x 111 m.
        span = max(1, math.ceil(max_distance_m / 85.0))
        best = None
        best_distance = max_distance_m
        for x in range(centre_x - span, centre_x + span + 1):
            for y in range(centre_y - span, centre_y + span + 1):
                for candidate in self.cells.get((x, y), []):
                    if suburb and candidate["suburb"] != suburb:
                        continue
                    candidate_distance = distance_m(
                        lon,
                        lat,
                        float(candidate["longitude"]),
                        float(candidate["latitude"]),
                    )
                    if candidate_distance <= best_distance:
                        best = candidate
                        best_distance = candidate_distance
        return best, best_distance if best else None


def _load_address_rows(path: Path) -> list[dict]:
    """Load the cleaned address lookup file."""

    with path.open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def _empty_aggregate() -> dict:
    """Create counters and species sets for one street."""

    return {
        "tree_record_count": 0,
        "tree_species": set(),
        "garden_plant_row_count": 0,
        "garden_species": set(),
        "pollinator_flowering_plant_species": set(),
        "canopy_area_m2": 0.0,
        "canopy_polygon_count": 0,
    }


def _assign(
    index: AddressIndex,
    lon: float,
    lat: float,
    suburb: str,
    report: Counter,
) -> str | None:
    """Assign an asset to its nearest street and update quality counters."""

    address, _ = index.nearest(lon, lat, suburb=suburb)
    if not address:
        report["rejected_no_address_within_250m"] += 1
        return None
    report["accepted"] += 1
    return address["street_key"]


def build_street_outputs(
    paths: dict[str, Path],
    pollinator_plant_keys: set[str],
) -> dict:
    """Build street-level JSON/CSV and return assignment-quality counters."""

    # Build one reusable address index before assigning local assets.
    address_rows = _load_address_rows(paths["processed"] / "address_lookup.csv")
    index = AddressIndex(address_rows)
    features = load_areas(paths["boundaries"])
    street_base: dict[str, dict] = {}
    for row in address_rows:
        key = row["street_key"]
        base = street_base.setdefault(
            key,
            {
                "street_key": key,
                "street_id": row["street_id"],
                "street_name": row["street_name"],
                "suburb": row["suburb"],
                "address_count": 0,
                "longitude_sum": 0.0,
                "latitude_sum": 0.0,
            },
        )
        base["address_count"] += 1
        base["longitude_sum"] += float(row["longitude"])
        base["latitude_sum"] += float(row["latitude"])

    aggregates = {key: _empty_aggregate() for key in street_base}
    report: dict[str, Counter] = {
        "trees": Counter(rows=0),
        "canopies": Counter(rows=0),
        "garden_beds": Counter(rows=0),
    }

    # Assign valid tree records to the nearest street.
    with paths["trees"].open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            report["trees"]["rows"] += 1
            species = clean_text(row.get("Scientific Name"))
            lon, lat = number(row.get("Longitude")), number(row.get("Latitude"))
            if not species or not valid_lon_lat(lon, lat):
                report["trees"]["rejected_missing_species_or_coordinates"] += 1
                continue
            suburb = find_area(lon, lat, features)
            if not suburb:
                report["trees"]["rejected_outside_supported_areas"] += 1
                continue
            key = _assign(index, lon, lat, suburb, report["trees"])
            if not key:
                continue
            value = aggregates[key]
            value["tree_record_count"] += 1
            value["tree_species"].add(species)
            if name_key(species) in pollinator_plant_keys:
                value["pollinator_flowering_plant_species"].add(species)

    # Canopy is reported as nearby area because street polygons are unavailable.
    with paths["canopies"].open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            report["canopies"]["rows"] += 1
            try:
                lat_text, lon_text = row["Geo Point"].split(",", 1)
                lat, lon = float(lat_text), float(lon_text)
                area_m2 = geometry_area_m2(json.loads(row["Geo Shape"]))
            except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                report["canopies"]["rejected_invalid_geometry"] += 1
                continue
            suburb = find_area(lon, lat, features)
            if not suburb:
                report["canopies"]["rejected_outside_supported_areas"] += 1
                continue
            key = _assign(index, lon, lat, suburb, report["canopies"])
            if not key:
                continue
            aggregates[key]["canopy_area_m2"] += area_m2
            aggregates[key]["canopy_polygon_count"] += 1

    # Garden coordinates are stored in MGA zone 55 and converted before lookup.
    garden_rows = []
    asset_coordinates: dict[str, tuple[float, float]] = {}
    with paths["garden_beds"].open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            garden_rows.append(row)
            asset_id = clean_text(row.get("Asset ID"))
            easting, northing = number(row.get("X_Coord")), number(row.get("Y_Coord"))
            if asset_id and easting and northing:
                asset_coordinates[asset_id] = utm55s_to_wgs84(easting, northing)
    for row in garden_rows:
        report["garden_beds"]["rows"] += 1
        species = clean_text(row.get("Botanical name"))
        coordinates = asset_coordinates.get(clean_text(row.get("Asset ID")))
        if not species or species.upper() == "NA" or not coordinates:
            report["garden_beds"]["rejected_missing_species_or_coordinates"] += 1
            continue
        lon, lat = coordinates
        suburb = find_area(lon, lat, features)
        if not suburb:
            report["garden_beds"]["rejected_outside_supported_areas"] += 1
            continue
        key = _assign(index, lon, lat, suburb, report["garden_beds"])
        if not key:
            continue
        value = aggregates[key]
        value["garden_plant_row_count"] += 1
        value["garden_species"].add(species)
        if name_key(species) in pollinator_plant_keys:
            value["pollinator_flowering_plant_species"].add(species)

    street_objects = []
    csv_rows = []
    for key, base in sorted(
        street_base.items(), key=lambda item: (item[1]["suburb"], item[1]["street_name"], item[0])
    ):
        value = aggregates[key]
        address_count = base["address_count"]
        longitude = base["longitude_sum"] / address_count
        latitude = base["latitude_sum"] / address_count
        tree_species = sorted(value["tree_species"])
        garden_species = sorted(value["garden_species"])
        plant_species = sorted(value["tree_species"] | value["garden_species"])
        flowering_species = sorted(value["pollinator_flowering_plant_species"])
        summary = {
            "street_key": key,
            "street_id": base["street_id"],
            "street_name": base["street_name"],
            "suburb": base["suburb"],
            "centroid_latitude": round(latitude, 7),
            "centroid_longitude": round(longitude, 7),
            "address_count": address_count,
            "planted_tree_count": value["tree_record_count"],
            "planted_tree_species_count": len(tree_species),
            "garden_plant_row_count": value["garden_plant_row_count"],
            "garden_plant_species_count": len(garden_species),
            "plant_species_count": len(plant_species),
            "pollinator_flowering_plant_species_count": len(flowering_species),
            "nearby_canopy_area_m2": round(value["canopy_area_m2"], 2),
            "nearby_canopy_polygon_count": value["canopy_polygon_count"],
        }
        csv_rows.append(summary)
        street_objects.append(
            {
                **summary,
                "planted_tree_species": tree_species,
                "garden_plant_species": garden_species,
                "plant_species": plant_species,
                "pollinator_flowering_plant_species": flowering_species,
            }
        )

    csv_path = paths["processed"] / "street_level.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(csv_rows[0]))
        writer.writeheader()
        writer.writerows(csv_rows)
    payload = {
        "schema_version": "2.0.0",
        "assignment_method": "nearest City of Melbourne address point in the resolved suburb, grouped by source street_id",
        "maximum_assignment_distance_m": MAX_ASSIGNMENT_DISTANCE_M,
        "canopy_metric_note": "Street polygons are unavailable, so nearby canopy area is reported instead of a street canopy percentage.",
        "streets": street_objects,
    }
    (paths["processed"] / "street_level.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    return {
        "street_count": len(street_objects),
        "maximum_assignment_distance_m": MAX_ASSIGNMENT_DISTANCE_M,
        **{source: dict(counts) for source, counts in report.items()},
    }
