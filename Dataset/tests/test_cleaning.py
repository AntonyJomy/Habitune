"""Tests for shared cleaning and ecological filter helpers."""

import csv
import tempfile
import unittest
from pathlib import Path

from habitune_data.cleaning import (
    CERTAINTY_ORDER,
    _bird_trait,
    family_filter,
    load_bird_traits,
    name_key,
)


class CleaningTests(unittest.TestCase):
    """Check name matching and safe ecological filters."""

    def test_name_key_normalizes_spacing_and_case(self):
        """Join keys should ignore extra spaces and letter case."""

        self.assertEqual(name_key("  Apis   mellifera "), "apis mellifera")

    def test_family_filter_rejects_unsafe_values(self):
        """Unsafe family text must not enter the ALA filter."""

        result = family_filter(["Apidae", "Syrphidae", 'bad" OR *:*'])
        self.assertEqual(result, "family:(Apidae OR Syrphidae)")

    def test_bird_higher_match_does_not_become_alias(self):
        """Higher-rank ALA matches must not replace a species name."""

        headers = [
            "Supplied Name",
            "English",
            "Diet-_Invertebrates",
            "Diet-_Nectar",
            "Diet-_Fruit",
            "Diet-_Seed",
            "Diet-5_Cat",
            "Diet-_Certainty",
            "class",
            "matchType",
            "scientificName",
        ]
        rows = [
            {
                "Supplied Name": "Old bird",
                "English": "Example",
                "Diet-_Invertebrates": "10",
                "Diet-_Nectar": "0",
                "Diet-_Fruit": "0",
                "Diet-_Seed": "0",
                "Diet-5_Cat": "Invertebrate",
                "Diet-_Certainty": "A",
                "class": "Aves",
                "matchType": "higherMatch",
                "scientificName": "Wrong genus",
            }
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "traits.csv"
            with path.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            aliases, _ = load_bird_traits(path)
        self.assertIn("old bird", aliases)
        self.assertNotIn("wrong genus", aliases)

    def test_invertebrate_only_bird_is_not_iteration_one_relevant(self):
        """Insect diet is supporting detail, not an Iteration 1 entry rule."""

        trait = _bird_trait(
            {
                "Supplied Name": "Example bird",
                "Diet-_Invertebrates": "100",
                "Diet-_Nectar": "0",
                "Diet-_Fruit": "0",
                "Diet-_Seed": "0",
            }
        )
        self.assertTrue(trait["roles"]["insect_food_web"])
        self.assertFalse(trait["relevant"])

    def test_certainty_order_runs_from_direct_to_family_inference(self):
        """Diet certainty should prefer A over B/C/D1/D2."""

        self.assertEqual(
            sorted(CERTAINTY_ORDER, key=CERTAINTY_ORDER.get),
            ["A", "B", "C", "D1", "D2"],
        )


# Allow this test module to be run directly from VS Code.
if __name__ == "__main__":
    unittest.main()
