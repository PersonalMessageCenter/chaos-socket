const express = require("express");
const client = require("prom-client");

const register = new client.Registry();

// Coletar métricas padrão do sistema
client.collectDefaultMetrics({ register });

// Histograma para latência de mensagens
const messageLatency = new client.Histogram({
  name: "chaos_socket_message_latency_seconds",
  help: "Message processing latency in seconds",
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  labelNames: ["status"]
});
register.registerMetric(messageLatency);

// Contador de mensagens recebidas
const messagesReceived = new client.Counter({
  name: "chaos_socket_messages_received_total",
  help: "Total number of messages received",
  labelNames: ["status"]
});
register.registerMetric(messagesReceived);

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
  messagesReceived,
  connectionsTotal,
  activeConnections,
  errorsTotal,
  metricsApp
};
