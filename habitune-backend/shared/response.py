import json
import os


def build_response(status_code, body_dict):
    """Build an API Gateway Lambda proxy response."""
    return {
        "statusCode": status_code,
        "headers": {
            # Allow deployments to restrict the frontend origin without code changes.
            "Access-Control-Allow-Origin": os.environ.get("CORS_ALLOW_ORIGIN", "*"),
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Content-Type": "application/json",
        },
        "body": json.dumps(body_dict),
    }


def success(body, status_code=200):
    """Return a successful JSON API response."""
    return build_response(status_code, body)


def client_error(message, status_code=400, code="bad_request"):
    """Return a safe client-facing JSON error."""
    return build_response(status_code, {"error": {"code": code, "message": message}})


def server_error(message="Internal server error"):
    """Return a safe error without exposing exception or infrastructure details."""
    # Handlers log the exception; clients receive only this sanitised envelope.
    return build_response(500, {"error": {"code": "internal_error", "message": message}})
