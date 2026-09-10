from shared.response import build_response


def lambda_handler(event, context):
    """Return a placeholder response until the species schema is available."""
    return build_response(
        200,
        {
            "message": "Species endpoint not yet implemented",
            "species": [],
        },
    )
