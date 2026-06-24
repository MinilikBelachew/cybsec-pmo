import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
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
  priority?: TaskPriorityEnum = TaskPriorityEnum.Medium;

  @ApiPropertyOptional({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002', nullable: true })
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

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

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  effortHours?: number;

  @ApiPropertyOptional({ enum: TaskStatusEnum, default: TaskStatusEnum.To_Do })
  @IsOptional()
  @IsEnum(TaskStatusEnum)
  status?: TaskStatusEnum = TaskStatusEnum.To_Do;
}
