import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ProjectCharterDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional({ nullable: true })
  customerId: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceOrderId: string | null;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  purpose: string | null;

  @ApiPropertyOptional({ nullable: true })
  successCriteria: string | null;

  @ApiPropertyOptional({ nullable: true })
  scopeSummary: string | null;

  @ApiPropertyOptional({ nullable: true })
  scopeExclusions: string | null;

  @ApiPropertyOptional({ nullable: true })
  keyDeliverables: string | null;

  @ApiPropertyOptional({ nullable: true })
  highLevelRisks: string | null;

  @ApiPropertyOptional({ nullable: true })
  milestoneSchedule: string | null;

  @ApiPropertyOptional({ nullable: true })
  valueSnapshot: string | null;

  @ApiPropertyOptional({ nullable: true })
  resourceEstimates: string | null;

  @ApiPropertyOptional({ nullable: true })
  stakeholders: string | null;

  @ApiPropertyOptional({ nullable: true })
  pmAuthority: string | null;

  @ApiPropertyOptional({ nullable: true })
  startDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  endDate: string | null;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional({ type: [String], nullable: true })
  incompleteFields: string[] | null;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  approverSignatureName: string | null;

  @ApiProperty()
  createdAt: string;
}

export class UpdateProjectCharterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  purpose?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  successCriteria?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  scopeSummary?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  scopeExclusions?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  keyDeliverables?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  highLevelRisks?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  milestoneSchedule?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  valueSnapshot?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  resourceEstimates?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  stakeholders?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  pmAuthority?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date | null;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  incompleteFields?: string[] | null;
}

export class ApproveProjectCharterDto {
  @ApiProperty({
    description: 'Typed full name used as approval signature',
    example: 'Jane Doe',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  signatureName: string;
}
