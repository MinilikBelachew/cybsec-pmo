/** API-facing enum values (aligned with frontend Zod schema). */

export enum ApiEngagementType {
  ManagedServices = 'ManagedServices',
  StaffAugmentation = 'StaffAugmentation',
  FixedPrice = 'FixedPrice',
}

export enum ApiProjectMethodology {
  Agile = 'Agile',
  Waterfall = 'Waterfall',
  Hybrid = 'Hybrid',
}

export enum ApiBillingModel {
  TimeAndMaterial = 'TimeAndMaterial',
  FixedPrice = 'FixedPrice',
  Retainer = 'Retainer',
}

export enum ApiPriorityLevel {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export enum ApiProjectStatus {
  Draft = 'Draft',
  Active = 'Active',
  OnHold = 'OnHold',
  AtRisk = 'AtRisk',
  PendingClosure = 'PendingClosure',
  Closed = 'Closed',
  Cancelled = 'Cancelled',
}

export enum ApiCurrencyCode {
  USD = 'USD',
  EUR = 'EUR',
  AED = 'AED',
  SAR = 'SAR',
}
