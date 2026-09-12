import logging

from shared.response import client_error, server_error, success
from shared.services.iteration2_service import list_connectivity


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
    """Handle GET /connectivity?precinct_id=&lat=&lng=&species_group=."""
    del context
    parameters = (event or {}).get("queryStringParameters") or {}
    try:
        has_latitude = parameters.get("lat") not in (None, "")
        has_longitude = parameters.get("lng") not in (None, "")
        if has_latitude != has_longitude:
            raise ValueError("lat and lng must be provided together")
        latitude = _coordinate(parameters, "lat", -90, 90) if has_latitude else None
        longitude = _coordinate(parameters, "lng", -180, 180) if has_longitude else None
        precinct_id = str(parameters.get("precinct_id") or "").strip() or None
        if latitude is None and precinct_id is None:
            raise ValueError("precinct_id or lat/lng is required")
        species_group = str(parameters.get("species_group") or "").strip()
        return success(list_connectivity(latitude, longitude, species_group, precinct_id))
    except ValueError as exc:
        return client_error(str(exc), code="invalid_connectivity_request")
    except Exception:
        logger.exception("Unable to get potential connectivity")
        return server_error()
