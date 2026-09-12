"""Service-level response shaping for the Iteration 2 framework."""

from shared.repositories import (
    connectivity_repository,
    location_context_repository,
    street_ecosystem_repository,
)
from shared.contracts.iteration2 import api_envelope, connectivity_data


SUPPORTED_SPECIES_GROUPS = {"native_bee", "butterfly", "small_bird"}


def get_location_context(latitude, longitude):
    context = location_context_repository.get_location_context(latitude, longitude)
    if context is None:
        return api_envelope(None)
    context = dict(context)
    metadata = {
        "resolutionSourceFile": context.pop("resolutionSourceFile", None),
        "streetSourceFile": context.pop("streetSourceFile", None),
        "assignmentMethod": context.pop("assignmentMethod", None),
    }
    return api_envelope(
        context,
        source="existing_habitune_dataset",
        status="available",
        method_version=context.pop("sourceSchemaVersion", None),
        geometry_status="point",
        **metadata,
    )


def get_street_ecosystem(street_id):
    normalized_id = str(street_id or "").strip()
    if not normalized_id:
        raise ValueError("street_id is required")
    context = street_ecosystem_repository.get_street_ecosystem(normalized_id)
    if context is None:
        return None
    row = dict(context)
    evidence_fields = (
        "addressCount", "plantedTreeCount", "plantedTreeSpeciesCount",
        "gardenPlantRowCount", "gardenPlantSpeciesCount", "plantSpeciesCount",
        "pollinatorFloweringPlantSpeciesCount", "nearbyCanopyAreaM2",
        "nearbyCanopyPolygonCount",
    )
    evidence = {field: row.pop(field, None) for field in evidence_fields}
    latitude = row.pop("centroidLatitude", None)
    longitude = row.pop("centroidLongitude", None)
    metadata = {
        "sourceFile": row.pop("sourceFile", None),
        "assignmentMethod": row.pop("assignmentMethod", None),
        "maximumAssignmentDistanceM": row.pop("maximumAssignmentDistanceM", None),
        "canopyMetricNote": row.pop("canopyMetricNote", None),
    }
    method_version = row.pop("sourceSchemaVersion", None)
    data = {
        **row,
        "centroid": {"latitude": latitude, "longitude": longitude} if latitude is not None and longitude is not None else None,
        "evidence": evidence,
        "habitatFeatures": [],
        "nearbyObservations": [],
        "potentialConnectivity": None,
        "status": "available",
    }
    return api_envelope(data, source="existing_habitune_dataset", status="available", geometry_status="point", method_version=method_version, **metadata)


def list_connectivity(latitude, longitude, species_group, precinct_id=None):
    if species_group not in SUPPORTED_SPECIES_GROUPS:
        raise ValueError("species_group must be native_bee, butterfly or small_bird")
    context = None
    if latitude is not None and longitude is not None:
        context = location_context_repository.get_location_context(latitude, longitude)
    resolved_precinct_id = context.get("precinctId") if context else str(precinct_id or "").strip()
    records = connectivity_repository.list_street_support(resolved_precinct_id) if resolved_precinct_id else []
    support_records = []
    for record in records:
        item = dict(record)
        latitude_value = item.pop("centroidLatitude", None)
        longitude_value = item.pop("centroidLongitude", None)
        item["centroid"] = (
            {"latitude": latitude_value, "longitude": longitude_value}
            if latitude_value is not None and longitude_value is not None else None
        )
        support_records.append(item)
    data = connectivity_data(
        context=dict(context) if context is not None else None,
        support_records=support_records,
        connectivity=[],
    )
    return api_envelope(
        data,
        source="existing_habitune_dataset",
        status="available" if support_records else "empty",
        geometry_status="centroid_points" if support_records else "not_available",
        connectivityStatus="not_modelled",
    )
