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
