import { FungibleAssetType } from 'src/lib/enum'
import { Entity, PrimaryColumn, Column, Index } from 'typeorm'

@Entity('pool')
export class PoolEntity {
  @PrimaryColumn('text')
  @Index('pool_denom')
  denom: string

  @PrimaryColumn('bigint')
  @Index('pool_height')
  height: number

  @Column('text')
  type: FungibleAssetType

  @Column('jsonb')
  underlying: Record<string, number>
}
