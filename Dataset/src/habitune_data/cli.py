"""Command-line interface used in VS Code terminals and CI."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .lookup import enrich_location_animals, map_view
from .pipeline import build
from .validation import validate_outputs


def _parser() -> argparse.ArgumentParser:
    """Define build, lookup and validation commands."""

    # The same CLI is used locally in VS Code and by automated checks.
    parser = argparse.ArgumentParser(description="Habitune Map View 1 data tools")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="data project root (default: current directory)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Build refreshes processed files; lookup reads them; validate checks them.
    build_parser = subparsers.add_parser("build", help="clean sources and rebuild outputs")
    build_parser.add_argument("--refresh-api", action="store_true", help="ignore cached ALA data")
    build_parser.add_argument("--offline", action="store_true", help="require existing ALA cache")
    build_parser.add_argument("--workers", type=int, default=3, help="parallel ALA area queries")

    lookup_parser = subparsers.add_parser("lookup", help="resolve an address or 'lat,lon'")
    lookup_parser.add_argument("query", nargs="?", default="", help="blank gives suburb overview")
    lookup_parser.add_argument("--latitude", type=float, help="WGS84 latitude")
    lookup_parser.add_argument("--longitude", type=float, help="WGS84 longitude")
    lookup_parser.add_argument(
        "--radius-m", type=int, default=250, help="ALA animal search radius (default: 250 m)"
    )
    lookup_parser.add_argument(
        "--offline", action="store_true", help="require cached nearby-animal queries"
    )

    subparsers.add_parser("validate", help="validate processed outputs without network")
    return parser


def main(argv: list[str] | None = None) -> int:
    """Run the selected command and return a process exit code."""

    args = _parser().parse_args(argv)
    root = args.root.resolve()
    # Dispatch to one command and return a shell-friendly exit code.
    if args.command == "build":
        print("Building local council metrics and ALA aggregates...", flush=True)
        result = build(
            root,
            refresh_api=args.refresh_api,
            offline=args.offline,
            workers=max(1, args.workers),
        )
        print(json.dumps(result["city_summary"], ensure_ascii=False, indent=2))
        return 0
    if args.command == "lookup":
        if (args.latitude is None) != (args.longitude is None):
            raise SystemExit("--latitude and --longitude must be provided together")
        query = (
            f"{args.latitude},{args.longitude}"
            if args.latitude is not None
            else args.query
        )
        result = map_view(query, root / "processed")
        if result.get("mode") == "street_level":
            result = enrich_location_animals(
                result,
                root,
                radius_m=max(50, args.radius_m),
                offline=args.offline,
            )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if args.command == "validate":
        errors = validate_outputs(root / "processed")
        if errors:
            print("Validation failed:\n- " + "\n- ".join(errors))
            return 1
        print("Validation passed.")
        return 0
    return 2
