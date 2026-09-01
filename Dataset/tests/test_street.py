"""Tests for street-scale distance and coordinate conversion."""

import unittest

from habitune_data.street import distance_m, utm55s_to_wgs84


class StreetGeometryTests(unittest.TestCase):
    """Check spatial helpers used for street asset assignment."""

    def test_utm55s_conversion_matches_supplied_tree_coordinate(self):
        """MGA zone 55 conversion should match a supplied WGS84 point."""

        # Row 1 of the supplied tree file contains both coordinate systems.
        lon, lat = utm55s_to_wgs84(321125.06, 5813877.14)
        self.assertAlmostEqual(lon, 144.968114, places=5)
        self.assertAlmostEqual(lat, -37.80498629, places=5)

    def test_local_distance(self):
        """Local distance should be zero for identical coordinates."""

        self.assertAlmostEqual(
            distance_m(144.968114, -37.804986, 144.968114, -37.804986),
            0.0,
        )
        self.assertGreater(
            distance_m(144.968114, -37.804986, 144.969114, -37.804986),
            80.0,
        )


# Allow this test module to be run directly from VS Code.
if __name__ == "__main__":
    unittest.main()
