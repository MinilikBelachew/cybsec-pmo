export const HEALTH_DIMENSIONS = [
  'schedule',
  'cost',
  'risk',
  'resources',
  'collections',
] as const;

export type HealthDimension = (typeof HEALTH_DIMENSIONS)[number];

export type RagStatus = 'green' | 'amber' | 'red';

export const HEALTH_RULE_VERSION = 'gate3-v1';

/** Default thresholds: higher score = healthier (0–100) except where noted. */
export const DEFAULT_HEALTH_RULES: Array<{
  dimension: HealthDimension;
  greenThreshold: number;
  amberThreshold: number;
  redThreshold: number;
  unit: string;
}> = [
  {
    dimension: 'schedule',
    greenThreshold: 85,
    amberThreshold: 60,
    redThreshold: 0,
    unit: '%',
  },
  {
    dimension: 'cost',
    greenThreshold: 90,
    amberThreshold: 70,
    redThreshold: 0,
    unit: '%',
  },
  {
    dimension: 'risk',
    greenThreshold: 80,
    amberThreshold: 50,
    redThreshold: 0,
    unit: '%',
  },
  {
    dimension: 'resources',
    greenThreshold: 75,
    amberThreshold: 50,
    redThreshold: 0,
    unit: '%',
  },
  {
    dimension: 'collections',
    greenThreshold: 80,
    amberThreshold: 50,
    redThreshold: 0,
    unit: '%',
  },
];

export function scoreToRag(
  score: number,
  green: number,
  amber: number,
  red?: number | null,
): RagStatus {
  if (score >= green) return 'green';
  if (score >= amber) return 'amber';
  if (red != null && score < red) return 'red';
  return 'red';
}

export function overallRag(statuses: RagStatus[]): RagStatus {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('amber')) return 'amber';
  return 'green';
}
