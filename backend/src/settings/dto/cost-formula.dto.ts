import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CostFormulaSettingsDto {
  @ApiProperty({ enum: ['ctc', 'gross'] })
  basis: 'ctc' | 'gross';

  @ApiProperty()
  hoursPerWeek: number;

  @ApiProperty()
  weeksPerYear: number;

  @ApiProperty()
  otMultiplier: number;

  @ApiProperty({ enum: ['ignore', 'exclude_unpaid', 'prorate'] })
  leaveMode: 'ignore' | 'exclude_unpaid' | 'prorate';

  @ApiProperty()
  monthlyRemunerationType: number;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: string | null;

  @ApiProperty()
  updatedAt: string;
}

export class UpdateCostFormulaSettingsDto {
  @ApiPropertyOptional({ enum: ['ctc', 'gross'] })
  @IsOptional()
  @IsIn(['ctc', 'gross'])
  basis?: 'ctc' | 'gross';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(80)
  hoursPerWeek?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(53)
  weeksPerYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(3)
  otMultiplier?: number;

  @ApiPropertyOptional({ enum: ['ignore', 'exclude_unpaid', 'prorate'] })
  @IsOptional()
  @IsIn(['ignore', 'exclude_unpaid', 'prorate'])
  leaveMode?: 'ignore' | 'exclude_unpaid' | 'prorate';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  monthlyRemunerationType?: number;
}

export function mapCostFormulaSettingsDto(
  formula: {
    basis: 'ctc' | 'gross';
    hoursPerWeek: number;
    weeksPerYear: number;
    otMultiplier: number;
    leaveMode: 'ignore' | 'exclude_unpaid' | 'prorate';
    monthlyRemunerationType: number;
    version: number;
    approvedBy?: string | null;
    approvedAt?: string | null;
  },
  updatedAt: Date,
): CostFormulaSettingsDto {
  return {
    ...formula,
    approvedBy: formula.approvedBy ?? null,
    approvedAt: formula.approvedAt ?? null,
    updatedAt: updatedAt.toISOString(),
  };
}
