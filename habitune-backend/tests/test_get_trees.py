import json
from unittest.mock import patch

from functions.get_trees.handler import lambda_handler
from shared.services.vegetation_service import VegetationResultLimitExceeded


BBOX = {"west": "144.9", "east": "145.0", "south": "-37.9", "north": "-37.7"}


@patch("functions.get_trees.handler.list_trees_geojson")
def test_get_trees_returns_bbox_database_feature_collection(service):
    service.return_value = {"type": "FeatureCollection", "features": [], "meta": {"source": "database", "count": 0}}
    response = lambda_handler({"queryStringParameters": BBOX}, None)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["meta"]["count"] == 0
    assert service.call_args.args[0].parameters == (144.9, -37.9, 145.0, -37.7)


def test_get_trees_rejects_missing_non_numeric_and_inverted_bounds():
    assert lambda_handler({}, None)["statusCode"] == 400
    assert lambda_handler({"queryStringParameters": {**BBOX, "west": "bad"}}, None)["statusCode"] == 400
    assert lambda_handler({"queryStringParameters": {**BBOX, "west": "145"}}, None)["statusCode"] == 400
    assert lambda_handler({"queryStringParameters": {**BBOX, "south": "-37.6"}}, None)["statusCode"] == 400


@patch("functions.get_trees.handler.list_trees_geojson", side_effect=VegetationResultLimitExceeded("zoom further in"))
def test_get_trees_returns_controlled_dense_viewport_error(_service):
    response = lambda_handler({"queryStringParameters": BBOX}, None)
    assert response["statusCode"] == 413
    assert json.loads(response["body"])["error"]["code"] == "viewport_too_dense"


@patch("functions.get_trees.handler.list_trees_geojson", side_effect=RuntimeError("database detail"))
def test_get_trees_hides_internal_errors(_service):
    response = lambda_handler({"queryStringParameters": BBOX}, None)
    assert response["statusCode"] == 500
    assert "database detail" not in response["body"]
