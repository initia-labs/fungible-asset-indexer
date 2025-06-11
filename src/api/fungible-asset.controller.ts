import { Controller, Get, Query } from '@nestjs/common'
import { FungibleAssetService } from './fungible-asset.service'
import {
  BalanceHistoryResponse,
  BalanceResponse,
  GetBalanceHistoriesDto,
  GetBalancesDto,
  SnapshotResponse,
  GetBalanceDistributionDto,
  BalanceDistributionResponse,
  RewardsDto,
  RewardsResponse,
} from './fungible-asset.dto'
import { ApiOperation, ApiQuery } from '@nestjs/swagger'

@Controller()
export class FungibleAssetController {
  constructor(private readonly apiService: FungibleAssetService) {}

  @Get('snapshots')
  @ApiOperation({ summary: 'Get all snapshots' })
  async getSnapshots(): Promise<SnapshotResponse[]> {
    return this.apiService.getSnapshots()
  }

  @Get('balances')
  @ApiOperation({ summary: 'Get balances for owner' })
  @ApiQuery({ name: 'owner', type: String })
  @ApiQuery({ name: 'denom', type: String })
  async getBalances(@Query() dto: GetBalancesDto): Promise<BalanceResponse[]> {
    return this.apiService.getBalances(dto.owner, dto.denom)
  }

  @Get('balance-histories')
  @ApiOperation({ summary: 'Get balance history for an owner' })
  async getBalanceHistories(
    @Query() dto: GetBalanceHistoriesDto
  ): Promise<BalanceHistoryResponse[]> {
    return this.apiService.getBalanceHistories(
      dto.owner,
      dto.denom,
      dto.fromHeight,
      dto.toHeight
    )
  }

  @Get('balance-distribution')
  @ApiOperation({ summary: 'Get balance distribution between blocks' })
  async getBalanceDistribution(
    @Query() dto: GetBalanceDistributionDto
  ): Promise<BalanceDistributionResponse[]> {
    return this.apiService.getBalanceDistribution(dto.startBlock, dto.endBlock)
  }

  @Get('rewards')
  @ApiOperation({ summary: 'Get Denom rewards' })
  async rewards(
    @Query() dto: RewardsDto
  ): Promise<RewardsResponse> {
    return this.apiService.getOnyxRewards(dto.denom)
  }
}
