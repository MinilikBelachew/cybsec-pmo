import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}

export class CreateProjectTeamResultDto {
  @ApiProperty({ type: [ProjectAllocationDto] })
  created: ProjectAllocationDto[];

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
