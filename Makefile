.PHONY: help up down logs status idle moderate busy flood test

help:
	@echo "Chaos Socket - Simulador WebSocket para testes"
	@echo ""
	@echo "Comandos:"
	@echo "  make up         - Iniciar com perfil padrão (moderate)"
	@echo "  make idle       - Iniciar com perfil idle (5 senders, 0.5 msg/min)"
	@echo "  make moderate   - Iniciar com perfil moderate (50 senders, 2 msg/min)"
	@echo "  make busy       - Iniciar com perfil busy (1000 senders, 8 msg/min)"
	@echo "  make flood      - Iniciar com perfil flood (10000 senders, 60 msg/min)"
	@echo "  make down       - Parar"
	@echo "  make logs       - Ver logs"
	@echo "  make status     - Ver status da API"
	@echo "  make test       - Executar testes"
	@echo ""
	@echo "Desenvolvimento local (sem Docker):"
	@echo "  npm install && npm start"
	@echo "  CHAOS_PROFILE=busy npm start"

# Docker Compose
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

# Perfis específicos
idle:
	CHAOS_PROFILE=idle docker compose up -d --build

moderate:
	CHAOS_PROFILE=moderate docker compose up -d --build

busy:
	CHAOS_PROFILE=busy docker compose up -d --build

flood:
	CHAOS_PROFILE=flood docker compose up -d --build

# Utilitários
status:
	@curl -s http://localhost:9101/api/status | jq . 2>/dev/null || curl -s http://localhost:9101/api/status

test:
	npm test
