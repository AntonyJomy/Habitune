"""Minimal cached client for the Atlas of Living Australia occurrence API."""

from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterable

from .config import ALA_SEARCH_URL, QUALITY_PROFILE


class ALAError(RuntimeError):
    """Raised when ALA returns an unusable response."""


class ALAClient:
    """Fetch ALA occurrence data and keep a local response cache."""

    def __init__(
        self,
        cache_dir: Path,
        *,
        refresh: bool = False,
        offline: bool = False,
        timeout_seconds: int = 90,
    ) -> None:
        """Configure cache, network and timeout behaviour."""

        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.refresh = refresh
        self.offline = offline
        self.timeout_seconds = timeout_seconds

    @staticmethod
    def _parameters(
        *,
        q: str,
        filters: Iterable[str],
        facets: Iterable[str] = (),
        wkt: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        radius_km: float | None = None,
        page_size: int = 0,
        start: int = 0,
        fields: Iterable[str] = (),
    ) -> list[tuple[str, str]]:
        """Build the repeated query parameters expected by the ALA API."""

        # ALA accepts repeated fq and facets parameters rather than one list value.
        params: list[tuple[str, str]] = [
            ("q", q),
            ("qualityProfile", QUALITY_PROFILE),
        ]
        params.extend(("fq", value) for value in filters)
        if wkt:
            params.append(("wkt", wkt))
        spatial_values = (latitude, longitude, radius_km)
        if any(value is not None for value in spatial_values):
            if not all(value is not None for value in spatial_values):
                raise ValueError("latitude, longitude and radius_km must be supplied together")
            params.extend(
                (
                    ("lat", str(latitude)),
                    ("lon", str(longitude)),
                    ("radius", str(radius_km)),
                )
            )
        params.append(("pageSize", str(page_size)))
        if start:
            params.append(("start", str(start)))
        if fields:
            params.append(("fl", ",".join(fields)))
        for facet in facets:
            params.append(("facets", facet))
        if facets:
            params.extend((("flimit", "-1"), ("fsort", "index")))
        return params

    def _cache_path(self, params: list[tuple[str, str]]) -> Path:
        """Create a stable cache filename from the complete request."""

        # The full query hash prevents different filters sharing one cache file.
        canonical = urllib.parse.urlencode(params, doseq=True)
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:20]
        return self.cache_dir / f"search-{digest}.json"

    def search(self, **kwargs) -> dict:
        """Return a cached response or query ALA with retry handling."""

        params = self._parameters(**kwargs)
        cache_path = self._cache_path(params)
        # Reuse a successful response unless the caller requests a refresh.
        if cache_path.is_file() and not self.refresh:
            return json.loads(cache_path.read_text(encoding="utf-8"))
        if self.offline:
            raise ALAError(f"ALA cache miss in offline mode: {cache_path.name}")

        url = ALA_SEARCH_URL + "?" + urllib.parse.urlencode(params, doseq=True)
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "Habitune-Map-Data/0.1 (FIT5120 student project)",
            },
        )
        # Retry temporary network or response errors with short backoff delays.
        last_error: Exception | None = None
        for attempt in range(4):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                    payload = json.load(response)
                if payload.get("status") not in (None, "OK"):
                    raise ALAError(f"ALA status was {payload.get('status')!r}")
                temporary = cache_path.with_suffix(".tmp")
                temporary.write_text(
                    json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8",
                )
                temporary.replace(cache_path)
                return payload
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ALAError) as error:
                last_error = error
                if attempt < 3:
                    time.sleep(2**attempt)
        raise ALAError(f"ALA request failed after retries: {last_error}") from last_error


def facet_map(payload: dict, facet_name: str) -> dict[str, int]:
    """Return {facet label: occurrence count} from an ALA search response."""

    # Missing and unnamed facet values are not useful for species displays.
    for result in payload.get("facetResults", []):
        if result.get("fieldName") == facet_name:
            return {
                item["label"]: int(item["count"])
                for item in result.get("fieldResult", [])
                if item.get("label") and item.get("label") != "Not supplied"
            }
    return {}
