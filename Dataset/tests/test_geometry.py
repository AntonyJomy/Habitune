"""Tests for suburb geometry and GeoJSON conversion helpers."""

import unittest

from habitune_data.geometry import (
    find_area,
    geometry_area_m2,
    geometry_to_wkt,
    point_in_geometry,
)


# A small synthetic polygon keeps geometry tests independent of raw data.
SQUARE = {
    "type": "MultiPolygon",
    "coordinates": [[[[144.0, -38.0], [145.0, -38.0], [145.0, -37.0], [144.0, -37.0], [144.0, -38.0]]]],
}


class GeometryTests(unittest.TestCase):
    """Check point, area and WKT operations used by the pipeline."""

    def test_point_inside_outside_and_boundary(self):
        """Boundary points count as inside the supported area."""

        self.assertTrue(point_in_geometry(144.5, -37.5, SQUARE))
        self.assertFalse(point_in_geometry(146.0, -37.5, SQUARE))
        self.assertTrue(point_in_geometry(144.0, -37.5, SQUARE))

    def test_find_area(self):
        """A point should resolve only to a containing feature."""

        features = [
            {"type": "Feature", "properties": {"suburb": "Test"}, "geometry": SQUARE}
        ]
        self.assertEqual(find_area(144.5, -37.5, features), "Test")
        self.assertIsNone(find_area(143.0, -37.5, features))

    def test_area_is_positive(self):
        """A valid polygon should produce a positive area."""

        self.assertGreater(geometry_area_m2(SQUARE), 9_000_000_000)

    def test_wkt_is_closed_multipolygon(self):
        """ALA spatial queries need closed multipolygon WKT."""

        wkt = geometry_to_wkt(SQUARE)
        self.assertTrue(wkt.startswith("MULTIPOLYGON"))
        self.assertIn("144.000000 -38.000000", wkt)


# Allow this test module to be run directly from VS Code.
if __name__ == "__main__":
    unittest.main()
