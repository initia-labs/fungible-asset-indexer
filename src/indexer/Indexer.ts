import { EntityManager } from 'typeorm'
import { parseEvents } from '../lib/parse'
import { ScrappedBlock } from '../lib/rpc'
import { Monitor } from './Monitor'
import { BalanceEntity, dataSource, SnapshotEntity } from '../orm'
import { DepositEvent, WithdrawEvent } from './events'
import { FungibleAssetType } from 'src/lib/enum'
import { logger } from 'src/lib/logger'

const batchSize = 100
export class Indexer extends Monitor {
  name(): string {
    return `fungible_asset_indexer-${this.denom}`
  }
  // setup the indexer
  async setup(): Promise<void> {
    this.metadata = await this.rest.getMetadata(this.denom)
    const snapshot: SnapshotEntity | null = await dataSource
      .getRepository(SnapshotEntity)
      .findOne({
        where: {
          denom: this.denom,
        },
      })
    if (snapshot && snapshot.height >= this.startHeight) return

    logger.info(`Setting up snapshot for ${this.name()}`)
    // check if the asset exists at given creation height
    const exist = await this.rest.checkAssetExists(
      this.creationHeight,
      this.metadata
    )
    if (!exist) {
      throw new Error(
        `Asset ${this.denom} does not exist at height ${this.creationHeight}`
      )
    }
    // collect store accounts from creation height to start height and do snapshot
    for (let h = this.creationHeight; h <= this.startHeight; h++) {
      const block = await this.rpc.scrapBlock(h)
      this.collectEvents(block)
    }
    await dataSource.transaction(async (manager) => {
      await this.snapshot(this.startHeight, manager)
      await manager.getRepository(SnapshotEntity).upsert(
        { denom: this.denom, height: this.startHeight },
        {
          conflictPaths: ['denom'],
          skipUpdateIfNoValuesChanged: true,
        }
      )
    })
  }

  async handleBlock(
    manager: EntityManager,
    block: ScrappedBlock
  ): Promise<void> {
    const height = Number(block.block.header.height)
    this.collectEvents(block)
    // return if no snapshot
    if (!this.shouldSnapshot(height)) return
    await this.snapshot(height, manager)
  }

  /**
   * @dev collect the fungible asset events from block
   */
  private collectEvents(block: ScrappedBlock) {
    for (const event of parseEvents(block)) {
      if (event.type === 'move') {
        switch (event.attributes.type_tag) {
          case '0x1::fungible_asset::DepositEvent': {
            const depositEvent = JSON.parse(
              event.attributes.data
            ) as DepositEvent
            if (depositEvent.metadata_addr !== this.metadata) break
            this.storeAddrs.add(depositEvent.store_addr)
            break
          }
          case '0x1::fungible_asset::WithdrawEvent': {
            const withdrawEvent = JSON.parse(
              event.attributes.data
            ) as WithdrawEvent
            if (withdrawEvent.metadata_addr !== this.metadata) break
            this.storeAddrs.add(withdrawEvent.store_addr)
            break
          }
          default:
            break
        }
      }
    }
  }

  /**
   * @dev snapshot the balance of fungible asset
   */
  private async snapshot(height: number, manager: EntityManager) {
    const balanceMap: Record<string, number> = {}
    const stores = Array.from(this.storeAddrs)
    // batch query balance
    for (let i = 0; i < stores.length; i += batchSize) {
      const batch = stores.slice(i, i + batchSize)
      const batchRes = await Promise.all(
        batch.map(async (addr) => [
          addr,
          await this.rest.getFungibleAssetAmount(height, addr),
        ])
      )
      for (const [addr, balance] of batchRes) {
        balanceMap[addr] = Number(balance ?? 0)
      }
    }
    // snapshot; batch insert entities
    const entities: BalanceEntity[] = await Promise.all(
      Object.entries(balanceMap).map(async ([storeAddr, amount]) => {
        return this.getBalanceEntity(height, amount, storeAddr)
      })
    )
    // store the balance entities
    for (let i = 0; i < entities.length; i += batchSize) {
      const sliced = entities.slice(i, i + batchSize)
      await manager.getRepository(BalanceEntity).insert(sliced)
    }
  }

  private async getBalanceEntity(
    height: number,
    amount: number,
    storeAddr: string
  ) {
    let underlying: Record<string, number> | undefined
    switch (this.faType) {
      case FungibleAssetType.StableLP: {
        const [[amountA, amountB, totalShare], [coinADenom, coinBDenom]] =
          await Promise.all([
            this.rest.getWeightPoolAmount(height, this.metadata),
            await this.rest.getPairMetadata(height, this.metadata),
          ])
        const balanceA = (amountA * amount) / totalShare
        const balanceB = (amountB * amount) / totalShare
        underlying = {
          [coinADenom]: balanceA,
          [coinBDenom]: balanceB,
        }
        break
      }
      case FungibleAssetType.WeightLP: {
        const [{ coin_balances: balances, coin_denoms: denoms }, totalSupply] =
          await Promise.all([
            this.rest.getStablePoolAmount(height, this.metadata),
            this.rest.getFungibleAssetSupply(height, this.metadata),
          ])
        underlying = {}
        for (let i = 0; i < balances.length; i++) {
          underlying[denoms[i]] = (balances[i] * amount) / totalSupply
        }
        break
      }
      default: // normal fungible asset
        break
    }
    return {
      storeAddr,
      denom: this.denom,
      height,
      amount,
      underlying,
    }
  }
}
