import * as http from 'http'
import { config } from './config'
import { logger } from './lib/logger'

let server: http.Server

export function initServer(): http.Server {
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-type': 'text/plain' })
    res.end('OK\n')
  })

  server.listen(config.PORT, () => {
    logger.info(`Listening on port ${config.PORT}`)
  })

  return server
}

export function finalizeServer(): void {
  server.close()
}
