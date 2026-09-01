# Map View 1 contract

`processed/map_view1.json` is the primary transport-neutral contract.

## No location input

Return `city_summary` and the complete 10-item `suburbs` array. The frontend can colour
the polygons in `map_view1_suburbs.geojson` and open the right-side panel when a
user selects one.

Each item contains polygon area, canopy percentage, plant/animal species and
density values, the three 0-100 component scores and the final biodiversity
score. The legacy key `suburb` remains the display-name field so existing
frontend/backend joins do not break even though the comparison unit is precinct.

## Location input: street-level response

1. If the input is WGS84 latitude/longitude, confirm the precinct and select
   the nearest address within 250 m.
2. If it is text, use exact, prefix, then contains ranking against
   `address_lookup.csv`; return candidates instead of guessing when several
   partial matches remain.
3. Resolve the address to its source street ID and load the matching object from
   `street_level.json`.
4. Query ALA birds and insects around the resolved location using the same
   requested radius.
5. Keep bird species present in `relevant_birds.csv` and insect species present
   in `pollinator_insect_taxa.csv`.
6. Return `mode=not_found` for unsupported areas or unmatched input; do not
   silently substitute a default suburb.

The response uses `mode=street_level` and includes:

- `resolved_location`, `resolved_street` and `resolved_suburb`
- planted tree count and species
- combined plant species and pollinator-linked flowering plants
- nearby canopy area and canopy polygon count
- `animals_near_location` with one centre and radius
- radius-filtered nectar/fruit birds with supporting habitat-function roles
- radius-filtered, evidence-filtered pollinator-insect candidates
- the parent precinct summary under `suburb_context`, including its score

Address input does not calculate a separate street biodiversity score. It
returns the matched precinct's score plus street-level environmental context.

The frontend heading for this block is the stable response value
`Animals near your location`.

The Python references are `habitune_data.lookup.map_view` and
`habitune_data.lookup.enrich_location_animals`.
