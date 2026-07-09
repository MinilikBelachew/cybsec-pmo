import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AllConfigType } from '../../config/config.type';
import { KekaSyncService } from './keka-sync.service';

@Injectable()
export class KekaSyncScheduler {
  private readonly logger = new Logger(KekaSyncScheduler.name);

  constructor(
    private readonly kekaSyncService: KekaSyncService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  @Cron(process.env.KEKA_SYNC_CRON ?? '*/15 * * * *')
  async handleScheduledSync(): Promise<void> {
    const syncEnabled = this.configService.get('keka.syncEnabled', { infer: true });
    if (!syncEnabled) {
      return;
    }

    this.logger.debug('Starting scheduled Keka sync');
    await this.kekaSyncService.runScheduledSync();
  }
}
