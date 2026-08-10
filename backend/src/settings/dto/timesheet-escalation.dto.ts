import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { TIMESHEET_ESCALATION_LIMITS } from '../app-settings.constants';

export class TimesheetEscalationSettingsDto {
  @ApiProperty({
    example: 3,
    description:
      'Days a timesheet can stay Submitted before it is treated as escalated',
  })
  escalationDays: number;

  @ApiProperty()
  updatedAt: string;
}

export class UpdateTimesheetEscalationSettingsDto {
  @ApiPropertyOptional({
    minimum: TIMESHEET_ESCALATION_LIMITS.escalationDays.min,
    maximum: TIMESHEET_ESCALATION_LIMITS.escalationDays.max,
  })
  @IsOptional()
  @IsInt()
  @Min(TIMESHEET_ESCALATION_LIMITS.escalationDays.min)
  @Max(TIMESHEET_ESCALATION_LIMITS.escalationDays.max)
  escalationDays?: number;
}
