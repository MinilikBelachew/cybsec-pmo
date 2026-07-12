import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UtilisationDepartmentBreakdownDto {
  @ApiProperty()
  departmentId: string;

  @ApiProperty()
  departmentName: string;

  @ApiProperty()
  plannedHours: number;

  @ApiProperty()
  submittedHours: number;

  @ApiProperty()
  approvedHours: number;

  @ApiProperty()
  billableHours: number;

  @ApiProperty()
  nonBillableHours: number;

  @ApiProperty()
  availableHours: number;
}

export class UtilisationReconcileDto {
  @ApiProperty()
  approvedHours: number;

  @ApiProperty()
  kekaSyncedHours: number;

  @ApiProperty()
  deltaHours: number;

  @ApiProperty({ enum: ['matched', 'pending', 'mismatch'] })
  status: 'matched' | 'pending' | 'mismatch';
}

export class UtilisationEmployeeRowDto {
  @ApiProperty()
  employeeId: string;

  @ApiPropertyOptional()
  userId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  designation: string;

  @ApiProperty()
  departmentId: string;

  @ApiProperty()
  departmentName: string;

  @ApiProperty()
  plannedHours: number;

  @ApiProperty()
  submittedHours: number;

  @ApiProperty()
  approvedHours: number;

  @ApiProperty()
  billableHours: number;

  @ApiProperty()
  nonBillableHours: number;

  @ApiProperty()
  availableHours: number;

  @ApiProperty()
  billableUtilisationPercent: number;

  @ApiProperty()
  totalUtilisationPercent: number;

  @ApiProperty({ enum: ['over', 'optimal', 'under'] })
  status: 'over' | 'optimal' | 'under';

  @ApiProperty({ type: UtilisationReconcileDto })
  reconcile: UtilisationReconcileDto;
}

export class UtilisationSummaryDto {
  @ApiProperty()
  employeeCount: number;

  @ApiProperty()
  avgBillableUtilisation: number;

  @ApiProperty()
  totalPlannedHours: number;

  @ApiProperty()
  totalSubmittedHours: number;

  @ApiProperty()
  totalApprovedHours: number;

  @ApiProperty()
  totalBillableHours: number;

  @ApiProperty()
  totalNonBillableHours: number;

  @ApiProperty()
  totalAvailableHours: number;

  @ApiProperty()
  overCount: number;

  @ApiProperty()
  underCount: number;
}

export class UtilisationReportResponseDto {
  @ApiProperty()
  startDate: string;

  @ApiProperty()
  endDate: string;

  @ApiProperty()
  formulaVersion: string;

  @ApiProperty({ type: UtilisationSummaryDto })
  summary: UtilisationSummaryDto;

  @ApiProperty({ type: [UtilisationEmployeeRowDto] })
  rows: UtilisationEmployeeRowDto[];

  @ApiProperty({ type: [UtilisationDepartmentBreakdownDto] })
  departments: UtilisationDepartmentBreakdownDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;
}
