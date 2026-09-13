# Habitune precinct and street-evidence database model

```mermaid
erDiagram
    precinct ||--|| precinct_biodiversity_metric : has
    precinct ||--o{ street_ecosystem_evidence : contains
    precinct ||--o{ address_street_lookup : contains
    precinct ||--o{ vegetation_tree : contains
    precinct ||--o{ garden_bed : contains
    garden_bed ||--o{ garden_bed_inventory : describes
    street_ecosystem_evidence ||--o{ address_street_lookup : resolves_to
    precinct {
        text precinct_id PK
        text name
        text boundary_source
        double_precision suburb_area_km2
        double_precision precinct_area_ha
        geometry_MultiPolygon_4326 geometry
    }
    precinct_biodiversity_metric {
        text precinct_id PK, FK
        double_precision canopy_area_km2
        double_precision canopy_coverage_pct
        integer plant_species_count
        integer animal_species_count
        double_precision biodiversity_score_0_100
        text biodiversity_score_version
    }
    street_ecosystem_evidence {
        text street_key PK
        text source_street_id
        text precinct_id FK
        text street_name
        geometry_Point_4326 centroid
        integer planted_tree_count
        integer planted_tree_species_count
        integer garden_plant_row_count
        integer garden_plant_species_count
        integer plant_species_count
        integer pollinator_flowering_plant_species_count
        double_precision nearby_canopy_area_m2
        integer nearby_canopy_polygon_count
        text source_schema_version
    }
    address_street_lookup {
        text search_key PK
        text street_key PK, FK
        geometry_Point_4326 location PK
        text precinct_id FK
        text address
        text source_schema_version
    }
    vegetation_tree {
        text tree_id PK
        text precinct_id FK
        text common_name
        text scientific_name
        text genus
        text family
        geometry_Point_4326 location
        text source_dataset_id
    }
    garden_bed {
        text bed_id PK
        text precinct_id FK
        geometry_Point_4326 location
        double_precision area_m2
        jsonb botanical_names
        integer inventory_row_count
        text source_dataset_id
    }
    garden_bed_inventory {
        text bed_id PK, FK
        text object_id PK
        text botanical_name
        text common_name
        text plant_origin
        text plant_form
    }
```

Each precinct has exactly one current Iteration 1 metric record. `precinct.precinct_id` is the stable join key from the Dataset contract; the same value is both the metric table's primary key and its foreign key. Geometry comes from `Dataset/processed/map_view1_suburbs.geojson` and is normalized from source `Polygon` or `MultiPolygon` to PostGIS `MultiPolygon` with WGS84 SRID 4326. All other precinct and metric values come from `Dataset/processed/map_view1.json`; the ingestion layer does not reproduce Dataset calculations.

Iteration 2 imports `address_lookup.csv` and `street_level.json` without recalculating their values. Coordinate resolution first finds the containing precinct and then the nearest supported address point within the Dataset's documented 250 metre limit. The address points join to `street_ecosystem_evidence` through the globally unique Dataset `street_key` (`suburb|source street_id`). Source street IDs are retained separately because they are not globally unique across precincts.

The street table contains vegetation and nearby-canopy evidence only. It intentionally has no habitat-quality, connectivity, corridor, or gap classification.

The vegetation tables import the spatially filtered City of Melbourne outputs without
recalculating their values. Trees and garden assets are stored as PostGIS WGS84 Points.
The Garden source does not provide bed polygons; `area_m2` remains a measured attribute.
Plant/condition observations are kept in `garden_bed_inventory` so the one-row-per-asset
API table does not discard the source's multiple species rows.
