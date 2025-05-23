import { config } from '../config'
import { logger } from '../lib/logger'
import { Monitor } from './Monitor'
import { FungibleAssetIndexer } from './Indexer'

const indexers: Monitor[] = []

export async function runIndexers(): Promise<void> {
  const rpcUrl = config.RPC_URL
  const restUrl = config.REST_URL
  for (const asset of config.FUNGIBLE_ASSETS) {
    const indexer = new FungibleAssetIndexer(
      rpcUrl,
      restUrl,
      asset.type,
      asset.denom,
      asset.start_height
    )
    indexers.push(indexer)
  }

  try {
    for (const indexer of indexers) {
      await indexer.run()
    }
  } catch (err) {
    // stop all indexers on error
    logger.info(err)
    stopIndexers()
  }
}

export function stopIndexers(): void {
  for (const indexer of indexers) {
    indexer.stop()
  }
  indexers.length = 0
}
