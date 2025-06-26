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
  BalanceDistributionResponse,
  RewardsResponse,
} from './fungible-asset.dto'
import axios from 'axios'
import { ethers } from 'ethers'
import { Cache } from '../lib/cache'
import { config } from '../config'

@Injectable()
export class FungibleAssetService {
  private readonly cache: Cache;

  constructor() {
    this.cache = Cache.getInstance(300); // 300 seconds TTL
  }

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

  async getBalanceDistribution(
    startBlock: number,
    endBlock: number
  ): Promise<BalanceDistributionResponse[]> {

    const CACHE_KEY = `onyx-rewards-${startBlock}-${endBlock}`;

    const cachedResult = this.cache.get<BalanceDistributionResponse[]>(CACHE_KEY);
    if (cachedResult) {
      return cachedResult;
    }

    const result = await readOnlyDataSource.query(`
      with snapshots as (
          select count(distinct height) as snapshotCount
          from balance_history
          where height between $1 and $2
      ),
      average_balances as (
        select owner, sum(amount)/(select snapshotCount from snapshots) as avgBalance
        from balance_history
        where height between $1 and $2
        group by 1
      ), total as (
        select sum(avgBalance) as balance
        from average_balances
      )
      select owner, avgBalance / (select balance from total) * 100 as percent, avgBalance
      from average_balances
      order by percent desc

    `, [startBlock, endBlock])

    const response = result.map(row => ({
      owner: row.owner,
      percent: parseFloat(row.percent),
      avgBalance: parseFloat(row.avgbalance)
    }))

    this.cache.set(CACHE_KEY, result);

    return response
  }

  async getOnyxRewards(
    denom: string
  ): Promise<RewardsResponse> {
    const trackedDenoms = config.FUNGIBLE_ASSETS.map(asset => asset.denom);

    if (!trackedDenoms.includes(denom)) {
      throw new HttpException('Untracked denom', 400);
    }
    const CACHE_KEY = 'onyx-rewards';

    const cachedResult = this.cache.get<RewardsResponse>(CACHE_KEY);
    if (cachedResult) {
      return cachedResult;
    }

    const provider = new ethers.JsonRpcProvider('https://jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz')
    const tokenAddress = '0x4badfb501ab304ff11217c44702bb9e9732e7cf4'
    const walletAddress = '0x3d7f111B3b69C657624b8633a997A56300212872'
    const onyxDenom = 'evm/4BaDFb501Ab304fF11217C44702bb9E9732E7CF4'

    const abi = ['function balanceOf(address) view returns (uint256)']
    const contract = new ethers.Contract(tokenAddress, abi, provider)

    try {
      const balance = await contract.balanceOf(walletAddress)
      const balanceToken = ethers.formatEther(balance) // Convert from wei to ether
      const amount = Number(balanceToken) / 14 / 2
      
      const result = {
        amount: amount,
        denom: onyxDenom
      }

      this.cache.set(CACHE_KEY, result);
      
      return result
    } catch (error) {
      return new HttpException('Failed to retrieve rewards: ' + error.message, 500)
    }
  }
}
