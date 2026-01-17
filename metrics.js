const express = require("express");
const client = require("prom-client");

const register = new client.Registry();

// Coletar métricas padrão do sistema
client.collectDefaultMetrics({ register });

// Histograma para latência de envio de mensagens via WebSocket
const messageLatency = new client.Histogram({
  name: "chaos_socket_message_send_latency_seconds",
  help: "Message send latency via WebSocket in seconds",
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  labelNames: ["status"]
});
register.registerMetric(messageLatency);

// Histograma para latência de mensagens enviadas via API HTTP
const messageLatencyViaAPI = new client.Histogram({
  name: "chaos_socket_message_latency_via_api_seconds",
  help: "Message processing latency for messages sent via HTTP API in seconds",
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  labelNames: ["status"]
});
register.registerMetric(messageLatencyViaAPI);

// Contador de mensagens recebidas (via WebSocket dos clientes)
const messagesReceived = new client.Counter({
  name: "chaos_socket_messages_received_total",
  help: "Total number of messages received from WebSocket clients",
  labelNames: ["flow"]
});
register.registerMetric(messagesReceived);

// Contador de mensagens enviadas (via WebSocket para clientes)
const messagesSent = new client.Counter({
  name: "chaos_socket_messages_sent_total",
  help: "Total number of messages sent to WebSocket clients",
  labelNames: ["status"]
});
register.registerMetric(messagesSent);

// Contador de mensagens enviadas via HTTP API (diferente de WebSocket)
const messagesSentViaAPI = new client.Counter({
  name: "chaos_socket_messages_sent_via_api_total",
  help: "Total number of messages sent via HTTP API endpoint",
  labelNames: ["status"]
});
register.registerMetric(messagesSentViaAPI);

// Contador de conexões
const connectionsTotal = new client.Counter({
  name: "chaos_socket_connections_total",
  help: "Total number of WebSocket connections",
  labelNames: ["event"]
});
register.registerMetric(connectionsTotal);

// Gauge de conexões ativas
const activeConnections = new client.Gauge({
  name: "chaos_socket_active_connections",
  help: "Number of active WebSocket connections"
});
register.registerMetric(activeConnections);

// Contador de erros
const errorsTotal = new client.Counter({
  name: "chaos_socket_errors_total",
  help: "Total number of errors",
  labelNames: ["type"]
});
register.registerMetric(errorsTotal);

// Criar servidor Express para endpoint de métricas
const metricsApp = express();

metricsApp.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

module.exports = {
  messageLatency,
  messageLatencyViaAPI,
  messagesReceived,  // Mensagens recebidas via WebSocket (dos clientes)
  messagesSent,     // Mensagens enviadas via WebSocket (para clientes)
  messagesSentViaAPI, // Mensagens enviadas via HTTP API
  connectionsTotal,
  activeConnections,
  errorsTotal,
  metricsApp
};
