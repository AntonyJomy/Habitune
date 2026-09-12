import logging

from shared.response import client_error, server_error, success
from shared.services.iteration2_service import get_street_ecosystem


logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    """Handle GET /streets/{street_id}/ecosystem."""
    del context
    street_id = ((event or {}).get("pathParameters") or {}).get("street_id")
    if not street_id or not str(street_id).strip():
        return client_error("street_id is required", code="missing_street_id")
    try:
        result = get_street_ecosystem(street_id)
        if result is None:
            return client_error(
                "Street ecosystem data is not configured or the street was not found",
                status_code=404,
                code="street_not_found",
            )
        return success(result)
    except ValueError as exc:
        return client_error(str(exc))
    except Exception:
        logger.exception("Unable to get street ecosystem")
        return server_error()
