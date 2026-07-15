import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { upsertFailedSyncRecord, resolveFailedSyncRecord } from '../utils/failed-sync-record.util';
import { KekaHoliday, KekaHolidayCalendar } from '../keka.types';

export type HolidaySyncResult = {
  synced: number;
  failed: number;
};

@Injectable()
export class HolidaySyncService {
  private readonly logger = new Logger(HolidaySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
  ) {}

  async syncHolidays(): Promise<HolidaySyncResult> {
    const calendars = await this.kekaClient.getAllPages<KekaHolidayCalendar>(
      '/time/holidayscalendar',
    );

    const syncedAt = new Date();
    const years = [syncedAt.getUTCFullYear(), syncedAt.getUTCFullYear() + 1];
    let synced = 0;
    let failed = 0;

    for (const calendar of calendars) {
      const kekaCalendarId = calendar.id?.trim();
      const name = calendar.name?.trim();
      if (!kekaCalendarId || !name) {
        failed += 1;
        await this.logFailure(
          KEKA_ENTITY_TYPE.HOLIDAY_CALENDAR,
          kekaCalendarId ?? 'unknown',
          calendar,
          'Holiday calendar is missing id or name',
        );
        continue;
      }

      try {
        const localCalendar = await this.prisma.holidayCalendar.upsert({
          where: { kekaCalendarId },
          update: { name, syncedAt },
          create: { kekaCalendarId, name, syncedAt },
        });

        await this.logSuccess(
          KEKA_ENTITY_TYPE.HOLIDAY_CALENDAR,
          kekaCalendarId,
          calendar,
        );
        synced += 1;

        for (const calendarYear of years) {
          const holidays = await this.kekaClient.getAllPages<KekaHoliday>(
            `/time/holidayscalendar/${encodeURIComponent(kekaCalendarId)}/holidays`,
            { calendarYear },
          );

          for (const holiday of holidays) {
            const kekaHolidayId = holiday.id?.trim();
            if (!kekaHolidayId) {
              failed += 1;
              await this.logFailure(
                KEKA_ENTITY_TYPE.HOLIDAY,
                'unknown',
                holiday,
                'Holiday is missing id',
              );
              continue;
            }

            try {
              const holidayDate = new Date(holiday.date);
              holidayDate.setUTCHours(0, 0, 0, 0);

              await this.prisma.holiday.upsert({
                where: { kekaHolidayId },
                update: {
                  calendarId: localCalendar.id,
                  name: holiday.name?.trim() || 'Holiday',
                  holidayDate,
                  isFloater: holiday.isFloater === true,
                  calendarYear,
                  syncedAt,
                },
                create: {
                  calendarId: localCalendar.id,
                  kekaHolidayId,
                  name: holiday.name?.trim() || 'Holiday',
                  holidayDate,
                  isFloater: holiday.isFloater === true,
                  calendarYear,
                  syncedAt,
                },
              });

              await this.logSuccess(
                KEKA_ENTITY_TYPE.HOLIDAY,
                kekaHolidayId,
                holiday,
              );
              synced += 1;
            } catch (error) {
              failed += 1;
              const message =
                error instanceof Error ? error.message : 'Unknown holiday sync error';
              this.logger.warn(
                `Holiday sync failed for ${kekaHolidayId}: ${message}`,
              );
              await this.logFailure(
                KEKA_ENTITY_TYPE.HOLIDAY,
                kekaHolidayId,
                holiday,
                message,
              );
            }
          }
        }
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown holiday calendar sync error';
        this.logger.warn(
          `Holiday calendar sync failed for ${kekaCalendarId}: ${message}`,
        );
        await this.logFailure(
          KEKA_ENTITY_TYPE.HOLIDAY_CALENDAR,
          kekaCalendarId,
          calendar,
          message,
        );
      }
    }

    return { synced, failed };
  }

  private async logSuccess(
    entityType: string,
    entityId: string,
    payload: unknown,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    await resolveFailedSyncRecord(this.prisma, {
      entityType,
      entityId,
    });
  }

  private async logFailure(
    entityType: string,
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
        retryCount: 0,
      },
    });

    await upsertFailedSyncRecord(this.prisma, {
      entityType: entityType,
      entityId: entityId,
      direction: KEKA_SYNC_DIRECTION.INBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });

  }
}
