CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS precinct (
    precinct_id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    boundary_source TEXT NOT NULL CHECK (btrim(boundary_source) <> ''),
    suburb_area_km2 DOUBLE PRECISION NOT NULL CHECK (suburb_area_km2 > 0),
    precinct_area_ha DOUBLE PRECISION NOT NULL CHECK (precinct_area_ha > 0),
    -- Source boundaries may be Polygon or MultiPolygon; one storage type keeps queries stable.
    geometry geometry(MultiPolygon, 4326) NOT NULL,
    CONSTRAINT precinct_geometry_valid CHECK (ST_IsValid(geometry))
);

CREATE TABLE IF NOT EXISTS precinct_biodiversity_metric (
    precinct_id TEXT PRIMARY KEY
        REFERENCES precinct (precinct_id),
    canopy_area_km2 DOUBLE PRECISION NOT NULL CHECK (canopy_area_km2 >= 0),
    canopy_coverage_pct DOUBLE PRECISION NOT NULL
        CHECK (canopy_coverage_pct BETWEEN 0 AND 100),
    plant_species_count INTEGER NOT NULL CHECK (plant_species_count >= 0),
    animal_species_count INTEGER NOT NULL CHECK (animal_species_count >= 0),
    plant_density_per_ha DOUBLE PRECISION NOT NULL CHECK (plant_density_per_ha >= 0),
    animal_density_per_ha DOUBLE PRECISION NOT NULL CHECK (animal_density_per_ha >= 0),
    species_density_per_ha DOUBLE PRECISION NOT NULL CHECK (species_density_per_ha >= 0),
    pollinator_flowering_plant_species_count INTEGER NOT NULL
        CHECK (pollinator_flowering_plant_species_count >= 0),
    pollinator_insect_species_count INTEGER NOT NULL
        CHECK (pollinator_insect_species_count >= 0),
    relevant_bird_species_count INTEGER NOT NULL CHECK (relevant_bird_species_count >= 0),
    tree_record_count INTEGER NOT NULL CHECK (tree_record_count >= 0),
    garden_plant_row_count INTEGER NOT NULL CHECK (garden_plant_row_count >= 0),
    canopy_polygon_count INTEGER NOT NULL CHECK (canopy_polygon_count >= 0),
    pollinator_insect_occurrence_count INTEGER NOT NULL
        CHECK (pollinator_insect_occurrence_count >= 0),
    relevant_bird_occurrence_count INTEGER NOT NULL
        CHECK (relevant_bird_occurrence_count >= 0),
    address_count INTEGER NOT NULL CHECK (address_count >= 0),
    -- NULL means corridor data is unavailable pending the Iteration 2 review, not zero.
    pollination_corridor_count INTEGER NULL CHECK (pollination_corridor_count >= 0),
    pollination_corridor_status TEXT NOT NULL CHECK (btrim(pollination_corridor_status) <> ''),
    canopy_score_0_100 DOUBLE PRECISION NOT NULL CHECK (canopy_score_0_100 BETWEEN 0 AND 100),
    plant_density_score_0_100 DOUBLE PRECISION NOT NULL
        CHECK (plant_density_score_0_100 BETWEEN 0 AND 100),
    animal_density_score_0_100 DOUBLE PRECISION NOT NULL
        CHECK (animal_density_score_0_100 BETWEEN 0 AND 100),
    biodiversity_score_0_100 DOUBLE PRECISION NOT NULL
        CHECK (biodiversity_score_0_100 BETWEEN 0 AND 100),
    biodiversity_score_version TEXT NOT NULL CHECK (btrim(biodiversity_score_version) <> '')
);
