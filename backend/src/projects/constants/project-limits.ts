/**
 * PMO + Keka create payload:
 * - Name: 100 (255 fails this tenant's Group.Name).
 * - Description: send the full PMO objective (max 500). Do not clip.
 */
export const PROJECT_NAME_MAX_LENGTH = 100;
export const PROJECT_OBJECTIVE_MAX_LENGTH = 500;

export function clipForKeka(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}
