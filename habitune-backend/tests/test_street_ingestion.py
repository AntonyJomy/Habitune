from ingestion.ingest_street_ecosystem import (
    EXPECTED_ADDRESS_COUNT,
    EXPECTED_STREET_COUNT,
    load_and_validate,
)


def test_existing_street_dataset_contract_is_valid():
    dataset = load_and_validate()
    assert len(dataset["streets"]) == EXPECTED_STREET_COUNT
    assert len(dataset["addresses"]) == EXPECTED_ADDRESS_COUNT
    assert dataset["metadata"]["schema_version"] == "2.0.0"
