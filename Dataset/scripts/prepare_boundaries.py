"""Build the ten Map View 1 precinct polygons from official spatial services.

Run this script only when the boundary snapshot needs to be refreshed. The
normal data build reads the generated GeoJSON and does not require Shapely.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union


# Official Victorian services used to prepare the boundary snapshot.
VICMAP_URL = (
    "https://spatial.planning.vic.gov.au/gis/rest/services/"
    "boundary/MapServer"
)
OVERLAY_URL = (
    "https://spatial.planning.vic.gov.au/gis/rest/services/"
    "planning_scheme_overlays/MapServer/0/query"
)

# Localities that contribute to the ten Map View 1 precincts.
LOCALITIES = (
    "CARLTON",
    "MELBOURNE",
    "DOCKLANDS",
    "EAST MELBOURNE",
    "KENSINGTON",
    "NORTH MELBOURNE",
    "WEST MELBOURNE",
    "PARKVILLE",
    "SOUTHBANK",
    "SOUTH YARRA",
)

# Keep a stable order in the generated GeoJSON and frontend map.
DISPLAY_ORDER = (
    "Carlton",
    "Central City",
    "Docklands",
    "East Melbourne",
    "Fishermans Bend",
    "Kensington",
    "North and West Melbourne",
    "Parkville",
    "Southbank",
    "South Yarra",
)


def _query(url: str, parameters: dict[str, str]) -> dict:
    """Download one public ArcGIS query as JSON."""

    # ArcGIS accepts the query fields as URL parameters.
    request = Request(f"{url}?{urlencode(parameters)}", headers={"User-Agent": "Habitune/1"})
    with urlopen(request, timeout=90) as response:
        payload = json.load(response)
    if payload.get("error"):
        raise RuntimeError(f"ArcGIS query failed: {payload['error']}")
    return payload


def _arcgis_geojson(url: str, where: str, out_fields: str) -> dict:
    """Query an ArcGIS feature layer in WGS84 GeoJSON."""

    # Request WGS84 so the output can be used directly by the web map.
    return _query(
        url,
        {
            "where": where,
            "outFields": out_fields,
            "outSR": "4326",
            "returnGeometry": "true",
            "f": "geojson",
        },
    )


def _slug(value: str) -> str:
    """Create a stable ID used by frontend and backend joins."""

    return "_".join(value.casefold().replace("'", "").split())


def _polygonal(geometry):
    """Drop line/point fragments left by clipping and return polygonal geometry."""

    # Spatial intersections can leave harmless line or point fragments.
    if isinstance(geometry, (Polygon, MultiPolygon)):
        return geometry
    polygons = [part for part in geometry.geoms if isinstance(part, (Polygon, MultiPolygon))]
    return unary_union(polygons)


def _make_feature(name: str, geometry, source: str, retrieved_at: str) -> dict:
    """Create one auditable boundary feature."""

    geometry = _polygonal(geometry)
    if geometry.is_empty or not geometry.is_valid:
        raise ValueError(f"Invalid prepared geometry for {name}")
    return {
        "type": "Feature",
        "properties": {
            "precinct_id": _slug(name),
            "suburb": name,
            "boundary_source": source,
            "boundary_retrieved_at_utc": retrieved_at,
        },
        "geometry": mapping(geometry),
    }


def prepare(output: Path) -> None:
    """Download, clip, merge and validate the ten precinct polygons."""

    # Download the required localities and the City of Melbourne boundary.
    locality_names = ",".join(f"'{name}'" for name in LOCALITIES)
    localities = _arcgis_geojson(
        f"{VICMAP_URL}/2/query",
        f"LOCALITY_NAME IN ({locality_names})",
        "LOCALITY_NAME,GAZETTED_LOCALITY_NAME,VICNAMES_ID",
    )
    lga_payload = _arcgis_geojson(
        f"{VICMAP_URL}/4/query",
        "LGA_NAME='MELBOURNE'",
        "LGA_NAME,LGA_OFFICIAL_NAME,ABS_LGA_CODE",
    )

    # DDO67 covers Lorimer and DDO74 covers the Employment Precinct.
    fishermans_payload = _arcgis_geojson(
        OVERLAY_URL,
        "SCHEME_CODE='DDO' AND LGA='MELBOURNE' "
        "AND ZONE_CODE IN ('DDO67','DDO74')",
        "SCHEME_CODE,LGA,ZONE_CODE,ZONE_DESCRIPTION,GAZ_BEGIN_DATE",
    )

    if len(localities.get("features", [])) != len(LOCALITIES):
        raise ValueError("Vicmap query did not return all requested localities")
    if len(lga_payload.get("features", [])) != 1:
        raise ValueError("Expected one City of Melbourne LGA polygon")
    if not fishermans_payload.get("features"):
        raise ValueError("Fishermans Bend planning polygons are missing")

    # Clip every source polygon to the City of Melbourne study area.
    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    lga = shape(lga_payload["features"][0]["geometry"])
    fishermans = unary_union(
        [shape(feature["geometry"]) for feature in fishermans_payload["features"]]
    ).intersection(lga)

    clipped = {}
    for feature in localities["features"]:
        source_name = feature["properties"]["LOCALITY_NAME"]
        clipped[source_name] = shape(feature["geometry"]).intersection(lga)

    # The planning overlay defines Fishermans Bend independently of locality
    # boundaries. Remove its small overlap from Docklands to avoid double joins.
    clipped["DOCKLANDS"] = clipped["DOCKLANDS"].difference(fishermans)

    # Merge and rename source polygons to match the ten map labels.
    prepared = {
        "Carlton": clipped["CARLTON"],
        "Central City": clipped["MELBOURNE"],
        "Docklands": clipped["DOCKLANDS"],
        "East Melbourne": clipped["EAST MELBOURNE"],
        "Fishermans Bend": fishermans,
        "Kensington": clipped["KENSINGTON"],
        "North and West Melbourne": unary_union(
            [clipped["NORTH MELBOURNE"], clipped["WEST MELBOURNE"]]
        ),
        "Parkville": clipped["PARKVILLE"],
        "Southbank": clipped["SOUTHBANK"],
        "South Yarra": clipped["SOUTH YARRA"],
    }

    source_labels = {
        name: "Vicmap Admin locality clipped to Melbourne LGA" for name in prepared
    }
    source_labels["Fishermans Bend"] = (
        "Victorian Planning Melbourne DDO74 and DDO67 Fishermans Bend polygons"
    )

    features = [
        _make_feature(name, prepared[name], source_labels[name], retrieved_at)
        for name in DISPLAY_ORDER
    ]

    # Reject overlapping precincts before saving the reusable snapshot.
    geometries = [shape(feature["geometry"]) for feature in features]
    for index, first in enumerate(geometries):
        for second in geometries[index + 1 :]:
            if first.intersection(second).area > 1e-12:
                raise ValueError("Prepared precinct polygons overlap")

    # Store source URLs and boundary provenance with the GeoJSON features.
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "name": "Habitune Urban Forest precinct boundaries",
                "source_urls": [VICMAP_URL, OVERLAY_URL],
                "features": features,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> None:
    """Parse the output path and refresh the boundary snapshot."""

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("raw/urban-forest-precinct-boundaries.geojson"),
    )
    args = parser.parse_args()
    prepare(args.output)


if __name__ == "__main__":
    main()
