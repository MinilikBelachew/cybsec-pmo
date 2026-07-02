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
  parentUid?: number;
  startDate?: string;
  finishDate?: string;
  durationDays?: number;
  percentComplete?: number;
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
  };
  tasks: ParsedMppTask[];
  resources: ParsedMppResource[];
  assignments: ParsedMppAssignment[];
  warnings: string[];
};

export type MppImportResultSummary = {
  tasksCreated: number;
  dependenciesCreated: number;
  resourcesMatched: number;
  assignmentsSkipped: number;
  warnings: string[];
};

export type MppImportPreviewTask = {
  uid: number;
  name: string;
  startDate?: string;
  finishDate?: string;
  durationDays?: number;
  percentComplete?: number;
  hasParent: boolean;
  predecessorCount: number;
};

export type MppImportPreview = {
  projectName?: string;
  startDate?: string;
  finishDate?: string;
  counts: {
    importableTasks: number;
    skippedSummaryTasks: number;
    dependencies: number;
    resourcesMatched: number;
    resourcesUnmatched: number;
  };
  tasks: MppImportPreviewTask[];
  warnings: string[];
};
