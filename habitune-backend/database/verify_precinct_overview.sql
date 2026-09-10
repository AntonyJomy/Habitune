-- Expected current result: 10 precinct rows and 10 metric rows.
SELECT
    (SELECT count(*) FROM precinct) AS precinct_count,
    (SELECT count(*) FROM precinct_biodiversity_metric) AS metric_count;

-- A non-zero count in either relationship column indicates incomplete linkage.
SELECT
    count(*) FILTER (WHERE m.precinct_id IS NULL) AS precincts_missing_metrics,
    count(*) FILTER (WHERE p.precinct_id IS NULL) AS orphan_metrics
FROM precinct AS p
FULL OUTER JOIN precinct_biodiversity_metric AS m USING (precinct_id);

-- Primary keys prevent these; the queries also document the expected uniqueness.
SELECT precinct_id, count(*) AS duplicate_count
FROM precinct
GROUP BY precinct_id
HAVING count(*) > 1;

SELECT precinct_id, count(*) AS duplicate_count
FROM precinct_biodiversity_metric
GROUP BY precinct_id
HAVING count(*) > 1;

-- Required precinct values must never be NULL.
SELECT precinct_id
FROM precinct
WHERE name IS NULL
   OR boundary_source IS NULL
   OR suburb_area_km2 IS NULL
   OR precinct_area_ha IS NULL
   OR geometry IS NULL;

-- Required metric values must never be NULL; corridor count is intentionally excluded.
SELECT precinct_id
FROM precinct_biodiversity_metric
WHERE canopy_area_km2 IS NULL
   OR canopy_coverage_pct IS NULL
   OR plant_species_count IS NULL
   OR animal_species_count IS NULL
   OR plant_density_per_ha IS NULL
   OR animal_density_per_ha IS NULL
   OR species_density_per_ha IS NULL
   OR pollinator_flowering_plant_species_count IS NULL
   OR pollinator_insect_species_count IS NULL
   OR relevant_bird_species_count IS NULL
   OR tree_record_count IS NULL
   OR garden_plant_row_count IS NULL
   OR canopy_polygon_count IS NULL
   OR pollinator_insect_occurrence_count IS NULL
   OR relevant_bird_occurrence_count IS NULL
   OR address_count IS NULL
   OR pollination_corridor_status IS NULL
   OR canopy_score_0_100 IS NULL
   OR plant_density_score_0_100 IS NULL
   OR animal_density_score_0_100 IS NULL
   OR biodiversity_score_0_100 IS NULL
   OR biodiversity_score_version IS NULL;

SELECT
    precinct_id,
    ST_SRID(geometry) AS srid,
    GeometryType(geometry) AS geometry_type,
    ST_IsValid(geometry) AS is_valid
FROM precinct
WHERE ST_SRID(geometry) <> 4326
   OR GeometryType(geometry) <> 'MULTIPOLYGON'
   OR NOT ST_IsValid(geometry);

SELECT precinct_id, biodiversity_score_0_100
FROM precinct_biodiversity_metric
WHERE biodiversity_score_0_100 NOT BETWEEN 0 AND 100;

SELECT precinct_id, canopy_coverage_pct
FROM precinct_biodiversity_metric
WHERE canopy_coverage_pct NOT BETWEEN 0 AND 100;

-- Current Iteration 1 rows should have NULL count plus the explicit unavailable status.
SELECT
    count(*) FILTER (WHERE pollination_corridor_count IS NULL) AS null_corridor_counts,
    count(*) FILTER (
        WHERE pollination_corridor_status = 'not_available_until_iteration_2_review'
    ) AS iteration_2_unavailable_statuses,
    count(*) FILTER (
        WHERE pollination_corridor_count IS NULL
          AND pollination_corridor_status <> 'not_available_until_iteration_2_review'
    ) AS inconsistent_corridor_rows
FROM precinct_biodiversity_metric;

-- Readable sample for comparison with Dataset/processed/map_view1.json.
SELECT
    p.precinct_id,
    p.name,
    p.suburb_area_km2,
    m.canopy_coverage_pct,
    m.plant_species_count,
    m.animal_species_count,
    m.biodiversity_score_0_100,
    m.biodiversity_score_version,
    GeometryType(p.geometry) AS geometry_type
FROM precinct AS p
JOIN precinct_biodiversity_metric AS m USING (precinct_id)
ORDER BY p.precinct_id;
