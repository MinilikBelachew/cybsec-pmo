import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryLeaveImpactsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class LeaveImpactLeaveDto {
  @ApiProperty()
  type: string;

  @ApiProperty()
  from: string;

  @ApiProperty()
  to: string;

  @ApiProperty()
  days: number;
}

export class LeaveImpactPersonDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  userId: string | null;

  @ApiPropertyOptional({ nullable: true })
  backupEmployeeId: string | null;

  @ApiPropertyOptional({ nullable: true })
  backupEmployeeName: string | null;
}

export class LeaveImpactTaskDto {
  @ApiProperty()
  taskId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  priority: string;

  @ApiProperty()
  isOnCriticalPath: boolean;

  @ApiPropertyOptional({ nullable: true })
  startDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  endDate: string | null;

  @ApiProperty()
  overlapDays: number;

  @ApiProperty()
  estimatedDelayDays: number;

  @ApiPropertyOptional({ nullable: true })
  projectedTaskEnd: string | null;

  @ApiProperty()
  downstreamTaskCount: number;

  @ApiPropertyOptional({ nullable: true })
  backupOwnerId: string | null;

  @ApiPropertyOptional({ nullable: true })
  backupOwnerName: string | null;
}

export class LeaveImpactRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty({ type: LeaveImpactPersonDto })
  assignee: LeaveImpactPersonDto;

  @ApiProperty({ type: LeaveImpactLeaveDto })
  leave: LeaveImpactLeaveDto;

  @ApiProperty({ type: LeaveImpactTaskDto })
  task: LeaveImpactTaskDto;

  @ApiProperty()
  hasBackup: boolean;

  @ApiProperty()
  isCritical: boolean;

  @ApiPropertyOptional({ nullable: true })
  allocationId: string | null;

  @ApiProperty()
  isCriticalAllocation: boolean;
}

export class LeaveImpactListResponseDto {
  @ApiProperty({ type: [LeaveImpactRowDto] })
  rows: LeaveImpactRowDto[];

  @ApiProperty()
  criticalCount: number;

  @ApiProperty()
  withoutBackupCount: number;
}

export class SetAllocationBackupDto {
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  backupEmployeeId?: string | null;
}

export class ApplyLeaveBackupDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  taskId: string;
}

export class TaskScheduleImpactDto {
  @ApiProperty()
  hasLeaveConflict: boolean;

  @ApiProperty()
  overlapDays: number;

  @ApiProperty()
  estimatedDelayDays: number;

  @ApiPropertyOptional({ nullable: true })
  projectedTaskEnd: string | null;

  @ApiProperty()
  downstreamTaskCount: number;

  @ApiPropertyOptional({ nullable: true })
  leaveFrom: string | null;

  @ApiPropertyOptional({ nullable: true })
  leaveTo: string | null;

  @ApiPropertyOptional({ nullable: true })
  leaveType: string | null;

  @ApiProperty()
  isCritical: boolean;

  @ApiProperty()
  hasBackup: boolean;
}
