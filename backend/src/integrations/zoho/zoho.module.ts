import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma.module';
import zohoConfig from './config/zoho.config';
import { ZohoHttpClient } from './client/zoho-http.client';
import { OpportunitySyncService } from './sync/opportunity-sync.service';
import { ZohoConnectionService } from './zoho-connection.service';
import { ZohoController } from './zoho.controller';

@Module({})
export class ZohoModule {
  static register(): DynamicModule {
    return {
      module: ZohoModule,
      imports: [ConfigModule.forFeature(zohoConfig), PrismaModule],
      controllers: [ZohoController],
      providers: [
        ZohoHttpClient,
        OpportunitySyncService,
        ZohoConnectionService,
      ],
      exports: [ZohoConnectionService, ZohoHttpClient],
    };
  }
}
