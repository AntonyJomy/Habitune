from shared.response import build_response


def lambda_handler(event, context):
    """Return a deployment health check response."""
    return build_response(200, {"status": "ok"})
