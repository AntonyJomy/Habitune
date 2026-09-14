"""GeoJSON response shaping for vegetation endpoints."""

import json

from shared.repositories import vegetation_repository
from shared.vegetation_bounds import VEGETATION_RESULT_LIMIT


class VegetationResultLimitExceeded(Exception):
    """Raised when a viewport contains too many features for a map response."""


def _geometry(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


def _feature_collection(rows, *, identifier, point_coordinates=None):
    if len(rows) > VEGETATION_RESULT_LIMIT:
        raise VegetationResultLimitExceeded(
            f"Viewport contains more than {VEGETATION_RESULT_LIMIT} records; zoom further in"
        )
    features = []
    for source_row in rows:
        row = dict(source_row)
        feature_id = row.get(identifier)
        if point_coordinates:
            longitude = row.pop(point_coordinates[0], None)
            latitude = row.pop(point_coordinates[1], None)
            geometry = (
                {"type": "Point", "coordinates": [longitude, latitude]}
                if longitude is not None and latitude is not None
                else None
            )
        else:
            geometry = _geometry(row.pop("geometry", None))
        features.append(
            {
                "type": "Feature",
                "id": feature_id,
                "geometry": geometry,
                "properties": row,
            }
        )
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {"source": "database", "count": len(features)},
    }


def list_trees_geojson(bounds):
    """Shape future database Tree rows as GeoJSON Point features."""
    return _feature_collection(
        vegetation_repository.list_trees(bounds),
        identifier="tree_id",
        point_coordinates=("longitude", "latitude"),
    )


def list_garden_beds_geojson(bounds):
    """Shape future database Garden Bed rows using their stored geometry."""
    return _feature_collection(
        vegetation_repository.list_garden_beds(bounds),
        identifier="bed_id",
    )
