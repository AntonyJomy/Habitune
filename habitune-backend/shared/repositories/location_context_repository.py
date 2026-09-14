"""Read-only coordinate resolution against existing Habitune address evidence."""

def get_connection():
    from shared.db import get_connection as create_connection
    return create_connection()


def dict_cursor_factory():
    from psycopg2.extras import RealDictCursor
    return RealDictCursor


LOCATION_CONTEXT_SQL = """
WITH input AS (SELECT ST_SetSRID(ST_MakePoint(%s, %s), 4326) AS location)
SELECT
    p.precinct_id AS "precinctId", p.name AS "precinctName",
    street.street_key AS "streetId", street.street_key AS "streetKey",
    street.source_street_id AS "sourceStreetId", street.street_name AS "streetName",
    %s::double precision AS latitude, %s::double precision AS longitude,
    'nearest_supported_address' AS "resolutionMethod",
    nearest.address AS "matchedAddress",
    round(nearest.distance_m::numeric, 1)::double precision AS "distanceToAddressM",
    'address_lookup.csv' AS "resolutionSourceFile",
    street.source_file AS "streetSourceFile",
    street.source_schema_version AS "sourceSchemaVersion",
    street.assignment_method AS "assignmentMethod"
FROM input
JOIN precinct AS p ON ST_Covers(p.geometry, input.location)
JOIN LATERAL (
    SELECT address, street_key,
           ST_Distance(location::geography, input.location::geography) AS distance_m
    FROM address_street_lookup
    WHERE precinct_id = p.precinct_id
      AND ST_DWithin(location::geography, input.location::geography, 250)
    ORDER BY distance_m
    LIMIT 1
) AS nearest ON TRUE
JOIN street_ecosystem_evidence AS street ON street.street_key = nearest.street_key
LIMIT 1
"""


def get_location_context(latitude, longitude):
    connection = get_connection()
    try:
        connection.set_session(readonly=True, autocommit=True)
        with connection.cursor(cursor_factory=dict_cursor_factory()) as cursor:
            cursor.execute(LOCATION_CONTEXT_SQL, (longitude, latitude, latitude, longitude))
            row = cursor.fetchone()
        return dict(row) if row is not None else None
    finally:
        connection.close()
