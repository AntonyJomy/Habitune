import json
import logging
from unittest.mock import MagicMock, mock_open, patch

import pytest

from functions.init_database import handler
from shared import db


def test_invocation_guard_prevents_initialization():
    with patch.object(handler, "load_and_validate") as validate:
        response = handler.lambda_handler({}, None)

    assert response["status"] == "refused"
    validate.assert_not_called()


def test_success_executes_schema_ingestion_verification_and_commit():
    rows = [{"metric": {"precinct_id": "carlton"}, "geometry": {}}]
    connection = MagicMock()
    schema_cursor = connection.cursor.return_value.__enter__.return_value

    with (
        patch.object(handler, "load_and_validate", return_value=rows),
        patch.object(handler, "_read_schema", return_value="CREATE TABLE safe_test ();"),
        patch.object(handler, "get_connection", return_value=connection),
        patch.object(handler, "import_rows_with_connection") as ingest,
        patch.object(
            handler,
            "_verify",
            return_value={
                "precinct_count": 10,
                "metric_count": 10,
                "relationship_errors": 0,
                "geometry_errors": 0,
                "score_errors": 0,
                "corridor_errors": 0,
            },
        ) as verify,
    ):
        response = handler.lambda_handler(
            {handler.CONFIRMATION_FIELD: handler.CONFIRMATION_VALUE}, None
        )

    assert response["status"] == "initialized"
    schema_cursor.execute.assert_called_once_with("CREATE TABLE safe_test ();")
    ingest.assert_called_once_with(rows, connection)
    verify.assert_called_once_with(connection)
    connection.commit.assert_called_once_with()
    connection.rollback.assert_not_called()
    connection.close.assert_called_once_with()


def test_verification_checks_expected_state():
    connection = MagicMock()
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = (10, 10, 0, 0, 0, 0)

    result = handler._verify(connection)

    cursor.execute.assert_called_once_with(handler.VERIFY_INITIALIZED_STATE)
    assert result["precinct_count"] == 10
    assert result["metric_count"] == 10


def test_initialization_rolls_back_on_ingestion_error():
    connection = MagicMock()
    with (
        patch.object(handler, "get_connection", return_value=connection),
        patch.object(
            handler,
            "import_rows_with_connection",
            side_effect=RuntimeError("ingestion failed"),
        ),
    ):
        with pytest.raises(RuntimeError, match="ingestion failed"):
            handler.initialize_database([], "CREATE TABLE safe_test ();")

    connection.commit.assert_not_called()
    connection.rollback.assert_called_once_with()
    connection.close.assert_called_once_with()


def test_dataset_validation_failure_happens_before_database_access():
    with (
        patch.object(
            handler,
            "load_and_validate",
            side_effect=handler.ContractError("invalid Dataset"),
        ),
        patch.object(handler, "get_connection") as connect,
    ):
        response = handler.lambda_handler(
            {handler.CONFIRMATION_FIELD: handler.CONFIRMATION_VALUE}, None
        )

    assert response == {"status": "failed", "message": "Dataset validation failed"}
    connect.assert_not_called()


def test_secret_details_are_not_returned_or_logged(caplog):
    secret_value = "never-log-this-password"
    with (
        patch.object(handler, "load_and_validate", return_value=[]),
        patch.object(handler, "_read_schema", return_value="SELECT 1;"),
        patch.object(
            handler,
            "initialize_database",
            side_effect=RuntimeError(secret_value),
        ),
        caplog.at_level(logging.ERROR),
    ):
        response = handler.lambda_handler(
            {handler.CONFIRMATION_FIELD: handler.CONFIRMATION_VALUE}, None
        )

    assert response == {"status": "failed", "message": "Database initialization failed"}
    assert secret_value not in json.dumps(response)
    assert secret_value not in caplog.text


def test_shared_connection_reads_mocked_secret_without_logging(monkeypatch):
    secret_value = "never-log-this-password"
    monkeypatch.setenv("DB_SECRET_ARN", "arn:aws:secretsmanager:region:account:secret:test")
    monkeypatch.setenv("DB_HOST", "database.internal")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("DB_NAME", "habitune_db")
    secrets_client = MagicMock()
    secrets_client.get_secret_value.return_value = {
        "SecretString": json.dumps({"username": "habitune_master", "password": secret_value})
    }

    with (
        patch.object(db.boto3, "client", return_value=secrets_client),
        patch.object(db.psycopg2, "connect", return_value=MagicMock()) as connect,
    ):
        db.get_connection()

    secrets_client.get_secret_value.assert_called_once()
    assert connect.call_args.kwargs["password"] == secret_value
