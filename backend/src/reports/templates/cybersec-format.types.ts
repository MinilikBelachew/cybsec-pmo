import type {
  BrandProfile,
  ReportAudience,
  ReportDocType,
} from './cybersec-format.constants';

/** Three values per row on the printed page. */
export type DocumentControl = {
  documentRef: string;
  version: number;
  projectName: string;
  customer: string | null;
  deliveredBy: string | null;
  reportPeriod: string | null;
  dateIssued: string;
  preparedBy: string | null;
  reviewedBy: string | null;
};

export type HealthDimensionRow = {
  dimension: string;
  score: number;
  ragStatus: string;
  /** Prior report's value, printed beside the current one to show direction. */
  previousScore: number | null;
  previousRag: string | null;
};

export type HealthBlock = {
  overallRag: string;
  previousOverallRag: string | null;
  /** Written justification, mandatory whenever a PM overrides the computed RAG. */
  overrideReason: string | null;
  dimensions: HealthDimensionRow[];
};

export type MilestoneRow = {
  title: string;
  status: string;
  baselineDate: string | null;
  expectedDate: string | null;
  varianceDays: number | null;
  percentComplete: number | null;
  ragStatus: string | null;
  phase: string | null;
};

export type PhaseWorkGroup = {
  phase: string;
  completed: string[];
  planned: string[];
};

export type ActionPointRow = {
  title: string;
  owner: string | null;
  dueDate: string | null;
  status: string;
};

export type IssueRow = {
  description: string;
  reportedDate: string | null;
  issueOwner: string | null;
  targetResolutionDate: string | null;
  /** Stays empty while the issue is open. */
  actualResolutionDate: string | null;
  status: string;
};

export type RiskRow = {
  description: string;
  category: string | null;
  owner: string | null;
  affectedMilestone: string | null;
  source: 'system' | 'manual';
  /** internal: caused by our own delay. shared: sits with or depends on the customer. */
  exposure: 'internal' | 'shared';
  targetDate: string | null;
  status: string;
  score: number | null;
};

export type PendingItemRow = {
  item: string;
  type: 'Issue' | 'Risk' | 'Action' | 'Task';
  requestedDate: string | null;
  daysWaiting: number | null;
  owner: string | null;
  sittingWith: string | null;
  holdingUp: string | null;
  lastFollowUp: string | null;
};

/** Internal audience only — the client document carries no cost field at all. */
export type CostBlock = {
  currency: string;
  baselineAmount: number | null;
  actualAmount: number | null;
  varianceAmount: number | null;
  actualEffortHours: number | null;
};

/** Internal audience only. Severity is deliberately not carried. */
export type DataQualityRow = {
  flagType: string;
  description: string;
};

export type StatusReportSnapshot = {
  docType: Extract<ReportDocType, 'WSR' | 'MSR'>;
  audience: ReportAudience;
  title: string;
  projectName: string;
  periodLabel: string | null;
  generatedAt: string;
  /** The moment the underlying data was read, printed in the header. */
  dataAsOf: string;
  brand: BrandProfile;
  control: DocumentControl;
  health: HealthBlock;
  milestones: MilestoneRow[];
  phaseWork: PhaseWorkGroup[];
  actionPoints: ActionPointRow[];
  issues: IssueRow[];
  risks: RiskRow[];
  pendingItems: PendingItemRow[];
  cost: CostBlock | null;
  dataQuality: DataQualityRow[];
  /** Listed in the closing notes rather than the milestone table. */
  phasesNotStarted: string[];
};

export type MomPerson = {
  name: string;
  email: string | null;
  organisation: string | null;
};

export type MomAttendeeRow = MomPerson & {
  /** Which side the attendee sits on. */
  party: string | null;
  attended: boolean | null;
};

export type MomActionRow = {
  reference: string;
  action: string;
  owner: string | null;
  dueDate: string | null;
  status: string;
};

export type MomSnapshot = {
  docType: Extract<ReportDocType, 'MoM'>;
  title: string;
  meetingType: string | null;
  projectName: string;
  organisation: string | null;
  scheduledAt: string;
  timeZone: string | null;
  version: number;
  generatedAt: string;
  brand: BrandProfile;
  control: DocumentControl;
  organiser: MomPerson | null;
  attendees: MomAttendeeRow[];
  /** What was discussed, taken from the agenda. Optional; not every meeting has one. */
  keyPoints: string[];
  decisions: string[];
  actions: MomActionRow[];
};
