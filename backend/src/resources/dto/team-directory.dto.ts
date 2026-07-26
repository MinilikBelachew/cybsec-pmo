import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AllocationPolicySummaryDto } from '../../projects/dto/project-allocation.dto';

export class TeamLeaveRangeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  from: string;

  @ApiProperty()
  to: string;

  @ApiProperty()
  days: number;

  @ApiProperty({ enum: ['approved', 'pending', 'rejected'] })
  status: 'approved' | 'pending' | 'rejected';
}

export class TeamDirectoryAssignmentDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  project: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  hoursPerWeek: number;

  @ApiPropertyOptional({ nullable: true })
  allocationPercent: number | null;

  @ApiProperty()
  startDate: string;

  @ApiPropertyOptional({ nullable: true })
  endDate: string | null;

  @ApiProperty()
  status: string;
}

export class TeamDirectoryMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  designation: string;

  @ApiProperty()
  kekaEmployeeId: string;

  @ApiPropertyOptional({ nullable: true })
  profileImageUrl: string | null;

  @ApiProperty()
  department: {
    id: string;
    code: string;
    name: string;
  };

  @ApiProperty()
  weeklyCapacityHours: number;

  @ApiProperty()
  allocatedHoursTotal: number;

  @ApiProperty()
  remainingHours: number;

  @ApiProperty()
  utilizationPercent: number;

  @ApiProperty()
  isOverAllocated: boolean;

  @ApiProperty()
  isFullyBooked: boolean;

  @ApiProperty({ type: [String] })
  projects: string[];

  @ApiProperty({ type: [TeamDirectoryAssignmentDto] })
  assignments: TeamDirectoryAssignmentDto[];

  @ApiProperty({ type: [TeamLeaveRangeDto] })
  upcomingLeave: TeamLeaveRangeDto[];

  @ApiProperty({ type: [TeamLeaveRangeDto] })
  leaveHistory: TeamLeaveRangeDto[];
}

export class AllocationPolicyDto extends AllocationPolicySummaryDto {}

export class TeamDirectoryStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  over: number;

  @ApiProperty()
  available: number;

  @ApiProperty()
  avgUtil: number;
}

export class TeamDirectoryResponseDto {
  @ApiProperty({ type: [TeamDirectoryMemberDto] })
  members: TeamDirectoryMemberDto[];

  @ApiProperty({ type: TeamDirectoryStatsDto })
  stats: TeamDirectoryStatsDto;

  @ApiProperty({ type: AllocationPolicyDto })
  policy: AllocationPolicyDto;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;
}

export class TeamLeaveRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  employeeName: string;

  @ApiProperty()
  department: string;

  @ApiProperty()
  designation: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  from: string;

  @ApiProperty()
  to: string;

  @ApiProperty()
  days: number;

  @ApiProperty({ enum: ['approved', 'pending', 'rejected'] })
  status: 'approved' | 'pending' | 'rejected';
}

export class TeamLeaveListResponseDto {
  @ApiProperty({ type: [TeamLeaveRowDto] })
  rows: TeamLeaveRowDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;
}

export class EmployeeAttendanceRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '2026-07-13' })
  attendanceDate: string;

  @ApiPropertyOptional({
    description: 'Keka day type: 0 Working, 1 Holiday, 2 WeeklyOff, 3 Leave, 4 Unknown',
  })
  dayType: number | null;

  @ApiPropertyOptional()
  shiftStartTime: string | null;

  @ApiPropertyOptional()
  shiftEndTime: string | null;

  @ApiPropertyOptional()
  shiftDuration: number | null;

  @ApiPropertyOptional()
  shiftEffectiveDuration: number | null;

  @ApiPropertyOptional()
  totalEffectiveHours: number | null;

  @ApiPropertyOptional()
  totalGrossHours: number | null;

  @ApiPropertyOptional()
  firstInAt: string | null;

  @ApiPropertyOptional()
  lastOutAt: string | null;

  @ApiProperty()
  syncedAt: string;
}

export class EmployeeAttendanceListResponseDto {
  @ApiProperty({ type: [EmployeeAttendanceRowDto] })
  rows: EmployeeAttendanceRowDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiPropertyOptional({
    description: 'Latest successful attendance sync for this employee',
    nullable: true,
  })
  lastSuccessfulSyncAt: string | null;
}

export class DesignationOptionsDto {
  @ApiProperty({ type: [String] })
  options: string[];
}
