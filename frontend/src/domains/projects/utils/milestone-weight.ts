/** Max combined weight (%) across all milestones in a project. */
export const MILESTONE_WEIGHT_TOTAL_MAX = 100;

export function toMilestoneWeightNumber(
  weight: number | string | null | undefined,
): number {
  if (weight === "" || weight == null) return 0;
  const n = Number(weight);
  return Number.isFinite(n) ? n : 0;
}

export function sumMilestoneWeights(
  weights: Array<number | string | null | undefined>,
): number {
  return weights.reduce<number>((sum, w) => sum + toMilestoneWeightNumber(w), 0);
}

/**
 * Returns an error message if adding `nextWeight` to sibling weights would exceed 100%.
 * Pass sibling weights only (exclude the milestone being edited).
 */
export function getMilestoneWeightTotalError(
  siblingWeights: Array<number | string | null | undefined>,
  nextWeight: number | string | null | undefined,
): string | null {
  const total = sumMilestoneWeights([...siblingWeights, nextWeight]);
  if (total <= MILESTONE_WEIGHT_TOTAL_MAX) return null;

  const rounded =
    Math.round(total * 100) / 100 === Math.trunc(total)
      ? String(Math.trunc(total))
      : (Math.round(total * 100) / 100).toFixed(2);

  return `Total milestone weight cannot exceed ${MILESTONE_WEIGHT_TOTAL_MAX}%. Combined weight would be ${rounded}%.`;
}

export function formatMilestoneWeightApiError(
  error: unknown,
  fallback = "Failed to save milestone",
): string {
  const data =
    error && typeof error === "object" && "data" in error
      ? (error as { data?: { errors?: Record<string, string>; message?: string } }).data
      : undefined;

  const code =
    data?.errors?.weight ??
    (data?.errors ? Object.values(data.errors)[0] : undefined) ??
    data?.message;

  if (code === "milestoneWeightExceedsTotal") {
    return `Total milestone weight cannot exceed ${MILESTONE_WEIGHT_TOTAL_MAX}%. Reduce this milestone's weight or adjust other milestones.`;
  }

  if (typeof code === "string" && code.trim()) return code;
  return fallback;
}
