export type ParsedMppPredecessor = {
  predecessorUid: number;
  type: string;
  lagDays: number;
};

export type ParsedMppTask = {
  uid: number;
  id?: number;
  name: string;
  wbs?: string;
  outlineLevel?: number;
  summary: boolean;
  milestone?: boolean;
  parentUid?: number;
  startDate?: string;
  finishDate?: string;
  baselineStartDate?: string;
  baselineFinishDate?: string;
  durationDays?: number;
  baselineDurationDays?: number;
  actualStartDate?: string;
  actualFinishDate?: string;
  percentComplete?: number;
  /** MS Project Cost. Used only when this row is the project/L1 summary. */
  cost?: number;
  predecessors: ParsedMppPredecessor[];
};

export type ParsedMppResource = {
  uid: number;
  name: string;
  email?: string;
};

export type ParsedMppAssignment = {
  taskUid: number;
  resourceUid: number;
  units?: number;
};

export type ParsedMppProject = {
  project: {
    name?: string;
    startDate?: string;
    finishDate?: string;
    baselineStartDate?: string;
    baselineFinishDate?: string;
    durationDays?: number;
    baselineDurationDays?: number;
    percentComplete?: number;
    durationVarianceDays?: number;
    actualStartDate?: string;
    actualFinishDate?: string;
    /** Project-level Cost. 0/missing is omitted; Cybsec budget falls back to 1. */
    cost?: number;
  };
  tasks: ParsedMppTask[];
  resources: ParsedMppResource[];
  assignments: ParsedMppAssignment[];
  warnings: string[];
};

export type MppPortfolioSegment = {
  projectName: string;
  startDate?: string;
  finishDate?: string;
  parsed: ParsedMppProject;
};

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
  warnings: string[];
  projectsCreated?: number;
  projectsUpdated?: number;
};

export type MppImportPreviewMilestone = {
  uid: number;
  title: string;
  targetDate?: string;
  phaseName?: string;
  percentComplete?: number;
  status: string;
};

export type MppImportPreviewTask = {
  uid: number;
  name: string;
  startDate?: string;
  finishDate?: string;
  durationDays?: number;
  baselineStartDate?: string;
  baselineFinishDate?: string;
  baselineDurationDays?: number;
  actualStartDate?: string;
  actualFinishDate?: string;
  percentComplete?: number;
  phaseName?: string;
  hasParent: boolean;
  predecessorCount: number;
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
  importMode: 'create' | 'update';
  resolvedProjectId?: string;
  tasks: MppImportPreviewTask[];
  milestones: MppImportPreviewMilestone[];
};

export type MppImportPreview = {
  mode: 'single' | 'portfolio';
  projectName?: string;
  startDate?: string;
  finishDate?: string;
  /** Project-level Cost from the file. Used as Cybsec value on create; 0/missing → 1. */
  cost?: number;
  /** Single-file preview: update existing project instead of creating a duplicate. */
  importMode?: 'create' | 'update';
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
  tasks: MppImportPreviewTask[];
  milestones: MppImportPreviewMilestone[];
  warnings: string[];
};
