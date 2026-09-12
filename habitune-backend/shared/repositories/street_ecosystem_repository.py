"""Read-only access to existing Habitune street vegetation evidence."""

def get_connection():
    from shared.db import get_connection as create_connection
    return create_connection()


def dict_cursor_factory():
    from psycopg2.extras import RealDictCursor
    return RealDictCursor


STREET_ECOSYSTEM_SQL = """
SELECT
    street_key AS "streetId", street_key AS "streetKey",
    source_street_id AS "sourceStreetId", street_name AS "streetName",
    precinct_id AS "precinctId", ST_Y(centroid) AS "centroidLatitude",
    ST_X(centroid) AS "centroidLongitude", address_count AS "addressCount",
    planted_tree_count AS "plantedTreeCount",
    planted_tree_species_count AS "plantedTreeSpeciesCount",
    garden_plant_row_count AS "gardenPlantRowCount",
    garden_plant_species_count AS "gardenPlantSpeciesCount",
    plant_species_count AS "plantSpeciesCount",
    pollinator_flowering_plant_species_count AS "pollinatorFloweringPlantSpeciesCount",
    nearby_canopy_area_m2 AS "nearbyCanopyAreaM2",
    nearby_canopy_polygon_count AS "nearbyCanopyPolygonCount",
    source_file AS "sourceFile", source_schema_version AS "sourceSchemaVersion",
    assignment_method AS "assignmentMethod",
    maximum_assignment_distance_m AS "maximumAssignmentDistanceM",
    canopy_metric_note AS "canopyMetricNote"
FROM street_ecosystem_evidence
WHERE street_key = %s
"""


def get_street_ecosystem(street_id):
    connection = get_connection()
    try:
        connection.set_session(readonly=True, autocommit=True)
        with connection.cursor(cursor_factory=dict_cursor_factory()) as cursor:
            cursor.execute(STREET_ECOSYSTEM_SQL, (street_id,))
            row = cursor.fetchone()
        return dict(row) if row is not None else None
    finally:
        connection.close()
