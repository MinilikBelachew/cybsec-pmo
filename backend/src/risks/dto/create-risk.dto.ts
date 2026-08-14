import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRiskDto {
  @ApiProperty({ example: 'API latency spikes' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'TECHNICAL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  impact: number;

  @ApiProperty({ example: 3, minimum: 1, maximum: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  likelihood: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ownerId: string;

  @ApiPropertyOptional({ example: 'Add caching and scale API pods' })
  @IsOptional()
  @IsString()
  mitigationPlan?: string;

  @ApiPropertyOptional({ example: '2026-09-15' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  targetDate?: Date;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  residualImpact?: number;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  residualLikelihood?: number;

  @ApiPropertyOptional({ example: 'Open', default: 'Open' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string = 'Open';
}
