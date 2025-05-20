/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsString, IsNumber } from 'class-validator'
import { Type } from 'class-transformer'

import { ApiProperty } from '@nestjs/swagger'

export class GetBalancesDto {
  @ApiProperty({
    description: 'owner address',
  })
  @IsString()
  owner: string

  @ApiProperty({
    description: 'Token denomination',
    example: 'uinit',
  })
  @IsString()
  denom: string
}

export class GetBalanceHistoriesDto {
  @ApiProperty({ description: 'Owner address' })
  @IsString()
  owner: string

  @ApiProperty({ description: 'Token denomination' })
  @IsString()
  denom: string

  @ApiProperty({ description: 'From height(inclusive)' })
  @IsNumber()
  @Type(() => Number)
  fromHeight: number

  @ApiProperty({ description: 'To height(inclusive)' })
  @IsNumber()
  @Type(() => Number)
  toHeight: number
}

export interface SnapshotResponse {
  denom: string
  height: number
}

export interface BalanceResponse {
  owner: string
  denom: string
  amount: string
  storeAddress: string
  primary: boolean
}

export interface BalanceHistoryResponse {
  owner: string
  denom: string
  height: number
  amount: string
  underlying?: Record<string, number>
}
