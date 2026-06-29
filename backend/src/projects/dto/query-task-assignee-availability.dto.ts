import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class QueryTaskAssigneeAvailabilityDto {
  @ApiProperty({ format: 'uuid', description: 'Task owner user id' })
  @IsUUID()
  ownerId: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  effortHours?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Exclude this task when recalculating (edit flow).',
  })
  @IsOptional()
  @IsUUID()
  excludeTaskId?: string;
}
