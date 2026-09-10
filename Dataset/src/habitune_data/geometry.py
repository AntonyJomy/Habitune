"""Small dependency-free geometry helpers for the supplied WGS84 data.

The project deliberately uses only Python's standard library so a backend or
CI runner can rebuild the data without a heavy GIS environment. Suburb lookup
uses the original polygon vertices. Only ALA request polygons are simplified,
at roughly five-metre tolerance, to stay within practical URL limits.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable, Sequence


EARTH_RADIUS_M = 6_371_008.8

# Keep compatibility with source labels that may appear in supporting tables.
AREA_NAME_MAP = {
    "Melbourne": "Central City",
    "Melbourne (CBD)": "Central City",
    "Melbourne (Remainder)": "Central City",
    "CBD Hoddle Grid": "Central City",
    "North Melbourne": "North and West Melbourne",
    "West Melbourne": "North and West Melbourne",
    "West Melbourne (Industrial)": "North and West Melbourne",
    "West Melbourne (Residential)": "North and West Melbourne",
}


def normalize_area_name(value: str | None) -> str:
    """Map source-specific area labels onto the Map View 1 names."""

    cleaned = " ".join((value or "").strip().split())
    return AREA_NAME_MAP.get(cleaned, cleaned)


def _as_multipolygon(geometry: dict) -> list:
    """Return polygon coordinates in a common multipolygon shape."""

    if geometry.get("type") == "MultiPolygon":
        return geometry["coordinates"]
    if geometry.get("type") == "Polygon":
        return [geometry["coordinates"]]
    raise ValueError(f"Unsupported boundary geometry: {geometry.get('type')}")


def load_areas(path: Path) -> list[dict]:
    """Load the reviewed ten-precinct GeoJSON boundary snapshot."""

    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("type") != "FeatureCollection":
        raise ValueError("Boundary input must be a GeoJSON FeatureCollection")
    features = data.get("features", [])
    names = [feature.get("properties", {}).get("suburb") for feature in features]
    if len(features) != 10 or any(not name for name in names):
        raise ValueError("Boundary input must contain 10 named precinct features")
    if len(set(names)) != len(names):
        raise ValueError("Boundary input contains duplicate precinct names")
    for feature in features:
        _as_multipolygon(feature.get("geometry", {}))
    return sorted(features, key=lambda feature: feature["properties"]["suburb"])


def _point_on_segment(
    x: float,
    y: float,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    epsilon: float = 1e-11,
) -> bool:
    """Check whether a point lies on a line segment."""

    cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    if abs(cross) > epsilon:
        return False
    return (
        min(x1, x2) - epsilon <= x <= max(x1, x2) + epsilon
        and min(y1, y2) - epsilon <= y <= max(y1, y2) + epsilon
    )


def point_in_ring(lon: float, lat: float, ring: Sequence[Sequence[float]]) -> bool:
    """Return True for points inside a ring, including its boundary."""

    # Use ray casting and treat points on the boundary as inside.
    inside = False
    for index in range(len(ring) - 1):
        x1, y1 = ring[index][:2]
        x2, y2 = ring[index + 1][:2]
        if _point_on_segment(lon, lat, x1, y1, x2, y2):
            return True
        intersects = (y1 > lat) != (y2 > lat)
        if intersects:
            crossing_lon = (x2 - x1) * (lat - y1) / (y2 - y1) + x1
            if lon < crossing_lon:
                inside = not inside
    return inside


def point_in_geometry(lon: float, lat: float, geometry: dict) -> bool:
    """Check whether a WGS84 point is inside a polygon or multipolygon."""

    for polygon in _as_multipolygon(geometry):
        if not polygon or not point_in_ring(lon, lat, polygon[0]):
            continue
        if any(point_in_ring(lon, lat, hole) for hole in polygon[1:]):
            continue
        return True
    return False


def find_area(lon: float, lat: float, features: Iterable[dict]) -> str | None:
    """Return the supported suburb containing a point."""

    for feature in features:
        if point_in_geometry(lon, lat, feature["geometry"]):
            return feature["properties"]["suburb"]
    return None


def _ring_area_m2(ring: Sequence[Sequence[float]], latitude_origin: float) -> float:
    """Approximate a small WGS84 ring in a local equirectangular plane."""

    cos_lat = math.cos(math.radians(latitude_origin))
    points = [
        (
            EARTH_RADIUS_M * math.radians(point[0]) * cos_lat,
            EARTH_RADIUS_M * math.radians(point[1]),
        )
        for point in ring
    ]
    doubled = 0.0
    for first, second in zip(points, points[1:]):
        doubled += first[0] * second[1] - second[0] * first[1]
    return abs(doubled) / 2.0


def geometry_area_m2(geometry: dict) -> float:
    """Calculate polygon area in square metres for Melbourne-scale data."""

    # A local projection is accurate enough for the supplied Melbourne polygons.
    polygons = _as_multipolygon(geometry)
    latitudes = [point[1] for polygon in polygons for ring in polygon for point in ring]
    latitude_origin = sum(latitudes) / len(latitudes)
    area = 0.0
    for polygon in polygons:
        if not polygon:
            continue
        area += _ring_area_m2(polygon[0], latitude_origin)
        area -= sum(_ring_area_m2(hole, latitude_origin) for hole in polygon[1:])
    return max(area, 0.0)


def _perpendicular_distance(point, start, end) -> float:
    """Measure point-to-line distance for geometry simplification."""

    if start == end:
        return math.dist(point[:2], start[:2])
    x, y = point[:2]
    x1, y1 = start[:2]
    x2, y2 = end[:2]
    numerator = abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1)
    return numerator / math.hypot(y2 - y1, x2 - x1)


def _rdp(points: Sequence[Sequence[float]], tolerance: float) -> list:
    """Simplify a line with the Ramer-Douglas-Peucker algorithm."""

    if len(points) <= 2:
        return list(points)
    max_distance = 0.0
    split_index = 0
    for index in range(1, len(points) - 1):
        distance = _perpendicular_distance(points[index], points[0], points[-1])
        if distance > max_distance:
            split_index = index
            max_distance = distance
    if max_distance <= tolerance:
        return [points[0], points[-1]]
    left = _rdp(points[: split_index + 1], tolerance)
    right = _rdp(points[split_index:], tolerance)
    return left[:-1] + right


def simplify_ring(ring: Sequence[Sequence[float]], tolerance: float = 0.00005) -> list:
    """Simplify a closed ring while preserving valid closure."""

    open_ring = list(ring[:-1] if ring and ring[0][:2] == ring[-1][:2] else ring)
    if len(open_ring) < 3:
        return list(ring)
    simplified = _rdp(open_ring + [open_ring[0]], tolerance)
    unique = []
    for point in simplified:
        if not unique or point[:2] != unique[-1][:2]:
            unique.append(point)
    if len(unique) < 4:
        unique = open_ring[:3] + [open_ring[0]]
    elif unique[0][:2] != unique[-1][:2]:
        unique.append(unique[0])
    return unique


def geometry_to_wkt(geometry: dict, tolerance: float = 0.00005) -> str:
    """Serialize a simplified Polygon/MultiPolygon for ALA spatial search."""

    # Simplification keeps ALA request URLs practical while preserving shape.
    polygon_text = []
    for polygon in _as_multipolygon(geometry):
        rings = []
        for ring in polygon:
            simple = simplify_ring(ring, tolerance)
            coordinates = ",".join(f"{p[0]:.6f} {p[1]:.6f}" for p in simple)
            rings.append(f"({coordinates})")
        polygon_text.append(f"({','.join(rings)})")
    return f"MULTIPOLYGON ({','.join(polygon_text)})"


def feature_collection(features: list[dict]) -> dict:
    """Wrap GeoJSON features in a FeatureCollection."""

    return {"type": "FeatureCollection", "features": features}
