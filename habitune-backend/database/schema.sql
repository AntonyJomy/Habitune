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

-- One evidence row per globally stable Dataset street key (suburb|source street id).
-- These are observations/aggregates only; no habitat or connectivity class is stored.
CREATE TABLE IF NOT EXISTS street_ecosystem_evidence (
    street_key TEXT PRIMARY KEY,
    source_street_id TEXT NOT NULL CHECK (btrim(source_street_id) <> ''),
    precinct_id TEXT NOT NULL REFERENCES precinct (precinct_id),
    street_name TEXT NOT NULL CHECK (btrim(street_name) <> ''),
    centroid geometry(Point, 4326) NULL,
    address_count INTEGER NULL CHECK (address_count >= 0),
    planted_tree_count INTEGER NULL CHECK (planted_tree_count >= 0),
    planted_tree_species_count INTEGER NULL CHECK (planted_tree_species_count >= 0),
    garden_plant_row_count INTEGER NULL CHECK (garden_plant_row_count >= 0),
    garden_plant_species_count INTEGER NULL CHECK (garden_plant_species_count >= 0),
    plant_species_count INTEGER NULL CHECK (plant_species_count >= 0),
    pollinator_flowering_plant_species_count INTEGER NULL
        CHECK (pollinator_flowering_plant_species_count >= 0),
    nearby_canopy_area_m2 DOUBLE PRECISION NULL CHECK (nearby_canopy_area_m2 >= 0),
    nearby_canopy_polygon_count INTEGER NULL CHECK (nearby_canopy_polygon_count >= 0),
    source_file TEXT NOT NULL,
    source_schema_version TEXT NOT NULL,
    assignment_method TEXT NOT NULL,
    maximum_assignment_distance_m DOUBLE PRECISION NULL
        CHECK (maximum_assignment_distance_m >= 0),
    canopy_metric_note TEXT NULL
);

CREATE INDEX IF NOT EXISTS street_ecosystem_precinct_idx
    ON street_ecosystem_evidence (precinct_id);
CREATE INDEX IF NOT EXISTS street_ecosystem_centroid_gix
    ON street_ecosystem_evidence USING GIST (centroid);

-- Address points provide deterministic coordinate-to-street resolution within a precinct.
CREATE TABLE IF NOT EXISTS address_street_lookup (
    address TEXT NOT NULL,
    search_key TEXT NOT NULL,
    precinct_id TEXT NOT NULL REFERENCES precinct (precinct_id),
    street_key TEXT NOT NULL REFERENCES street_ecosystem_evidence (street_key),
    location geometry(Point, 4326) NOT NULL,
    source_file TEXT NOT NULL,
    source_schema_version TEXT NOT NULL,
    PRIMARY KEY (search_key, street_key, location)
);

CREATE INDEX IF NOT EXISTS address_street_lookup_precinct_idx
    ON address_street_lookup (precinct_id);
CREATE INDEX IF NOT EXISTS address_street_lookup_location_gix
    ON address_street_lookup USING GIST (location);

-- City of Melbourne Urban Forest inventory, spatially assigned to the reviewed
-- Habitune project polygons before ingestion.
CREATE TABLE IF NOT EXISTS vegetation_tree (
    tree_id TEXT PRIMARY KEY,
    precinct_id TEXT NOT NULL REFERENCES precinct (precinct_id),
    common_name TEXT NULL,
    scientific_name TEXT NULL,
    genus TEXT NULL,
    family TEXT NULL,
    diameter_breast_height_cm DOUBLE PRECISION NULL
        CHECK (diameter_breast_height_cm >= 0),
    year_planted INTEGER NULL,
    date_planted DATE NULL,
    age_description TEXT NULL,
    useful_life_expectancy TEXT NULL,
    useful_life_expectancy_years INTEGER NULL
        CHECK (useful_life_expectancy_years >= 0),
    source_precinct TEXT NULL,
    located_in TEXT NULL,
    location geometry(Point, 4326) NOT NULL,
    easting DOUBLE PRECISION NULL,
    northing DOUBLE PRECISION NULL,
    source_dataset_id TEXT NOT NULL,
    source_record_id TEXT NOT NULL,
    source_retrieved_at_utc TIMESTAMPTZ NOT NULL,
    processing_method_version TEXT NOT NULL,
    CONSTRAINT vegetation_tree_location_valid CHECK (ST_IsValid(location))
);

CREATE INDEX IF NOT EXISTS vegetation_tree_precinct_idx
    ON vegetation_tree (precinct_id);
CREATE INDEX IF NOT EXISTS vegetation_tree_location_gix
    ON vegetation_tree USING GIST (location);

-- The Garden Bed export provides an asset point and measured area, not polygon
-- geometry. Plant inventory observations are normalized into the child table.
CREATE TABLE IF NOT EXISTS garden_bed (
    bed_id TEXT PRIMARY KEY,
    precinct_id TEXT NOT NULL REFERENCES precinct (precinct_id),
    location geometry(Point, 4326) NOT NULL,
    easting_epsg7855 DOUBLE PRECISION NOT NULL,
    northing_epsg7855 DOUBLE PRECISION NOT NULL,
    area_m2 DOUBLE PRECISION NULL CHECK (area_m2 >= 0),
    source_neighbourhood TEXT NULL,
    site_type TEXT NULL,
    site_name TEXT NULL,
    assessed_bed_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    botanical_names JSONB NOT NULL DEFAULT '[]'::jsonb,
    common_names JSONB NOT NULL DEFAULT '[]'::jsonb,
    inventory_row_count INTEGER NOT NULL CHECK (inventory_row_count >= 0),
    source_dataset_id TEXT NOT NULL,
    source_record_id TEXT NOT NULL,
    source_retrieved_at_utc TIMESTAMPTZ NOT NULL,
    processing_method_version TEXT NOT NULL,
    CONSTRAINT garden_bed_location_valid CHECK (ST_IsValid(location))
);

CREATE INDEX IF NOT EXISTS garden_bed_precinct_idx
    ON garden_bed (precinct_id);
CREATE INDEX IF NOT EXISTS garden_bed_location_gix
    ON garden_bed USING GIST (location);

CREATE TABLE IF NOT EXISTS garden_bed_inventory (
    bed_id TEXT NOT NULL REFERENCES garden_bed (bed_id) ON DELETE CASCADE,
    object_id TEXT NOT NULL,
    assessment_date DATE NULL,
    assessed_bed_type TEXT NULL,
    bed_type_origin TEXT NULL,
    botanical_name TEXT NULL,
    common_name TEXT NULL,
    plant_origin TEXT NULL,
    plant_form TEXT NULL,
    level_of_certainty TEXT NULL,
    dominant_species_over_25 TEXT NULL,
    plant_condition TEXT NULL,
    plant_condition_score DOUBLE PRECISION NULL,
    overall_condition_rating TEXT NULL,
    condition_rating_score DOUBLE PRECISION NULL,
    source_retrieved_at_utc TIMESTAMPTZ NOT NULL,
    processing_method_version TEXT NOT NULL,
    PRIMARY KEY (bed_id, object_id)
);

CREATE INDEX IF NOT EXISTS garden_bed_inventory_botanical_name_idx
    ON garden_bed_inventory (botanical_name);
