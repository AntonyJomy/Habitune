"""Central configuration and source contracts.

All paths are resolved relative to the data project root. Keeping source names
in one module makes schema drift visible during code review.
"""

from __future__ import annotations

from pathlib import Path


ALA_SEARCH_URL = "https://biocache-ws.ala.org.au/ws/occurrences/search"

# Use an explicit taxon query instead of the supplied saved-query ID. Both
# returned 427,596 records with these filters on 2026-08-29, while the explicit
# form remains readable and does not depend on the lifetime of an ALA qid.
BIRD_QUERY = 'taxa:"Birds"'
BIRD_FILTERS = (
    'species_group:"Birds"',
    'occurrence_decade_i:"2020"',
    'state:"Victoria"',
    'cl959:"Melbourne (C)"',
)

INSECT_QUERY = 'taxa:"Insects"'
INSECT_FILTERS = (
    'occurrence_decade_i:"2020"',
    'cl959:"Melbourne (C)"',
)

# The supplied qc=-*nest_parent*:* context currently returns HTTP 400 from
# ALA. The pipeline therefore applies deterministic identifier deduplication
# after download and records this deviation in the quality report.
QUALITY_PROFILE = "ALA"

# Keep the seven expected source filenames together so missing inputs fail early.
SOURCE_FILES = {
    "insect_plant_study": "The Little Things that Run the City v1 rhapsodyingreen.csv",
    "addresses": "street-addresses.csv",
    "canopies": "tree-canopies-2019.csv",
    "trees": "trees-with-species-and-dimensions-urban-forest.csv",
    "boundaries": "small-areas-for-census-of-land-use-and-employment-clue.csv",
    "garden_beds": "renewals-for-nature-city-of-melbourne-garden-bed-inventory-2024.csv",
    "bird_traits": "species-list-6a0a60879edbb26fbb3cac18.csv",
}


def project_paths(root: Path) -> dict[str, Path]:
    """Return all project paths and fail early when an input is missing."""

    # Resolve every path from the project root instead of the current shell folder.
    root = root.resolve()
    raw = root / "raw"
    paths = {
        "root": root,
        "raw": raw,
        "processed": root / "processed",
        "cache": root / "cache" / "ala",
    }
    for key, filename in SOURCE_FILES.items():
        paths[key] = raw / filename
    missing = [str(paths[key]) for key in SOURCE_FILES if not paths[key].is_file()]
    if missing:
        raise FileNotFoundError("Missing required source files:\n- " + "\n- ".join(missing))
    return paths
