from unittest.mock import MagicMock, patch

from shared.repositories import connectivity_repository, location_context_repository, street_ecosystem_repository
from shared.services import iteration2_service


def test_valid_coordinate_resolution_returns_stable_street_key():
    connection = MagicMock()
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = {
        "precinctId": "carlton",
        "precinctName": "Carlton",
        "streetId": "Carlton|379",
        "streetKey": "Carlton|379",
        "streetName": "Alma Place",
        "latitude": -37.8057,
        "longitude": 144.9611,
        "resolutionMethod": "nearest_supported_address",
    }
    with patch.object(location_context_repository, "get_connection", return_value=connection), patch.object(location_context_repository, "dict_cursor_factory"):
        result = location_context_repository.get_location_context(-37.8057, 144.9611)
    assert result["streetId"] == "Carlton|379"
    cursor.execute.assert_called_once()
    connection.set_session.assert_called_once_with(readonly=True, autocommit=True)
    connection.close.assert_called_once_with()


def test_unsupported_coordinate_returns_no_fabricated_location():
    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value.fetchone.return_value = None
    with patch.object(location_context_repository, "get_connection", return_value=connection), patch.object(location_context_repository, "dict_cursor_factory"):
        assert location_context_repository.get_location_context(-38.5, 145.5) is None


def test_valid_street_evidence_preserves_null_fields():
    row = {
        "streetId": "Carlton|379",
        "streetKey": "Carlton|379",
        "streetName": "Alma Place",
        "precinctId": "carlton",
        "centroidLatitude": -37.8057,
        "centroidLongitude": 144.9611,
        "plantedTreeCount": 0,
        "nearbyCanopyAreaM2": None,
        "sourceFile": "street_level.json",
        "sourceSchemaVersion": "2.0.0",
    }
    with patch.object(street_ecosystem_repository, "get_street_ecosystem", return_value=row):
        result = iteration2_service.get_street_ecosystem("Carlton|379")
    assert result["data"]["evidence"]["plantedTreeCount"] == 0
    assert result["data"]["evidence"]["nearbyCanopyAreaM2"] is None
    assert result["data"]["potentialConnectivity"] is None


def test_unknown_street_repository_result_stays_not_found():
    with patch.object(street_ecosystem_repository, "get_street_ecosystem", return_value=None):
        assert iteration2_service.get_street_ecosystem("Carlton|unknown") is None


def test_connectivity_view_queries_only_the_selected_precinct():
    connection = MagicMock()
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = [{
        "streetId": "Carlton|379", "streetKey": "Carlton|379", "streetName": "Alma Place",
        "precinctId": "carlton", "centroidLatitude": -37.8057, "centroidLongitude": 144.9611,
        "plantSpeciesCount": 0,
    }]
    with patch.object(connectivity_repository, "get_connection", return_value=connection), patch.object(connectivity_repository, "dict_cursor_factory"):
        rows = connectivity_repository.list_street_support("carlton")
    cursor.execute.assert_called_once_with(connectivity_repository.LIST_STREET_SUPPORT_SQL, ("carlton",))
    assert rows[0]["streetKey"] == "Carlton|379"


def test_connectivity_response_contains_neutral_street_evidence_only():
    row = {
        "streetId": "Carlton|379", "streetKey": "Carlton|379", "streetName": "Alma Place",
        "precinctId": "carlton", "centroidLatitude": -37.8057, "centroidLongitude": 144.9611,
        "plantSpeciesCount": 0,
    }
    with patch.object(connectivity_repository, "list_street_support", return_value=[row]):
        result = iteration2_service.list_connectivity(None, None, "native_bee", "carlton")
    assert result["data"]["supportRecords"][0]["centroid"]["latitude"] == -37.8057
    assert result["data"]["supportRecords"][0]["plantSpeciesCount"] == 0
    assert result["data"]["connectivity"] == []
    assert result["data"]["connectivityStatus"] == "not_modelled"
