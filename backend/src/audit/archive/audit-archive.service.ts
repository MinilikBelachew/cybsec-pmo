import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppSettingsService } from '../../settings/app-settings.service';
import { AUDIT_ARCHIVE_BATCH_SIZE } from '../../settings/app-settings.constants';

@Injectable()
export class AuditArchiveService {
  private readonly logger = new Logger(AuditArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingsService: AppSettingsService,
  ) {}

  async runScheduledArchive(): Promise<number> {
    const settings = await this.appSettingsService.getAuditSettings();

    if (!settings.auditArchiveEnabled) {
      this.logger.log('Audit archival skipped (disabled in settings).');
      return 0;
    }

    const cutoff = this.subtractMonths(new Date(), settings.auditRetentionMonths);
    let totalArchived = 0;

    while (true) {
      const batch = await this.prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { createdAt: 'asc' },
        take: AUDIT_ARCHIVE_BATCH_SIZE,
      });

      if (batch.length === 0) {
        break;
      }

      const ids = batch.map((row) => row.id);

      await this.prisma.$transaction(async (tx) => {
        // Allow this transaction only to move rows into archive (DB trigger gate).
        await tx.$executeRaw`SELECT set_config('app.allow_audit_archive_delete', 'on', true)`;

        await tx.auditLogArchive.createMany({
          data: batch.map((row) => ({
            id: row.id,
            actorId: row.actorId,
            action: row.action,
            objectType: row.objectType,
            objectId: row.objectId,
            oldValue: row.oldValue ?? undefined,
            newValue: row.newValue ?? undefined,
            ipAddress: row.ipAddress,
            isExternal: row.isExternal,
            breakGlassAction: row.breakGlassAction,
            source: row.source,
            createdAt: row.createdAt,
          })),
          skipDuplicates: true,
        });

        await tx.auditLog.deleteMany({
          where: { id: { in: ids } },
        });
      });

      totalArchived += batch.length;
    }

    if (totalArchived > 0) {
      await this.appSettingsService.recordArchiveRun(totalArchived);
      this.logger.log(`Archived ${totalArchived} audit log row(s).`);
    }

    return totalArchived;
  }

  private subtractMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setUTCMonth(result.getUTCMonth() - months);
    return result;
  }
}
