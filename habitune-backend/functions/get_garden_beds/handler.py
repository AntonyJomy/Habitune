import logging

from shared.response import client_error, server_error, success
from shared.services.vegetation_service import VegetationResultLimitExceeded, list_garden_beds_geojson
from shared.vegetation_bounds import parse_vegetation_bounds


logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    """Handle GET /vegetation/beds."""
    del context
    try:
        parameters = (event or {}).get("queryStringParameters") or {}
        bounds = parse_vegetation_bounds(parameters)
        return success(list_garden_beds_geojson(bounds))
    except ValueError as exc:
        return client_error(str(exc), code="invalid_bbox")
    except VegetationResultLimitExceeded as exc:
        return client_error(str(exc), status_code=413, code="viewport_too_dense")
    except Exception:
        logger.exception("Unable to get vegetation garden beds")
        return server_error()
