.DEFAULT_GOAL := help
REBUILD ?= 0
NO_CACHE ?=
include ./3.docker/compose/.env
export $(shell sed 's/=.*//' 3.docker/compose/.env)

# NOTE: This makefile MUST be run from the root of the repository
# (All files are relative to the root)

.PHONY: help
help:
	@echo "Take a look inside the makefile for specific make targets..."

export_vars:
    export $$(sed 's/=.*//' "3.docker/compose/.env")

.PHONY: base
base: 
	@echo "Building" $(NAME_BASE):$(VERSION_BASE) "image..."
	docker build --network=host -t $(NAME_BASE):$(VERSION_BASE) -f ./3.docker/images/base/Dockerfile .

.PHONY: builder
builder: base
	@echo "Building" $(NAME_BUILDER):$(VERSION_BUILDER) "image..."
	docker build -t $(NAME_BUILDER):$(VERSION_BUILDER) --build-arg BASE_IMAGE=$(NAME_BASE):$(VERSION_BASE) -f ./3.docker/images/builder/Dockerfile .
	
# Build the docker container that can be used to build the opentrack project
.PHONY: opentrack
opentrack: builder
	@echo "Building" $(NAME_OPENTRACK):$(VERSION_OPENTRACK) "image..."
	docker build $(NO_CACHE) -t $(NAME_OPENTRACK):$(VERSION_OPENTRACK) --build-arg BASE_IMAGE=$(NAME_BUILDER):$(VERSION_BUILDER) -f images/opentrack/Dockerfile .

# Clobber the open track project
.PHONY: clobber_opentrack
clobber_opentrack: 
	docker rmi -f $(NAME_OPENTRACK):$(VERSION_OPENTRACK)

# Copy the opentrack build files from the opentrack container to the host
.PHONY: cp_opentrack
cp_opentrack: opentrack
	@echo "Copying" $(NAME_OPENTRACK):$(VERSION_OPENTRACK) "files..."
	docker run -d --rm --name opentrack $(NAME_OPENTRACK):$(VERSION_OPENTRACK)
	docker cp opentrack:/builds/opentrack/ $(CURDIR)/dillinger_builds/opentrack
	docker stop opentrack
	
.PHONY: runner_base
runner_base: opentrack
	docker build -t ${NAME_RUNNER_BASE}:${VERSION_RUNNER_BASE} --build-arg BASE_IMAGE=$(NAME_BASE):$(VERSION_BASE) -f images/runners/runner_base.dockerfile .

.PHONY: clobber_runner_base
clobber_runner_base: 
	docker rmi -f $(NAME_RUNNER_BASE):$(VERSION_RUNNER_BASE)

.PHONY: runner_wine
runner_wine: runner_base 
	@echo "Building" $(NAME_RUNNER_WINE):$(VERSION_RUNNER_WINE) "image..."
	docker build -t $(NAME_RUNNER_WINE):$(VERSION_RUNNER_WINE) --build-arg BASE_IMAGE=${NAME_RUNNER_BASE}:${VERSION_RUNNER_BASE} -f images/runners/runner_wine.dockerfile .

# The primary dillinger server (core)
# There is no need to build any base image, this is straight up rust:latest
.PHONY: core
core: builder
	@echo "Building" $(NAME_CORE):$(VERSION_CORE) "image..."
	docker build -t $(NAME_CORE):$(VERSION_CORE) --build-arg BASE_IMAGE=$(NAME_BUILDER):$(VERSION_BUILDER) -f ./3.docker/images/core/Dockerfile .