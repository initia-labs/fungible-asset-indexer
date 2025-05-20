import { HttpException, Injectable } from '@nestjs/common'
import {
  BalanceEntity,
  BalanceHistoryEntity,
  readOnlyDataSource,
  PoolEntity,
  SnapshotEntity,
} from 'src/orm'
import { Between } from 'typeorm'
import {
  BalanceHistoryResponse,
  BalanceResponse,
  SnapshotResponse,
} from './fungible-asset.dto'

@Injectable()
export class FungibleAssetService {
  async getSnapshots(): Promise<SnapshotResponse[]> {
    const snapshots = await readOnlyDataSource
      .getRepository(SnapshotEntity)
      .find()
    if (snapshots.length === 0) {
      throw new HttpException('Snapshot not found', 404)
    }

    return snapshots
  }

  async getBalances(owner: string, denom: string): Promise<BalanceResponse[]> {
    const balances = await readOnlyDataSource
      .getRepository(BalanceEntity)
      .find({
        where: {
          owner,
          denom,
        },
      })
    return balances
  }

  async getBalanceHistories(
    owner: string,
    denom: string,
    fromHeight: number,
    toHeight: number
  ): Promise<BalanceHistoryResponse[]> {
    const balanceHistories = await readOnlyDataSource
      .getRepository(BalanceHistoryEntity)
      .find({
        where: {
          owner,
          height: Between(fromHeight, toHeight),
          denom,
        },
        order: {
          height: 'ASC',
        },
      })

    const poolHistories = await readOnlyDataSource
      .getRepository(PoolEntity)
      .find({
        where: {
          denom,
          height: Between(fromHeight, toHeight),
        },
        order: {
          height: 'ASC',
        },
      })

    if (poolHistories.length === 0) {
      return balanceHistories.map((history) => ({
        owner: history.owner,
        denom: history.denom,
        height: history.height,
        amount: history.amount,
      }))
    }
    const poolByHeight = new Map(
      poolHistories.map((pool) => [pool.height, pool])
    )

    return balanceHistories.map((history) => {
      const poolHistory = poolByHeight.get(history.height)

      if (!poolHistory?.underlying) {
        return {
          owner: history.owner,
          denom: history.denom,
          height: history.height,
          amount: history.amount,
        }
      }

      const { totalSupply, ...underlyingTokens } = poolHistory.underlying
      const underlying = Object.entries(underlyingTokens).reduce(
        (acc, [denom, amount]) => ({
          ...acc,
          [denom]:
            (Number(history.amount) * Number(amount)) / Number(totalSupply),
        }),
        {}
      )

      return {
        owner: history.owner,
        denom: history.denom,
        height: history.height,
        amount: history.amount,
        underlying,
      }
    })
  }
}
