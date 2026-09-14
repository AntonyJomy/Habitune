"""Iteration 2 API contracts with deliberately optional geometry."""

from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict


SpeciesGroup = Literal["native_bee", "butterfly", "small_bird"]


class Geometry(TypedDict):
    type: Literal["Point", "LineString", "Polygon", "MultiLineString", "MultiPolygon"]
    coordinates: list


class LocationContext(TypedDict):
    contextId: NotRequired[str | None]
    precinctId: NotRequired[str | None]
    streetId: NotRequired[str | None]
    streetKey: NotRequired[str | None]
    sourceStreetId: NotRequired[str | None]
    precinctName: NotRequired[str | None]
    streetName: NotRequired[str | None]
    resolutionMethod: NotRequired[str | None]
    matchedAddress: NotRequired[str | None]
    distanceToAddressM: NotRequired[float | None]
    label: NotRequired[str | None]
    latitude: float
    longitude: float
    geometry: NotRequired[Geometry | None]


class HabitatFeature(TypedDict):
    id: str
    kind: Literal["tree", "canopy", "garden", "vegetation", "other"]
    label: str
    evidenceSource: NotRequired[str | None]
    geometry: NotRequired[Geometry | None]


class NearbyObservation(TypedDict):
    id: str
    speciesGroup: SpeciesGroup
    scientificName: NotRequired[str | None]
    commonName: NotRequired[str | None]
    occurrenceCount: NotRequired[int | None]
    observedAt: NotRequired[str | None]
    geometry: NotRequired[Geometry | None]


class ConnectivityGap(TypedDict):
    id: str
    label: str
    explanation: str
    severity: NotRequired[Literal["potential", "unknown"]]
    geometry: NotRequired[Geometry | None]


class PotentialConnectivity(TypedDict):
    id: str
    speciesGroup: SpeciesGroup
    status: Literal["not_available", "provisional"]
    supportLevel: NotRequired[Literal["strong", "moderate", "potential_gap"] | None]
    explanation: NotRequired[str | None]
    geometry: NotRequired[Geometry | None]
    gaps: list[ConnectivityGap]


class StreetPollinatorSupport(TypedDict):
    streetId: str
    streetKey: NotRequired[str]
    streetName: str
    precinctId: NotRequired[str | None]
    nearbyCanopyAreaM2: NotRequired[float | None]
    geometry: NotRequired[Geometry | None]
    centroid: NotRequired[dict[str, float] | None]
    sourceStreetId: NotRequired[str | None]
    addressCount: NotRequired[int | None]
    plantedTreeCount: NotRequired[int | None]
    plantedTreeSpeciesCount: NotRequired[int | None]
    gardenPlantRowCount: NotRequired[int | None]
    gardenPlantSpeciesCount: NotRequired[int | None]
    plantSpeciesCount: NotRequired[int | None]
    pollinatorFloweringPlantSpeciesCount: NotRequired[int | None]
    nearbyCanopyAreaM2: NotRequired[float | None]
    nearbyCanopyPolygonCount: NotRequired[int | None]


class ConnectivityData(TypedDict):
    context: LocationContext | None
    supportRecords: list[StreetPollinatorSupport]
    connectivity: list[PotentialConnectivity]
    connectivityStatus: Literal["not_modelled"]


class StreetEcosystemContext(TypedDict):
    streetId: str
    streetKey: NotRequired[str]
    sourceStreetId: NotRequired[str]
    precinctId: NotRequired[str]
    streetName: NotRequired[str | None]
    centroid: NotRequired[dict[str, float] | None]
    evidence: NotRequired[StreetEcosystemEvidence]
    location: NotRequired[LocationContext | None]
    speciesGroup: NotRequired[SpeciesGroup | None]
    habitatFeatures: list[HabitatFeature]
    nearbyObservations: list[NearbyObservation]
    potentialConnectivity: NotRequired[PotentialConnectivity | None]
    status: Literal["not_available", "available"]
    message: NotRequired[str | None]


class StreetEcosystemEvidence(TypedDict):
    addressCount: int | None
    plantedTreeCount: int | None
    plantedTreeSpeciesCount: int | None
    gardenPlantRowCount: int | None
    gardenPlantSpeciesCount: int | None
    plantSpeciesCount: int | None
    pollinatorFloweringPlantSpeciesCount: int | None
    nearbyCanopyAreaM2: float | None
    nearbyCanopyPolygonCount: int | None


def api_meta(*, source="not_integrated", status="not_available", geometry_status="not_available", method_version=None, **metadata):
    """Build the shared metadata shape used by Iteration 2 endpoints."""
    return {
        "source": source,
        "status": status,
        "methodVersion": method_version,
        "geometryStatus": geometry_status,
        **metadata,
    }


def api_envelope(data: Any, *, source="not_integrated", status="not_available", geometry_status="not_available", method_version=None, **metadata):
    """Construct an API envelope through the contract module to prevent shape drift."""
    return {"data": data, "meta": api_meta(source=source, status=status, geometry_status=geometry_status, method_version=method_version, **metadata)}


def connectivity_data(*, context=None, support_records=None, connectivity=None) -> ConnectivityData:
    return {
        "context": context,
        "supportRecords": list(support_records or []),
        "connectivity": list(connectivity or []),
        "connectivityStatus": "not_modelled",
    }
