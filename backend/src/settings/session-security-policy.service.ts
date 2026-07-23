import { Injectable } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';

export type SessionSecurityRuntime = {
  idleTimeoutSec: number;
  warningBeforeSec: number;
};

@Injectable()
export class SessionSecurityPolicyService {
  private cache: { value: SessionSecurityRuntime; at: number } | null = null;
  private readonly ttlMs = 30_000;

  constructor(private readonly appSettingsService: AppSettingsService) {}

  async getPolicy(): Promise<SessionSecurityRuntime> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) {
      return this.cache.value;
    }

    const settings = await this.appSettingsService.getSessionSecuritySettings();
    const value: SessionSecurityRuntime = {
      idleTimeoutSec: settings.idleTimeoutSec,
      warningBeforeSec: settings.warningBeforeSec,
    };
    this.cache = { value, at: Date.now() };
    return value;
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
