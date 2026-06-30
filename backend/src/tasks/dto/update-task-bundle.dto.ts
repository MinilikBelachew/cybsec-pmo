import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateTaskDependencyDto } from './create-task-dependency.dto';
import {
  TaskBundleCommentDto,
  TaskBundleSubTaskDto,
} from './create-task-bundle.dto';
import { UpdateTaskDto } from './update-task.dto';

export class UpdateTaskBundleDto extends UpdateTaskDto {
  @ApiPropertyOptional({ type: [TaskBundleCommentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskBundleCommentDto)
  comments?: TaskBundleCommentDto[];

  @ApiPropertyOptional({ type: [TaskBundleSubTaskDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskBundleSubTaskDto)
  subTasks?: TaskBundleSubTaskDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  removeAttachmentIds?: string[];

  @ApiPropertyOptional({ type: [CreateTaskDependencyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDependencyDto)
  addDependencies?: CreateTaskDependencyDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  removeDependencyIds?: string[];
}
