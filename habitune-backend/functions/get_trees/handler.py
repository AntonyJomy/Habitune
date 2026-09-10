from shared.response import build_response


def lambda_handler(event, context):
    """Return a placeholder response until the trees schema is available."""
    return build_response(
        200,
        {
            "message": "Trees endpoint not yet implemented",
            "trees": [],
        },
    )
