import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const TASK_DEPENDENCY_TYPES = ['FS', 'SS', 'FF', 'SF'] as const;
export type TaskDependencyType = (typeof TASK_DEPENDENCY_TYPES)[number];

export class CreateTaskDependencyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  predecessorId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  successorId: string;

  @ApiProperty({ enum: TASK_DEPENDENCY_TYPES, default: 'FS' })
  @IsIn(TASK_DEPENDENCY_TYPES)
  depType: TaskDependencyType = 'FS';

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(-365)
  @Max(365)
  lagDays?: number = 0;
}

export class ValidateTaskDependencyDto extends CreateTaskDependencyDto {}
