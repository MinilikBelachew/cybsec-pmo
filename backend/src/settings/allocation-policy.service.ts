import { Injectable } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { AllocationRuntimePolicies } from './allocation-policy.types';

@Injectable()
export class AllocationPolicyService {
  private cache: { value: AllocationRuntimePolicies; at: number } | null = null;
  private readonly ttlMs = 60_000;

  constructor(private readonly appSettingsService: AppSettingsService) {}

  async getPolicies(): Promise<AllocationRuntimePolicies> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) {
      return this.cache.value;
    }

    const value = await this.appSettingsService.getAllocationPolicies();
    this.cache = { value, at: Date.now() };
    return value;
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
