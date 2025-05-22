import { NestFactory } from '@nestjs/core'
import { FungibleAssetModule } from './fungible-asset.module'
import { config } from '../config'
import { readOnlyDataSource } from 'src/orm'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

export async function bootstrap() {
  await readOnlyDataSource.initialize()
  const app = await NestFactory.create(FungibleAssetModule, {
    bufferLogs: true,
  })

  // strip prefix 
  app.setGlobalPrefix('funassindexer')

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fungible Asset API')
    .setDescription('Fungible Asset API Description')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('swagger', app, document)
  await app.listen(config.PORT)
}
