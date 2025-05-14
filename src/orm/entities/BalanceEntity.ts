import { Entity, PrimaryColumn, Column, Index } from 'typeorm'

@Entity('balance')
export class BalanceEntity {
  @PrimaryColumn('text')
  storeAccount: string

  @PrimaryColumn('text')
  @Index('balance_denom')
  denom: string

  @PrimaryColumn('bigint')
  @Index('balance_height')
  height: number

  @Column('bigint')
  @Index('balance_amount')
  amount: number

  @Column('jsonb', { nullable: true })
  underlying?: Record<string, number>
}
