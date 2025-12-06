# Chaos Socket

Serviço Node.js que simula um servidor WebSocket com características de chaos engineering para testes de carga e simulação de comportamento realista de sistemas distribuídos.

## Características

- Servidor WebSocket que simula comportamento realista de sistemas externos
- Envia mensagens automaticamente para clientes conectados
- Latência aleatória configurável
- Taxa de falhas configurável (chaos engineering)
- Métricas Prometheus expostas em `/metrics`
- API HTTP para controle e geração de carga programática

## Portas

- `4001` - WebSocket server (padrão)
- `9101` - Métricas Prometheus e API HTTP (padrão)

## Variáveis de Ambiente

- `WS_PORT` - Porta do servidor WebSocket (padrão: 4001)
- `METRICS_PORT` - Porta do servidor de métricas e API (padrão: 9101)
- `API_PORT` - Porta separada para API (opcional, usa METRICS_PORT se não definido)
- `FAILURE_RATE` - Taxa de falhas (0.0 a 1.0, padrão: 0.01 = 1%)
- `MAX_DELAY_MS` - Delay máximo em milissegundos (padrão: 200)
- `MIN_DELAY_MS` - Delay mínimo em milissegundos (padrão: 0)
- `MESSAGE_RATE` - Intervalo entre mensagens automáticas em ms (padrão: 1000)
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

## Métricas Prometheus

- `chaos_socket_message_latency_seconds` - Histograma de latência de mensagens
- `chaos_socket_messages_received_total` - Contador de mensagens recebidas
- `chaos_socket_connections_total` - Contador de conexões
- `chaos_socket_active_connections` - Gauge de conexões ativas
- `chaos_socket_errors_total` - Contador de erros

## Uso

```bash
# Desenvolvimento
npm install
npm start

# Docker
docker build -t chaos-socket .
docker run -p 4001:4001 -p 9101:9101 chaos-socket
```
