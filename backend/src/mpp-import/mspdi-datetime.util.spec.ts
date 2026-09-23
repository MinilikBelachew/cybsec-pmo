import { fromMspdiDateTime, toMspdiDateTime } from './mspdi-datetime.util';

describe('toMspdiDateTime', () => {
  it('keeps 08:00 / 17:00 for date-only and UTC-midnight values', () => {
    expect(toMspdiDateTime('2026-04-01', false)).toBe('2026-04-01T08:00:00');
    expect(toMspdiDateTime('2026-04-01', true)).toBe('2026-04-01T17:00:00');
    expect(toMspdiDateTime('2026-04-01T00:00:00.000Z', false)).toBe(
      '2026-04-01T08:00:00',
    );
    expect(toMspdiDateTime(new Date('2026-04-01T00:00:00.000Z'), true)).toBe(
      '2026-04-01T17:00:00',
    );
  });

  it('exports the stored instant in the given timezone', () => {
    expect(
      toMspdiDateTime('2026-04-01T07:00:00.000Z', false, 'Africa/Nairobi'),
    ).toBe('2026-04-01T10:00:00');
    expect(
      toMspdiDateTime('2026-04-01T20:00:00.000Z', true, 'Africa/Nairobi'),
    ).toBe('2026-04-01T23:00:00');
  });
});

describe('fromMspdiDateTime', () => {
  it('keeps date-only values as UTC midnight', () => {
    expect(fromMspdiDateTime('2026-04-01')?.toISOString()).toBe(
      '2026-04-01T00:00:00.000Z',
    );
  });

  it('interprets MPP wall-clock in the given timezone', () => {
    expect(
      fromMspdiDateTime('2026-04-01T10:00:00', 'Africa/Nairobi')?.toISOString(),
    ).toBe('2026-04-01T07:00:00.000Z');
    expect(
      fromMspdiDateTime('2026-04-02T23:00:00', 'Africa/Nairobi')?.toISOString(),
    ).toBe('2026-04-02T20:00:00.000Z');
  });
});
