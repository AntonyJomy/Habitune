from unittest.mock import MagicMock, patch

from shared.repositories import vegetation_repository
from shared.vegetation_bounds import VEGETATION_RESULT_LIMIT, VegetationBounds


BOUNDS = VegetationBounds(west=144.9, south=-37.9, east=145.0, north=-37.7)


@patch.object(vegetation_repository, "dict_cursor_factory", return_value=object())
@patch.object(vegetation_repository, "get_connection")
def test_tree_repository_uses_parameterized_bbox_and_read_only_session(connect, _cursor_factory):
    connection = MagicMock(); cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = [{"tree_id": "tree-1", "longitude": 144.9, "latitude": -37.8}]
    connect.return_value = connection
    rows = vegetation_repository.list_trees(BOUNDS)
    connection.set_session.assert_called_once_with(readonly=True, autocommit=True)
    cursor.execute.assert_called_once_with(vegetation_repository.LIST_TREES_SQL, (144.9, -37.9, 145.0, -37.7, VEGETATION_RESULT_LIMIT + 1))
    assert "ST_MakeEnvelope(%s, %s, %s, %s, 4326)" in vegetation_repository.LIST_TREES_SQL
    assert rows[0]["tree_id"] == "tree-1"; connection.close.assert_called_once_with()


@patch.object(vegetation_repository, "dict_cursor_factory", return_value=object())
@patch.object(vegetation_repository, "get_connection")
def test_garden_repository_uses_parameterized_bbox(connect, _cursor_factory):
    connection = MagicMock(); cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = [{"bed_id": "bed-1", "geometry": '{"type":"Point","coordinates":[144.9,-37.8]}'}]
    connect.return_value = connection
    rows = vegetation_repository.list_garden_beds(BOUNDS)
    cursor.execute.assert_called_once_with(vegetation_repository.LIST_GARDEN_BEDS_SQL, (144.9, -37.9, 145.0, -37.7, VEGETATION_RESULT_LIMIT + 1))
    assert rows[0]["bed_id"] == "bed-1"; connection.close.assert_called_once_with()
