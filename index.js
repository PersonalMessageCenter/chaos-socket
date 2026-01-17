const WebSocket = require("ws");
const express = require("express");
const logger = require("./logger");
const config = require("./config");

const WS_PORT = process.env.WS_PORT || 4001;
const API_PORT = process.env.API_PORT || 9101;

// Get message interval from profile
const MESSAGE_RATE = config.calculateMessageInterval(
  config.profile.timing?.messages_per_minute || 5
);

// Active connections map (exported for testing)
const activeConnectionsMap = new Map();

// Express app for HTTP API
const apiApp = express();
apiApp.use(express.json());

/**
 * Generate a message based on the current profile
 * @param {string} connectionId - Connection identifier for logging
 * @returns {object} Generated message
 */
function generateMessage(connectionId) {
  const now = Date.now();
  const profile = config.profile;
  
  // Select message type based on profile probabilities
  const messageType = config.selectMessageType(
    profile.message_types || { text: 1.0 }
  );
  
  // Get sender from pool (round-robin for realistic distribution)
  const sender = config.getNextSender();
  
  // Generate content based on message type
  let content;
  switch (messageType) {
    case "image":
      content = `[Image: img_${now}.jpg]`;
      break;
    case "audio":
      content = `[Audio: audio_${now}.ogg]`;
      break;
    case "document":
      content = `[Document: doc_${now}.pdf]`;
      break;
    case "sticker":
      content = `[Sticker: sticker_${now}]`;
      break;
    default:
      content = `Test message ${now}`;
  }
  
  return {
    id: `msg_${now}_${Math.random().toString(36).slice(2, 11)}`,
    timestamp: new Date().toISOString(),
    sender,
    type: messageType,
    content,
    raw_payload: {
      simulated: true,
      chaos_socket: true,
      profile: config.profileName
    }
  };
}

/**
 * Calculate next message delay with burst support
 * @returns {number} Delay in milliseconds
 */
function calculateNextDelay() {
  const profile = config.profile;
  const timing = profile.timing || {};
  
  // Check for burst
  if (Math.random() < (timing.burst_probability || 0)) {
    // In burst mode, send messages quickly
    return config.randomInRange(timing.typing_delay_ms || { min: 100, max: 500 });
  }
  
  // Normal interval
  return MESSAGE_RATE;
}

// Servidor WebSocket (only create if main module)
let wss;
if (require.main === module) {
  wss = new WebSocket.Server({ port: WS_PORT });

  wss.on("listening", () => {
    logger.info("Chaos Socket WebSocket server started", {
      port: WS_PORT,
      profile: config.profileName,
      profileDescription: config.profile.description,
      messageRate: `${MESSAGE_RATE}ms`,
      messagesPerMinute: config.profile.timing?.messages_per_minute
    });
  });
}

if (wss) {
  wss.on("connection", (ws, req) => {
    const clientAddress = req.socket.remoteAddress;
    const connectionId = `${clientAddress}-${Date.now()}`;
    activeConnectionsMap.set(connectionId, ws);
    
    logger.info("New WebSocket connection", { 
      remoteAddress: clientAddress,
      connectionId,
      activeConnections: activeConnectionsMap.size,
      profile: config.profileName
    });

    try {
      ws.send(JSON.stringify({
        type: "connection",
        status: "connected",
        timestamp: new Date().toISOString(),
        profile: config.profileName
      }));
    } catch (err) {
      logger.error("Error sending connection confirmation", {
        connectionId,
        error: err.message
      });
    }

    // Message simulation with profile-based timing
    let burstCount = 0;
    const maxBurstSize = config.randomInRange(
      config.profile.timing?.burst_size || { min: 1, max: 3 }
    );
    
    const scheduleNextMessage = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      
      const delay = calculateNextDelay();
      
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        const message = generateMessage(connectionId);
        
        try {
          ws.send(JSON.stringify(message));
          
          logger.debug("Simulated message sent to client", {
            connectionId,
            messageId: message.id,
            sender: message.sender,
            type: message.type,
            profile: config.profileName
          });
          
          // Handle burst
          if (burstCount < maxBurstSize && Math.random() < (config.profile.timing?.burst_probability || 0)) {
            burstCount++;
          } else {
            burstCount = 0;
          }
          
          // Schedule next message
          scheduleNextMessage();
        } catch (err) {
          logger.error("Error sending simulated message", {
            connectionId,
            error: err.message,
            stack: err.stack
          });
        }
      }, delay);
    };
    
    // Start message simulation
    scheduleNextMessage();

    ws.on("message", (msg) => {
      try {
        const message = JSON.parse(msg.toString());
        const flow = message.type || "default";
        
        logger.info("Message received from client", {
          connectionId,
          flow
        });
      } catch (err) {
        logger.error("Error processing message from client", {
          connectionId,
          error: err.message
        });
      }
    });

    ws.on("close", (code, reason) => {
      activeConnectionsMap.delete(connectionId);
      
      logger.info("WebSocket connection closed", {
        remoteAddress: clientAddress,
        connectionId,
        code,
        reason: reason.toString(),
        activeConnections: activeConnectionsMap.size
      });
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error", {
        remoteAddress: clientAddress,
        connectionId,
        error: error.message,
        stack: error.stack
      });
    });
  });
}

// API Endpoints
apiApp.post("/api/send-message", (req, res) => {
  const { message, connectionId } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

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

apiApp.get("/api/status", (req, res) => {
  res.json({
    activeConnections: activeConnectionsMap.size,
    profile: {
      name: config.profileName,
      description: config.profile.description,
      messagesPerMinute: config.profile.timing?.messages_per_minute,
      messageRate: `${MESSAGE_RATE}ms`
    }
  });
});

apiApp.get("/api/profiles", (req, res) => {
  const profiles = config.listProfiles();
  res.json({
    current: config.profileName,
    available: profiles
  });
});

apiApp.get("/api/profile/:name", (req, res) => {
  const { name } = req.params;
  try {
    const profile = config.loadProfile(name);
    res.json(profile);
  } catch (err) {
    res.status(404).json({ error: `Profile not found: ${name}` });
  }
});

// Graceful shutdown (only if main module)
if (require.main === module) {
  apiApp.listen(API_PORT, () => {
    logger.info("API server started", { 
      port: API_PORT,
      profile: config.profileName
    });
  });

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
} else {
  // Export for testing
  module.exports = { apiApp, activeConnectionsMap, MESSAGE_RATE, config };
}

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
