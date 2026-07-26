import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TimesheetTaskOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;
}

export class TimesheetProjectOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [TimesheetTaskOptionDto] })
  tasks: TimesheetTaskOptionDto[];
}

export class TimesheetContextDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  employeeName: string;

  @ApiProperty()
  weeklyHours: number;

  @ApiProperty()
  dailyThresholdHours: number;

  @ApiProperty({ type: [TimesheetProjectOptionDto] })
  projects: TimesheetProjectOptionDto[];
}

export class TimesheetDaySummaryDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  totalHours: number;

  @ApiProperty()
  isOverThreshold: boolean;
}

export class TimesheetEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workDate: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  taskId: string;

  @ApiProperty()
  taskName: string;

  @ApiProperty()
  hours: number;

  @ApiProperty({ description: 'Regular (non-OT) hours' })
  regularHours: number;

  @ApiProperty({ description: 'Overtime hours' })
  overtimeHours: number;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty()
  isBillable: boolean;

  @ApiProperty({ enum: ['Draft', 'Submitted', 'Approved', 'Rejected'] })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  feedback: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;
}

export class TimesheetWeekSummaryCardDto {
  @ApiProperty()
  weekStart: string;

  @ApiProperty()
  weekLabel: string;

  @ApiProperty()
  totalHours: number;

  @ApiProperty()
  billableHours: number;

  @ApiProperty()
  overtimeHours: number;

  @ApiProperty({ enum: ['draft', 'submitted', 'approved', 'mixed'] })
  status: 'draft' | 'submitted' | 'approved' | 'mixed';

  @ApiPropertyOptional({ nullable: true })
  submittedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;
}

export class TimesheetWeekResponseDto {
  @ApiProperty()
  weekStart: string;

  @ApiProperty()
  weekEnd: string;

  @ApiProperty()
  weekLabel: string;

  @ApiProperty()
  totalHours: number;

  @ApiProperty()
  billableHours: number;

  @ApiProperty()
  overtimeHours: number;

  @ApiProperty({ type: [TimesheetDaySummaryDto] })
  days: TimesheetDaySummaryDto[];

  @ApiProperty({ type: [TimesheetEntryDto] })
  entries: TimesheetEntryDto[];

  @ApiProperty({ type: [TimesheetWeekSummaryCardDto] })
  recentWeeks: TimesheetWeekSummaryCardDto[];
}

export class SubmitTimesheetWeekResultDto {
  @ApiProperty()
  submittedCount: number;

  @ApiProperty({ type: [TimesheetEntryDto] })
  entries: TimesheetEntryDto[];
}
