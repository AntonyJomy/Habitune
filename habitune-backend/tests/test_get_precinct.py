import json
from unittest.mock import patch

from functions.get_precinct.handler import lambda_handler


def test_get_precinct_requires_path_parameter():
    response = lambda_handler({"pathParameters": None}, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 400
    assert body["error"]["code"] == "missing_precinct_id"


# Mock the service boundary; handler tests must remain independent of RDS.
@patch("functions.get_precinct.handler.get_precinct", return_value=None)
def test_get_precinct_returns_controlled_not_found(service):
    response = lambda_handler({"pathParameters": {"precinct_id": "P-001"}}, None)
    body = json.loads(response["body"])

    service.assert_called_once_with("P-001")
    assert response["statusCode"] == 404
    assert body["error"]["code"] == "precinct_not_found"


@patch(
    "functions.get_precinct.handler.get_precinct",
    return_value={"precinct_id": "P-001", "name": "Example precinct"},
)
def test_get_precinct_returns_service_data(service):
    response = lambda_handler({"pathParameters": {"precinct_id": "P-001"}}, None)

    service.assert_called_once_with("P-001")
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["data"]["precinct_id"] == "P-001"


@patch("functions.get_precinct.handler.get_precinct", side_effect=RuntimeError("secret detail"))
def test_get_precinct_hides_internal_errors(_service):
    response = lambda_handler({"pathParameters": {"precinct_id": "P-001"}}, None)

    assert response["statusCode"] == 500
    assert "secret detail" not in response["body"]
