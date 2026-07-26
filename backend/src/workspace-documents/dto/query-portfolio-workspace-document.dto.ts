import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { WORKSPACE_DOCUMENT_CATEGORIES } from '../workspace-document.constants';

export class QueryPortfolioWorkspaceDocumentDto {
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @Transform(({ value }) => (value ? Number(value) : 50))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ example: 'report' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ enum: WORKSPACE_DOCUMENT_CATEGORIES })
  @IsOptional()
  @IsIn([...WORKSPACE_DOCUMENT_CATEGORIES])
  category?: (typeof WORKSPACE_DOCUMENT_CATEGORIES)[number];
}
