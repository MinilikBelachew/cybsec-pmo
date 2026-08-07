import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ConfirmExcelProjectsPreviewDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  previewId: string;
}

export class ExcelProjectsPreviewPageQueryDto {
  @ApiProperty({ enum: ['projects', 'phases', 'tasks', 'milestones'] })
  @IsEnum(['projects', 'phases', 'tasks', 'milestones'])
  entity: 'projects' | 'phases' | 'tasks' | 'milestones';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class PatchExcelProjectsPreviewRowDto {
  @ApiProperty({ enum: ['projects', 'phases', 'tasks', 'milestones'] })
  @IsEnum(['projects', 'phases', 'tasks', 'milestones'])
  entity: 'projects' | 'phases' | 'tasks' | 'milestones';

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  patch: Record<string, unknown>;
}
