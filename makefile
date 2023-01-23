PHONY: local

dev:
	cd ./daemon && cargo build

local:
	cd ./daemon && cargo build --release

docker: local
	PORT=4000 docker compose build
