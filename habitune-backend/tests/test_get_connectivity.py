import json
from unittest.mock import patch

from functions.get_connectivity.handler import lambda_handler


def test_connectivity_rejects_unsupported_species_group():
    response = lambda_handler(
        {"queryStringParameters": {"lat": "-37.81", "lng": "144.96", "species_group": "unknown"}},
        None,
    )
    assert response["statusCode"] == 400
    assert json.loads(response["body"])["error"]["code"] == "invalid_connectivity_request"


@patch("functions.get_connectivity.handler.list_connectivity")
def test_connectivity_returns_empty_framework_response(service):
    service.return_value = {
        "data": {"context": None, "supportRecords": [], "connectivity": [], "connectivityStatus": "not_modelled"},
        "meta": {"status": "empty"},
    }
    response = lambda_handler(
        {"queryStringParameters": {"lat": "-37.81", "lng": "144.96", "species_group": "native_bee"}},
        None,
    )
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["data"] == {
        "context": None,
        "supportRecords": [],
        "connectivity": [],
        "connectivityStatus": "not_modelled",
    }
    service.assert_called_once_with(-37.81, 144.96, "native_bee", None)


@patch("functions.get_connectivity.handler.list_connectivity")
def test_connectivity_supports_precinct_only_request(service):
    service.return_value = {
        "data": {"context": None, "supportRecords": [], "connectivity": [], "connectivityStatus": "not_modelled"},
        "meta": {"status": "empty"},
    }
    response = lambda_handler(
        {"queryStringParameters": {"precinct_id": "carlton", "species_group": "native_bee"}},
        None,
    )
    assert response["statusCode"] == 200
    service.assert_called_once_with(None, None, "native_bee", "carlton")
