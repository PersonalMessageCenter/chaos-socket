const WebSocket = require("ws");
const { 
  messageLatency, 
  messagesReceived, 
  connectionsTotal, 
  activeConnections,
  errorsTotal,
  metricsApp 
} = require("./metrics");
const express = require("express");
const apiApp = metricsApp; // Reusar o mesmo app do metrics
const logger = require("./logger");

const WS_PORT = process.env.WS_PORT || 4001;
const METRICS_PORT = process.env.METRICS_PORT || 9101;

// Configurações de chaos
const FAILURE_RATE = parseFloat(process.env.FAILURE_RATE || "0.01"); // 1% de falhas
const MAX_DELAY_MS = parseInt(process.env.MAX_DELAY_MS || "200");
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || "0");
const MESSAGE_RATE = parseInt(process.env.MESSAGE_RATE || "1000"); // ms entre mensagens automáticas
const COMMAND_INTERVAL_MS = parseInt(process.env.COMMAND_INTERVAL_MS || "60000"); // 1 minuto entre comandos

// Lista de comandos disponíveis
const AVAILABLE_COMMANDS = ["/help", "/status", "/info"];

// Adicionar middleware JSON antes de iniciar o servidor
metricsApp.use(express.json());

// Servidor de métricas
metricsApp.listen(METRICS_PORT, () => {
  logger.info("Metrics server started", { port: METRICS_PORT });
});

// Servidor WebSocket
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on("listening", () => {
  logger.info("Chaos Socket WebSocket server started", {
    port: WS_PORT,
    failureRate: `${FAILURE_RATE * 100}%`,
    delayRange: `${MIN_DELAY_MS}-${MAX_DELAY_MS}ms`,
    messageRate: `${MESSAGE_RATE}ms`
  });
});

// Armazenar conexões ativas
const activeConnectionsMap = new Map();

