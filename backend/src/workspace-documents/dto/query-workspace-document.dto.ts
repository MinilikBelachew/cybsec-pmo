import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { WORKSPACE_DOCUMENT_CATEGORIES } from '../workspace-document.constants';

export class QueryWorkspaceDocumentDto {
  @ApiPropertyOptional({ enum: WORKSPACE_DOCUMENT_CATEGORIES })
  @IsOptional()
  @IsIn([...WORKSPACE_DOCUMENT_CATEGORIES])
  category?: (typeof WORKSPACE_DOCUMENT_CATEGORIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  phaseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  milestoneId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;
}
