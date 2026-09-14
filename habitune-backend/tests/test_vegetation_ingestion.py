from ingestion.ingest_vegetation import (
    EXPECTED_BED_COUNT,
    EXPECTED_INVENTORY_COUNT,
    EXPECTED_TREE_COUNT,
    _bed_values,
    _inventory_values,
    _tree_values,
    load_and_validate,
)


def test_current_processed_vegetation_contract_is_valid():
    dataset = load_and_validate()
    assert len(dataset["trees"]) == EXPECTED_TREE_COUNT
    assert len(dataset["beds"]) == EXPECTED_BED_COUNT
    assert len(dataset["inventory"]) == EXPECTED_INVENTORY_COUNT


def test_ingestion_mapping_uses_stable_ids_and_lon_lat_order():
    dataset = load_and_validate()
    tree = _tree_values(dataset["trees"][0])
    bed = _bed_values(dataset["beds"][0])
    inventory = _inventory_values(dataset["inventory"][0])
    assert tree[0] == dataset["trees"][0]["com_id"]
    assert tree[14:16] == (
        float(dataset["trees"][0]["resolved_longitude"]),
        float(dataset["trees"][0]["resolved_latitude"]),
    )
    assert bed[0] == dataset["beds"][0]["asset_id"]
    assert bed[2:4] == (
        float(dataset["beds"][0]["resolved_longitude"]),
        float(dataset["beds"][0]["resolved_latitude"]),
    )
    assert inventory[:2] == (
        dataset["inventory"][0]["asset_id"],
        dataset["inventory"][0]["objectid"],
    )
