from unittest.mock import patch

import pytest

from shared.services.vegetation_service import VegetationResultLimitExceeded, list_garden_beds_geojson, list_trees_geojson
from shared.vegetation_bounds import VEGETATION_RESULT_LIMIT, VegetationBounds


BOUNDS = VegetationBounds(west=144.9, south=-37.9, east=145.0, north=-37.7)


@patch("shared.services.vegetation_service.vegetation_repository.list_trees")
def test_tree_rows_become_geojson_points(repository):
    repository.return_value = [{"tree_id": "tree-1", "common_name": "Wattle", "longitude": 144.9, "latitude": -37.8}]
    result = list_trees_geojson(BOUNDS)
    assert result["features"][0]["geometry"] == {"type": "Point", "coordinates": [144.9, -37.8]}
    assert result["meta"]["count"] == 1; repository.assert_called_once_with(BOUNDS)


@patch("shared.services.vegetation_service.vegetation_repository.list_garden_beds")
def test_garden_rows_keep_database_point_geometry(repository):
    repository.return_value = [{"bed_id": "bed-1", "area_m2": 10, "geometry": '{"type":"Point","coordinates":[144.9,-37.8]}'}]
    result = list_garden_beds_geojson(BOUNDS)
    assert result["features"][0]["geometry"]["type"] == "Point"
    assert result["features"][0]["properties"]["area_m2"] == 10


@patch("shared.services.vegetation_service.vegetation_repository.list_trees")
def test_over_limit_viewport_is_rejected(repository):
    repository.return_value = [{"tree_id": str(index)} for index in range(VEGETATION_RESULT_LIMIT + 1)]
    with pytest.raises(VegetationResultLimitExceeded):
        list_trees_geojson(BOUNDS)
