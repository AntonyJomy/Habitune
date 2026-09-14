import json
from unittest.mock import patch

from functions.get_street_ecosystem.handler import lambda_handler


def test_street_ecosystem_requires_identifier():
    response = lambda_handler({"pathParameters": None}, None)
    assert response["statusCode"] == 400
    assert json.loads(response["body"])["error"]["code"] == "missing_street_id"


@patch(
    "functions.get_street_ecosystem.handler.get_street_ecosystem",
    return_value={"data": {"streetId": "street-1", "status": "not_available"}},
)
def test_street_ecosystem_returns_not_available_contract(service):
    response = lambda_handler({"pathParameters": {"street_id": "street-1"}}, None)
    service.assert_called_once_with("street-1")
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["data"]["status"] == "not_available"


@patch("functions.get_street_ecosystem.handler.get_street_ecosystem", return_value=None)
def test_street_ecosystem_returns_not_found_for_unknown_identifier(service):
    response = lambda_handler({"pathParameters": {"street_id": "unknown-street"}}, None)
    service.assert_called_once_with("unknown-street")
    assert response["statusCode"] == 404
    assert json.loads(response["body"])["error"]["code"] == "street_not_found"
