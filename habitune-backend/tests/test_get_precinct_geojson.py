import json
from unittest.mock import patch

from functions.get_precinct_geojson.handler import lambda_handler


@patch(
    "functions.get_precinct_geojson.handler.get_precinct_geojson",
    return_value={
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "carlton",
                "geometry": {"type": "MultiPolygon", "coordinates": []},
                "properties": {"precinct_id": "carlton", "name": "Carlton"},
            }
        ],
        "meta": {"source": "database", "count": 1},
    },
)
def test_get_precinct_geojson_returns_database_feature_collection(service):
    response = lambda_handler({}, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 200
    assert body["type"] == "FeatureCollection"
    service.assert_called_once_with()
    assert len(body["features"]) == 1
    assert body["features"][0]["id"] == "carlton"
    assert body["meta"] == {"source": "database", "count": 1}


# Simulate a service failure without opening a database connection.
@patch(
    "functions.get_precinct_geojson.handler.get_precinct_geojson",
    side_effect=RuntimeError("connection detail"),
)
def test_get_precinct_geojson_hides_internal_errors(_service):
    response = lambda_handler({}, None)

    assert response["statusCode"] == 500
    assert "connection detail" not in response["body"]
