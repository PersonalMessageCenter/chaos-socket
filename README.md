# Chaos Socket

Simulador WebSocket para testes de carga e comportamento de sistemas de mensagens distribuídos.

## Características

- Servidor WebSocket com geração automática de eventos
- **Perfis de comportamento** configuráveis via YAML
- **8 tipos de eventos** (message, typing, read, delivered, presence, reaction, edit, delete)
- **6 tipos de conteúdo** (text, image, audio, video, file, sticker)
- API HTTP para controle e injeção de eventos
- Suporte a bursts e pools de senders

## Portas

| Porta | Serviço |
|-------|---------|
| `4001` | WebSocket |
| `9101` | API HTTP |

## Eventos

| Evento | Descrição |
|--------|-----------|
| `message` | Nova mensagem |
| `typing` | Indicador de digitação |
| `read` | Confirmação de leitura |
| `delivered` | Confirmação de entrega |
| `presence` | Status online/offline |
| `reaction` | Reação a mensagem |
| `edit` | Edição de mensagem |
| `delete` | Exclusão de mensagem |

## Perfis

| Perfil | Msgs/min | Senders | Descrição |
|--------|----------|---------|-----------|
| `idle` | 0.5 | 5 | Usuário inativo |
| `moderate` | 2 | 50 | Uso equilibrado (padrão) |
| `busy` | 8 | 1000 | Power user |
| `flood` | 60 | 10000 | Stress test |

Ver detalhes em [CONFIGURATION.md](./CONFIGURATION.md).

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `WS_PORT` | 4001 | Porta WebSocket |
| `API_PORT` | 9101 | Porta API HTTP |
| `CHAOS_PROFILE` | moderate | Perfil a usar |
| `LOG_LEVEL` | info | Nível de log |

## API HTTP

### GET /api/status

```json
{
  "activeConnections": 5,
  "profile": {
    "name": "busy",
    "messagesPerMinute": 8,
    "events": { "message": 0.40, "typing": 0.15 },
    "messageTypes": { "text": 0.65, "image": 0.15 }
  }
}
```

### GET /api/events

```json
{
  "available": ["message", "typing", "read", "delivered", "presence", "reaction", "edit", "delete"],
  "current_distribution": { "message": 0.40, "typing": 0.15 }
}
```

### GET /api/profiles

```json
{
  "current": "busy",
  "available": ["idle", "moderate", "busy", "flood"]
}
```

### POST /api/send-event

```json
{
  "event": { "event": "message", "sender": "user@example.com", "content": "Hello" },
  "connectionId": "optional"
}
```

## Uso

```bash
# Instalar
npm install

# Executar
npm start

# Com perfil específico
CHAOS_PROFILE=busy npm start

# Testes
npm test
```

### Docker

```bash
docker build -t chaos-socket .
docker run -p 4001:4001 -p 9101:9101 -e CHAOS_PROFILE=busy chaos-socket
```

## Cliente WebSocket

```javascript
const ws = new WebSocket('ws://localhost:4001');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log(event.event, event.sender || event.user, event.content || event.status);
});
```

## Roadmap

Implementado:
- Perfis de comportamento via YAML
- 8 tipos de eventos genéricos
- 6 tipos de conteúdo
- Burst de mensagens
- Pool de senders configurável

Próximos passos:
- Mudança de perfil em runtime
- Interface web
- Simulação de falhas
