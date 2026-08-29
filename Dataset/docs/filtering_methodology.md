# Filtering and cleaning methodology

## Source coverage

All seven supplied CSVs are used:

| Source | Pipeline use |
|---|---|
| Insect/plant study | `pol=1` functional-group family, group and plant evidence |
| Street addresses | Clean address lookup and input-to-suburb routing |
| Tree canopies 2019 | Canopy polygon area and coverage estimate |
| Urban forest trees | Plant diversity and asset presence |
| CLUE small areas | Map polygons and point-in-polygon allocation |
| Garden bed inventory 2024 | Plant diversity and asset presence |
| Bird species traits | Diet guild, diet proportions and ecological roles |

The supplied ALA bird query resolves to 427,596 observations and 212 named
under the supplied filters on 2026-08-29. The insect query resolves to 7,048
observations and 594 named species before ecological filtering.

## Shared cleaning

- Files are read as `utf-8-sig` and embedded BOM/whitespace is removed.
- Display names keep their source spelling; joins use case-insensitive,
  whitespace-normalised keys.
- Longitude/latitude must be numeric and inside WGS84 bounds.
- Spatial records must fall inside one of the 11 supported merged CLUE areas.
- Sets, not row counts, produce every field labelled `*_species_count`.
- ALA insect records are deduplicated by UUID, then occurrence ID, with a
  deterministic field tuple as a last fallback.

## Canopy coverage

Each canopy polygon is assigned using its supplied `Geo Point`. Polygon area
and suburb area are calculated in a local equirectangular plane suitable for
small Melbourne geometries. Coverage is:

`100 * allocated canopy polygon area / suburb polygon area`

This is an estimate because a canopy polygon crossing a suburb boundary is
allocated to the side containing its representative point rather than clipped.

## Plant species and flowering-plant filter

General plant diversity is the distinct union of urban-forest scientific names
and garden-bed botanical names for each suburb.

A plant enters `pollinator_flowering_plants.csv` only when:

1. the supplied insect/plant study has at least one row with `pol=1` on that
   vegetation species; and
2. the same scientific name is present in the tree or garden-bed inventory.

Here `pol=1` means the insect is labelled in the pollinator functional group.
It does not mean the row recorded a pollination event.

## Pollinator insect filter

1. Collect every insect family with at least one `pol=1` record in the supplied
   Melbourne study (34 families).
2. Query the user-supplied ALA insect scope for those families.
3. Page in blocks of 100 because ALA returned HTTP 503 for 1,000-5,000-record
   pages during the verified 2026-08-28 build.
4. Reject non-species ranks, invalid coordinates, duplicates and points outside
   supported areas.

The result is 1,442 accepted occurrence rows across 105 species. Family-level
evidence makes each taxon a **pollinator candidate**; it is not proof that every
included species pollinates. Each row states whether its evidence is an exact
local species label or a family-level candidate.

`main_pollinator_groups.csv` is independently ranked from local `pol=1` study
rows. The five most frequently observed groups are flies, ants, parasitoid
wasps, heteropteran bugs and bees.

## Bird feeding-guild filter

An ALA-observed bird is kept when the supplied trait table can safely match its
name and nectar or fruit is greater than zero:

- nectar -> `role_pollination`
- fruit -> `role_seed_dispersal`
- invertebrates -> `role_insect_food_web` (supporting detail only)

Exact accepted-name aliases are used automatically. Fuzzy matches are accepted
only from a manually checked allowlist; rejected suggestions are written to
`data_quality_report.json`. Diet certainty follows A, B, C, D1, D2 from strongest
to weakest; D1 is a species-level inference and D2 is a family-level inference.
All seven accepted fuzzy aliases were rechecked as exact Aves species through
ALA's name-matching API. The two rejected suggestions and all accepted mappings
are included in the quality report.

## Street-level Map View 1

The source package contains address points and street IDs, but no street
polygons. Street-level assets are therefore built as follows:

1. Clean addresses are spatially checked against the 11 CLUE Map View 1 areas.
2. Tree, canopy and garden-bed points are assigned to the nearest address point
   within 250 m in the same resolved suburb.
3. Assigned records are grouped by suburb plus source `street_id`.
4. Garden MGA easting/northing is converted as UTM/MGA zone 55 south; a unit
   test checks the conversion against a tree row containing both coordinate
   systems.
5. Because street polygons are unavailable, street output reports nearby
   canopy area, not a fabricated street canopy percentage.
6. When a user enters a location, birds and insects are queried from ALA using
   the same centre and radius (250 m by default).
7. Bird facets are intersected with `relevant_birds.csv`; insect facets are
   intersected with `pollinator_insect_taxa.csv`. The returned counts are
   distinct species and matching occurrence rows near the location.

The 250 m street-asset assignment and the runtime animal radius are separate
MVP parameters. Changing the animal radius does not rebuild or change street
tree, garden or canopy aggregates.

This is an input-detail extension of Map View 1 only. It does not implement
microclimate recommendations, planting eligibility or later map interactions.

## ALA query deviation

Both supplied links contain `qc=-*nest_parent*:*`. The current ALA occurrence
service returned HTTP 400 when that context was present. The pipeline retains
`qualityProfile=ALA`, omits the broken context, and applies explicit stable-ID
deduplication. This deviation is surfaced in the quality report.

The bird link also used the saved query `qid:1787916013758`. The pipeline uses
the equivalent explicit taxon query so a removed or expired saved query cannot
break future builds.
