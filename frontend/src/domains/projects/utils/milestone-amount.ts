export function toMilestoneAmountNumber(
  amount: number | string | null | undefined,
): number {
  if (amount === "" || amount == null) return 0;
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

export function sumMilestoneAmounts(
  amounts: Array<number | string | null | undefined>,
): number {
  return amounts.reduce<number>((sum, a) => sum + toMilestoneAmountNumber(a), 0);
}

/**
 * Returns an error if sibling amounts + nextAmount would exceed project value.
 * Null/empty amounts are ignored. If projectValue is null, no check.
 */
export function getMilestoneAmountTotalError(
  siblingAmounts: Array<number | string | null | undefined>,
  nextAmount: number | string | null | undefined,
  projectValue: number | string | null | undefined,
): string | null {
  if (projectValue == null || projectValue === "") return null;
  const max = Number(projectValue);
  if (!Number.isFinite(max)) return null;

  const total = sumMilestoneAmounts([...siblingAmounts, nextAmount]);
  if (total <= max + 1e-9) return null;

  return `Total milestone amounts cannot exceed project value (${max}). Combined amount would be ${Math.round(total * 100) / 100}.`;
}

export function formatMilestoneAmountApiError(
  error: unknown,
  fallback = "Failed to save milestone",
): string {
  const data =
    error && typeof error === "object" && "data" in error
      ? (error as { data?: { errors?: Record<string, string>; message?: string } })
          .data
      : undefined;
  const code =
    data?.errors?.amount ??
    data?.errors?.value ??
    (data?.errors ? Object.values(data.errors)[0] : undefined) ??
    data?.message;
  if (typeof code === "string") {
    if (code === "milestoneAmountExceedsProjectValue") {
      return "Total milestone amounts cannot exceed the project value.";
    }
    if (code === "projectValueBelowMilestoneAmounts") {
      return "Project value cannot be lower than the sum of milestone amounts.";
    }
    return code;
  }
  return fallback;
}
