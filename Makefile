.PHONY: help dev prod pull up down logs status restart clean idle moderate busy flood test

help:
	@echo "Chaos Socket - Simulador WebSocket para testes"
	@echo ""
	@echo "Ambientes:"
	@echo "  make dev        - Iniciar dev (build local)"
	@echo "  make prod       - Iniciar prod (imagem GHCR)"
	@echo "  make pull       - Atualizar imagem do GHCR"
	@echo "  make down       - Parar serviços"
	@echo "  make logs       - Ver logs"
	@echo "  make status     - Ver status da API"
	@echo "  make restart    - Reiniciar serviços"
	@echo "  make clean      - Limpar containers e volumes"
	@echo ""
	@echo "Perfis de Chaos (use com dev ou prod):"
	@echo "  make idle       - Dev com perfil idle (5 senders, 0.5 msg/min)"
	@echo "  make moderate   - Dev com perfil moderate (50 senders, 2 msg/min)"
	@echo "  make busy       - Dev com perfil busy (1000 senders, 8 msg/min)"
	@echo "  make flood      - Dev com perfil flood (10000 senders, 60 msg/min)"
	@echo ""
	@echo "Exemplos:"
	@echo "  make dev                          - Dev com moderate"
	@echo "  CHAOS_PROFILE=busy make dev       - Dev com busy"
	@echo "  make prod                         - Prod com moderate e tag 1.0.0"
	@echo "  IMAGE_TAG=1.1.0 make prod        - Prod com tag 1.1.0"
	@echo ""
	@echo "Desenvolvimento local (sem Docker):"
	@echo "  npm install && npm start"
	@echo "  CHAOS_PROFILE=busy npm start"
	@echo ""
	@echo "Testes:"
	@echo "  make test       - Executar testes"

# Development environment (build local)
dev:
	docker compose --profile dev up -d

# Production environment (GHCR image)
prod:
	docker compose --profile prod up -d

# Pull latest image from GHCR
pull:
	docker compose --profile prod pull

# Alias for dev (backward compatibility)
up: dev

down:
	docker compose --profile dev --profile prod down

logs:
	docker compose --profile dev --profile prod logs -f

restart:
	docker compose --profile dev --profile prod restart

clean:
	docker compose --profile dev --profile prod down -v
	docker image prune -f

# Perfis específicos (sempre em dev mode)
idle:
	CHAOS_PROFILE=idle docker compose --profile dev up -d

moderate:
	CHAOS_PROFILE=moderate docker compose --profile dev up -d

busy:
	CHAOS_PROFILE=busy docker compose --profile dev up -d

flood:
	CHAOS_PROFILE=flood docker compose --profile dev up -d

# Utilitários
status:
	@curl -s http://localhost:9101/api/status | jq . 2>/dev/null || curl -s http://localhost:9101/api/status

test:
	npm test
