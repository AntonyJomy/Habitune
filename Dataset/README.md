## Delivered View 1 metrics

The current verified build covers 11 merged CLUE areas and reports:

- City canopy coverage estimate: **11.50%**
- Plant species: **1,757**
- Pollinator-linked flowering plants present in council assets: **64**
- Evidence-filtered, species-rank pollinator insect candidates: **105**
- Nectar/fruit diet-filtered bird species: **66**

These are occurrence/inventory-derived indicators. In particular, ALA records
are sightings, not habitat polygons or population estimates.

## Run in VS Code

Open this `Dataset` folder in VS Code and use its integrated terminal:

```bash
PYTHONPATH=src python3 -m habitune_data --root . build
PYTHONPATH=src python3 -m habitune_data --root . validate
```

The first build calls ALA and writes reusable responses under `cache/ala/`.
After that, a deterministic no-network rebuild is available:

```bash
PYTHONPATH=src python3 -m habitune_data --root . build --offline
```

No third-party Python package is required. Python 3.11 or later is expected.

## Map View 1 location behavior

No input returns the city summary and every suburb:

```bash
PYTHONPATH=src python3 -m habitune_data --root . lookup
```

An address or coordinate resolves to a street. The response contains street-level
trees, plant species, pollinator-linked flowering plants and nearby canopy area. Birds
and pollinator-insect candidates are queried from ALA around the resolved location
using the same radius. The parent suburb is retained only as context:

```bash
PYTHONPATH=src python3 -m habitune_data --root . lookup "2 Marmion Place Docklands"
PYTHONPATH=src python3 -m habitune_data --root . lookup --latitude -37.80499 --longitude 144.96811
```

The lookup uses a 250 m animal radius by default. Use `--radius-m 500` to change
it or `--offline` to require cached bird and insect results. Backend code can
import `habitune_data.lookup.map_view` and `enrich_location_animals` directly.
The bird request uses the explicit `taxa:"Birds"` query rather than depending
on the lifetime of the saved ALA `qid` from the supplied link.

## Outputs for frontend/backend

- `processed/map_view1.json` - primary JSON contract and city/suburb metrics
- `processed/map_view1_suburbs.geojson` - map polygons with the same metrics
- `processed/map_view1_suburbs.csv` - analyst-friendly metrics table
- `processed/address_lookup.csv` - cleaned address-to-suburb lookup
- `processed/street_level.json` - street tree, plant and nearby-canopy metrics
- `processed/street_level.csv` - flattened street metrics for database import
- `processed/pollinator_insect_taxa.csv` - filtered ALA insect taxa
- `processed/pollinator_flowering_plants.csv` - plants linked to insects labelled `pol=1`
- `processed/relevant_birds.csv` - diet fields, habitat-function tags and counts
- `processed/data_quality_report.json` - accepted/rejected counts and limitations

Detailed rules are in [filtering_methodology.md](docs/filtering_methodology.md),
field definitions in [data_dictionary.md](docs/data_dictionary.md), and the
backend response shape in [map_view1_contract.md](docs/map_view1_contract.md).

## Tests

```bash
PYTHONPATH=src python3 -m unittest discover -s tests -v
```
