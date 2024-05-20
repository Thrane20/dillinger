.DEFAULT_GOAL := help
REBUILD ?= 0
include ./compose/.env
export $(shell sed 's/=.*//' ./compose/.env)

.PHONY: help
help:
	@echo "Take a look inside the makefile for specific make targets..."

.PHONY: base
base: 
	@echo "Building" $(NAME_BASE):$(VERSION_BASE) "image..."
	@if [ -z "$(shell docker images -q $(NAME_BASE):$(VERSION_BASE))" ]; then \
        docker-compose -f ./compose/base.yml build; \
    else \
    	echo "Base image $(NAME_BASE):$(VERSION_BASE) already exists, skipping build."; \
	fi

.PHONY: builder
builder: base
	@echo "Building" $(NAME_BUILDER):$(VERSION_BUILDER) "image..."
	@if [ "$(REBUILD)" = "1" ] || [ -z "$(shell docker images -q $(NAME_BUILDER):$(VERSION_BUILDER))" ]; then \
        docker-compose --env-file ./compose/.env -f ./compose/builder.yml build; \
    else \
    	echo "Builder image $(NAME_BUILDER):$(VERSION_BUILDER) already exists, skipping build."; \
	fi

.PHONY: opentrack
opentrack: builder
	@echo "Building" $(NAME_OPENTRACK):$(VERSION_OPENTRACK) "image..."
	@if [ "$(REBUILD)" = "1" ] || [ -z "$(shell docker images -q $(NAME_OPENTRACK):$(VERSION_OPENTRACK))" ]; then \
        docker-compose --env-file ./compose/.env -f ./compose/opentrack.yml build; \
    else \
    	echo "Builder image $(NAME_OPENTRACK):$(VERSION_OPENTRACK) already exists, skipping build."; \
	fi

.PHONY: cp_opentrack
cp_opentrack: opentrack
	@echo "Copying" $(NAME_OPENTRACK):$(VERSION_OPENTRACK) "files..."
	docker run -d --rm --name opentrack dillinger/opentrack:$(VERSION_OPENTRACK)
	docker cp opentrack:/builds/opentrack/ $(CURDIR)/dillinger_builds/opentrack
	

.PHONY: runner_wine
runner_wine: opentrack
	@echo "Building" $(NAME_RUNNER_WINE):$(VERSION_RUNNER_WINE) "image..."
	@if [ "$(REBUILD)" = "1" ] || [ -z "$(shell docker images -q $(NAME_OPENTRACK):$(VERSION_OPENTRACK))" ]; then \
        docker-compose --env-file ./compose/.env -f ./compose/runner_wine.yml build; \
    else \
    	echo "Builder image $(NAME_RUNNER_WINE):$(VERSION_RUNNER_WINE) already exists, skipping build."; \
	fi