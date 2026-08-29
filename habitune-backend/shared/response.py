import json


def build_response(status_code, body_dict):
    """Build an API Gateway Lambda proxy response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Content-Type": "application/json",
        },
        "body": json.dumps(body_dict),
    }
