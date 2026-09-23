import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FxService } from './fx.service';

function mockConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'fx.apiUrl': 'https://open.er-api.com/v6/latest/USD',
    'fx.cacheTtlMs': 3_600_000,
    'fx.timeoutMs': 8_000,
    ...overrides,
  };

  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('FxService', () => {
  const rates = { USD: 1, AED: 3.6725, INR: 83.12 };

  function makeService(fetchImpl?: typeof fetch, config?: Record<string, unknown>) {
    const fetchFn =
      fetchImpl ??
      (jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'success', rates }),
      }) as unknown as typeof fetch);

    return {
      service: new FxService(mockConfig(config), { project: {} } as never, fetchFn),
      fetchFn,
    };
  }

  it('converts USD without calling the market API', async () => {
    const fetchFn = jest.fn();
    const { service } = makeService(fetchFn as unknown as typeof fetch);

    const result = await service.convertToUsd(10_000_000, 'usd');

    expect(result).toEqual({
      valueUsd: 10_000_000,
      fxRateToUsd: 1,
      fxRateAt: expect.any(Date),
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('converts AED using the live USD-quoted rate', async () => {
    const { service, fetchFn } = makeService();

    const result = await service.convertToUsd(10_000_000, 'AED');

    expect(result?.valueUsd).toBe(2_722_940.78);
    expect(result?.fxRateToUsd).toBeCloseTo(1 / 3.6725, 8);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('reuses cached rates for a second conversion', async () => {
    const { service, fetchFn } = makeService();

    await service.convertToUsd(1, 'AED');
    await service.convertToUsd(1, 'INR');

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns null for an unsupported currency instead of rejecting', async () => {
    const { service } = makeService();

    await expect(service.convertToUsd(100, 'XXX')).resolves.toBeNull();
  });

  it('returns null when the market API is unavailable and there is no cache', async () => {
    const { service } = makeService(
      jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch,
    );

    await expect(service.convertToUsd(100, 'AED')).resolves.toBeNull();
  });

  it('uses a stale cached rate when the live API is down', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'success', rates }),
      })
      .mockRejectedValue(new Error('network down'));
    const { service } = makeService(fetchFn as unknown as typeof fetch, {
      'fx.cacheTtlMs': 0,
    });

    const live = await service.convertToUsd(10_000_000, 'AED');
    const stale = await service.convertToUsd(10_000_000, 'AED');

    expect(live?.valueUsd).toBe(2_722_940.78);
    expect(stale?.valueUsd).toBe(2_722_940.78);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('uses a caller-supplied fallback rate when live FX has no rate', async () => {
    const { service } = makeService(
      jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch,
    );

    const result = await service.convertToUsd(10_000_000, 'AED', {
      fallbackRateToUsd: 0.27,
    });

    expect(result?.valueUsd).toBe(2_700_000);
    expect(result?.fxRateToUsd).toBe(0.27);
  });

  it('still rejects a non-numeric amount', async () => {
    const { service } = makeService();

    await expect(service.convertToUsd(Number.NaN, 'AED')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
