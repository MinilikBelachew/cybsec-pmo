import { Global, Module } from '@nestjs/common';
import { CaslAbilityInterceptor } from './casl-ability.interceptor';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslGuard } from './casl.guard';
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
    CaslAbilityInterceptor,
    RecordScopeWhereService,
  ],
  exports: [
    PermissionsCacheService,
    CaslAbilityFactory,
    CaslGuard,
    CaslAbilityInterceptor,
    RecordScopeWhereService,
  ],
})
export class CaslModule {}
