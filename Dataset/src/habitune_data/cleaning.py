"""Cleaning and ecological filter rules shared by the build pipeline."""

from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from pathlib import Path


def clean_text(value: object) -> str:
    """Return a trimmed, BOM-free string with repeated whitespace collapsed."""

    return " ".join(str(value or "").replace("\ufeff", "").strip().split())


def name_key(value: object) -> str:
    """Case-insensitive key used only for joins; display names are preserved."""

    return clean_text(value).replace("×", "x").casefold()


def number(value: object) -> float | None:
    """Parse a numeric input, returning None for missing or malformed values."""

    try:
        result = float(clean_text(value))
    except (TypeError, ValueError):
        return None
    return result


def valid_lon_lat(lon: float | None, lat: float | None) -> bool:
    """Return whether both values form a valid WGS84 longitude/latitude pair."""

    return lon is not None and lat is not None and -180 <= lon <= 180 and -90 <= lat <= 90


def load_pollinator_evidence(path: Path) -> dict:
    """Summarise insects labelled as the pollinator functional group.

    Candidate ALA insects are restricted to families that contain at least one
    ``pol=1`` record in the supplied Melbourne study. The label describes the
    insect's functional group; it is not a field observation of pollination.
    """

    # Keep separate totals for insect groups, families, plants and exact species.
    group_counts: dict[str, Counter] = defaultdict(Counter)
    family_counts: dict[str, Counter] = defaultdict(Counter)
    plant_positive_records: Counter = Counter()
    positive_species: set[str] = set()
    rows = 0
    invalid_pollinator_flag = 0

    # Only pol=0 and pol=1 are valid study labels; other values are reported.
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            rows += 1
            flag = clean_text(row.get("pol"))
            if flag not in {"0", "1"}:
                invalid_pollinator_flag += 1
                continue
            is_positive = flag == "1"
            group = clean_text(row.get("buggroup")) or "Unclassified"
            family = clean_text(row.get("family"))
            group_counts[group]["all"] += 1
            group_counts[group]["positive"] += int(is_positive)
            if family:
                family_counts[family]["all"] += 1
                family_counts[family]["positive"] += int(is_positive)
            if not is_positive:
                continue
            plant = clean_text(row.get("vegspecies"))
            if plant:
                plant_positive_records[plant] += 1
            species = clean_text(row.get("species"))
            if species:
                positive_species.add(species)

    # Keep groups and families only when the study contains positive evidence.
    groups = []
    for group, counts in group_counts.items():
        positive = counts["positive"]
        if not positive:
            continue
        groups.append(
            {
                "group": group,
                "pollinator_classified_record_count": positive,
                "all_study_record_count": counts["all"],
                "pollinator_share": round(positive / counts["all"], 4),
            }
        )
    groups.sort(
        key=lambda item: (-item["pollinator_classified_record_count"], item["group"])
    )

    families = sorted(
        family for family, counts in family_counts.items() if counts["positive"] > 0
    )
    return {
        "rows": rows,
        "invalid_pollinator_flag": invalid_pollinator_flag,
        "candidate_families": families,
        "main_groups": groups,
        "positive_species": positive_species,
        "plant_positive_records": plant_positive_records,
    }


CERTAINTY_ORDER = {"A": 0, "B": 1, "C": 2, "D1": 3, "D2": 4}
CERTAINTY_DEFINITION = {
    "A": "high certainty",
    "B": "reasonably certain",
    "C": "uncertain",
    "D1": "inferred from a congeneric or ecologically similar species",
    "D2": "inferred from the family",
}

# These fuzzy rows were checked manually. The values are species-level ALA
# names; two unsafe fuzzy rows in the source file are deliberately not listed.
VERIFIED_FUZZY_BIRD_ALIASES = {
    "calyptorhynchus funereus": "Zanda funerea",
    "catharacta antarctica": "Stercorarius antarcticus",
    "phalacrocorax melanoleucos": "Microcarbo melanoleucos",
    "threskiornis molucca": "Threskiornis moluccus",
    "thalassarche melanophrys": "Thalassarche melanophris",
    "chthonicola sagittatus": "Pyrrholaemus sagittatus",
    "arses telescophthalmus": "Arses telescopthalmus",
}


