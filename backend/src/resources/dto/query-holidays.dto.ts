import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryHolidaysDto {
  @ApiPropertyOptional({
    description: 'Calendar year to load (defaults to current UTC year)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ description: 'Filter to one holiday calendar' })
  @IsOptional()
  @IsUUID()
  calendarId?: string;
}
