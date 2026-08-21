import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExcelTaskImportRowDto } from './excel-tasks-import.dto';
import {
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_OBJECTIVE_MAX_LENGTH,
} from '../../projects/constants/project-limits';

export class ExcelProjectImportRowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PROJECT_NAME_MAX_LENGTH, {
    message: 'Project name must be 100 characters or fewer (Keka limit)',
  })
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PROJECT_OBJECTIVE_MAX_LENGTH, {
    message: 'Description must be 500 characters or fewer',
  })
  objective: string;

  @ApiProperty()
  @IsString()
  engagementType: string;

  @ApiProperty()
  @IsString()
  billingModel: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  methodology?: string;

  @ApiProperty()
  @IsString()
  priority: string;

  @ApiProperty()
  @IsString()
  startDate: string;

  @ApiProperty()
  @IsString()
  endDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty()
  @IsString()
  currency: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baselineStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baselineEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  baselineDurationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actualStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actualEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  percentComplete?: number;

  @ApiProperty({ enum: ['create', 'update'] })
  @IsEnum(['create', 'update'])
  importMode: 'create' | 'update';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resolvedProjectId?: string;

  @ApiProperty()
  @IsUUID()
  resolvedDepartmentId: string;

  @ApiProperty()
  @IsUUID()
  resolvedCustomerId: string;

  @ApiProperty()
  @IsUUID()
  resolvedPrimaryPmId: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  resolvedSecondaryPmId?: string | null;
}

export class ExcelPhaseImportRowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  orderIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ enum: ['create', 'update'] })
  @IsEnum(['create', 'update'])
  importMode: 'create' | 'update';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resolvedPhaseId?: string;
}

export class ExcelMilestoneImportRowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phaseName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  resolvedPhaseId?: string | null;

  @ApiProperty({ enum: ['create', 'update'] })
  @IsEnum(['create', 'update'])
  importMode: 'create' | 'update';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  resolvedMilestoneId?: string;
}

export class ExcelProjectsImportDto {
  @ApiProperty({ type: [ExcelProjectImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ExcelProjectImportRowDto)
  projects: ExcelProjectImportRowDto[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  phasesByProject?: Record<string, ExcelPhaseImportRowDto[]>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  tasksByProject?: Record<string, ExcelTaskImportRowDto[]>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  milestonesByProject?: Record<string, ExcelMilestoneImportRowDto[]>;
}
