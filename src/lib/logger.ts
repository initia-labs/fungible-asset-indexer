import winston from 'winston'

function createLogger(name: string) {
  const formats = [
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf((info) => {
      const { timestamp, level, message, context, action } = info
      return JSON.stringify({
        timestamp,
        level,
        message,
        context,
        action,
      })
    }),
  ]

  const logger = winston.createLogger({
    format: winston.format.combine(...formats),
    defaultMeta: { service: name },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  })

  return logger
}

export const logger = createLogger('fungible-asset-indexer')
