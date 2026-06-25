import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslGuard } from '../casl/casl.guard';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { buildAuditLogWhere, buildAuditLogOrderBy } from './audit-log-query.util';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('AuditLogs')
@Controller({
  path: 'audit',
  version: '1',
})
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @CheckAbility('read', 'AuditLog')
  @Get('events')
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryAuditDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where = buildAuditLogWhere(query);
    const orderBy = buildAuditLogOrderBy(query);

    const [data, total] = await Promise.all([
      this.auditLogsService.findAll({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.auditLogsService.count(where),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  @CheckAbility('read', 'AuditLog')
  @Get('export')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @Header('Content-Disposition', 'attachment; filename="audit_logs_export.json"')
  async export(@Query() query: QueryAuditDto) {
    const where = buildAuditLogWhere(query);
    const orderBy = buildAuditLogOrderBy(query);

    return this.auditLogsService.findAll({
      where,
      take: 10000,
      orderBy,
    });
  }
}
