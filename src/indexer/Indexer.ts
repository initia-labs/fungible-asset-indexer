import { EntityManager } from 'typeorm'
import { parseEvents } from '../lib/parse'
import { ScrappedBlock } from '../lib/rpc'
import { Monitor } from './Monitor'
import { BalanceEntity, dataSource, PoolEntity, SnapshotEntity } from '../orm'
import { DepositEvent, WithdrawEvent } from './events'
import { FungibleAssetStoreType, FungibleAssetType } from 'src/lib/enum'
import { StoreAccountEntity } from 'src/orm/entities/StoreAccountEntity'

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
    if (snapshot) {
      this.startHeight = snapshot.height
      return
    }

    await dataSource.transaction(async (manager) => {
      // check if the asset exists
      const exists = await this.rest.checkAssetExists(
        this.startHeight,
        this.metadata
      )
      if (exists) {
        // get all accounts
        const accounts = await this.rest.getAllCosmosAccounts(this.startHeight)
        // get all balances and insert them into the balance table
        for (let i = 0; i < accounts.length; i += batchSize) {
          const accountsBatch = accounts.slice(i, i + batchSize)
          const batchResults = await Promise.all(
            accountsBatch.map(async (account) => {
              const balance = await this.rest.getBalance(
                this.startHeight,
                account,
                this.denom
              )
              return {
                owner: account,
                height: this.startHeight,
                ...balance,
              }
            })
          )
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
    this.collectBalanceDiff(block)
    // return if no snapshot
    if (!this.shouldSnapshot(height)) return
    await this.snapshot(height, manager)
  }

  /**
   * @dev collect the fungible asset events from block
   */
  private collectBalanceDiff(block: ScrappedBlock) {
    for (const event of parseEvents(block)) {
      if (event.type === 'move') {
        switch (event.attributes.type_tag) {
          case '0x1::fungible_asset::DepositEvent': {
            const depositEvent = JSON.parse(
              event.attributes.data
            ) as DepositEvent
            if (depositEvent.metadata_addr !== this.metadata) break
            if (this.balanceDiffMap.has(depositEvent.store_addr)) {
              const existingValue = this.balanceDiffMap.get(
                depositEvent.store_addr
              )!
              this.balanceDiffMap.set(
                depositEvent.store_addr,
                existingValue.plus(new BigNumber(depositEvent.amount))
              )
            } else {
              this.balanceDiffMap.set(
                depositEvent.store_addr,
                new BigNumber(depositEvent.amount)
              )
            }
            break
          }
          case '0x1::fungible_asset::WithdrawEvent': {
            const withdrawEvent = JSON.parse(
              event.attributes.data
            ) as WithdrawEvent
            if (withdrawEvent.metadata_addr !== this.metadata) break
            if (this.balanceDiffMap.has(withdrawEvent.store_addr)) {
              const existingValue = this.balanceDiffMap.get(
                withdrawEvent.store_addr
              )!
              this.balanceDiffMap.set(
                withdrawEvent.store_addr,
                existingValue.minus(new BigNumber(withdrawEvent.amount))
              )
            } else {
              this.balanceDiffMap.set(
                withdrawEvent.store_addr,
                new BigNumber(withdrawEvent.amount).negated()
              )
            }
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
    const storeAccountRepo = manager.getRepository(StoreAccountEntity)
    const balanceRepo = manager.getRepository(BalanceEntity)
    const liquidityRepo = manager.getRepository(PoolEntity)

    const storeAccAndDiff: [StoreAccountEntity, BigNumber][] = []
    // 1. Get the store entities from the balance diff map
    // and insert them into the store table
    for (const [storeAddress, diffAmount] of Object.entries(
      this.balanceDiffMap
    )) {
      const storeEntity = await storeAccountRepo.findOne({
        where: { storeAddress },
      })

      if (storeEntity) {
        if (storeEntity.type === FungibleAssetStoreType.Other) {
          continue
        }
        storeAccAndDiff.push([storeEntity, diffAmount as BigNumber])
        continue
      }

      const owner = await this.rest.getOwner(height, storeAddress)
      const primaryStore = await this.rest.getPrimaryFungibleStoreAddress(
        height,
        owner,
        this.metadata
      )

      const storeType =
        primaryStore === storeAddress
          ? FungibleAssetStoreType.Primary
          : FungibleAssetStoreType.Other

      const newStoreAccount: StoreAccountEntity = {
        storeAddress: storeAddress,
        owner,
        type: storeType,
      }
      await storeAccountRepo.insert(newStoreAccount)

      if (storeType === FungibleAssetStoreType.Other) {
        continue
      }
      storeAccAndDiff.push([newStoreAccount, diffAmount as BigNumber])
    }

    const balanceEntities: BalanceEntity[] = []
    // Calculate balance entities
    for (const [store, diffAmount] of storeAccAndDiff) {
      const latestBalance = await balanceRepo.findOne({
        where: {
          owner: store.owner,
          denom: this.denom,
        },
        order: { height: 'DESC' },
      })

      balanceEntities.push({
        owner: store.owner,
        denom: this.denom,
        height,
        amount: latestBalance
          ? new BigNumber(latestBalance.amount).plus(diffAmount).toString()
          : diffAmount.toString(),
      })
    }

    // Store balance entities in batches
    for (let i = 0; i < balanceEntities.length; i += batchSize) {
      const batch = balanceEntities.slice(i, i + batchSize)
      await balanceRepo.insert(batch)
    }

    // Save underlying token amount of liquidity tokens
    let underlying: Record<string, number> | undefined
    switch (this.faType) {
      case FungibleAssetType.Normal:
        return
      case FungibleAssetType.StableLP: {
        const [[amountA, amountB, totalShare], [coinADenom, coinBDenom]] =
          await Promise.all([
            this.rest.getWeightPoolInfo(height, this.metadata),
            await this.rest.getWeightPoolMetdata(height, this.metadata),
          ])
        underlying = {
          totalSupply: totalShare,
          [coinADenom]: amountA,
          [coinBDenom]: amountB,
        }
        break
      }
      case FungibleAssetType.WeightLP: {
        const [{ coin_balances: balances, coin_denoms: denoms }, totalSupply] =
          await Promise.all([
            this.rest.getStablePoolInfo(height, this.metadata),
            this.rest.getFungibleAssetSupply(height, this.metadata),
          ])
        underlying = {
          totalSupply: totalSupply,
        }
        for (let i = 0; i < balances.length; i++) {
          underlying[denoms[i]] = balances[i]
        }
        break
      }
    }
    await liquidityRepo.insert({
      denom: this.denom,
      height,
      type: this.faType,
      underlying,
    })
  }
}
