import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AllConfigType } from '../config/config.type';
import { FX_FETCH, FX_HOME_CURRENCY } from './fx.constants';
import {
  ConvertToUsdOptions,
  UsdConversion,
  UsdRatesSnapshot,
} from './fx.types';

type FxFetch = (
  input: string,
  init?: { signal?: AbortSignal },
) => Promise<Response>;

type OpenExchangeRatesResponse = {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
};

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly fetchFn: FxFetch;
  private cache: UsdRatesSnapshot | null = null;
  private inflight: Promise<UsdRatesSnapshot | null> | null = null;
  private backfillInflight: Promise<number> | null = null;

  constructor(
    private readonly config: ConfigService<AllConfigType>,
    private readonly prisma: PrismaService,
    @Optional() @Inject(FX_FETCH) fetchFn?: FxFetch,
  ) {
    this.fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  async convertToUsd(
    amount: number,
    currency: string,
    options: ConvertToUsdOptions = {},
  ): Promise<UsdConversion | null> {
    const code = (currency || FX_HOME_CURRENCY).trim().toUpperCase();
    const fxRateAt = new Date();

    if (!Number.isFinite(amount)) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { value: 'invalidProjectValue' },
      });
    }

    if (code === FX_HOME_CURRENCY) {
      return {
        valueUsd: roundMoney(amount),
        fxRateToUsd: 1,
        fxRateAt,
      };
    }

    const liveRate = await this.getRateToUsd(code);
    const rateToUsd = liveRate ?? positiveRate(options.fallbackRateToUsd);

    if (rateToUsd == null) {
      this.logger.warn(
        `No FX rate for ${code}; saving without a USD snapshot`,
      );
      return null;
    }

    if (liveRate == null) {
      this.logger.warn(`Using fallback FX rate for ${code}`);
    }

    return {
      valueUsd: roundMoney(amount * rateToUsd),
      fxRateToUsd: roundRate(rateToUsd),
      fxRateAt,
    };
  }

  async backfillMissingProjectValueUsd(): Promise<number> {
    if (this.backfillInflight) {
      return this.backfillInflight;
    }

    this.backfillInflight = this.runBackfill().finally(() => {
      this.backfillInflight = null;
    });

    return this.backfillInflight;
  }

  private async runBackfill(): Promise<number> {
    const missing = await this.prisma.project.findMany({
      where: {
        value: { not: null },
        OR: [{ valueUsd: null }, { fxRateToUsd: null }],
      },
      select: { id: true, value: true, currency: true, fxRateToUsd: true },
    });

    if (missing.length === 0) {
      return 0;
    }

    let updated = 0;
    for (const project of missing) {
      try {
        const conversion = await this.convertToUsd(
          Number(project.value),
          project.currency,
          {
            fallbackRateToUsd:
              project.fxRateToUsd != null ? Number(project.fxRateToUsd) : null,
          },
        );
        if (!conversion) {
          continue;
        }
        await this.prisma.project.update({
          where: { id: project.id },
          data: {
            valueUsd: conversion.valueUsd,
            fxRateToUsd: conversion.fxRateToUsd,
            fxRateAt: conversion.fxRateAt,
          },
        });
        updated += 1;
      } catch (error) {
        this.logger.warn(
          `Could not convert project ${project.id} (${project.currency}) to USD: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    return updated;
  }

  private async getRateToUsd(currency: string): Promise<number | null> {
    const snapshot = await this.getUsdRates();
    const quotedPerUsd = snapshot?.rates[currency];

    if (!quotedPerUsd || quotedPerUsd <= 0) {
      return null;
    }

    return 1 / quotedPerUsd;
  }

  private async getUsdRates(): Promise<UsdRatesSnapshot | null> {
    const ttlMs = this.config.get('fx.cacheTtlMs', { infer: true }) ?? 3_600_000;
    if (this.cache && Date.now() - this.cache.fetchedAt.getTime() < ttlMs) {
      return this.cache;
    }

    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.fetchUsdRates()
      .then((snapshot) => {
        this.cache = snapshot;
        return snapshot;
      })
      .catch((error) => {
        this.logger.error(
          `Live FX lookup failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        if (this.cache) {
          this.logger.warn('Using stale FX rates after live lookup failed');
          return this.cache;
        }
        return null;
      })
      .finally(() => {
        this.inflight = null;
      });

    return this.inflight;
  }

  private async fetchUsdRates(): Promise<UsdRatesSnapshot> {
    const apiUrl =
      this.config.get('fx.apiUrl', { infer: true }) ??
      'https://open.er-api.com/v6/latest/USD';
    const timeoutMs = this.config.get('fx.timeoutMs', { infer: true }) ?? 8_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchFn(apiUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`FX API responded with ${response.status}`);
      }

      const body = (await response.json()) as OpenExchangeRatesResponse;
      if (body.result && body.result !== 'success') {
        throw new Error(`FX API result was ${body.result}`);
      }

      const rates = body.rates;
      if (!rates || typeof rates !== 'object') {
        throw new Error('FX API returned no rates');
      }

      return { rates, fetchedAt: new Date() };
    } finally {
      clearTimeout(timer);
    }
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function positiveRate(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}
