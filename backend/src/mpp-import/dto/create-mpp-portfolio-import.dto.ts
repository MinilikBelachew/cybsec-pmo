import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ApiBillingModel,
  ApiEngagementType,
  ApiPriorityLevel,
} from '../../projects/enums/project-api.enum';

/** Multipart empty strings must become undefined so @IsOptional skips them. */
function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

function emptyToUndefinedNumber({ value }: { value: unknown }): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseProjectsJson({ value }: { value: unknown }): unknown {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export class MppPortfolioProjectCreateDto {
  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  objective?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: ApiEngagementType })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(ApiEngagementType)
  engagementType?: ApiEngagementType;

  @ApiPropertyOptional({ enum: ApiBillingModel })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(ApiBillingModel)
  billingModel?: ApiBillingModel;

  @ApiPropertyOptional({ enum: ApiPriorityLevel })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(ApiPriorityLevel)
  priority?: ApiPriorityLevel;

  @ApiPropertyOptional()
  @Transform(emptyToUndefinedNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000000)
  value?: number;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  primaryPmId?: string;
}

/**
 * Shared create defaults + optional per-project overrides for portfolio MPP import.
 */
export class CreateMppPortfolioImportDto {
  @ApiPropertyOptional({ example: 'Imported from MS Project portfolio' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  objective?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: ApiEngagementType })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(ApiEngagementType)
  engagementType?: ApiEngagementType;

  @ApiPropertyOptional({ enum: ApiBillingModel })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(ApiBillingModel)
  billingModel?: ApiBillingModel;

  @ApiPropertyOptional({ enum: ApiPriorityLevel })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(ApiPriorityLevel)
  priority?: ApiPriorityLevel;

  @ApiPropertyOptional({ example: 1 })
  @Transform(emptyToUndefinedNumber)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000000)
  value?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  primaryPmId?: string;

  /**
   * Multipart-safe JSON string of per-project create fields (matched by name).
   * Prefer this over `projects` — FileInterceptor + nested @Type often drops arrays.
   */
  @ApiPropertyOptional({
    description: 'JSON array of MppPortfolioProjectCreateDto',
    type: String,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  projectsJson?: string;

  /** @deprecated Prefer projectsJson. Kept for backwards compatibility. */
  @ApiPropertyOptional({ type: [MppPortfolioProjectCreateDto] })
  @Transform(parseProjectsJson)
  @IsOptional()
  @IsArray()
  projects?: MppPortfolioProjectCreateDto[];
}
