import json
import os

import boto3
import psycopg2
from botocore.exceptions import BotoCoreError, ClientError
from psycopg2 import OperationalError


def _get_database_credentials():
    secret_arn = os.environ["DB_SECRET_ARN"]
    secrets_client = boto3.client("secretsmanager")
    secret_value = secrets_client.get_secret_value(SecretId=secret_arn)
    return json.loads(secret_value["SecretString"])


def get_connection():
    """Create a PostgreSQL connection using environment and Secrets Manager."""
    try:
        credentials = _get_database_credentials()
        return psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=os.environ["DB_PORT"],
            dbname=os.environ["DB_NAME"],
            user=credentials["username"],
            password=credentials["password"],
        )
    except (BotoCoreError, ClientError, KeyError, json.JSONDecodeError, OperationalError) as exc:
        raise RuntimeError("Unable to create database connection") from exc
