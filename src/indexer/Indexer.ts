import { EntityManager, In } from 'typeorm'
import { parseEvents } from '../lib/parse'
import { ScrappedBlock } from '../lib/rpc'
import { Monitor } from './Monitor'
import {
  BalanceEntity,
  BalanceHistoryEntity,
  dataSource,
  PoolEntity,
  SnapshotEntity,
} from '../orm'
import { FugibleAssetEvent } from './events'
import { FungibleAssetType } from 'src/lib/enum'
import { logger } from 'src/lib/logger'
import { getPrimaryStore } from 'src/lib/primary'

const batchSize = 100
export class FungibleAssetIndexer extends Monitor {
  name(): string {
    return `fungible_asset_indexer-${this.denom}`
  }
  // setup the indexer
  async setup(): Promise<void> {
    this.metadata = await this.rest.getMetadata(this.denom)
    const snapshot = await dataSource.getRepository(SnapshotEntity).findOne({
      where: { denom: this.denom },
    })
    if (snapshot && this.startHeight <= snapshot.height) {
      this.startHeight = snapshot.height
      return
    }

    await dataSource.transaction(async (manager) => {
      // check if the asset exists
      this.assetExists = await this.rest.checkAssetExists(
        this.startHeight,
        this.metadata
      )
      if (this.assetExists) {
        logger.info('Asset exists, fetching all of accounts holding ...')
        // get all accounts
        const accounts = await this.rest.getAllCosmosAccounts(this.startHeight)
        // get all balances and insert them into the balance table
        for (let i = 0; i < accounts.length; i += batchSize) {
          const accountsBatch = accounts.slice(i, i + batchSize)
          const batchResults = (
            await Promise.all(
              accountsBatch.map(async (account) => {
                const balance = await this.rest.getBalance(
                  this.startHeight,
                  account,
                  this.denom
                )
                return {
                  owner: account,
                  storeAddress: getPrimaryStore(account, this.metadata),
                  ...balance,
                }
              })
            )
          ).filter((result) => result.amount !== '0')
          if (batchResults.length === 0) continue
          await manager.getRepository(BalanceEntity).insert(batchResults)
        }
      }
      // insert the snapshot into the snapshot table
      await manager.insert(SnapshotEntity, {
        denom: this.denom,
        height: this.startHeight,
      })
    })
  }

  async handleBlock(
    manager: EntityManager,
    block: ScrappedBlock
  ): Promise<void> {
    const height = Number(block.block.header.height)
    await this.handleBalanceDiff(block, manager)
    // return if no snapshot
    if (!this.shouldSnapshot(height)) return
    logger.info(`Snapshot fungible asset :${this.denom}, height: ${height}`)
    // 1. Snapshot Balance and make history of it.
    await this.snapshotBalanceHistory(height, manager)
    logger.info(
      `Snapshot balance history for ${this.denom} at height ${height}`
    )
    // 2. Snapshot underlying token amount of pool. skip the normal token
    if (this.faType === FungibleAssetType.Normal) return
    logger.info(`Snapshot pool for ${this.denom} at height ${height}`)
    await this.snapshotPool(height, manager)
  }

