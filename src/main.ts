import { once } from 'lodash'
import { runIndexers, stopIndexers } from './indexer'
import { initConnection, finalizeConnection } from './orm'
import { bootstrap } from './api/main'

async function gracefulShutdown(): Promise<void> {
  stopIndexers()
  await finalizeConnection()
  process.exit(0)
}

export async function start(): Promise<void> {
  await initConnection()
  await runIndexers()

  // attach graceful shutdown
  const signals = ['SIGHUP', 'SIGINT', 'SIGTERM'] as const
  signals.forEach((signal) => process.on(signal, once(gracefulShutdown)))
}

if (require.main === module) {
  start().catch(console.log)
  // start the API server
  bootstrap()
}
