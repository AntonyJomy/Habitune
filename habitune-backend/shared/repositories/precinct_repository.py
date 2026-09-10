"""Read-only PostgreSQL persistence for precinct overview APIs."""

import json

from psycopg2.extras import RealDictCursor

from shared.db import get_connection


# Keep the public API shape explicit rather than returning every database column.
PRECINCT_COLUMNS = """
    p.precinct_id,
    p.name,
    p.boundary_source,
    p.suburb_area_km2,
    p.precinct_area_ha,
    m.canopy_area_km2,
    m.canopy_coverage_pct,
    m.plant_species_count,
    m.animal_species_count,
    m.plant_density_per_ha,
    m.animal_density_per_ha,
    m.species_density_per_ha,
    m.pollinator_flowering_plant_species_count,
    m.pollinator_insect_species_count,
    m.relevant_bird_species_count,
    m.tree_record_count,
    m.garden_plant_row_count,
    m.canopy_polygon_count,
    m.pollinator_insect_occurrence_count,
    m.relevant_bird_occurrence_count,
    m.address_count,
    m.pollination_corridor_count,
    m.pollination_corridor_status,
    m.canopy_score_0_100,
    m.plant_density_score_0_100,
    m.animal_density_score_0_100,
    m.biodiversity_score_0_100,
    m.biodiversity_score_version
"""

LIST_PRECINCTS_SQL = f"""
SELECT {PRECINCT_COLUMNS}
FROM precinct AS p
JOIN precinct_biodiversity_metric AS m USING (precinct_id)
ORDER BY p.name
"""

GET_PRECINCT_SQL = f"""
SELECT {PRECINCT_COLUMNS}
FROM precinct AS p
JOIN precinct_biodiversity_metric AS m USING (precinct_id)
WHERE p.precinct_id = %s
"""

LIST_PRECINCT_GEOMETRIES_SQL = f"""
SELECT
    {PRECINCT_COLUMNS},
    ST_AsGeoJSON(p.geometry) AS geometry
FROM precinct AS p
JOIN precinct_biodiversity_metric AS m USING (precinct_id)
ORDER BY p.name
"""


def _execute_read(sql, parameters=(), *, fetch_one=False):
    """Run a parameterized query in a read-only database session."""
    connection = get_connection()
    try:
        # The request may read data but cannot modify it through this session.
        connection.set_session(readonly=True, autocommit=True)
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(sql, parameters)
            result = cursor.fetchone() if fetch_one else cursor.fetchall()
        if fetch_one:
            return dict(result) if result is not None else None
        return [dict(row) for row in result]
    finally:
        connection.close()


def list_precincts():
    """Return all current precincts and their overview metrics."""
    return _execute_read(LIST_PRECINCTS_SQL)


def get_precinct(precinct_id):
    """Return one current precinct and its overview metrics."""
    # Passing a tuple keeps user input separate from SQL and prevents SQL injection.
    return _execute_read(GET_PRECINCT_SQL, (precinct_id,), fetch_one=True)


def list_precinct_geometries():
    """Return all precinct metrics with PostGIS-serialized GeoJSON geometry."""
    rows = _execute_read(LIST_PRECINCT_GEOMETRIES_SQL)
    # psycopg2 returns PostGIS GeoJSON as text, so decode it before the API response.
    for row in rows:
        geometry = row.get("geometry")
        if isinstance(geometry, str):
            row["geometry"] = json.loads(geometry)
    return rows
