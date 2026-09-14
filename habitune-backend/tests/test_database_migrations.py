from pathlib import Path
from unittest.mock import MagicMock

import pytest

from database.run_migrations import (
    CREATE_HISTORY_TABLE_SQL,
    MigrationError,
    RECORD_MIGRATION_SQL,
    discover_migrations,
    run_pending_migrations,
)


def _connection(applied=()):
    connection = MagicMock()
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = list(applied)
    return connection, cursor


def test_discovers_migrations_in_deterministic_order(tmp_path):
    (tmp_path / "010_later.sql").write_text("SELECT 10;", encoding="utf-8")
    (tmp_path / "002_earlier.sql").write_text("SELECT 2;", encoding="utf-8")
    assert [item.name for item in discover_migrations(tmp_path)] == ["002_earlier.sql", "010_later.sql"]


def test_creates_history_runs_pending_and_records_success(tmp_path):
    migration = tmp_path / "001_test.sql"
    migration.write_text("CREATE TABLE safe_test (id INTEGER);", encoding="utf-8")
    connection, cursor = _connection()
    assert run_pending_migrations(connection, tmp_path) == ["001_test.sql"]
    assert cursor.execute.call_args_list[0].args == (CREATE_HISTORY_TABLE_SQL,)
    assert any(call.args == ("CREATE TABLE safe_test (id INTEGER);",) for call in cursor.execute.call_args_list)
    assert any(call.args[0] == RECORD_MIGRATION_SQL and call.args[1][0] == "001_test.sql" for call in cursor.execute.call_args_list)
    connection.rollback.assert_not_called()


def test_skips_completed_migration_with_matching_checksum(tmp_path):
    import hashlib

    migration = tmp_path / "001_test.sql"
    migration.write_text("SELECT 1;", encoding="utf-8")
    checksum = hashlib.sha256(migration.read_bytes()).hexdigest()
    connection, cursor = _connection(((migration.name, checksum),))
    assert run_pending_migrations(connection, tmp_path) == []
    assert not any(call.args == ("SELECT 1;",) for call in cursor.execute.call_args_list)


def test_rejects_changed_applied_migration_and_rolls_back(tmp_path):
    migration = tmp_path / "001_test.sql"
    migration.write_text("SELECT 2;", encoding="utf-8")
    connection, _cursor = _connection(((migration.name, "old-checksum"),))
    with pytest.raises(MigrationError, match="checksum changed"):
        run_pending_migrations(connection, tmp_path)
    connection.rollback.assert_called_once_with()


def test_rolls_back_failed_migration(tmp_path):
    (tmp_path / "001_test.sql").write_text("BROKEN SQL;", encoding="utf-8")
    connection, cursor = _connection()
    cursor.execute.side_effect = [None, None, RuntimeError("migration failed")]
    with pytest.raises(RuntimeError, match="migration failed"):
        run_pending_migrations(connection, tmp_path)
    connection.rollback.assert_called_once_with()
