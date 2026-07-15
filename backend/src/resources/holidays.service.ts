import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueryHolidaysDto } from './dto/query-holidays.dto';
import { HolidayCalendarListResponseDto } from './dto/holidays.dto';

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  async listHolidays(
    query: QueryHolidaysDto,
  ): Promise<HolidayCalendarListResponseDto> {
    const year = query.year ?? new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));

    const holidayWhere: Prisma.HolidayWhereInput = {
      holidayDate: { gte: yearStart, lte: yearEnd },
      ...(query.calendarId ? { calendarId: query.calendarId } : {}),
    };

    const [calendars, holidays, lastSynced] = await Promise.all([
      this.prisma.holidayCalendar.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          syncedAt: true,
          _count: {
            select: {
              holidays: {
                where: {
                  holidayDate: { gte: yearStart, lte: yearEnd },
                },
              },
            },
          },
        },
      }),
      this.prisma.holiday.findMany({
        where: holidayWhere,
        orderBy: [{ holidayDate: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          holidayDate: true,
          isFloater: true,
          calendarYear: true,
          calendarId: true,
          syncedAt: true,
          calendar: { select: { name: true } },
        },
      }),
      this.prisma.holiday.findFirst({
        where: holidayWhere,
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }),
    ]);

    return {
      year,
      lastSyncedAt: lastSynced?.syncedAt ?? null,
      calendars: calendars.map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        holidayCount: calendar._count.holidays,
        syncedAt: calendar.syncedAt,
      })),
      holidays: holidays.map((holiday) => ({
        id: holiday.id,
        name: holiday.name,
        holidayDate: holiday.holidayDate,
        isFloater: holiday.isFloater,
        calendarYear: holiday.calendarYear,
        calendarId: holiday.calendarId,
        calendarName: holiday.calendar.name,
        syncedAt: holiday.syncedAt,
      })),
    };
  }
}
