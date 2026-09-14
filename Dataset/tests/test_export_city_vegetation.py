"""Focused tests for the standalone City vegetation export."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "export_city_vegetation.py"
SPEC = importlib.util.spec_from_file_location("export_city_vegetation", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


FEATURES = [
    {
        "type": "Feature",
        "properties": {"suburb": "Test Area"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[144.9, -37.9], [145.0, -37.9], [145.0, -37.7], [144.9, -37.7], [144.9, -37.9]]],
        },
    }
]


class CityVegetationExportTests(unittest.TestCase):
    def test_trees_are_spatially_filtered_and_deduplicated_by_com_id(self):
        rows = [
            {"com_id": "1", "longitude": "144.95", "latitude": "-37.8"},
            {"com_id": "1", "longitude": "144.95", "latitude": "-37.8"},
            {"com_id": "2", "longitude": "145.2", "latitude": "-37.8"},
            {"com_id": "3", "longitude": "bad", "latitude": "-37.8"},
        ]
        records, report = MODULE.process_trees(rows, FEATURES, "2026-01-01T00:00:00+00:00")
        self.assertEqual([record["com_id"] for record in records], ["1"])
        self.assertEqual(report["deduplicated_com_id_rows"], 1)
        self.assertEqual(report["rejected_outside_project_area"], 1)
        self.assertEqual(report["rejected_invalid_coordinates"], 1)

    def test_garden_inventory_inherits_asset_coordinates_without_losing_species(self):
        coordinate_row = {
            "objectid": "10", "asset_id": "A", "x_coord": "320000", "y_coord": "5815000",
            "botanical_name": "", "area_m2": "12",
        }
        plant_row = {
            "objectid": "10", "asset_id": "A", "x_coord": "", "y_coord": "",
            "botanical_name": "Plant species", "area_m2": "12",
        }
        longitude, latitude = MODULE.utm55s_to_wgs84(320000, 5815000)
        feature = [{**FEATURES[0], "geometry": {"type": "Polygon", "coordinates": [[[longitude - .01, latitude - .01], [longitude + .01, latitude - .01], [longitude + .01, latitude + .01], [longitude - .01, latitude + .01], [longitude - .01, latitude - .01]]]}}]
        inventory, assets, report = MODULE.process_gardens(
            [coordinate_row, plant_row, plant_row], feature, "2026-01-01T00:00:00+00:00"
        )
        self.assertEqual(len(assets), 1)
        self.assertEqual(len(inventory), 2)
        self.assertEqual(assets[0]["botanical_names"], ["Plant species"])
        self.assertEqual(inventory[1]["resolved_longitude"], round(longitude, 8))
        self.assertEqual(report["deduplicated_exact_inventory_rows"], 1)


if __name__ == "__main__":
    unittest.main()
