import logging

from shared.response import build_response


logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    """Placeholder handler for a future ingestion workflow."""
    logger.info("ingestion not yet implemented")
    return build_response(200, {"status": "success"})
