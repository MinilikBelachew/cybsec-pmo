import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryTimesheetApprovalsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['all', 'pending', 'approved', 'rejected'] })
  @IsOptional()
  @IsIn(['all', 'pending', 'approved', 'rejected'])
  status?: 'all' | 'pending' | 'approved' | 'rejected';

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
}

export class TimesheetSubmissionEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  date: string;

  @ApiProperty()
  project: string;

  @ApiProperty()
  task: string;

  @ApiProperty()
  hours: number;

  @ApiProperty()
  regularHours: number;

  @ApiProperty()
  overtimeHours: number;

  @ApiProperty()
  isBillable: boolean;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ enum: ['synced', 'failed'], nullable: true })
  kekaSyncStatus: 'synced' | 'failed' | null;
}

export class TimesheetSubmissionRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  employee: string;

  @ApiProperty()
  employeeInitials: string;

  @ApiProperty()
  employeeRole: string;

  @ApiProperty()
  weekStart: string;

  @ApiProperty()
  week: string;

  @ApiProperty()
  submittedAt: string;

  @ApiProperty()
  totalHours: number;

  @ApiProperty()
  billableHours: number;

  @ApiProperty()
  overtimeHours: number;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected'] })
  status: 'pending' | 'approved' | 'rejected';

  @ApiProperty()
  isOverThreshold: boolean;

  @ApiProperty()
  isEscalated: boolean;

  @ApiProperty()
  hasSyncFailures: boolean;

  @ApiProperty()
  failedSyncCount: number;

  @ApiProperty({ type: [TimesheetSubmissionEntryDto] })
  entries: TimesheetSubmissionEntryDto[];

  @ApiPropertyOptional({ nullable: true })
  feedback: string | null;
}

export class TimesheetApprovalStatsDto {
  @ApiProperty()
  pending: number;

  @ApiProperty()
  approved: number;

  @ApiProperty()
  rejected: number;

  @ApiProperty()
  escalated: number;

  @ApiProperty()
  overThreshold: number;
}

export class TimesheetApprovalListResponseDto {
  @ApiProperty({ type: [TimesheetSubmissionRowDto] })
  rows: TimesheetSubmissionRowDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty({ type: TimesheetApprovalStatsDto })
  stats: TimesheetApprovalStatsDto;
}

export class TimesheetSubmissionActionDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  weekStart: string;
}

export class ApproveTimesheetSubmissionDto extends TimesheetSubmissionActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RejectTimesheetSubmissionDto extends TimesheetSubmissionActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class TimesheetApprovalDecisionDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  weekStart: string;

  @ApiProperty()
  updatedCount: number;

  @ApiProperty({ type: [String] })
  kekaSyncRefs: string[];

  @ApiProperty({ type: [String] })
  syncFailures: string[];

  @ApiProperty()
  syncSuccessCount: number;
}

export class RetryTimesheetSyncDto {
  @ApiProperty()
  @IsUUID()
  timesheetId: string;
}

export class TimesheetSyncFailureDto {
  @ApiProperty()
  timesheetId: string;

  @ApiProperty()
  approvalId: string;

  @ApiProperty()
  employeeName: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  taskName: string;

  @ApiProperty()
  workDate: string;

  @ApiProperty()
  hours: number;

  @ApiPropertyOptional({ nullable: true })
  errorMsg: string | null;

  @ApiProperty()
  retryCount: number;
}

export class RetryTimesheetSyncResultDto {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional({ nullable: true })
  ref: string | null;
}
