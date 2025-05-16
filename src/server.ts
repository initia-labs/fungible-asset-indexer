import * as http from 'http'
import { config } from './config'
import { logger } from './lib/logger'
import { dataSource, SnapshotEntity } from './orm'

let server: http.Server

export function initServer(): http.Server {
  server = http.createServer(async (req, res) => {
    if (req.url === `/snapshot` && req.method === 'GET') {
      const snapshot = await dataSource.getRepository(SnapshotEntity).find()

      if (!snapshot || snapshot.length === 0) {
        res.writeHead(404, { 'Content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'Snapshot not found' }))
        return
      }
      res.end(JSON.stringify(snapshot, null, 2))

      return
    }
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
