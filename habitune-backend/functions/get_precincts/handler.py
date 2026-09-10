import logging

from shared.response import server_error, success
from shared.services.precinct_service import list_precincts


logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    """Handle GET /precincts without embedding persistence logic."""
    del event, context
    try:
        # Keep data access and response shaping behind the service boundary.
        return success(list_precincts())
    except Exception:
        logger.exception("Unable to list precincts")
        # Preserve diagnostic logs without exposing internal details to clients.
        return server_error()
