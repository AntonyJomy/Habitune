"""Read-only PostgreSQL persistence for vegetation GeoJSON APIs."""

from shared.vegetation_bounds import VEGETATION_RESULT_LIMIT


def get_connection():
    from shared.db import get_connection as create_connection
    return create_connection()


def dict_cursor_factory():
    from psycopg2.extras import RealDictCursor
    return RealDictCursor


LIST_TREES_SQL = """
SELECT
    tree_id,
    common_name,
    scientific_name,
    genus,
    family,
    precinct_id,
    ST_X(location) AS longitude,
    ST_Y(location) AS latitude,
    source_dataset_id AS source
FROM vegetation_tree
WHERE location && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
ORDER BY tree_id
LIMIT %s
"""

LIST_GARDEN_BEDS_SQL = """
SELECT
    bed_id,
    site_name AS name,
    precinct_id,
    area_m2,
    source_neighbourhood,
    site_type,
    assessed_bed_types,
    botanical_names,
    common_names,
    ST_AsGeoJSON(location) AS geometry,
    source_dataset_id AS source
FROM garden_bed
WHERE location && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
ORDER BY bed_id
LIMIT %s
"""


def _list(sql, bounds):
    # PostGIS limits the query to the visible map bounding box before returning rows.
    connection = get_connection()
    try:
        connection.set_session(readonly=True, autocommit=True)
        with connection.cursor(cursor_factory=dict_cursor_factory()) as cursor:
            cursor.execute(sql, (*bounds.parameters, VEGETATION_RESULT_LIMIT + 1))
            rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def list_trees(bounds):
    """Return Urban Forest tree rows whose Points intersect the WGS84 bbox."""
    return _list(LIST_TREES_SQL, bounds)


def list_garden_beds(bounds):
    """Return Garden Bed Point rows whose locations intersect the WGS84 bbox."""
    return _list(LIST_GARDEN_BEDS_SQL, bounds)
