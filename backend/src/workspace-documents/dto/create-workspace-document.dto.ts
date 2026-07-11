import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { WORKSPACE_DOCUMENT_CATEGORIES } from '../workspace-document.constants';

export class CreateWorkspaceDocumentDto {
  @ApiProperty({ example: '/api/v1/files/abc.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  storageKey: string;

  @ApiProperty({ example: 'design_doc.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @ApiPropertyOptional({ example: 420000 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  sizeBytes?: number;

  @ApiProperty({
    enum: WORKSPACE_DOCUMENT_CATEGORIES,
    example: 'Project',
  })
  @IsIn([...WORKSPACE_DOCUMENT_CATEGORIES])
  category: (typeof WORKSPACE_DOCUMENT_CATEGORIES)[number];

  @ApiPropertyOptional({
    description: 'Required when category is Phase',
  })
  @ValidateIf((o: CreateWorkspaceDocumentDto) => o.category === 'Phase')
  @IsUUID()
  @IsNotEmpty()
  phaseId?: string;

  @ApiPropertyOptional({
    description: 'Required when category is Milestone',
  })
  @ValidateIf((o: CreateWorkspaceDocumentDto) => o.category === 'Milestone')
  @IsUUID()
  @IsNotEmpty()
  milestoneId?: string;

  @ApiPropertyOptional({
    description: 'Required when category is Task (prefer task attachment routes)',
  })
  @ValidateIf((o: CreateWorkspaceDocumentDto) => o.category === 'Task')
  @IsUUID()
  @IsNotEmpty()
  taskId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
