import json
from unittest.mock import patch

from functions.get_garden_beds.handler import lambda_handler


BBOX = {"west": "144.9", "east": "145.0", "south": "-37.9", "north": "-37.7"}


@patch("functions.get_garden_beds.handler.list_garden_beds_geojson")
def test_get_garden_beds_returns_bbox_database_feature_collection(service):
    service.return_value = {"type": "FeatureCollection", "features": [], "meta": {"source": "database", "count": 0}}
    response = lambda_handler({"queryStringParameters": BBOX}, None)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["features"] == []
    assert service.call_args.args[0].parameters == (144.9, -37.9, 145.0, -37.7)


def test_get_garden_beds_rejects_invalid_bbox():
    response = lambda_handler({"queryStringParameters": {**BBOX, "north": "not-a-number"}}, None)
    assert response["statusCode"] == 400
    assert json.loads(response["body"])["error"]["code"] == "invalid_bbox"


@patch("functions.get_garden_beds.handler.list_garden_beds_geojson", side_effect=RuntimeError("database detail"))
def test_get_garden_beds_hides_internal_errors(_service):
    response = lambda_handler({"queryStringParameters": BBOX}, None)
    assert response["statusCode"] == 500
    assert "database detail" not in response["body"]
