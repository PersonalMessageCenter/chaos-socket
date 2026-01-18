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
 * Generate a message event based on the current profile
 * @returns {object} Generated message event
 */
function generateMessageEvent() {
  const now = Date.now();
  const profile = config.profile;
  
  // Select message type based on profile probabilities
  const messageType = config.selectMessageType(
    profile.message_types || { text: 1.0 }
  );
  
  // Get sender from pool
  const sender = config.getNextSender();
  const chat = config.generateChatId();
  
  // Generate content based on message type
  let content;
  switch (messageType) {
    case "image":
      content = `[Image: img_${now}.jpg]`;
      break;
    case "audio":
      content = `[Audio: audio_${now}.ogg]`;
      break;
    case "video":
      content = `[Video: video_${now}.mp4]`;
      break;
    case "file":
    case "document":
      content = `[File: doc_${now}.pdf]`;
      break;
    case "sticker":
      content = `[Sticker: sticker_${now}]`;
      break;
    default:
      content = `Test message ${now}`;
  }
  
  const message = {
    event: "message",
    id: config.generateMessageId(),
    timestamp: new Date().toISOString(),
    sender,
    chat,
    message_type: messageType,
    content,
    metadata: {
      simulated: true,
      chaos_socket: true,
      profile: config.profileName
    }
  };
  
  // Add to history for future reference (read, reaction, etc.)
  config.addToMessageHistory(message);
  
  return message;
}

/**
 * Generate a typing event
 * @returns {object} Typing event
 */
function generateTypingEvent() {
  return {
    event: "typing",
    id: config.generateMessageId(),
    timestamp: new Date().toISOString(),
    sender: config.getNextSender(),
    chat: config.generateChatId(),
    status: config.getRandomTypingState(),
    metadata: {
      simulated: true,
      chaos_socket: true,
      profile: config.profileName
    }
  };
}

/**
 * Generate a read receipt event
 * @returns {object} Read event
 */
function generateReadEvent() {
  const referencedMessage = config.getRandomFromHistory();
  
  return {
    event: "read",
    id: config.generateMessageId(),
    timestamp: new Date().toISOString(),
    reader: config.getNextSender(),
    chat: referencedMessage?.chat || config.generateChatId(),
    message_id: referencedMessage?.id || config.generateMessageId(),
    metadata: {
      simulated: true,
      chaos_socket: true,
      profile: config.profileName
    }
  };
}

/**
 * Generate a delivered event
 * @returns {object} Delivered event
 */
function generateDeliveredEvent() {
  const referencedMessage = config.getRandomFromHistory();
  
  return {
    event: "delivered",
    id: config.generateMessageId(),
    timestamp: new Date().toISOString(),
    recipient: config.getNextSender(),
    chat: referencedMessage?.chat || config.generateChatId(),
    message_id: referencedMessage?.id || config.generateMessageId(),
    metadata: {
      simulated: true,
      chaos_socket: true,
      profile: config.profileName
    }
  };
}

/**
 * Generate a presence event
 * @returns {object} Presence event
 */
function generatePresenceEvent() {
  return {
    event: "presence",
    id: config.generateMessageId(),
    timestamp: new Date().toISOString(),
    user: config.getNextSender(),
    status: config.getRandomPresenceState(),
    last_seen: new Date().toISOString(),
    metadata: {
      simulated: true,
      chaos_socket: true,
      profile: config.profileName
    }
  };
}

/**
 * Generate a reaction event
 * @returns {object} Reaction event
 */
function generateReactionEvent() {
  const referencedMessage = config.getRandomFromHistory();
  
  return {
    event: "reaction",
    id: config.generateMessageId(),
    timestamp: new Date().toISOString(),
    user: config.getNextSender(),
    chat: referencedMessage?.chat || config.generateChatId(),
    message_id: referencedMessage?.id || config.generateMessageId(),
    reaction: config.getRandomReaction(),
    metadata: {
      simulated: true,
      chaos_socket: true,
      profile: config.profileName
    }
  };
}

/**
 * Generate an edit event
 * @returns {object} Edit event
 */
function generateEditEvent() {
  const referencedMessage = config.getRandomFromHistory();
  const now = Date.now();
  
  return {
    event: "edit",
    id: config.generateMessageId(),
    timestamp: new Date().toISOString(),
    editor: referencedMessage?.sender || config.getNextSender(),
    chat: referencedMessage?.chat || config.generateChatId(),
    message_id: referencedMessage?.id || config.generateMessageId(),
    new_content: `[Edited] Updated message ${now}`,
    metadata: {
      simulated: true,
      chaos_socket: true,
      profile: config.profileName
    }
  };
}

