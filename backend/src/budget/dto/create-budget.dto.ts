import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBudgetBaselineDto {
  @ApiProperty({ example: 250000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}

export class CreateBudgetRevisionDto {
  @ApiProperty({ example: 275000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  revisedAmount: number;

  @ApiProperty({ example: 'Scope increase for Phase 2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class CreateBudgetLineItemDto {
  @ApiProperty({ example: 'Travel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category: string;

  @ApiProperty({ example: 'On-site workshops' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemName: string;

  @ApiProperty({ example: 15000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  planned: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actual?: number;
}

export class UpdateBudgetLineItemDto {
  @ApiPropertyOptional({ example: 'Travel' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ example: 'On-site workshops' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemName?: string;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  planned?: number;

  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actual?: number;
}

export class CreateBudgetAdjustmentDto {
  @ApiProperty({
    enum: ['LineActual', 'LinePlanned', 'Baseline'],
    example: 'LineActual',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  targetField: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required when targetField is LineActual or LinePlanned',
  })
  @IsOptional()
  @IsString()
  lineItemId?: string;

  @ApiProperty({ example: 12500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  newAmount: number;

  @ApiProperty({ example: 'Corrected travel actual after invoice' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}
