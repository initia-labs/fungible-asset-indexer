import { Module } from '@nestjs/common'
import { FungibleAssetController } from './fungible-asset.controller'
import { FungibleAssetService } from './fungible-asset.service'

@Module({
  imports: [],
  controllers: [FungibleAssetController],
  providers: [FungibleAssetService],
})
export class FungibleAssetModule {}
