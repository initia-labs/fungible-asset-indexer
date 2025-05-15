import { Entity, PrimaryColumn, Column, Index } from 'typeorm'

@Entity('balance_history')
export class BalanceHistoryEntity {
  @PrimaryColumn('bigint')
  @Index('balance_history_height')
  height: number

  @PrimaryColumn('text')
  storeAddress: string

  @PrimaryColumn('text')
  @Index('balance_history_denom')
  denom: string

  @Column('text')
  @Index('balance_history_owner')
  owner: string // owner of primary fungible store

  @Column('text')
  amount: string
}
