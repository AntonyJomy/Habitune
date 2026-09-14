"""Validation and limits shared by vegetation viewport endpoints."""

from dataclasses import dataclass
import math


VEGETATION_RESULT_LIMIT = 5000


@dataclass(frozen=True)
class VegetationBounds:
    west: float
    south: float
    east: float
    north: float

    @property
    def parameters(self):
        return (self.west, self.south, self.east, self.north)


def parse_vegetation_bounds(parameters):
    """Parse a required WGS84 bbox from API Gateway query parameters."""
    parameters = parameters or {}
    values = {}
    for name, minimum, maximum in (
        ("west", -180, 180),
        ("east", -180, 180),
        ("south", -90, 90),
        ("north", -90, 90),
    ):
        raw_value = parameters.get(name)
        if raw_value is None or raw_value == "":
            raise ValueError("west, east, south and north bbox parameters are required")
        try:
            value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{name} must be a number") from exc
        if not math.isfinite(value) or not minimum <= value <= maximum:
            raise ValueError(f"{name} is outside the valid coordinate range")
        values[name] = value

    if values["west"] >= values["east"]:
        raise ValueError("west must be less than east")
    if values["south"] >= values["north"]:
        raise ValueError("south must be less than north")
    return VegetationBounds(**values)
