"""Run the Habitune data command line interface with `python -m`."""

from .cli import main


# Forward `python -m habitune_data` to the shared CLI entry point.
if __name__ == "__main__":
    raise SystemExit(main())
