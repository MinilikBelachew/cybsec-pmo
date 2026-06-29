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
