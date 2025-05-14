import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('snapshot')
export class SnapshotEntity {
  @PrimaryColumn('text')
  denom: string

  @Column('bigint')
  height: number
}
