import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditDto } from './dto/query-audit.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('AuditLogs')
@Controller({
  path: 'audit',
  version: '1',
})
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Roles(RoleEnum.super_admin, RoleEnum.it_admin, RoleEnum.pmo_lead)
  @Get('events')
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryAuditDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.objectType) {
      where.objectType = query.objectType;
    }
    if (query.objectId) {
      where.objectId = query.objectId;
    }
    if (query.action) {
      where.action = query.action;
    }

    const [data, total] = await Promise.all([
      this.auditLogsService.findAll({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

  @Roles(RoleEnum.super_admin, RoleEnum.it_admin, RoleEnum.pmo_lead)
  @Get('export')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @Header('Content-Disposition', 'attachment; filename="audit_logs_export.json"')
  async export(@Query() query: QueryAuditDto) {
    const where: any = {};
    if (query.objectType) {
      where.objectType = query.objectType;
    }
    if (query.objectId) {
      where.objectId = query.objectId;
    }
    if (query.action) {
      where.action = query.action;
    }

    // Return a bulk list (up to 10,000 items) for export
    return this.auditLogsService.findAll({
      where,
      take: 10000,
      orderBy: { createdAt: 'desc' },
    });
  }
}
