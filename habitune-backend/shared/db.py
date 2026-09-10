import json
import os

import boto3
import psycopg2
from botocore.exceptions import BotoCoreError, ClientError
from psycopg2 import OperationalError


def _get_database_credentials():
    # The ARN is configuration only; the username and password never live in source code.
    secret_arn = os.environ["DB_SECRET_ARN"]
    # Lambda reaches Secrets Manager through the private VPC endpoint.
    secrets_client = boto3.client("secretsmanager")
    secret_value = secrets_client.get_secret_value(SecretId=secret_arn)
    return json.loads(secret_value["SecretString"])


def get_connection():
    """Create a PostgreSQL connection using environment and Secrets Manager."""
    try:
        credentials = _get_database_credentials()
        # Host, port, and database name are injected by CloudFormation at deployment.
        return psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=os.environ["DB_PORT"],
            dbname=os.environ["DB_NAME"],
            user=credentials["username"],
            password=credentials["password"],
        )
    except (BotoCoreError, ClientError, KeyError, json.JSONDecodeError, OperationalError) as exc:
        # Preserve the original exception for logs while exposing only a generic message upstream.
        raise RuntimeError("Unable to create database connection") from exc
