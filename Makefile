.PHONY: build-InitDatabaseFunction

build-InitDatabaseFunction:
	mkdir -p "$(ARTIFACTS_DIR)"
	mkdir -p "$(ARTIFACTS_DIR)/functions"
	cp -R habitune-backend/functions/init_database "$(ARTIFACTS_DIR)/functions/"
	cp -R habitune-backend/ingestion habitune-backend/shared habitune-backend/database "$(ARTIFACTS_DIR)/"
	cp habitune-backend/requirements.txt "$(ARTIFACTS_DIR)/"
	mkdir -p "$(ARTIFACTS_DIR)/Dataset/processed"
	cp Dataset/processed/map_view1.json "$(ARTIFACTS_DIR)/Dataset/processed/"
	cp Dataset/processed/map_view1_suburbs.geojson "$(ARTIFACTS_DIR)/Dataset/processed/"
	python3 -m pip install -r habitune-backend/requirements.txt -t "$(ARTIFACTS_DIR)" --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 --only-binary=:all:
