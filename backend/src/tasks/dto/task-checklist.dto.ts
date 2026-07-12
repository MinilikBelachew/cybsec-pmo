import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaskChecklistItemDto {
  @ApiProperty({ example: 'Review evidence pack', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;
}

export class UpdateTaskChecklistItemDto {
  @ApiPropertyOptional({ example: 'Review evidence pack', maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}

export class TaskChecklistItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  taskId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  isDone: boolean;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class TaskChecklistProgressDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  done: number;

  @ApiProperty({ description: '0–100 integer percent complete' })
  percent: number;

  @ApiProperty({ type: [TaskChecklistItemDto] })
  items: TaskChecklistItemDto[];
}
