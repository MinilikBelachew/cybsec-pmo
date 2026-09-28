import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FINANCE_ALERT_SETTINGS_LIMITS } from '../app-settings.constants';

export class FinanceAlertSettingsDto {
  @ApiProperty({
    example: 10000,
    description:
      'Notify Finance when a project-linked invoice balance is at least this amount (invoice currency). Set 0 to disable.',
  })
  largeUnpaidBalanceThreshold: number;

  @ApiProperty()
  updatedAt: string;
}

export class UpdateFinanceAlertSettingsDto {
  @ApiPropertyOptional({
    minimum: FINANCE_ALERT_SETTINGS_LIMITS.largeUnpaidBalanceThreshold.min,
    maximum: FINANCE_ALERT_SETTINGS_LIMITS.largeUnpaidBalanceThreshold.max,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(FINANCE_ALERT_SETTINGS_LIMITS.largeUnpaidBalanceThreshold.min)
  @Max(FINANCE_ALERT_SETTINGS_LIMITS.largeUnpaidBalanceThreshold.max)
  largeUnpaidBalanceThreshold?: number;
}
