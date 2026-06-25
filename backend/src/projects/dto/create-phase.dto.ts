import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PhaseStatus } from '@prisma/client';

export class CreatePhaseDto {
  @ApiProperty({ example: 'Phase 1 - Discovery', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Understand project requirements and compile scope.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  orderIndex?: number = 0;

  @ApiProperty({ example: '2026-01-01' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({ example: '2026-02-01' })
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiPropertyOptional({ enum: PhaseStatus, default: PhaseStatus.Planned })
  @IsEnum(PhaseStatus)
  @IsOptional()
  status?: PhaseStatus = PhaseStatus.Planned;
}
