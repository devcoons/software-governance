COMPOSE ?= docker compose
DEV := -f compose/compose.dev.yml
PROD := -f compose/compose.prod.yml
ENV_FILE    := .env

.PHONY: dev-up dev-down prod-up prod-down
dev-up:  ; $(COMPOSE) --env-file $(ENV_FILE) $(DEV) up -d --build
dev-down:; $(COMPOSE) --env-file $(ENV_FILE) $(DEV) down -v
prod-up: ; $(COMPOSE) --env-file $(ENV_FILE) $(PROD) up -d --build
prod-down:;$(COMPOSE) --env-file $(ENV_FILE) $(PROD) down -v

# helpers to create dev secrets quickly (DON'T commit real passwords)
.PHONY: init-secrets
init-secrets:
	@mkdir -p compose/secrets
	@[ -f compose/secrets/mariadb_root_password.txt ] || echo devroot                > compose/secrets/mariadb_root_password.txt
	@[ -f compose/secrets/mariadb_app_password.txt ]  || echo devpassword            > compose/secrets/mariadb_app_password.txt
	@[ -f compose/secrets/redis_password.txt ]        || echo devredis               > compose/secrets/redis_password.txt
	@[ -f compose/secrets/app_seed.txt ]              || echo applicationsseed12345  > compose/secrets/app_seed.txt
