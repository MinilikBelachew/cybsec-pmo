import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApiBillingModel,
  ApiCurrencyCode,
  ApiEngagementType,
  ApiMethodology,
  ApiPriorityLevel,
  ApiProjectStatus,
} from '../enums/project-api.enum';

class ProjectDepartmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;
}

class ProjectCustomerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;
}

class ProjectPmDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;
}

export class ProjectDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  objective: string;

  @ApiProperty()
  departmentId: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty({ enum: ApiEngagementType })
  engagementType: ApiEngagementType;

  @ApiProperty({ enum: ApiMethodology })
  methodology: ApiMethodology;

  @ApiProperty({ enum: ApiBillingModel })
  billingModel: ApiBillingModel;

  @ApiProperty({ enum: ApiPriorityLevel })
  priority: ApiPriorityLevel;

  @ApiProperty()
  startDate: string;

  @ApiProperty()
  endDate: string;

  @ApiPropertyOptional()
  value?: number;

  @ApiPropertyOptional({ enum: ApiCurrencyCode })
  currency?: ApiCurrencyCode;

  @ApiProperty()
  primaryPmId: string;

  @ApiPropertyOptional({ nullable: true })
  secondaryPmId: string | null;

  @ApiProperty({ enum: ApiProjectStatus })
  status: ApiProjectStatus;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: ProjectDepartmentDto })
  department?: ProjectDepartmentDto;

  @ApiPropertyOptional({ type: ProjectCustomerDto })
  customer?: ProjectCustomerDto;

  @ApiPropertyOptional({ type: ProjectPmDto })
  primaryPm?: ProjectPmDto;

  @ApiPropertyOptional({ type: ProjectPmDto, nullable: true })
  secondaryPm?: ProjectPmDto | null;

  @ApiPropertyOptional({ example: 12 })
  tasksTotal?: number;

  @ApiPropertyOptional({ example: 5 })
  tasksDone?: number;

  @ApiPropertyOptional({ example: 4 })
  phasesTotal?: number;

  @ApiPropertyOptional({ example: 2 })
  phasesCompleted?: number;

  @ApiPropertyOptional({ example: 6 })
  milestonesTotal?: number;

  @ApiPropertyOptional({ example: 3 })
  milestonesDone?: number;

  @ApiPropertyOptional({ example: 192 })
  budgetSpent?: number;

  @ApiPropertyOptional({ example: 88 })
  budgetRemaining?: number;
}

export class DepartmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;
}

export class CustomerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional()
  industry?: string | null;

  @ApiProperty()
  status: string;
}

export class ProjectManagerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  roleId: number;

  @ApiProperty()
  roleCode: string;
}
