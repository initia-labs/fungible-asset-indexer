import { setTimeout as delay } from 'timers/promises'
import { EntityManager } from 'typeorm'
import { config } from '../config'
import { logger } from '../lib/logger'
import { RESTClient } from '../lib/rest'
import { RPCClient, ScrappedBlock } from '../lib/rpc'
import { dataSource, SnapshotEntity } from '../orm'
import { Denom } from '@initia/initia.js'
import { FungibleAssetType } from 'src/lib/enum'

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
export abstract class Monitor {
  rpc: RPCClient
  rest: RESTClient
  faType: FungibleAssetType
  denom: Denom
  creationHeight: number
  startHeight: number

  metadata: string
  isRunning = false
  latestHeight = 0
  scrappedHeight = 0
  syncedHeight = 0
  blockMap: Record<number, ScrappedBlock> = {}
  storeAddrs = new Set<string>() // set of stores to fetch balance every snapshot interval

  constructor(
    rpcUrl: string,
    restUrl: string,
    denom: Denom,
    faType: FungibleAssetType,
    creationHeight: number,
    startHeight?: number
  ) {
    this.rpc = new RPCClient(rpcUrl)
    this.rest = new RESTClient(restUrl)
    this.faType = faType
    this.denom = denom
    this.creationHeight = creationHeight
    this.startHeight = startHeight || creationHeight
  }

  async run(): Promise<void> {
    const latestBlock = await this.rpc.getBlock()
    this.latestHeight = Number(latestBlock.header.height)
    await this.setup()
    this.syncedHeight = Number(this.startHeight)
    this.scrappedHeight = this.syncedHeight
    this.isRunning = true

    this.checkHeight()
    this.scrapBlock()
    this.processBlock()
  }

  abstract setup(): Promise<void>

  stop(): void {
    this.isRunning = false
  }

  async checkHeight(): Promise<void> {
    while (this.isRunning) {
      try {
        const block = await this.rpc.getBlock()
        this.latestHeight = Math.max(
          this.latestHeight,
          Number(block.header.height)
        )
      } catch (err) {
        console.log(`Error in checkHeight for ${this.name()} ${err}`)
        logger.error(`Error in checkHeight for ${this.name()} ${err}`)
      } finally {
        await delay(config.MONITOR_INTERVAL)
      }
    }
  }

  async scrapBlock(): Promise<void> {
    while (this.isRunning) {
      try {
        const keys = Object.keys(this.blockMap)
        if (keys.length > 100) {
          for (const key of keys) {
            if (Number(key) < this.syncedHeight) {
              delete this.blockMap[key]
            }
          }
          continue
        }

        if (this.latestHeight <= this.scrappedHeight) continue

        this.rpc
          .scrapBlock(this.scrappedHeight + 1)
          .then((block) => {
            const height = Number(block.block.header.height)
            if (height > this.syncedHeight) {
              this.blockMap[height] = block
            }
          })
          .catch((err) => {
            console.log(`Error in scrapBlock for ${this.name()} ${err}`)
            logger.error(`Error in scrapBlock for ${this.name()} ${err}`)
          })
        this.scrappedHeight++
      } catch (err) {
        console.log(`Error in scrapBlock for ${this.name()} ${err}`)
        logger.error(`Error in scrapBlock for ${this.name()} ${err}`)
      } finally {
        await delay(config.COOLING_DURATION)
      }
    }
  }

  async processBlock(): Promise<void> {
    while (this.isRunning) {
      try {
        if (this.latestHeight <= this.syncedHeight) continue

        const currentHeight = this.syncedHeight + 1
        let scrappedBlock = this.blockMap[currentHeight]
        if (scrappedBlock) {
          delete this.blockMap[currentHeight]
        } else if (this.scrappedHeight > currentHeight + 10) {
          scrappedBlock = await this.rpc.scrapBlock(currentHeight)
        } else {
          continue
        }

        await dataSource.transaction(async (manager: EntityManager) => {
          await this.handleBlock(manager, scrappedBlock)
          if (currentHeight % 10 === 0) {
            logger.info(`${this.name()} height ${currentHeight}`)
          }

          // update state only when snapshot
          if (this.shouldSnapshot(currentHeight)) {
            await manager.getRepository(SnapshotEntity).update(
              { denom: this.denom },
              {
                height: currentHeight,
              }
            )
          }
        })
        this.syncedHeight++
      } catch (err) {
        console.log(`Error in processBlock for ${this.name()} ${err}`)
        logger.error(`Error in processBlock for ${this.name()} ${err}`)
      } finally {
        await delay(config.COOLING_DURATION)
      }
    }
  }

  abstract handleBlock(
    manager: EntityManager,
    block: ScrappedBlock
  ): Promise<void>

  name(): string {
    return ''
  }

  shouldSnapshot(height: number) {
    return height % config.SNAPSHOT_INTERVAL === 0
  }
}
