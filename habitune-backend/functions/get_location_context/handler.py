import logging

from shared.response import client_error, server_error, success
from shared.services.iteration2_service import get_location_context


logger = logging.getLogger(__name__)


def _coordinate(parameters, name, minimum, maximum):
    try:
        value = float(parameters.get(name, ""))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a number") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} is outside the valid coordinate range")
    return value


def lambda_handler(event, context):
    """Handle GET /location-context?lat=&lng=."""
    del context
    parameters = (event or {}).get("queryStringParameters") or {}
    try:
        latitude = _coordinate(parameters, "lat", -90, 90)
        longitude = _coordinate(parameters, "lng", -180, 180)
        return success(get_location_context(latitude, longitude))
    except ValueError as exc:
        return client_error(str(exc), code="invalid_location")
    except Exception:
        logger.exception("Unable to get location context")
        return server_error()
