import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditArchiveService } from './audit-archive.service';

@Injectable()
export class AuditArchiveScheduler {
  private readonly logger = new Logger(AuditArchiveScheduler.name);

  constructor(private readonly auditArchiveService: AuditArchiveService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyArchive(): Promise<void> {
    try {
      const count = await this.auditArchiveService.runScheduledArchive();
      if (count === 0) {
        this.logger.debug('No audit rows eligible for archival.');
      }
    } catch (error) {
      this.logger.error('Scheduled audit archival failed', error);
    }
  }
}
