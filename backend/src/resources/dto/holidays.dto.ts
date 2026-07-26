import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HolidayCalendarOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  holidayCount: number;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  syncedAt: Date | null;
}

export class HolidayRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, format: 'date' })
  holidayDate: Date;

  @ApiProperty()
  isFloater: boolean;

  @ApiPropertyOptional({ nullable: true })
  calendarYear: number | null;

  @ApiProperty()
  calendarId: string;

  @ApiProperty()
  calendarName: string;

  @ApiProperty({ type: String, format: 'date-time' })
  syncedAt: Date;
}

export class HolidayCalendarListResponseDto {
  @ApiProperty()
  year: number;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastSyncedAt: Date | null;

  @ApiProperty({ type: [HolidayCalendarOptionDto] })
  calendars: HolidayCalendarOptionDto[];

  @ApiProperty({ type: [HolidayRowDto] })
  holidays: HolidayRowDto[];
}
