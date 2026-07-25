import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TaskPriorityEnum {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export enum TaskStatusEnum {
  To_Do = 'To_Do',
  In_Progress = 'In_Progress',
  Submitted_for_Review = 'Submitted_for_Review',
  Approved = 'Approved',
  Rework = 'Rework',
  Done = 'Done',
}

@ValidatorConstraint({ name: 'TaskEndDateAfterStartDate', async: false })
export class TaskEndDateAfterStartDateConstraint implements ValidatorConstraintInterface {
  validate(endDate: Date, args: ValidationArguments): boolean {
    const obj = args.object as { startDate?: Date };
    if (!obj.startDate || !endDate) return true;
    return new Date(endDate) >= new Date(obj.startDate);
  }

  defaultMessage(): string {
    return 'End date must be on or after the start date';
  }
}

export class CreateTaskDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440001', nullable: true })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string | null;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003' })
  @IsUUID()
  @IsNotEmpty()
  phaseId: string;

  @ApiProperty({ example: 'Complete vulnerability scanning', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Perform depth scanning of target external subnets' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskPriorityEnum, default: TaskPriorityEnum.Medium })
  @IsOptional()
  @IsEnum(TaskPriorityEnum)
  priority?: TaskPriorityEnum;

  @ApiPropertyOptional({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002', nullable: true })
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  backupOwnerId?: string | null;

  @ApiProperty({ example: '2026-06-01' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({ example: '2026-06-15' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  @Validate(TaskEndDateAfterStartDateConstraint)
  endDate: Date;

  @ApiProperty({ example: 40 })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  effortHours: number;

  @ApiPropertyOptional({
    example: 5.5,
    description: 'MSP working-day duration (fractional allowed)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  durationDays?: number;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  baselineStart?: Date;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  baselineEnd?: Date;

  @ApiPropertyOptional({ example: '2026-06-02' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  actualStart?: Date;

  @ApiPropertyOptional({ example: '2026-06-16' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  actualEnd?: Date;

  @ApiPropertyOptional({
    example: 5.5,
    description: 'Baseline working-day duration (fractional allowed)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  baselineDurationDays?: number;

  @ApiPropertyOptional({
    example: 40,
    description: 'Approved percent complete (0–100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progressApproved?: number;

  @ApiPropertyOptional({ enum: TaskStatusEnum, default: TaskStatusEnum.To_Do })
  @IsOptional()
  @IsEnum(TaskStatusEnum)
  status?: TaskStatusEnum;
}