wss.on("connection", (ws, req) => {
  connectionsTotal.inc({ event: "connect" });
  activeConnections.inc();
  
  const clientAddress = req.socket.remoteAddress;
  const connectionId = `${clientAddress}-${Date.now()}`;
  activeConnectionsMap.set(connectionId, ws);
  
  logger.info("New WebSocket connection", { 
    remoteAddress: clientAddress,
    connectionId,
    activeConnections: activeConnectionsMap.size
  });

  // Enviar mensagem de boas-vindas/confirmação de conexão
  try {
    ws.send(JSON.stringify({
      type: "connection",
      status: "connected",
      timestamp: new Date().toISOString()
    }));
  } catch (err) {
    logger.error("Error sending connection confirmation", {
      connectionId,
      error: err.message
    });
  }

  // Rastrear último comando enviado para esta conexão
  let lastCommandTime = 0;

  // Simular envio de mensagens para os clientes conectados
  const messageInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const shouldFail = Math.random() < FAILURE_RATE;
      
      if (shouldFail) {
        logger.warn("Simulating connection failure", { connectionId });
        errorsTotal.inc({ type: "random_failure" });
        ws.close(1000, "Simulated failure");
        clearInterval(messageInterval);
        return;
      }

      const now = Date.now();
      const timeSinceLastCommand = now - lastCommandTime;
      const shouldSendCommand = timeSinceLastCommand >= COMMAND_INTERVAL_MS;

      // Decidir se envia comando ou mensagem normal
      let content;
      if (shouldSendCommand) {
        // Selecionar comando aleatório da lista
        const randomCommand = AVAILABLE_COMMANDS[Math.floor(Math.random() * AVAILABLE_COMMANDS.length)];
        content = randomCommand;
        lastCommandTime = now;
        logger.info("Sending command", { connectionId, command: randomCommand });
      } else {
        content = `Test message ${now}`;
      }

      // Simular mensagem para enviar aos clientes
      const message = {
        id: `msg_${now}_${Math.random().toString(36).slice(2, 11)}`,
        timestamp: new Date().toISOString(),
        sender: `sender_${Math.floor(Math.random() * 1000000000)}@example.com`,
        type: "text",
        content: content,
        raw_payload: {
          simulated: true,
          chaos_socket: true,
          is_command: shouldSendCommand,
          delay: Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS
        }
      };

      const startTime = Date.now();
      try {
        ws.send(JSON.stringify(message));
        const latency = (Date.now() - startTime) / 1000;
        
        messageLatency.observe({ status: "success" }, latency);
        messagesReceived.inc({ status: "sent" });
        
        logger.debug("Simulated message sent to client", {
          connectionId,
          messageId: message.id,
          sender: message.sender,
          latency: `${latency.toFixed(3)}s`
        });
      } catch (err) {
        const latency = (Date.now() - startTime) / 1000;
        messageLatency.observe({ status: "error" }, latency);
        messagesReceived.inc({ status: "error" });
        errorsTotal.inc({ type: "send_error" });
        logger.error("Error sending simulated message", {
          connectionId,
          error: err.message,
          stack: err.stack
        });
        clearInterval(messageInterval);
      }
    } else {
      clearInterval(messageInterval);
    }
  }, MESSAGE_RATE);

  // Receber mensagens dos clientes (ex: confirmações, comandos)
  ws.on("message", (msg) => {
    try {
      const message = JSON.parse(msg.toString());
      messagesReceived.inc({ status: "received" });
      
      logger.debug("Message received from client", {
        connectionId,
        messageType: message.type || "unknown"
      });

      // Se for uma requisição de teste de carga (do Locust via API), processar
      if (message.type === "load_test") {
        const delay = Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS;
        const shouldFail = Math.random() < FAILURE_RATE;
        
        setTimeout(() => {
          if (shouldFail) {
            messageLatency.observe({ status: "error" }, delay / 1000);
            messagesReceived.inc({ status: "error" });
            errorsTotal.inc({ type: "random_failure" });
            ws.close(1000, "Simulated failure");
          } else {
            try {
              ws.send(JSON.stringify({ type: "ack", originalId: message.id }));
              messageLatency.observe({ status: "success" }, delay / 1000);
              messagesReceived.inc({ status: "success" });
            } catch (err) {
              errorsTotal.inc({ type: "send_error" });
              logger.error("Error sending ACK", {
                connectionId,
                error: err.message
              });
            }
          }
        }, delay);
      }
    } catch (err) {
      logger.error("Error processing message from client", {
        connectionId,
        error: err.message
      });
    }
  });

  ws.on("close", (code, reason) => {
    activeConnections.dec();
    connectionsTotal.inc({ event: "disconnect" });
    activeConnectionsMap.delete(connectionId);
    clearInterval(messageInterval);
    
    logger.info("WebSocket connection closed", {
      remoteAddress: clientAddress,
      connectionId,
      code,
      reason: reason.toString(),
      activeConnections: activeConnectionsMap.size
    });
  });

  ws.on("error", (error) => {
    errorsTotal.inc({ type: "websocket_error" });
    logger.error("WebSocket error", {
      remoteAddress: clientAddress,
      connectionId,
      error: error.message,
      stack: error.stack
    });
  });
});

// API HTTP para Locust gerar carga (opcional) - usar o mesmo app do metrics
metricsApp.post("/api/send-message", (req, res) => {
  const { message, connectionId } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Enviar para todas as conexões ativas ou uma específica
  let sent = 0;
  activeConnectionsMap.forEach((ws, id) => {
    if (!connectionId || id === connectionId) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          sent++;
        } catch (err) {
          logger.error("Error sending message via API", { error: err.message });
        }
      }
    }
  });

  res.json({ 
    success: true, 
    sent, 
    activeConnections: activeConnectionsMap.size 
  });
});

metricsApp.get("/api/status", (req, res) => {
  res.json({
    activeConnections: activeConnectionsMap.size,
    failureRate: FAILURE_RATE,
    delayRange: `${MIN_DELAY_MS}-${MAX_DELAY_MS}ms`,
    messageRate: `${MESSAGE_RATE}ms`
  });
});

// API endpoints já estão no mesmo app do metrics, não precisa iniciar outro servidor

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, closing WebSocket server...");
  activeConnectionsMap.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "Server shutting down");
    }
  });
  wss.close(() => {
    logger.info("WebSocket server closed gracefully");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, closing WebSocket server...");
  activeConnectionsMap.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "Server shutting down");
    }
  });
  wss.close(() => {
    logger.info("WebSocket server closed gracefully");
    process.exit(0);
  });
});

// Log unhandled errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection", {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
