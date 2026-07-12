import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPriorityLevel } from '../../projects/enums/project-api.enum';

export enum ActionPointSourceType {
  Project = 'Project',
  Task = 'Task',
}

export class CreateActionPointDto {
  @ApiProperty({ example: 'Confirm UAT environment access' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ownerId: string;

  @ApiProperty({ example: '2026-07-20' })
  @Type(() => Date)
  @IsDate()
  dueDate: Date;

  @ApiPropertyOptional({ enum: ApiPriorityLevel, default: ApiPriorityLevel.Medium })
  @IsOptional()
  @IsEnum(ApiPriorityLevel)
  priority?: ApiPriorityLevel = ApiPriorityLevel.Medium;

  @ApiPropertyOptional({
    enum: ActionPointSourceType,
    default: ActionPointSourceType.Project,
  })
  @IsOptional()
  @IsEnum(ActionPointSourceType)
  sourceType?: ActionPointSourceType = ActionPointSourceType.Project;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required when sourceType is Task (task id). Defaults to project id for Project.',
  })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @ApiPropertyOptional({ example: 'Open', default: 'Open' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string = 'Open';
}
