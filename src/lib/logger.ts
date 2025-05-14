import winston from 'winston'

function createLogger(name: string) {
  const formats = [winston.format.errors({ stack: true })]

  formats.push(winston.format.colorize())

  formats.push(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      return `${info.timestamp} [${info.level} - ${name}]: ${
        info.stack || info.message
      }`
    })
  )

  const logger = winston.createLogger({
    format: winston.format.combine(...formats),
    defaultMeta: { service: 'user-service' },
  })

  logger.add(new winston.transports.Console())

  return logger
}

export const logger = createLogger('fungible-asset-indexer')
