from shared.response import build_response


def lambda_handler(event, context):
    """Return a placeholder response until the canopy schema is available."""
    return build_response(
        200,
        {
            "message": "Canopy endpoint not yet implemented",
            "canopy": [],
        },
    )
