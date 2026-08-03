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

export class UpdateIssueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: ApiPriorityLevel })
  @IsOptional()
  @IsEnum(ApiPriorityLevel)
  priority?: ApiPriorityLevel;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ example: '2026-08-20' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @ApiPropertyOptional({ example: '2026-08-25' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedResolutionDate?: Date | null;

  @ApiPropertyOptional({
    example: 'In Progress',
    description: 'Open | In Progress | Resolved | Closed | Cancelled',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNote?: string | null;

  @ApiPropertyOptional({
    description: 'S3 key for closure evidence attachment',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  s3EvidenceKey?: string | null;
}

export class CloseIssueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolutionNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  s3EvidenceKey?: string;
}
