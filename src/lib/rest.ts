import { AccAddress, bcs, Coins, Denom } from '@initia/initia.js'
import Axios, { AxiosInstance } from 'axios'
import https from 'https'
import http from 'http'

export type APIParams = Record<string, string | number | null | undefined>

export interface DelegationBalanceResponse {
  addr: string
  staking_account: string
  balance: Coins.Data
}

export class RESTClient {
  private axios: AxiosInstance

  constructor(public baseUrl: string) {
    this.axios = Axios.create({
      headers: {
        Accept: 'application/json',
      },
      httpsAgent: new https.Agent({ keepAlive: true }),
      httpAgent: new http.Agent({ keepAlive: true }),
      timeout: 5000,
    })
  }

  async getMetadata(denom: Denom): Promise<string> {
    return this.get<{ metadata: string }>('initia/move/v1/metadata', {
      denom,
    }).then((res) => res.metadata)
  }

  async viewFunction<T>(
    address: AccAddress,
    moduleName: string,
    functionName: string,
    typeArgs: string[] = [],
    args: string[] = [],
    height: number
  ): Promise<T> {
    return this.post<{ data: string }>(
      `/initia/move/v1/accounts/${address}/modules/${moduleName}/view_functions/${functionName}`,
      {
        type_args: typeArgs,
        args,
      },
      height
    ).then((res) => JSON.parse(res.data) as T)
  }

  async checkAssetExists(height: number, metadata: string) {
    return this.viewFunction<boolean>(
      '0x1',
      'fungible_asset',
      'is_fungible_asset',
      [],
      [bcs.address().serialize(metadata).toBase64()],
      height
    )
  }

  async getFungibleAssetSupply(height: number, metadata: string) {
    return this.viewFunction<string>(
      '0x1',
      'fungible_asset',
      'supply',
      [],
      [bcs.address().serialize(metadata).toBase64()],
      height
    ).then((res) => Number(res))
  }

  async getFungibleAssetAmount(height: number, storeAccount: string) {
    return this.viewFunction<string>(
      '0x1',
      'fungible_asset',
      'balance',
      [],
      [bcs.address().serialize(storeAccount).toBase64()],
      height
    )
  }

  async getPairMetadata(height: number, metadata: string) {
    return this.viewFunction<{ coin_a_denom: string; coin_b_denom: string }>(
      '0x1',
      'dex',
      'get_pair_denom',
      [],
      [bcs.string().serialize(metadata).toBase64()],
      height
    ).then((res) => [res.coin_a_denom, res.coin_b_denom])
  }

  async getWeightPoolAmount(
    height: number,
    metadata: string
  ): Promise<[number, number, number]> {
    return this.viewFunction<{
      coin_a_amount: string
      coin_b_amount: string
      total_share: string
    }>(
      '0x1',
      'dex',
      'get_pool_info',
      [],
      [bcs.string().serialize(metadata).toBase64()],
      height
    ).then((res) => [
      Number(res.coin_a_amount),
      Number(res.coin_b_amount),
      Number(res.total_share),
    ])
  }

  async getStablePoolAmount(
    height: number,
    metadata: string
  ): Promise<{
    coin_denoms: string[]
    coin_balances: number[]
  }> {
    return this.viewFunction<{
      coin_denoms: string[]
      coin_balances: number[]
    }>(
      '0x1',
      'stableswap',
      'get_pool',
      [],
      [bcs.address().serialize(metadata).toBase64()],
      height
    )
  }

  async get<T>(
    endpoint: string,
    params: URLSearchParams | APIParams = {},
    height?: number
  ): Promise<T> {
    const url = this.computeEndpoint(endpoint)
    const headers = height
      ? { 'x-cosmos-block-height': `${height}` }
      : undefined
    return this.axios.get(url, { params, headers }).then((res) => res.data as T)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async post<T>(endpoint: string, data?: any, height?: number): Promise<T> {
    const url = this.computeEndpoint(endpoint)
    const headers = height
      ? { 'x-cosmos-block-height': `${height}` }
      : undefined
    return this.axios.post(url, data, { headers }).then((res) => res.data as T)
  }

  private computeEndpoint(endpoint: string) {
    const url = new URL(this.baseUrl)
    url.pathname === '/'
      ? (url.pathname = endpoint)
      : (url.pathname += endpoint)
    return url.toString()
  }
}
