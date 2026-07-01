export function parseIntegerInput(value: string): number | undefined {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatIntegerWithCommas(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const parsed =
    typeof value === "number" ? value : parseIntegerInput(String(value));
  if (parsed === undefined) return "";
  return parsed.toLocaleString("en-US");
}

export function formatProjectBudget(
  value: number | null | undefined,
  currency = "USD",
): string {
  const amount = value ?? 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${formatIntegerWithCommas(amount)}`;
  }
}

function getCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Compact budget label: $100 for small amounts, $10k only when value is 1,000+. */
export function formatProjectBudgetCompact(
  value: number | null | undefined,
  currency = "USD",
): string {
  const amount = value ?? 0;
  const abs = Math.abs(amount);

  if (abs >= 1000) {
    const inThousands = amount / 1000;
    const compact = Number.isInteger(inThousands)
      ? String(inThousands)
      : inThousands.toFixed(1).replace(/\.0$/, "");
    return `${getCurrencySymbol(currency)}${compact}k`;
  }

  return formatProjectBudget(amount, currency);
}
