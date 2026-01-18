# Configuração de Perfis - Chaos Socket

Este documento descreve todos os parâmetros disponíveis para configuração de perfis.

## Estrutura do Arquivo de Perfil

```yaml
name: string           # Nome do perfil (exibido nos logs)
description: string    # Descrição do perfil

timing:                # Configurações de tempo
  ...

presence:              # Configurações de presença online
  ...

sender:                # Configurações de remetentes
  ...

message_types:         # Distribuição de tipos de mensagem
  ...
```

---

## Seção: `timing`

Controla a frequência e padrão de envio de mensagens.

### `messages_per_minute`

- **Tipo:** `number`
- **Obrigatório:** Sim
- **Descrição:** Quantas mensagens são enviadas por minuto em média.
- **Exemplos:**
  - `0.5` = 1 mensagem a cada 2 minutos
  - `2` = 2 mensagens por minuto
  - `60` = 1 mensagem por segundo

### `burst_probability`

- **Tipo:** `number` (0.0 a 1.0)
- **Obrigatório:** Não (padrão: 0)
- **Descrição:** Probabilidade de entrar em modo "burst" (rajada de mensagens rápidas).
- **Exemplos:**
  - `0.05` = 5% de chance
  - `0.3` = 30% de chance

### `burst_size`

- **Tipo:** `object { min, max }`
- **Obrigatório:** Não
- **Descrição:** Quantas mensagens são enviadas em sequência durante um burst.
- **Exemplo:**
  ```yaml
  burst_size:
    min: 3
    max: 10
  ```

### `typing_delay_ms`

- **Tipo:** `object { min, max }`
- **Obrigatório:** Não
- **Descrição:** Delay em milissegundos simulando tempo de digitação (durante burst).
- **Exemplo:**
  ```yaml
  typing_delay_ms:
    min: 500
    max: 2000
  ```

### `read_delay_ms`

- **Tipo:** `object { min, max }`
- **Obrigatório:** Não
- **Descrição:** Delay em milissegundos simulando tempo de leitura entre mensagens.
- **Exemplo:**
  ```yaml
  read_delay_ms:
    min: 1000
    max: 5000
  ```

---

## Seção: `presence`

Controla o comportamento de presença online do simulador.

### `online_probability`

- **Tipo:** `number` (0.0 a 1.0)
- **Obrigatório:** Não (padrão: 1.0)
- **Descrição:** Probabilidade do sender estar "online" ao enviar mensagem.
- **Exemplos:**
  - `0.3` = 30% online
  - `1.0` = sempre online

### `status_change_interval_ms`

- **Tipo:** `number`
- **Obrigatório:** Não (padrão: 0)
- **Descrição:** Intervalo em milissegundos para mudança de status online/offline.
- **Exemplos:**
  - `0` = não muda status
  - `60000` = muda a cada 1 minuto

---

## Seção: `sender`

Controla o pool de remetentes (senders) que enviam mensagens.

### `count`

- **Tipo:** `number`
- **Obrigatório:** Sim
- **Descrição:** Quantos remetentes únicos existem no pool. As mensagens alternam entre os senders (round-robin).
- **Exemplo:**
  ```yaml
  sender:
    count: 50
  ```

---

## Seção: `message_types`

Controla a distribuição de tipos de mensagem. Os valores são probabilidades que devem somar 1.0.

### Tipos disponíveis

| Tipo | Descrição |
|------|-----------|
| `text` | Mensagem de texto |
| `image` | Imagem |
| `audio` | Áudio/voz |
| `document` | Documento/arquivo |
| `sticker` | Sticker |

### Exemplo

```yaml
message_types:
  text: 0.70       # 70% texto
  image: 0.15      # 15% imagem
  audio: 0.10      # 10% áudio
  document: 0.05   # 5% documento
```

---

## Perfis Disponíveis

| Perfil | Msgs/min | Senders | Uso |
|--------|----------|---------|-----|
| `idle` | 0.5 | 5 | Usuário inativo |
| `moderate` | 2 | 50 | Uso normal |
| `busy` | 8 | 1000 | Uso intenso |
| `flood` | 60 | 10000 | Stress test |

