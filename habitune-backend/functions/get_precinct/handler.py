import logging

from shared.response import client_error, server_error, success
from shared.services.precinct_service import get_precinct


logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    """Handle GET /precincts/{precinct_id}."""
    del context
    path_parameters = (event or {}).get("pathParameters") or {}
    precinct_id = path_parameters.get("precinct_id")
    if not precinct_id or not str(precinct_id).strip():
        return client_error("precinct_id is required", code="missing_precinct_id")

    try:
        # Keep domain validation and data access out of the API Gateway handler.
        precinct = get_precinct(precinct_id)
        if precinct is None:
            return client_error(
                "Precinct data is not configured or the precinct was not found",
                status_code=404,
                code="precinct_not_found",
            )
        return success({"data": precinct})
    except ValueError as exc:
        return client_error(str(exc))
    except Exception:
        logger.exception("Unable to get precinct")
        # Return a stable API error instead of leaking infrastructure details.
        return server_error()
