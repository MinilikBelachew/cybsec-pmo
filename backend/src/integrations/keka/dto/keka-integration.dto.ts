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

export class KekaEntitySyncStatusDto {
  @ApiProperty({
    description:
      'Stable key for UI grouping (e.g. employee, leave, holidays)',
  })
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ type: [String] })
  entityTypes: string[];

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastSuccessfulAt: Date | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastFailedAt: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Timestamp of the most recent sync log for this entity group',
  })
  lastRunAt: Date | null;

  @ApiProperty({
    description: 'Success log count in the last-run time window',
  })
  lastRunSucceeded: number;

  @ApiProperty({
    description: 'Failed log count in the last-run time window',
  })
  lastRunFailed: number;

  @ApiProperty()
  unresolvedFailures: number;

  @ApiProperty({
    description: 'Linked / synced records currently stored locally',
  })
  linkedRecordCount: number;
}

export class KekaSyncStatusResponseDto {
  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastSuccessfulAt: Date | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  lastFailedAt: Date | null;

  @ApiProperty()
  unresolvedFailures: number;

  @ApiProperty({ type: [KekaEntitySyncStatusDto] })
  entities: KekaEntitySyncStatusDto[];
}

export class QueryTimesheetReconcileDto {
  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'When true, notify integration admins if mismatches are found',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  notifyAdmins?: boolean;
}

export class TimesheetReconcileEmployeeRowDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  departmentName: string;

  @ApiPropertyOptional({ nullable: true })
  kekaEmployeeId: string | null;

  @ApiProperty()
  localApprovedHours: number;

  @ApiProperty()
  kekaRemoteHours: number;

  @ApiProperty()
  kekaSyncedHours: number;

  @ApiProperty()
  deltaHours: number;

  @ApiProperty({ enum: ['matched', 'pending', 'mismatch', 'unavailable'] })
  status: 'matched' | 'pending' | 'mismatch' | 'unavailable';
}

export class TimesheetReconcileResponseDto {
  @ApiProperty()
  startDate: string;

  @ApiProperty()
  endDate: string;

  @ApiProperty({ enum: ['keka-live', 'local-push-ack'] })
  source: 'keka-live' | 'local-push-ack';

  @ApiProperty()
  pulledEntryCount: number;

  @ApiProperty()
  matchedCount: number;

  @ApiProperty()
  pendingCount: number;

  @ApiProperty()
  mismatchCount: number;

  @ApiProperty()
  unavailableCount: number;

  @ApiProperty()
  notifiedAdminCount: number;

  @ApiProperty({ type: [TimesheetReconcileEmployeeRowDto] })
  mismatches: TimesheetReconcileEmployeeRowDto[];
}