def _bird_trait(row: dict) -> dict:
    """Convert one bird trait row into diet roles used by Map View 1."""

    # Diet percentages are converted into the three habitat roles used by the map.
    diet = {
        "invertebrates": number(row.get("Diet-_Invertebrates")) or 0.0,
        "nectar": number(row.get("Diet-_Nectar")) or 0.0,
        "fruit": number(row.get("Diet-_Fruit")) or 0.0,
        "seed": number(row.get("Diet-_Seed")) or 0.0,
    }
    roles = {
        "pollination": diet["nectar"] > 0,
        "seed_dispersal": diet["fruit"] > 0,
        "insect_food_web": diet["invertebrates"] > 0,
    }
    return {
        "trait_scientific_name": clean_text(row.get("Supplied Name")),
        "common_name": clean_text(row.get("English")),
        "feeding_guild": clean_text(row.get("Diet-5_Cat")),
        "diet_percent": diet,
        "roles": roles,
        # Iteration 1 is limited to pollination and seed dispersal. The insect
        # food-web flag stays available as supporting detail only.
        "relevant": roles["pollination"] or roles["seed_dispersal"],
        "certainty": clean_text(row.get("Diet-_Certainty")),
    }


def load_bird_traits(path: Path) -> tuple[dict[str, dict], dict]:
    """Build aliases for original and accepted bird names.

    Exact accepted names are used automatically. Fuzzy accepted names are used
    only when they appear in the manually checked allowlist above.
    """

    # Alias supplied and accepted species names so they can match ALA results.
    aliases: dict[str, dict] = {}
    rows = 0
    accepted_aliases = 0
    fuzzy_rows = 0
    accepted_fuzzy_aliases = 0
    accepted_fuzzy_alias_details = []
    rejected_fuzzy_aliases = []
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            rows += 1
            trait = _bird_trait(row)
            supplied_key = name_key(row.get("Supplied Name"))
            if supplied_key:
                aliases.setdefault(
                    supplied_key,
                    {**trait, "trait_match_basis": "supplied_name"},
                )

            if clean_text(row.get("class")) != "Aves":
                continue
            match_type = clean_text(row.get("matchType"))
            accepted_name = clean_text(row.get("scientificName"))
            match_basis = "exact_accepted_name"
            if match_type == "fuzzyMatch":
                fuzzy_rows += 1
                accepted_name = VERIFIED_FUZZY_BIRD_ALIASES.get(supplied_key, "")
                match_basis = "manually_verified_fuzzy_name"
                if not accepted_name:
                    rejected_fuzzy_aliases.append(
                        {
                            "supplied_name": trait["trait_scientific_name"],
                            "suggested_name": clean_text(row.get("scientificName")),
                        }
                    )
                    continue
                accepted_fuzzy_aliases += 1
                accepted_fuzzy_alias_details.append(
                    {
                        "supplied_name": trait["trait_scientific_name"],
                        "source_suggestion": clean_text(row.get("scientificName")),
                        "accepted_species_name": accepted_name,
                    }
                )
            elif match_type != "exactMatch":
                continue
            if not accepted_name:
                continue
            accepted_key = name_key(accepted_name)
            alias_trait = {**trait, "trait_match_basis": match_basis}
            existing = aliases.get(accepted_key)
            if existing is None or CERTAINTY_ORDER.get(trait["certainty"], 99) < CERTAINTY_ORDER.get(
                existing["certainty"], 99
            ):
                aliases[accepted_key] = alias_trait
            accepted_aliases += 1
    return aliases, {
        "rows": rows,
        "accepted_name_alias_rows": accepted_aliases,
        "fuzzy_match_rows": fuzzy_rows,
        "accepted_manual_fuzzy_alias_rows": accepted_fuzzy_aliases,
        "accepted_manual_fuzzy_aliases": accepted_fuzzy_alias_details,
        "rejected_unverified_fuzzy_alias_rows": len(rejected_fuzzy_aliases),
        "rejected_unverified_fuzzy_aliases": rejected_fuzzy_aliases,
    }


def family_filter(families: list[str]) -> str:
    """Create a Lucene filter accepted by ALA for evidence-backed families."""

    # Allow plain taxonomic family names only before building the Lucene query.
    safe = [family for family in families if re.fullmatch(r"[A-Za-z-]+", family)]
    if not safe:
        raise ValueError("No valid pollinator families were found")
    return "family:(" + " OR ".join(safe) + ")"
