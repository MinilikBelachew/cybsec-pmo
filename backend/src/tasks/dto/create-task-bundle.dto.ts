import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

export class TaskBundleCommentDto {
  @IsString()
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class TaskBundleSubTaskDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateTaskBundleDto extends CreateTaskDto {
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
}
