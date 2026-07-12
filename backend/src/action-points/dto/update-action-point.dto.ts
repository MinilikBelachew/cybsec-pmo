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
