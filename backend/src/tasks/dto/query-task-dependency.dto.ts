import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryTaskDependencyDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'All dependencies in a project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Dependencies where this task is involved' })
  @IsOptional()
  @IsUUID()
  taskId?: string;
}
