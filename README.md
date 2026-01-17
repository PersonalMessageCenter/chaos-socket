# Chaos Socket

Serviço Node.js que simula um servidor WebSocket gerenciável para testes de carga e simulação de comportamento realista de sistemas distribuídos.

## Características

- Servidor WebSocket que simula comportamento realista de sistemas externos
- **Perfis de comportamento** configuráveis via YAML (idle, moderate, busy, flood)
- Envia mensagens automaticamente para clientes conectados
- Suporte a diferentes tipos de mensagem (text, image, audio, document, sticker)
- API HTTP para controle e geração de carga programática
- Pipeline CI/CD automatizado com GitHub Actions

## Portas

- `4001` - WebSocket server (padrão)
- `9101` - API HTTP (padrão)

## Perfis de Comportamento

Os perfis simulam diferentes padrões de uso do WhatsApp:

| Perfil | Msgs/min | Senders | Descrição |
|--------|----------|---------|-----------|
| `idle` | 0.5 | 5 | Usuário inativo, poucas mensagens |
| `moderate` | 2 | 50 | Usuário comum, uso equilibrado |
| `busy` | 8 | 1000 | Usuário ativo, muitos grupos e conversas |
| `flood` | 60 | 10000 | Carga máxima para stress test |

### Estrutura do Perfil (YAML)

```yaml
name: Busy
description: Usuário ativo com muitos grupos

timing:
  messages_per_minute: 8
  burst_probability: 0.3        # 30% chance de burst
  burst_size:
    min: 5
    max: 15
  typing_delay_ms:
    min: 500
    max: 1500
  read_delay_ms:
    min: 1000
    max: 5000

presence:
  online_probability: 0.85
  status_change_interval_ms: 30000

# Sender pool: quantos remetentes únicos existem
sender:
  count: 1000

message_types:
  text: 0.70
  image: 0.15
  audio: 0.10
  document: 0.05
```

### Documentação Completa

Para detalhes sobre todos os parâmetros de configuração, consulte [CONFIGURATION.md](./CONFIGURATION.md).

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `WS_PORT` | 4001 | Porta do servidor WebSocket |
| `API_PORT` | 9101 | Porta do servidor API HTTP |
| `CHAOS_PROFILE` | moderate | Nome do perfil a usar |
| `LOG_LEVEL` | info | Nível de log (error, warn, info, debug) |

## API HTTP

### GET /api/status
Retorna status do servidor com informações do perfil.

```json
{
  "activeConnections": 5,
  "profile": {
    "name": "busy",
    "description": "Usuário ativo com muitos grupos",
    "messagesPerMinute": 8,
    "messageRate": "7500ms"
  }
}
```

### GET /api/profiles
Lista perfis disponíveis.

```json
{
  "current": "busy",
  "available": ["idle", "moderate", "busy", "flood"]
}
```

### GET /api/profile/:name
Retorna detalhes de um perfil específico.

### POST /api/send-message
Envia uma mensagem para todos os clientes conectados (ou um específico).

```json
{
  "message": {
    "id": "msg_123",
    "type": "text",
    "content": "Test message"
  },
  "connectionId": "optional-connection-id"
}
```

## Uso

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Executar com perfil padrão (moderate)
npm start

# Executar com perfil específico
CHAOS_PROFILE=busy npm start

# Executar testes
npm test
```

### Docker

```bash
# Build
docker build -t chaos-socket .

# Executar com perfil padrão
docker run -p 4001:4001 -p 9101:9101 chaos-socket

# Executar com perfil busy
docker run -p 4001:4001 -p 9101:9101 \
  -e CHAOS_PROFILE=busy \
  chaos-socket
```

### Via wpp-infra (Docker Compose)

```bash
# Iniciar com perfil padrão
make chaos

# Iniciar com perfis específicos
make chaos-idle
make chaos-moderate
make chaos-busy
make chaos-flood

# Ver logs
make chaos-logs

# Parar
make chaos-down
```

## Roadmap

### ✅ Implementado
- Perfis de comportamento via YAML
- Diferentes tipos de mensagem
- Burst de mensagens
- Pool de senders configurável
- API para listar e consultar perfis
- Documentação completa de configuração

### 🚧 Próximos Passos
- [ ] Perfis customizados via API
- [ ] Interface web para gerenciamento
- [ ] Mudança de perfil em runtime via API
- [ ] Histórico de configurações e métricas
- [ ] Simulação de falhas e recuperação
