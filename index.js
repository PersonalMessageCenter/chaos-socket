const WebSocket = require("ws");
const { 
  messageLatency, 
  messagesReceived,
  messagesSent,
  messagesSentViaAPI,
  connectionsTotal, 
  activeConnections,
  errorsTotal,
  metricsApp 
} = require("./metrics");
const express = require("express");
const logger = require("./logger");

const WS_PORT = process.env.WS_PORT || 4001;
const METRICS_PORT = process.env.METRICS_PORT || 9101;

// Configurações de controle de mensagens
const MAX_DELAY_MS = parseInt(process.env.MAX_DELAY_MS || "200");
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || "0");
const MESSAGE_RATE = parseInt(process.env.MESSAGE_RATE || "12000"); // ms entre mensagens automáticas (padrão: 5 msg/min = 12000ms)
const COMMAND_INTERVAL_MS = parseInt(process.env.COMMAND_INTERVAL_MS || "60000"); // 1 minuto entre comandos


metricsApp.use(express.json());
metricsApp.listen(METRICS_PORT, () => {
  logger.info("Metrics server started", { port: METRICS_PORT });
});

// Servidor WebSocket
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on("listening", () => {
  logger.info("Chaos Socket WebSocket server started", {
    port: WS_PORT,
    delayRange: `${MIN_DELAY_MS}-${MAX_DELAY_MS}ms`,
    messageRate: `${MESSAGE_RATE}ms`
  });
});

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

  try {
    ws.send(JSON.stringify({
      type: "connection",
      status: "connected",
      timestamp: new Date().toISOString()
    }));
  } catch (err) {
    errorsTotal.inc({ type: "connection_confirmation_error" });
    logger.error("Error sending connection confirmation", {
      connectionId,
      error: err.message
    });
  }

  // Simulation
  const messageInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const now = Date.now();

      const message = {
        id: `msg_${now}_${Math.random().toString(36).slice(2, 11)}`,
        timestamp: new Date().toISOString(),
        sender: `sender_${Math.floor(Math.random() * 1000000000)}@example.com`,
        type: "text",
        content: `Test message ${now}`,
        raw_payload: {
          simulated: true,
          chaos_socket: true
        }
      };

      const startTime = Date.now();
      try {
        ws.send(JSON.stringify(message));
        const latency = (Date.now() - startTime) / 1000;
        
        messageLatency.observe({ status: "success" }, latency);
        messagesSent.inc({ status: "success" });
        
        logger.debug("Simulated message sent to client", {
          connectionId,
          messageId: message.id,
          sender: message.sender,
          latency: `${latency.toFixed(3)}s`
        });
      } catch (err) {
        const latency = (Date.now() - startTime) / 1000;
        messageLatency.observe({ status: "error" }, latency);
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
  // NOTA: Não contamos essas mensagens em messagesReceived porque essa métrica
  // é apenas para requests HTTP recebidos do Locust via API
  ws.on("message", (msg) => {
    try {
      const message = JSON.parse(msg.toString());
      
      logger.debug("Message received from client", {
        connectionId,
        messageType: message.type || "unknown"
      });

      // Se for uma requisição de teste de carga (do Locust via API), processar
      if (message.type === "load_test") {
        const delay = Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS;
        
        setTimeout(() => {
          try {
            ws.send(JSON.stringify({ type: "ack", originalId: message.id }));
            messageLatency.observe({ status: "success" }, delay / 1000);
            // Não incrementar messagesReceived aqui - essa métrica é apenas para HTTP requests
          } catch (err) {
            errorsTotal.inc({ type: "send_error" });
            logger.error("Error sending ACK", {
              connectionId,
              error: err.message
            });
          }
        }, delay);
      }
    } catch (err) {
      errorsTotal.inc({ type: "message_processing_error" });
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
        const startTime = Date.now();
        try {
          ws.send(JSON.stringify(message));
          const latency = (Date.now() - startTime) / 1000;
          
          // Incrementar métricas para mensagens enviadas via API HTTP
          messageLatency.observe({ status: "success" }, latency);
          messagesSentViaAPI.inc({ status: "success" });
          sent++;
        } catch (err) {
          const latency = (Date.now() - startTime) / 1000;
          messageLatency.observe({ status: "error" }, latency);
          // Don't increment messagesSentViaAPI on error - message was not successfully sent
          errorsTotal.inc({ type: "send_error" });
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
    delayRange: `${MIN_DELAY_MS}-${MAX_DELAY_MS}ms`,
    messageRate: `${MESSAGE_RATE}ms`
  });
});

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
  errorsTotal.inc({ type: "uncaught_exception" });
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  errorsTotal.inc({ type: "unhandled_rejection" });
  logger.error("Unhandled rejection", {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
