import { DynamicModule, Module } from '@nestjs/common';
import { KekaModule } from './keka/keka.module';
import { ZohoModule } from './zoho/zoho.module';

/**
 * Parent module for third-party connectors.
 * Keka and Zoho CRM are registered; Books / Teams nest beside them later.
 */
@Module({})
export class IntegrationsModule {
  static register(): DynamicModule {
    return {
      module: IntegrationsModule,
      imports: [KekaModule.register(), ZohoModule.register()],
      exports: [KekaModule, ZohoModule],
    };
  }
}
