from shared.repositories import precinct_repository


def list_precincts():
    """Shape database rows as the precinct collection contract."""
    rows = precinct_repository.list_precincts()
    return {
        "data": [dict(row) for row in rows],
        "meta": {"source": "database", "count": len(rows)},
    }


def get_precinct(precinct_id):
    """Validate an ID and shape one future precinct resource."""
    # Normalize IDs here so every handler receives the same domain behavior.
    normalized_id = str(precinct_id or "").strip()
    if not normalized_id:
        raise ValueError("precinct_id is required")
    row = precinct_repository.get_precinct(normalized_id)
    return dict(row) if row is not None else None


def get_precinct_geojson():
    """Shape repository geometry rows as a GeoJSON FeatureCollection."""
    rows = precinct_repository.list_precinct_geometries()
    # Keep transport-ready GeoJSON formatting separate from future SQL queries.
    features = [
        {
            "type": "Feature",
            "id": row.get("precinct_id"),
            "geometry": row.get("geometry"),
            "properties": {
                key: value
                for key, value in row.items()
                if key not in {"geometry"}
            },
        }
        for row in rows
    ]
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {"source": "database", "count": len(features)},
    }
