import json

from functions.health_check.handler import lambda_handler


def test_health_check_returns_ok():
    response = lambda_handler({}, None)

    assert response["statusCode"] == 200
    assert json.loads(response["body"]) == {"status": "ok"}
