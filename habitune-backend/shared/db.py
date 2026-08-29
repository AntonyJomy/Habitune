import os

import psycopg2
from psycopg2 import OperationalError


def get_connection():
    """Create a PostgreSQL connection from environment variables."""
    try:
        return psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=os.environ["DB_PORT"],
            dbname=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
        )
    except (KeyError, OperationalError) as exc:
        raise RuntimeError("Unable to create database connection") from exc
