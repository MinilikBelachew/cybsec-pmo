import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class AllocationPolicySummaryDto {
  @ApiProperty({ enum: ['warn', 'block', 'approve'] })
  thresholdMode: 'warn' | 'block' | 'approve';

  @ApiProperty({ enum: ['off', 'warn', 'block'] })
  designationMismatchMode: 'off' | 'warn' | 'block';

  @ApiProperty({ enum: ['off', 'warn', 'block'] })
  departmentStaffingMode: 'off' | 'warn' | 'block';

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        projectRole: { type: 'string' },
        allowedDesignations: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  designationRules: Array<{
    projectRole: string;
    allowedDesignations: string[];
  }>;

  @ApiProperty({
    type: 'object',
    properties: {
      rule: { enum: ['same_department_only', 'allow_list'] },
      byProjectDepartmentCode: { type: 'object', additionalProperties: true },
    },
  })
  departmentStaffingRules: {
    rule: 'same_department_only' | 'allow_list';
    byProjectDepartmentCode?: Record<string, string[]>;
  };
}

export class ProjectAllocationEmployeeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  designation: string;

  @ApiPropertyOptional({ nullable: true })
  userId: string | null;

  @ApiProperty()
  department: {
    id: string;
    code: string;
    name: string;
  };

  @ApiPropertyOptional({ nullable: true })
  profileImageUrl: string | null;
}

export class ProjectAllocationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  role: string;

  @ApiPropertyOptional({ nullable: true })
  hours: number | null;

  @ApiPropertyOptional({ nullable: true })
  percent: number | null;

  @ApiProperty()
  startDate: string;

  @ApiPropertyOptional({ nullable: true })
  endDate: string | null;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  requestedBy: { id: string; name: string } | null;

  @ApiPropertyOptional({ nullable: true })
  requestedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: { id: string; name: string } | null;

  @ApiPropertyOptional({ nullable: true })
  kekaSyncedAt: string | null;

  @ApiProperty({ type: ProjectAllocationEmployeeDto })
  employee: ProjectAllocationEmployeeDto;

  @ApiProperty()
  weeklyCapacityHours: number;

  @ApiProperty()
  allocatedHoursTotal: number;

  @ApiProperty()
  remainingHoursTotal: number;

  @ApiProperty()
  utilizationPercent: number;

  @ApiProperty()
  isOverAllocated: boolean;

  @ApiProperty({ type: [TeamLeaveRangeDto] })
  upcomingLeave: TeamLeaveRangeDto[];

  @ApiPropertyOptional({ nullable: true })
  backupEmployeeId: string | null;

  @ApiPropertyOptional({ nullable: true })
  backupEmployeeName: string | null;
}

export class UpdateProjectTeamMemberResultDto {
  @ApiProperty({ type: ProjectAllocationDto })
  updated: ProjectAllocationDto;

  @ApiProperty({ type: [String] })
  warnings: string[];

  @ApiProperty({ type: AllocationPolicySummaryDto })
  policy: AllocationPolicySummaryDto;
}

export class TeamCandidateDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  designation: string;

  @ApiPropertyOptional({ nullable: true })
  userId: string | null;

  @ApiProperty()
  department: {
    id: string;
    code: string;
    name: string;
  };

  @ApiProperty()
  weeklyCapacityHours: number;

  @ApiProperty({ description: 'Hours allocated on other active projects' })
  allocatedHoursOtherProjects: number;

  @ApiProperty({ description: 'Hours allocated on this project (when projectId query is set)' })
  allocatedHoursThisProject: number;

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

  @ApiProperty()
  isOnProject: boolean;

  @ApiProperty({ type: [TeamLeaveRangeDto] })
  upcomingLeave: TeamLeaveRangeDto[];

  @ApiProperty({
    description:
      'False when department staffing policy would reject this employee for the project department',
  })
  departmentStaffingAllowed: boolean;

  @ApiPropertyOptional({ nullable: true })
  profileImageUrl: string | null;
}

export class CreateProjectTeamResultDto {
  @ApiProperty({ type: [ProjectAllocationDto] })
  created: ProjectAllocationDto[];

  @ApiProperty({ type: [String] })
  warnings: string[];

  @ApiProperty({ type: AllocationPolicySummaryDto })
  policy: AllocationPolicySummaryDto;
}

export class TaskAssigneeAvailabilityDto {
  @ApiProperty()
  canCheck: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  employeeName?: string;

  @ApiPropertyOptional()
  weeklyCapacityHours?: number;

  @ApiPropertyOptional({ description: 'Weekly hours from project allocations' })
  allocationHours?: number;

  @ApiPropertyOptional({ description: 'Weekly hours from other assigned tasks' })
  otherTaskHours?: number;

  @ApiPropertyOptional({ description: 'Weekly hours from this task effort' })
  thisTaskHours?: number;

  @ApiPropertyOptional()
  allocatedHoursTotal?: number;

  @ApiPropertyOptional()
  remainingHours?: number;

  @ApiPropertyOptional()
  utilizationPercent?: number;

  @ApiPropertyOptional()
  isOverAllocated?: boolean;

  @ApiProperty({ type: [String] })
  warnings: string[];
}

export class ProjectTaskAssigneeDto {
  @ApiProperty({ description: 'User id stored on tasks.owner_id' })
  userId: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  designation: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  department: {
    id: string;
    code: string;
    name: string;
  };
}
