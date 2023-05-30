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

.PHONY: build-all-release
build-all-release: RUST_BUILD_FLAGS += --release
build-all-release: build-all 

.PHONY: build-all
build-all: build-client copy-client-dist build-daemon

.PHONY: build-client
build-client:
	@echo "building client..."
	@cd client && npm run build
	@echo "client built"

.PHONY: build-daemon
build-daemon: clean-daemon
	@echo "building daemon..."
	@cd daemon && cargo build $(RUST_BUILD_FLAGS)
	@echo "daemon built"

.PHONY: package-daemon
package-daemon: build-all-release
	@echo "packaging daemon..."
	@rm -rf dist
	@mkdir dist
	@cd daemon && cp target/release/dillinger-daemon ../dist/dillinger-daemon
	@cd daemon && cp .env ../dist/.env
	@cd client && cp -r dist ../dist
	@chmod +x dist/dillinger-daemon
	@echo "daemon packaged"

.PHONY: package-all
package-all: package-daemon prepare-docker-dillinger build-docker-dillinger
	
.PHONY: copy-client-dist
copy-client-dist:
	@cd client && cp -r dist ../daemon/dist

.PHONY: help
help:
	@echo "Take a look inside the makefile for specific make targets..."

.PHONY: gamescope
gamescope:
	cd ./gamescope
	meson build/

.PHONY: build-docker-gow-base
build-docker-gow-base:
	@echo "Building - dillinger/gow-base"
	@cd gow && sudo DOCKER_BUILDKIT=1 docker build -t dillinger/gow-base images/base
	@echo "Build complete - dillinger/gow-base"

.PHONY: build-docker-gow-base-app
build-docker-gow-base-app:
	@echo "Building - dillinger/gow-base-app"
	@cd gow && sudo DOCKER_BUILDKIT=1 docker build --build-arg BASE_IMAGE=dillinger/gow-base -t dillinger/gow-base-app images/base-app
	@echo "Build complete - dillinger/gow-base-app"

.PHONY: build-docker-gow-retroarch
build-docker-gow-retroarch: build-docker-gow-base build-docker-gow-base-app
	@echo "Building - dillinger/retroarch"
	@cd gow && sudo ./run-gow --gpu nvidia --app retroarch build
	@echo "Build complete - dillinger/retroarch"

.PHONY: prepare-docker-dillinger
prepare-docker-dillinger: package-daemon
	@echo "preparing docker files for dillinger docker build..."
	cp -r dist docker/images/core/dist
	@echo "docker files prepared"

.PHONY: build-docker-dillinger
build-docker-dillinger: prepare-docker-dillinger
	@cd docker/images/core && sudo DOCKER_BUILDKIT=1 docker build -t dillinger/core .

.PHONY: run-docker-dillinger
run-docker-dillinger:
	@cd docker/compose && docker-compose -f core.yml up -d