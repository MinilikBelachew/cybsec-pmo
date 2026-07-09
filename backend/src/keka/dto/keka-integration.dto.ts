import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export class QueryKekaSyncLogsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['inbound', 'outbound'])
  direction?: 'inbound' | 'outbound';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class KekaSyncLogRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty()
  direction: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  errorMsg: string | null;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  createdAt: Date;
}

export class KekaSyncLogListResponseDto {
  @ApiProperty({ type: [KekaSyncLogRowDto] })
  data: KekaSyncLogRowDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}

export class QueryFailedSyncRecordsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  integration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isResolved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class FailedSyncRecordRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  integration: string;

  @ApiProperty()
  entityType: string;

  @ApiPropertyOptional({ nullable: true })
  entityId: string | null;

  @ApiProperty()
  direction: string;

  @ApiProperty()
  errorMsg: string;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  isResolved: boolean;

  @ApiPropertyOptional({ nullable: true })
  resolvedByName: string | null;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt: Date | null;

  @ApiProperty()
  lastAttempted: Date;

  @ApiProperty()
  createdAt: Date;
}

export class FailedSyncRecordListResponseDto {
  @ApiProperty({ type: [FailedSyncRecordRowDto] })
  data: FailedSyncRecordRowDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  unresolvedCount: number;
}

export class RetryKekaSyncDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  failedSyncRecordId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;
}

export class RetryKekaSyncResultDto {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional({ nullable: true })
  message: string | null;

  @ApiPropertyOptional({ nullable: true })
  ref: string | null;
}
