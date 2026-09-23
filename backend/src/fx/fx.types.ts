export type UsdConversion = {
  valueUsd: number;
  fxRateToUsd: number;
  fxRateAt: Date;
};

export type UsdRatesSnapshot = {
  rates: Record<string, number>;
  fetchedAt: Date;
};

export type ConvertToUsdOptions = {
  /** Last known USD-per-unit rate for this currency, used if live FX is unavailable. */
  fallbackRateToUsd?: number | null;
};
