import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TASK_DEPENDENCY_TYPES, TaskDependencyType } from './create-task-dependency.dto';

export class UpdateTaskDependencyDto {
  @ApiPropertyOptional({ enum: TASK_DEPENDENCY_TYPES })
  @IsOptional()
  @IsIn(TASK_DEPENDENCY_TYPES)
  depType?: TaskDependencyType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-365)
  @Max(365)
  lagDays?: number;
}
