import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslGuard } from '../casl/casl.guard';
import { AuditLogsService } from './audit-logs.service';
import { AuditExportService } from './audit-export.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { buildAuditLogWhere, buildAuditLogOrderBy } from './audit-log-query.util';
import { AppSettingsService } from '../settings/app-settings.service';
import {
  AUDIT_EXPORT_FORMATS,
  type AuditExportFormat,
} from './audit-export.constants';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('AuditLogs')
@Controller({
  path: 'audit',
  version: '1',
})
export class AuditLogsController {
  constructor(
    private readonly auditLogsService: AuditLogsService,
    private readonly auditExportService: AuditExportService,
    private readonly appSettingsService: AppSettingsService,
  ) {}

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
  async export(
    @Query() query: QueryAuditDto,
    @Res() res: Response,
  ): Promise<void> {
    const format = this.resolveExportFormat(query.format);
    const auditSettings = await this.appSettingsService.getAuditSettings();
    const where = buildAuditLogWhere(query);
    const orderBy = buildAuditLogOrderBy(query);

    const rows = await this.auditLogsService.findAll({
      where,
      take: auditSettings.auditExportMaxRows,
      orderBy,
    });

    const exportLimits = {
      excelJsonCellLimit: auditSettings.auditExportExcelJsonCellLimit,
      pdfJsonLimit: auditSettings.auditExportPdfJsonLimit,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'xlsx') {
      const buffer = await this.auditExportService.buildXlsx(rows, exportLimits);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit_logs_${timestamp}.xlsx"`,
      );
      res.send(buffer);
      return;
    }

    if (format === 'pdf') {
      const buffer = await this.auditExportService.buildPdf(rows, exportLimits);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit_logs_${timestamp}.pdf"`,
      );
      res.send(buffer);
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit_logs_${timestamp}.json"`,
    );
    res.json(rows);
  }

  private resolveExportFormat(format?: string): AuditExportFormat {
    if (!format || format === 'json') {
      return 'json';
    }

    if ((AUDIT_EXPORT_FORMATS as readonly string[]).includes(format)) {
      return format as AuditExportFormat;
    }

    throw new BadRequestException({
      status: 400,
      errors: { format: 'invalidExportFormat' },
    });
  }
}
