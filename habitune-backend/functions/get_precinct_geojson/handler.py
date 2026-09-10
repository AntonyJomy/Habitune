import logging

from shared.response import server_error, success
from shared.services.precinct_service import get_precinct_geojson


logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    """Handle GET /precincts/geojson."""
    del event, context
    try:
        # GeoJSON shaping belongs in the service, not the Lambda boundary.
        return success(get_precinct_geojson())
    except Exception:
        logger.exception("Unable to get precinct GeoJSON")
        # Keep unexpected server details out of the public response.
        return server_error()
