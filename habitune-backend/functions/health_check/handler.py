from shared.response import build_response


def lambda_handler(event, context):
    """Return a deployment health check response."""
    # This deliberately avoids the database so it can isolate API/Lambda availability.
    del event, context
    return build_response(200, {"status": "ok"})
