import { FungibleAssetStoreType } from 'src/lib/enum'
import { Entity, PrimaryColumn, Column, Index } from 'typeorm'

@Entity('store_account')
export class StoreAccountEntity {
  @PrimaryColumn('text')
  storeAddress: string

  @Column('text')
  @Index('store_owner')
  owner: string

  @Column('text')
  type: FungibleAssetStoreType
}
