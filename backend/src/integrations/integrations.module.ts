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
      // Single registration in AppModule; exports (incl. SowCrmWritebackService)
      // available app-wide so feature modules must not call register() again
      // (that double-registers Bull processors like sync-employees).
      global: true,
      imports: [KekaModule.register(), ZohoModule.register()],
      exports: [KekaModule, ZohoModule],
    };
  }
}
