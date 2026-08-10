import { Injectable } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import {
  DEFAULT_TIMESHEET_ESCALATION,
} from './app-settings.constants';

export type TimesheetEscalationRuntime = {
  escalationDays: number;
};

@Injectable()
export class TimesheetEscalationPolicyService {
  private cache: { value: TimesheetEscalationRuntime; at: number } | null =
    null;
  private readonly ttlMs = 30_000;

  constructor(private readonly appSettingsService: AppSettingsService) {}

  async getPolicy(): Promise<TimesheetEscalationRuntime> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) {
      return this.cache.value;
    }

    try {
      const settings =
        await this.appSettingsService.getTimesheetEscalationSettings();
      const value: TimesheetEscalationRuntime = {
        escalationDays: settings.escalationDays,
      };
      this.cache = { value, at: Date.now() };
      return value;
    } catch {
      return {
        escalationDays: DEFAULT_TIMESHEET_ESCALATION.timesheetEscalationDays,
      };
    }
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