/**
 * Generate a delete event
 * @returns {object} Delete event
 */
function generateDeleteEvent() {
  const referencedMessage = config.getRandomFromHistory();
  
  return {
    event: "delete",
    id: config.generateMessageId(),
    timestamp: new Date().toISOString(),
    deleted_by: referencedMessage?.sender || config.getNextSender(),
    chat: referencedMessage?.chat || config.generateChatId(),
    message_id: referencedMessage?.id || config.generateMessageId(),
    delete_for_everyone: Math.random() > 0.5,
    metadata: {
      simulated: true,
      chaos_socket: true,
      profile: config.profileName
    }
  };
}

/**
 * Generate an event based on the current profile's event distribution
 * @returns {object} Generated event
 */
function generateEvent() {
  const profile = config.profile;
  const eventType = config.selectEventType(profile.events || {});
  
  switch (eventType) {
    case "message":
      return generateMessageEvent();
    case "typing":
      return generateTypingEvent();
    case "read":
      return generateReadEvent();
    case "delivered":
      return generateDeliveredEvent();
    case "presence":
      return generatePresenceEvent();
    case "reaction":
      return generateReactionEvent();
    case "edit":
      return generateEditEvent();
    case "delete":
      return generateDeleteEvent();
    default:
      return generateMessageEvent();
  }
}

/**
 * Calculate next event delay with burst support
 * @returns {number} Delay in milliseconds
 */
function calculateNextDelay() {
  const profile = config.profile;
  const timing = profile.timing || {};
  
  // Check for burst
  if (Math.random() < (timing.burst_probability || 0)) {
    // In burst mode, send events quickly
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
      messagesPerMinute: config.profile.timing?.messages_per_minute,
      eventTypes: Object.keys(config.profile.events || {}).filter(
        k => config.profile.events[k] > 0
      )
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
        event: "connection",
        status: "connected",
        timestamp: new Date().toISOString(),
        profile: config.profileName,
        available_events: Object.keys(config.profile.events || {}).filter(
          k => config.profile.events[k] > 0
        )
      }));
    } catch (err) {
      logger.error("Error sending connection confirmation", {
        connectionId,
        error: err.message
      });
    }

    // Event simulation with profile-based timing
    let burstCount = 0;
    const maxBurstSize = config.randomInRange(
      config.profile.timing?.burst_size || { min: 1, max: 3 }
    );
    
    const scheduleNextEvent = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      
      const delay = calculateNextDelay();
      
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        const event = generateEvent();
        
        try {
          ws.send(JSON.stringify(event));
          
          logger.debug("Simulated event sent to client", {
            connectionId,
            eventId: event.id,
            eventType: event.event,
            sender: event.sender || event.user || event.reader,
            profile: config.profileName
          });
          
          // Handle burst
          if (burstCount < maxBurstSize && Math.random() < (config.profile.timing?.burst_probability || 0)) {
            burstCount++;
          } else {
            burstCount = 0;
          }
          
          // Schedule next event
          scheduleNextEvent();
        } catch (err) {
          logger.error("Error sending simulated event", {
            connectionId,
            error: err.message,
            stack: err.stack
          });
        }
      }, delay);
    };
    
    // Start event simulation
    scheduleNextEvent();

    ws.on("message", (msg) => {
      try {
        const message = JSON.parse(msg.toString());
        const flow = message.event || message.type || "default";
        
        logger.info("Event received from client", {
          connectionId,
          flow
        });
      } catch (err) {
        logger.error("Error processing event from client", {
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
apiApp.post("/api/send-event", (req, res) => {
  const { event, connectionId } = req.body;
  
  if (!event) {
    return res.status(400).json({ error: "Event is required" });
  }

  let sent = 0;
  activeConnectionsMap.forEach((ws, id) => {
    if (!connectionId || id === connectionId) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(event));
          sent++;
        } catch (err) {
          logger.error("Error sending event via API", { error: err.message });
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

// Keep backward compatibility
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
      messageRate: `${MESSAGE_RATE}ms`,
      events: config.profile.events,
      messageTypes: config.profile.message_types
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

apiApp.get("/api/events", (req, res) => {
  res.json({
    available: ["message", "typing", "read", "delivered", "presence", "reaction", "edit", "delete"],
    current_distribution: config.profile.events
  });
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
  module.exports = { 
    apiApp, 
    activeConnectionsMap, 
    MESSAGE_RATE, 
    config,
    generateEvent,
    generateMessageEvent,
    generateTypingEvent,
    generateReadEvent,
    generateDeliveredEvent,
    generatePresenceEvent,
    generateReactionEvent,
    generateEditEvent,
    generateDeleteEvent
  };
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
