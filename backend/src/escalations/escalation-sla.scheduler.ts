import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EscalationsService } from './escalations.service';

@Injectable()
export class EscalationSlaScheduler {
  private readonly logger = new Logger(EscalationSlaScheduler.name);

  constructor(private readonly escalationsService: EscalationsService) {}

  @Cron(process.env.ESCALATION_SLA_CRON ?? '*/15 * * * *')
  async handleSlaBreaches(): Promise<void> {
    try {
      const result = await this.escalationsService.processSlaBreaches();
      if (result.breached > 0) {
        this.logger.log(`Marked ${result.breached} escalation(s) as SLA breached`);
      }
    } catch (error) {
      this.logger.error(
        'Escalation SLA job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
