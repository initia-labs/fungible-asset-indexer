import { Entity, PrimaryColumn, Column, Index } from 'typeorm'

@Entity('balance')
export class BalanceEntity {
  @PrimaryColumn('text')
  owner: string

  @PrimaryColumn('text')
  @Index('balance_denom')
  denom: string

  @PrimaryColumn('bigint')
  @Index('balance_height')
  height: number

  @Column('text')
  amount: string
}
