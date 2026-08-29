# Processed data dictionary

## `map_view1_suburbs.csv` / GeoJSON properties

| Field | Meaning |
|---|---|
| `suburb` | One of 11 merged CLUE map areas |
| `suburb_area_km2` | Calculated boundary area |
| `canopy_area_km2` | Sum of allocated 2019 canopy polygons |
| `canopy_coverage_pct` | Canopy area divided by suburb area |
| `plant_species_count` | Distinct tree + garden scientific names |
| `pollinator_flowering_plant_species_count` | Inventory species linked to local `pol=1` records |
| `pollinator_insect_species_count` | Distinct species-rank ALA candidates |
| `relevant_bird_species_count` | Distinct ALA birds passing the diet-role filter |
| `*_record_count` / `*_occurrence_count` | Supporting source row/observation counts, not abundance |
| `address_count` | Clean addresses available for location lookup |

## `pollinator_insect_taxa.csv`

`scientific_name`, ALA `family` and `order`, LGA occurrence count, suburb
presence, exact local species evidence, and the family-level classification
basis. A row is always species rank.

## `pollinator_flowering_plants.csv`

Scientific name used in the asset inventory, study name, count of study rows
linked to a `pol=1` insect, matching asset rows, source names and suburb presence.

## `relevant_birds.csv`

Observed and trait scientific names, common name, five-category feeding guild,
four diet percentages, three boolean habitat-function roles, diet certainty and
its definition, trait-match basis, ALA occurrence count and suburb presence.

## `street_level.json` / `street_level.csv`

Each row/object is keyed by `suburb|street_id` and contains street name,
centroid, address count, planted-tree counts, combined plant diversity,
pollinator-linked flowering plants and nearby canopy area. JSON additionally
includes the corresponding plant species lists.

Animals are not frozen into every street row. Birds and pollinator-insect
candidates are queried around the resolved user location using one shared
radius. They are attached to the runtime response under
`street_data.animals_near_location`:

| Field | Meaning |
|---|---|
| `label` | Stable frontend heading: `Animals near your location` |
| `radius_m` | Search radius used for both animal groups |
| `centre` | Latitude and longitude used for both ALA queries |
| `birds.species_count` | Distinct nearby species passing the nectar/fruit filter |
| `pollinator_insects.species_count` | Distinct nearby species in the evidence-filtered candidate table |
| `*.filtered_occurrence_count` | Matching ALA observation rows within the radius |
| `*.species` | Species details and per-species occurrence counts |

## Evidence semantics

- `species_count` = distinct taxa observed/matched under the documented rules.
- `occurrence_count` = ALA observation rows, not animal population.
- `pol=1` = pollinator functional-group label in the local study, not an observed
  pollination interaction.
- `canopy_coverage_pct` = estimated physical coverage.
- No output field is named or represented as confirmed habitat area.
- `nearby_canopy_area_m2` is an address-assigned street context metric, not a
  percentage of a street polygon.
