import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class HealthRuleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  dimension: string;

  @ApiProperty()
  greenThreshold: number;

  @ApiProperty()
  amberThreshold: number;

  @ApiPropertyOptional()
  redThreshold: number | null;

  @ApiPropertyOptional()
  unit: string | null;

  @ApiProperty()
  version: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  updatedAt: Date;
}

export class UpdateHealthRuleItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(50)
  dimension: string;

  @ApiProperty()
  @IsNumber()
  greenThreshold: number;

  @ApiProperty()
  @IsNumber()
  amberThreshold: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  redThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateHealthRulesDto {
  @ApiProperty({ type: [UpdateHealthRuleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateHealthRuleItemDto)
  rules: UpdateHealthRuleItemDto[];
}

export class DimensionHealthDto {
  @ApiProperty()
  dimension: string;

  @ApiProperty()
  score: number;

  @ApiProperty()
  ragStatus: string;

  @ApiProperty()
  value: Record<string, unknown>;

  @ApiProperty()
  ruleVersion: string;
}

export class ProjectHealthEvaluationDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  overallRag: string;

  @ApiProperty({ type: [DimensionHealthDto] })
  dimensions: DimensionHealthDto[];

  @ApiProperty()
  evaluatedAt: string;

  @ApiProperty()
  source: 'live' | 'snapshot';
}
