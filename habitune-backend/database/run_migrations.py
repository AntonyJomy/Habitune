#!/usr/bin/env python3
"""Apply pending SQL migrations deterministically and transactionally."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

from shared.db import get_connection


MIGRATIONS_PATH = Path(__file__).resolve().parent / "migrations"
CREATE_HISTORY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_name TEXT PRIMARY KEY,
    checksum_sha256 TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""
LIST_APPLIED_SQL = "SELECT migration_name, checksum_sha256 FROM schema_migrations"
RECORD_MIGRATION_SQL = """
INSERT INTO schema_migrations (migration_name, checksum_sha256)
VALUES (%s, %s)
"""


class MigrationError(RuntimeError):
    """Raised when migration history is unsafe or a migration cannot be applied."""


def discover_migrations(migrations_path=MIGRATIONS_PATH):
    path = Path(migrations_path)
    migrations = sorted(path.glob("[0-9][0-9][0-9]_*.sql"), key=lambda item: item.name)
    names = [migration.name for migration in migrations]
    if names != sorted(set(names)):
        raise MigrationError("Migration filenames must be unique and deterministically ordered")
    return migrations


def _read_migration(path):
    try:
        content = path.read_bytes()
    except OSError as exc:
        raise MigrationError(f"Unable to read migration {path.name}") from exc
    return content.decode("utf-8"), hashlib.sha256(content).hexdigest()


def run_pending_migrations(connection, migrations_path=MIGRATIONS_PATH):
    """Apply pending migrations on one caller-owned transaction/connection."""
    applied_now = []
    try:
        with connection.cursor() as cursor:
            cursor.execute(CREATE_HISTORY_TABLE_SQL)
            cursor.execute(LIST_APPLIED_SQL)
            applied = dict(cursor.fetchall())
            for migration in discover_migrations(migrations_path):
                sql, checksum = _read_migration(migration)
                previous_checksum = applied.get(migration.name)
                if previous_checksum:
                    if previous_checksum != checksum:
                        raise MigrationError(f"Applied migration checksum changed: {migration.name}")
                    continue
                cursor.execute(sql)
                cursor.execute(RECORD_MIGRATION_SQL, (migration.name, checksum))
                applied_now.append(migration.name)
        return applied_now
    except Exception:
        connection.rollback()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--migrations", type=Path, default=MIGRATIONS_PATH)
    arguments = parser.parse_args()
    connection = get_connection()
    try:
        applied = run_pending_migrations(connection, arguments.migrations)
        connection.commit()
        print(f"Applied {len(applied)} migration(s): {', '.join(applied) or 'none'}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
