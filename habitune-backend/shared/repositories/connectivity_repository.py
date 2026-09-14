"""Read-only precinct street evidence for the Connectivity View."""

def get_connection():
    from shared.db import get_connection as create_connection
    return create_connection()


def dict_cursor_factory():
    from psycopg2.extras import RealDictCursor
    return RealDictCursor


LIST_STREET_SUPPORT_SQL = """
SELECT
    street_key AS "streetId", street_key AS "streetKey",
    source_street_id AS "sourceStreetId", street_name AS "streetName",
    precinct_id AS "precinctId", address_count AS "addressCount",
    planted_tree_count AS "plantedTreeCount",
    planted_tree_species_count AS "plantedTreeSpeciesCount",
    garden_plant_row_count AS "gardenPlantRowCount",
    garden_plant_species_count AS "gardenPlantSpeciesCount",
    plant_species_count AS "plantSpeciesCount",
    pollinator_flowering_plant_species_count AS "pollinatorFloweringPlantSpeciesCount",
    nearby_canopy_area_m2 AS "nearbyCanopyAreaM2",
    nearby_canopy_polygon_count AS "nearbyCanopyPolygonCount",
    CASE WHEN centroid IS NULL THEN NULL ELSE ST_Y(centroid) END AS "centroidLatitude",
    CASE WHEN centroid IS NULL THEN NULL ELSE ST_X(centroid) END AS "centroidLongitude"
FROM street_ecosystem_evidence
WHERE precinct_id = %s
ORDER BY street_name, street_key
"""


def list_street_support(precinct_id):
    connection = get_connection()
    try:
        connection.set_session(readonly=True, autocommit=True)
        with connection.cursor(cursor_factory=dict_cursor_factory()) as cursor:
            cursor.execute(LIST_STREET_SUPPORT_SQL, (precinct_id,))
            rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()