  /**
   * @dev collect the fungible asset events from block
   */
  private async handleBalanceDiff(
    block: ScrappedBlock,
    manager: EntityManager
  ) {
    const store2BalanceDiff = new Map<string, number>()
    for (const event of parseEvents(block)) {
      if (event.type !== 'move') {
        continue
      }
      let diff: number
      let storeAddr: string
      switch (event.attributes.type_tag) {
        case '0x1::fungible_asset::DepositEvent':
        case '0x1::fungible_asset::WithdrawEvent': {
          const eventData = JSON.parse(
            event.attributes.data
          ) as FugibleAssetEvent
          if (eventData.metadata_addr !== this.metadata) continue

          const eventAmount = parseInt(eventData.amount, 10)
          storeAddr = eventData.store_addr
          diff =
            event.attributes.type_tag === '0x1::fungible_asset::WithdrawEvent'
              ? -eventAmount
              : eventAmount
          break
        }
        default:
          // skip other events
          continue
      }
      const existingValue = store2BalanceDiff.get(storeAddr) || 0
      store2BalanceDiff.set(storeAddr, existingValue + diff)
    }

    // Update the balance table with the diff
    const latestBalances = await manager.getRepository(BalanceEntity).find({
      where: {
        storeAddress: In(Array.from(store2BalanceDiff.keys())),
        denom: this.denom,
      },
    })
    const latestBalanceMap = new Map<string, number>(
      latestBalances.map((balance) => [
        balance.storeAddress,
        parseInt(balance.amount, 10),
      ])
    )
    const balanceRepo = manager.getRepository(BalanceEntity)
    const balanceEntities = Array.from(store2BalanceDiff.entries()).map(
      ([storeAddress, diffAmount]) => {
        const latestBalance = latestBalanceMap.get(storeAddress)
        return {
          storeAddress,
          denom: this.denom,
          amount: latestBalance
            ? (latestBalance + diffAmount).toString()
            : diffAmount.toString(),
        }
      }
    )
    await balanceRepo.save(balanceEntities, { chunk: batchSize })
  }

  private async snapshotBalanceHistory(height: number, manager: EntityManager) {
    // if there are rows that have empty string and primary is true, update them
    const updatableBalances = await manager.getRepository(BalanceEntity).find({
      where: {
        owner: '',
        denom: this.denom,
        primary: true,
      },
    })

    for (const balance of updatableBalances) {
      const owner = await this.getOwnerOfStore(height, balance.storeAddress)
      if (owner) {
        balance.owner = owner
        balance.primary = true
      } else {
        balance.primary = false
      }
    }
    await manager.getRepository(BalanceEntity).save(updatableBalances)

    // make snapshot history of balance
    await manager
      .createQueryBuilder()
      .insert()
      .into(BalanceHistoryEntity)
      .select([
        `'${height}' as height`,
        'balance.owner as owner',
        'balance.storeAddress as storeAddress',
        'balance.denom as denom',
        'balance.amount as amount',
      ])
      .from(BalanceEntity, 'balance')
      .execute()
  }

  private async snapshotPool(height: number, manager: EntityManager) {
    // skip if the asset does not exist
    if (!this.assetExists) {
      this.assetExists = await this.rest.checkAssetExists(height, this.metadata)
      if (!this.assetExists) return
    }

    let underlying: Record<string, number> | undefined
    switch (this.faType) {
      case FungibleAssetType.WeightLP: {
        const [[amountA, amountB, totalShare], [coinADenom, coinBDenom]] =
          await Promise.all([
            this.rest.getWeightPoolInfo(height, this.metadata),
            this.rest.getWeightPoolDenom(height, this.metadata),
          ])
        if (totalShare === 0) {
          return
        }
        underlying = {
          totalSupply: totalShare,
          [coinADenom]: amountA,
          [coinBDenom]: amountB,
        }
        break
      }
      case FungibleAssetType.StableLP: {
        const [{ coin_balances: balances, coin_denoms: denoms }, totalSupply] =
          await Promise.all([
            this.rest.getStablePoolInfo(height, this.metadata),
            this.rest.getFungibleAssetSupply(height, this.metadata),
          ])
        if (totalSupply === 0) {
          return
        }
        underlying = {
          totalSupply: totalSupply,
        }
        for (let i = 0; i < balances.length; i++) {
          underlying[denoms[i]] = balances[i]
        }
        break
      }
    }
    await manager.getRepository(PoolEntity).insert({
      denom: this.denom,
      height,
      type: this.faType,
      underlying,
    })
  }

  /**
   * @dev get the owner of the store if the store is not primary fungible store, return undefined
   */
  private async getOwnerOfStore(
    height: number,
    storeAddress: string
  ): Promise<string | undefined> {
    const owner = await this.rest.getFugibleStoreOwner(height, storeAddress)

    const primaryStore = getPrimaryStore(owner, this.metadata)
    if (primaryStore === storeAddress) {
      return owner
    }
    return undefined
  }
}
