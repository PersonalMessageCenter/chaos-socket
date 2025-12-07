# Chaos Socket

Serviço Node.js que simula um servidor WebSocket gerenciável para testes de carga e simulação de comportamento realista de sistemas distribuídos.

## Características

- Servidor WebSocket que simula comportamento realista de sistemas externos
- Envia mensagens automaticamente para clientes conectados
- Taxa de mensagens configurável via variável de ambiente (controle de carga)
- Métricas Prometheus expostas em `/metrics`
- API HTTP para controle e geração de carga programática
- Pipeline CI/CD automatizado com GitHub Actions

## Portas

- `4001` - WebSocket server (padrão)
- `9101` - Métricas Prometheus e API HTTP (padrão)

## Variáveis de Ambiente

- `WS_PORT` - Porta do servidor WebSocket (padrão: 4001)
- `METRICS_PORT` - Porta do servidor de métricas e API (padrão: 9101)
- `MESSAGE_RATE` - Intervalo entre mensagens automáticas em ms (padrão: 12000 = 5 msg/min). Controla a taxa de carga
- `LOG_LEVEL` - Nível de log (error, warn, info, verbose, debug, silly, padrão: info)
- `NODE_ENV` - Ambiente de execução (development, production)

## Como Funciona

1. **Clientes se conectam** ao servidor via WebSocket
2. **Servidor envia mensagens** simuladas automaticamente para os clientes conectados
3. **Clientes processam** as mensagens recebidas
4. **API HTTP** permite gerar carga adicional programaticamente

## API HTTP

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

### GET /api/status
Retorna status do servidor e conexões ativas.

```json
{
  "activeConnections": 5,
  "messageRate": "12000ms"
}
```

## Métricas Prometheus

### Latência
- `chaos_socket_message_send_latency_seconds` - Histograma de latência de envio de mensagens via WebSocket
- `chaos_socket_message_latency_via_api_seconds` - Histograma de latência de mensagens enviadas via HTTP API

### Mensagens
- `chaos_socket_messages_received_total` - Contador de mensagens recebidas via WebSocket dos clientes (label: flow)
- `chaos_socket_messages_sent_total` - Contador de mensagens enviadas via WebSocket (label: status)
- `chaos_socket_messages_sent_via_api_total` - Contador de mensagens enviadas via HTTP API (label: status)

### Conexões
- `chaos_socket_connections_total` - Contador total de conexões (label: event)
- `chaos_socket_active_connections` - Gauge de conexões ativas

### Erros
- `chaos_socket_errors_total` - Contador de erros (label: type)

## Uso

```bash
# Desenvolvimento
npm install
npm start

# Docker
docker build -t chaos-socket .
docker run -p 4001:4001 -p 9101:9101 chaos-socket

# Docker com variáveis customizadas
docker run -p 4001:4001 -p 9101:9101 \
  -e MESSAGE_RATE=5000 \
  -e LOG_LEVEL=debug \
  chaos-socket
```

## Roadmap

### v2.0.0 (Próxima versão maior)
- [ ] Interface web simples para gerenciamento do socket
- [ ] Banco de dados SQLite para persistência de configurações
- [ ] API REST para gerenciamento de configurações
- [ ] Histórico de configurações e métricas

### Futuro
- [ ] Múltiplos perfis de carga configuráveis
- [ ] Simulação de falhas e recuperação
- [ ] Integração com sistemas de monitoramento externos
