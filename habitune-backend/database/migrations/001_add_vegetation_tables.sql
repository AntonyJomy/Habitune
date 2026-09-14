-- Incremental, non-destructive Iteration 2 vegetation schema for existing databases.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS vegetation_tree (
    tree_id TEXT PRIMARY KEY,
    precinct_id TEXT NOT NULL REFERENCES precinct (precinct_id),
    common_name TEXT NULL,
    scientific_name TEXT NULL,
    genus TEXT NULL,
    family TEXT NULL,
    diameter_breast_height_cm DOUBLE PRECISION NULL CHECK (diameter_breast_height_cm >= 0),
    year_planted INTEGER NULL,
    date_planted DATE NULL,
    age_description TEXT NULL,
    useful_life_expectancy TEXT NULL,
    useful_life_expectancy_years INTEGER NULL CHECK (useful_life_expectancy_years >= 0),
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

CREATE INDEX IF NOT EXISTS vegetation_tree_precinct_idx ON vegetation_tree (precinct_id);
CREATE INDEX IF NOT EXISTS vegetation_tree_location_gix ON vegetation_tree USING GIST (location);

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

CREATE INDEX IF NOT EXISTS garden_bed_precinct_idx ON garden_bed (precinct_id);
CREATE INDEX IF NOT EXISTS garden_bed_location_gix ON garden_bed USING GIST (location);

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
