import https from 'https'
import http from 'http'
import Axios, { AxiosInstance } from 'axios'
import { Block, Event } from '@initia/initia.js'
import { Tx as Tx_pb } from '@initia/initia.proto/cosmos/tx/v1beta1/tx'
import { createHash } from 'crypto'

export type APIParams = Record<string, string | number | null | undefined>

export interface BlockResults {
  txResults: TxResult[]
  finalizeEvents: Event[]
}

export interface TxResult {
  codespace: string
  code: number
  data: string
  log: string
  info: string
  gas_wanted: string
  gas_used: string
  events: Event[]
}

export interface ScrappedBlock {
  block: Block
  infos: TxInfo[]
  finalizeEvents: Event[]
}

export interface TxInfo {
  height: number
  txhash: string
  codespace: string
  code: number
  raw_log: string
  logs: {
    msg_index: number
    log: string
    events: Event[]
  }[]
  gas_wanted: number
  gas_used: number
  tx?: Tx_pb
  timestamp: string
  events: Event[]
}

export class RPCClient {
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

  async getBlock(height?: number): Promise<Block> {
    return this.get<{ result: { block: Block } }>(`/block`, {
      ...(height && { height }),
    }).then((d) => d.result.block)
  }

  private async getBlockResults(height: number): Promise<BlockResults> {
    return this.get<{
      result: { txs_results: TxResult[]; finalize_block_events: Event[] }
    }>(`/block_results`, {
      height,
    }).then((d) => ({
      txResults: d.result.txs_results ?? [],
      finalizeEvents: d.result.finalize_block_events ?? [],
    }))
  }

  async scrapBlock(height: number): Promise<ScrappedBlock> {
    const [block, blockResults] = await Promise.all([
      this.getBlock(height),
      this.getBlockResults(height),
    ])

    const rawTxs: string[] = block.data.txs ?? []
    const infos: TxInfo[] = []
    for (const [idx, txRaw] of rawTxs.entries()) {
      const txRes = blockResults.txResults[idx]
      if (txRes.code !== 0) continue

      const txByte = Buffer.from(txRaw, 'base64')
      const decoded = Tx_pb.decode(txByte)
      if (!decoded.body) continue

      const info: TxInfo = {
        height,
        txhash: createHash('sha256').update(txByte).digest('hex').toUpperCase(),
        raw_log: '',
        logs: [],
        gas_wanted: Number(txRes.gas_wanted),
        gas_used: Number(txRes.gas_used),
        tx: decoded,
        timestamp: block.header.time,
        events: txRes.events,
        code: txRes.code,
        codespace: txRes.codespace,
      }
      infos.push(info)
    }

    return { block, infos, finalizeEvents: blockResults.finalizeEvents }
  }

  async get<T>(
    endpoint: string,
    params: URLSearchParams | APIParams = {}
  ): Promise<T> {
    const url = this.computeEndpoint(endpoint)
    return this.axios.get(url, { params }).then((d) => d.data as T)
  }

  private computeEndpoint(endpoint: string) {
    const url = new URL(this.baseUrl)
    url.pathname === '/'
      ? (url.pathname = endpoint)
      : (url.pathname += endpoint)
    return url.toString()
  }
}
