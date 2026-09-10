import json
from unittest.mock import MagicMock, patch

import pytest

from shared.repositories import precinct_repository


def _mock_connection(*, rows=None, row=None):
    connection = MagicMock()
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = rows or []
    cursor.fetchone.return_value = row
    return connection, cursor


def test_list_precincts_runs_read_only_join_and_closes_connection():
    connection, cursor = _mock_connection(
        rows=[
            {
                "precinct_id": "carlton",
                "name": "Carlton",
                "biodiversity_score_0_100": 63.89,
            }
        ]
    )
    with patch.object(precinct_repository, "get_connection", return_value=connection):
        rows = precinct_repository.list_precincts()

    connection.set_session.assert_called_once_with(readonly=True, autocommit=True)
    executed_sql, parameters = cursor.execute.call_args.args
    assert "JOIN precinct_biodiversity_metric" in executed_sql
    assert parameters == ()
    assert rows[0]["precinct_id"] == "carlton"
    connection.close.assert_called_once_with()


def test_get_precinct_parameterizes_identifier_and_returns_row():
    connection, cursor = _mock_connection(
        row={"precinct_id": "carlton", "name": "Carlton"}
    )
    with patch.object(precinct_repository, "get_connection", return_value=connection):
        row = precinct_repository.get_precinct("carlton")

    executed_sql, parameters = cursor.execute.call_args.args
    assert "WHERE p.precinct_id = %s" in executed_sql
    assert parameters == ("carlton",)
    assert row == {"precinct_id": "carlton", "name": "Carlton"}
    connection.close.assert_called_once_with()


def test_get_precinct_returns_none_when_not_found():
    connection, _cursor = _mock_connection(row=None)
    with patch.object(precinct_repository, "get_connection", return_value=connection):
        assert precinct_repository.get_precinct("missing") is None


def test_geojson_uses_postgis_serialization_and_decodes_geometry():
    geometry = {"type": "MultiPolygon", "coordinates": [[[]]]}
    connection, cursor = _mock_connection(
        rows=[
            {
                "precinct_id": "carlton",
                "name": "Carlton",
                "geometry": json.dumps(geometry),
            }
        ]
    )
    with patch.object(precinct_repository, "get_connection", return_value=connection):
        rows = precinct_repository.list_precinct_geometries()

    executed_sql = cursor.execute.call_args.args[0]
    assert "ST_AsGeoJSON(p.geometry)" in executed_sql
    assert rows[0]["geometry"] == geometry


def test_connection_closes_when_query_fails():
    connection, cursor = _mock_connection()
    cursor.execute.side_effect = RuntimeError("query failed")
    with (
        patch.object(precinct_repository, "get_connection", return_value=connection),
        pytest.raises(RuntimeError, match="query failed"),
    ):
        precinct_repository.list_precincts()

    connection.close.assert_called_once_with()
