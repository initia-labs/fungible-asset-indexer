import { config as initConfig } from 'dotenv'
import { getEnv } from './validation'
import { FungibleAssetType } from './lib/enum'

initConfig()

export const config = {
  PORT: getEnv('PORT', '5000'),
  RPC_URL: getEnv('RPC_URL', 'https://rpc.testnet.initia.xyz'),
  REST_URL: getEnv('REST_URL', 'https://rest.testnet.initia.xyz'),
  MONITOR_INTERVAL: parseInt(getEnv('MONITOR_INTERVAL', '1000')),
  COOLING_DURATION: parseInt(getEnv('COOLING_DURATION', '10')),
  SNAPSHOT_INTERVAL: parseInt(getEnv('SNAPSHOT_INTERVAL', '100')),
  FUNGIBLE_ASSETS: JSON.parse(getEnv('FUNGIBLE_ASSETS', '[]')) as {
    denom: string
    type: FungibleAssetType
    start_height: number
  }[], 
  DBHOST: getEnv('DBHOST', 'localhost'),
  DBHOSTRO: getEnv('DBHOSTRO', 'localhost'),
  DATABASE: getEnv('DATABASE', 'fungible_asset_indexer'),
}
