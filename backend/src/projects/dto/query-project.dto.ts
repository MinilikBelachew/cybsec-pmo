import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ApiPriorityLevel,
  ApiProjectStatus,
} from '../enums/project-api.enum';

export class QueryProjectDto {
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ example: 'security audit' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ApiProjectStatus })
  @IsEnum(ApiProjectStatus)
  @IsOptional()
  status?: ApiProjectStatus;

  @ApiPropertyOptional({ enum: ApiPriorityLevel })
  @IsEnum(ApiPriorityLevel)
  @IsOptional()
  priority?: ApiPriorityLevel;
}
