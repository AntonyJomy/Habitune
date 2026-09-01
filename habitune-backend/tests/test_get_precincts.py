import json
from unittest.mock import patch

from functions.get_precincts.handler import lambda_handler


@patch(
    "functions.get_precincts.handler.list_precincts",
    return_value={
        "data": [{"precinct_id": "carlton", "name": "Carlton"}],
        "meta": {"source": "database", "count": 1},
    },
)
def test_get_precincts_returns_database_data_with_cors(service, monkeypatch):
    monkeypatch.delenv("CORS_ALLOW_ORIGIN", raising=False)
    response = lambda_handler({}, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 200
    assert response["headers"]["Content-Type"] == "application/json"
    assert response["headers"]["Access-Control-Allow-Origin"] == "*"
    service.assert_called_once_with()
    assert body["data"][0]["precinct_id"] == "carlton"
    assert body["meta"] == {"source": "database", "count": 1}


# Mock the service boundary so failure tests never reach AWS or RDS.
@patch("functions.get_precincts.handler.list_precincts", side_effect=RuntimeError("database detail"))
def test_get_precincts_hides_internal_errors(_service):
    response = lambda_handler({}, None)
    body = json.loads(response["body"])

    assert response["statusCode"] == 500
    assert body == {
        "error": {"code": "internal_error", "message": "Internal server error"}
    }
    assert "database detail" not in response["body"]
