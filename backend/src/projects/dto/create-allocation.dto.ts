import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateAllocationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: 'Security Consultant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  role: string;

  @ApiPropertyOptional({ example: 20, description: 'Weekly hours on this project' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(168)
  hours?: number;

  @ApiPropertyOptional({ example: 50, description: 'Weekly percent on this project' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  percent?: number;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'Client go-live surge — approved by PMO Lead',
    description:
      'Required when assignment exceeds weekly capacity under warn/approve threshold policy (min 10 chars).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}

export class CreateProjectTeamDto {
  @ApiProperty({ type: [CreateAllocationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAllocationDto)
  allocations: CreateAllocationDto[];
}
