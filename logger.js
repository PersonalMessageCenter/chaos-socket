const winston = require("winston");

const logLevel = process.env.LOG_LEVEL || "info";

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "chaos-socket" },
  transports: [
    // Escrever todos os logs em console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0 && meta.service !== "chaos-socket") {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      ),
    }),
  ],
});

// Se não estiver em produção, também logar em arquivo
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.File({
      filename: "chaos-socket-error.log",
      level: "error",
    })
  );
  logger.add(
    new winston.transports.File({
      filename: "chaos-socket-combined.log",
    })
  );
}

module.exports = logger;

