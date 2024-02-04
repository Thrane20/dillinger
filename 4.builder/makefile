.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "Take a look inside the makefile for specific make targets..."

.PHONY: clean-server
clean-server: 
	@cd ../2.server && cargo clean
	@echo "server cleaned..."

.PHONY: build-server
build-server:
	@echo "building server..."
	@cd ../2.server && cargo build $(RUST_BUILD_FLAGS)
	@echo "server built"

