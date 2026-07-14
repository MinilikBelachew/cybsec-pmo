import { DynamicModule, Module } from '@nestjs/common';
import { KekaModule } from './keka/keka.module';

/**
 * Parent module for third-party connectors.
 * Keka is registered today; Zoho / Teams / etc. will nest beside `./keka` later.
 */
@Module({})
export class IntegrationsModule {
  static register(): DynamicModule {
    return {
      module: IntegrationsModule,
      imports: [KekaModule.register()],
      exports: [KekaModule],
    };
  }
}
