import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPriorityLevel } from '../../projects/enums/project-api.enum';
import { ActionPointSourceType } from './create-action-point.dto';

export class UpdateActionPointDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ example: '2026-07-20' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @ApiPropertyOptional({ enum: ApiPriorityLevel })
  @IsOptional()
  @IsEnum(ApiPriorityLevel)
  priority?: ApiPriorityLevel;

  @ApiPropertyOptional({ enum: ActionPointSourceType })
  @IsOptional()
  @IsEnum(ActionPointSourceType)
  sourceType?: ActionPointSourceType;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required when sourceType is Task, Risk, Issue, Meeting, or MoM. Defaults to project id for Project.',
  })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @ApiPropertyOptional({
    example: 'In Progress',
    description: 'Open | In Progress | Done | Cancelled',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  closureNote?: string;
}
