import json
from unittest.mock import patch

from functions.get_location_context.handler import lambda_handler


def test_location_context_requires_valid_coordinates():
    response = lambda_handler({"queryStringParameters": {"lat": "bad", "lng": "144.9"}}, None)
    assert response["statusCode"] == 400
    assert json.loads(response["body"])["error"]["code"] == "invalid_location"


@patch(
    "functions.get_location_context.handler.get_location_context",
    return_value={"data": None, "meta": {"status": "not_available"}},
)
def test_location_context_returns_empty_framework_response(service):
    response = lambda_handler({"queryStringParameters": {"lat": "-37.81", "lng": "144.96"}}, None)
    service.assert_called_once_with(-37.81, 144.96)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["data"] is None
