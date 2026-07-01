import { Global, Module } from '@nestjs/common';
import { CaslAbilityInterceptor } from './casl-ability.interceptor';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslGuard } from './casl.guard';
import { ModulePermissionGuard } from './module-permission.guard';
import { RecordScopeWhereService } from './record-scope-where.service';
import { PermissionsCacheService } from './permissions-cache.service';
import { PrismaModule } from '../database/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    PermissionsCacheService,
    CaslAbilityFactory,
    CaslGuard,
    ModulePermissionGuard,
    CaslAbilityInterceptor,
    RecordScopeWhereService,
  ],
  exports: [
    PermissionsCacheService,
    CaslAbilityFactory,
    CaslGuard,
    ModulePermissionGuard,
    CaslAbilityInterceptor,
    RecordScopeWhereService,
  ],
})
export class CaslModule {}
