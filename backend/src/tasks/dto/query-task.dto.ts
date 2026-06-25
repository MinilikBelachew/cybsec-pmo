import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaskPriorityEnum, TaskStatusEnum } from './create-task.dto';

export class QueryTaskDto {
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ example: 'vulnerability' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: TaskStatusEnum })
  @IsEnum(TaskStatusEnum)
  @IsOptional()
  status?: TaskStatusEnum;

  @ApiPropertyOptional({ enum: TaskPriorityEnum })
  @IsEnum(TaskPriorityEnum)
  @IsOptional()
  priority?: TaskPriorityEnum;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by parent task (sub-tasks of this task)',
  })
  @IsUUID()
  @IsOptional()
  parentTaskId?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'When true, only return top-level tasks (no sub-tasks)',
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return true;
    if (value === 'false' || value === false) return false;
    return true;
  })
  @IsBoolean()
  @IsOptional()
  topLevelOnly?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  phaseId?: string;
}
