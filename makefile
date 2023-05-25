.DEFAULT_GOAL := help

.PHONY: clean-all
clean-all: clean-client clean-daemon 

.PHONY: clean-client
clean-client: 
	@cd client && rm -rf dist
	@echo "client cleaned..."

.PHONY: clean-daemon
clean-daemon:
	@cd daemon && cargo clean && rm -rf dist
	@echo "daemon-cleaned.."

.PHONY: build-all-debug
build-all-debug: RUST_BUILD_FLAGS += --release
build-all-debug: build-all 

.PHONY: build-all
build-all: build-client copy-client-dist build-daemon

.PHONY: build-client
build-client:
	@echo "building client..."
	@cd client && npm run build
	@echo "client built"

.PHONY: build-daemon
build-daemon:
	@echo "building daemon..."
	@cd daemon && cargo build $(RUST_BUILD_FLAGS)
	@echo "daemon built"

.PHONY: copy-client-dist
copy-client-dist:
	@cd client && cp -r dist ../daemon/dist

.PHONY: help
help:
	@echo "Take a look inside the makefile for specific make targets..."

dev:
	cd ./daemon && cargo build

local:
	cd ./daemon && cargo build --release

.PHONY: gamescope
gamescope:
	cd ./gamescope
	meson build/

.PHONY: build-docker-gow-base
build-docker-gow-base:
	@cd gow && sudo DOCKER_BUILDKIT=1 docker build -t dillinger-gow-base images/base

.PHONY: build-docker-gow-base
build-docker-gow-base-app:
	@cd gow && sudo DOCKER_BUILDKIT=1 docker build --build-arg BASE_IMAGE=dillinger-gow-base -t dillinger-gow-base-app images/base-app

.PHONY: build-docker-gow-base
build-docker-gow-retroarch: build-docker-gow-base build-docker-gow-base-app
	@cd gow && sudo ./run-gow --gpu nvidia --app retroarch build

docker: local
	PORT=4000 docker compose build
