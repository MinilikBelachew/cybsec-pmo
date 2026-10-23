export type MppImportResultSummary = {
  tasksCreated: number;
  tasksUpdated: number;
  dependenciesCreated: number;
  dependenciesUpdated: number;
  phasesCreated: number;
  phasesUpdated: number;
  milestonesCreated: number;
  milestonesUpdated: number;
  resourcesMatched: number;
  assignmentsSkipped: number;
  projectsCreated?: number;
  projectsUpdated?: number;
  warnings: string[];
};

export type MppImportPreviewMilestone = {
  uid: number;
  title: string;
  targetDate?: string;
  phaseName?: string;
  percentComplete?: number;
  status: string;
  importMode: "create" | "update";
  updateDetails?: string[];
};

export type MppImportPreviewTask = {
  uid: number;
  name: string;
  startDate?: string;
  finishDate?: string;
  durationDays?: number;
  workHours?: number;
  percentComplete?: number;
  phaseName?: string;
  hasParent: boolean;
  predecessorCount: number;
  importMode: "create" | "update";
  priority?: string;
  assigneeNames?: string[];
  notesPreview?: string;
  updateDetails?: string[];
};

export type MppImportPreviewPhase = {
  name: string;
  startDate?: string;
  finishDate?: string;
  durationDays?: number;
  percentComplete?: number;
  importMode: "create" | "update";
  updateDetails?: string[];
};

export type MppImportPreviewProject = {
  name: string;
  startDate?: string;
  finishDate?: string;
  baselineStartDate?: string;
  baselineFinishDate?: string;
  durationDays?: number;
  baselineDurationDays?: number;
  percentComplete?: number;
  durationVarianceDays?: number;
  cost?: number;
  taskCount: number;
  phaseCount: number;
  milestoneCount: number;
  dependencyCount: number;
  importMode: "create" | "update";
  resolvedProjectId?: string;
  phases?: MppImportPreviewPhase[];
  tasks: MppImportPreviewTask[];
  milestones: MppImportPreviewMilestone[];
};

export type MppImportPreview = {
  mode: "single" | "portfolio";
  projectName?: string;
  startDate?: string;
  finishDate?: string;
  cost?: number;
  importMode?: "create" | "update";
  resolvedProjectId?: string;
  counts: {
    importableTasks: number;
    phasesFromSummaries: number;
    milestonesFromFile: number;
    skippedSummaryTasks: number;
    dependencies: number;
    resourcesMatched: number;
    resourcesUnmatched: number;
    projects?: number;
  };
  projects?: MppImportPreviewProject[];
  phases?: MppImportPreviewPhase[];
  tasks: MppImportPreviewTask[];
  milestones: MppImportPreviewMilestone[];
  warnings: string[];
};

export type MppPortfolioImportDefaults = {
  objective?: string;
  departmentId?: string;
  customerId?: string;
  engagementType?: string;
  billingModel?: string;
  priority?: string;
  value?: number;
  currency?: string;
  primaryPmId?: string;
  projects?: Array<{
    name: string;
    objective?: string;
    departmentId?: string;
    customerId?: string;
    engagementType?: string;
    billingModel?: string;
    priority?: string;
    value?: number;
    currency?: string;
    primaryPmId?: string;
  }>;
};
