"""Integration tests for generated files and location lookup."""

import csv
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from habitune_data.lookup import enrich_location_animals, map_view
from habitune_data.config import BIRD_QUERY
from habitune_data.validation import validate_outputs


# Integration tests read the processed files checked into this project.
ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "processed"


class OutputIntegrationTests(unittest.TestCase):
    """Check the processed contract used by frontend and backend code."""

    def test_processed_outputs_validate(self):
        """The checked-in processed files should pass validation."""

        self.assertEqual(validate_outputs(PROCESSED), [])

    def test_no_input_returns_suburb_overview(self):
        """Blank input should return all supported suburbs."""

        result = map_view("", PROCESSED)
        self.assertEqual(result["mode"], "suburb_overview")
        self.assertEqual(len(result["suburbs"]), 11)

    def test_coordinate_resolves_carlton(self):
        """A known coordinate should return Carlton street data."""

        result = map_view("-37.80499,144.96811", PROCESSED)
        self.assertEqual(result["resolved_suburb"], "Carlton")
        self.assertEqual(result["mode"], "street_level")
        self.assertGreater(result["street_data"]["planted_tree_count"], 0)

    def test_address_resolves_docklands(self):
        """A known address should return the matching Docklands street."""

        result = map_view("2 Marmion Place Docklands", PROCESSED)
        self.assertEqual(result["resolved_suburb"], "Docklands")
        self.assertEqual(result["resolved_street"]["street_name"], "Marmion Place")
        animals = result["street_data"]["animals_near_location"]
        self.assertEqual(animals["label"], "Animals near your location")
        self.assertEqual(animals["birds"]["status"], "live_ala_query_required")
        self.assertEqual(
            animals["pollinator_insects"]["status"], "live_ala_query_required"
        )

    def test_border_coordinate_keeps_street_in_resolved_suburb(self):
        """A border point must not borrow a street from the next suburb."""

        result = map_view("-37.796094,144.950876", PROCESSED)
        self.assertEqual(result["resolved_suburb"], "Parkville")
        self.assertEqual(result["street_data"]["suburb"], "Parkville")

    def test_sample_coordinates_keep_expected_suburbs(self):
        """Samples from three areas should keep polygon and street labels aligned."""

        samples = {
            "Carlton": "-37.80499,144.96811",
            "Parkville": "-37.796094,144.950876",
            "South Yarra": "-37.8386,144.9864",
        }
        for expected, query in samples.items():
            with self.subTest(suburb=expected):
                result = map_view(query, PROCESSED)
                self.assertEqual(result["resolved_suburb"], expected)
                self.assertEqual(result["street_data"]["suburb"], expected)

    def test_ambiguous_text_returns_candidates(self):
        """A short text match should not silently choose the first address."""

        result = map_view("King", PROCESSED)
        self.assertEqual(result["mode"], "address_candidates")
        self.assertGreater(len(result["address_candidates"]), 1)

    def test_birds_require_nectar_or_fruit(self):
        """No final bird row should enter through invertebrate diet alone."""

        with (PROCESSED / "relevant_birds.csv").open(
            encoding="utf-8", newline=""
        ) as stream:
            rows = list(csv.DictReader(stream))
        self.assertTrue(rows)
        self.assertTrue(
            all(
                row["role_pollination"] == "True"
                or row["role_seed_dispersal"] == "True"
                for row in rows
            )
        )

    def test_bird_query_does_not_depend_on_saved_qid(self):
        """The build should use a readable taxon query that cannot expire as a qid."""

        self.assertEqual(BIRD_QUERY, 'taxa:"Birds"')

    def test_fuzzy_alias_audit_is_written(self):
        """The quality report should show every manually reviewed fuzzy row."""

        report = json.loads(
            (PROCESSED / "data_quality_report.json").read_text(encoding="utf-8")
        )["local_sources"]["bird_traits"]
        self.assertEqual(report["fuzzy_match_rows"], 9)
        self.assertEqual(report["accepted_manual_fuzzy_alias_rows"], 7)
        self.assertEqual(len(report["accepted_manual_fuzzy_aliases"]), 7)
        self.assertEqual(report["rejected_unverified_fuzzy_alias_rows"], 2)

    def test_street_output_has_no_static_animal_fields(self):
        """Animal results belong to the runtime location response, not street assets."""

        streets = json.loads(
            (PROCESSED / "street_level.json").read_text(encoding="utf-8")
        )["streets"]
        for street in streets:
            with self.subTest(street=street["street_key"]):
                self.assertFalse(
                    any(key.startswith("pollinator_insect_") for key in street)
                )

    def test_nearby_animals_share_the_same_centre_and_radius(self):
        """Bird and insect queries should use one location and one search radius."""

        bird_payload = {
            "totalRecords": 7,
            "facetResults": [
                {
                    "fieldName": "species",
                    "fieldResult": [
                        {"label": "Acanthiza pusilla", "count": 3},
                        {"label": "Unmatched bird", "count": 4},
                    ],
                }
            ],
        }
        insect_payload = {
            "totalRecords": 5,
            "facetResults": [
                {
                    "fieldName": "species",
                    "fieldResult": [
                        {"label": "Apis mellifera", "count": 2},
                        {"label": "Unmatched insect", "count": 3},
                    ],
                }
            ],
        }
        result = map_view("34 Queensberry Street Carlton", PROCESSED)
        with patch(
            "habitune_data.lookup.ALAClient.search",
            side_effect=[bird_payload, insect_payload],
        ) as search:
            enrich_location_animals(result, ROOT, radius_m=300)

        animals = result["street_data"]["animals_near_location"]
        self.assertEqual(animals["label"], "Animals near your location")
        self.assertEqual(animals["radius_m"], 300)
        self.assertEqual(animals["birds"]["species_count"], 1)
        self.assertEqual(animals["pollinator_insects"]["species_count"], 1)
        self.assertEqual(search.call_count, 2)
        for call in search.call_args_list:
            self.assertEqual(call.kwargs["latitude"], animals["centre"]["latitude"])
            self.assertEqual(call.kwargs["longitude"], animals["centre"]["longitude"])
            self.assertEqual(call.kwargs["radius_km"], 0.3)


# Allow this test module to be run directly from VS Code.
if __name__ == "__main__":
    unittest.main()
