import { Entity, PrimaryColumn, Column, Index } from 'typeorm'

@Entity('balance')
export class BalanceEntity {
  @PrimaryColumn('text')
  storeAddress: string

  @PrimaryColumn('text')
  @Index('balance_denom')
  denom: string

  @Column('text', { default: '' })
  @Index('balance_owner')
  owner: string

  @Column('text')
  amount: string

  @Column('boolean', { default: true })
  @Index('balance_primary')
  primary: boolean
}
