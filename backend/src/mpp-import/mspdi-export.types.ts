export type MspdiExportTaskPayload = {
  id: string;
  name: string;
  parentId?: string;
  summary: boolean;
  outlineLevel?: number;
  startDate?: string;
  finishDate?: string;
  baselineStart?: string;
  baselineFinish?: string;
  /** Working days for the task. */
  durationDays?: number;
  /** Working days for the baseline span. */
  baselineDurationDays?: number;
  /** MS Project milestone (0-day checkpoint). */
  milestone?: boolean;
  /** Start − baseline start (calendar days). */
  startVarianceDays?: number;
  /** Finish − baseline finish (calendar days). */
  finishVarianceDays?: number;
  percentComplete?: number;
  priority?: number;
  notes?: string;
};

export type MspdiExportDependencyPayload = {
  predecessorId: string;
  successorId: string;
  type: string;
  lagDays: number;
};

export type MspdiExportHolidayPayload = {
  date: string;
  name?: string;
};

export type MspdiExportResourcePayload = {
  /** Stable user id used to link assignments. */
  id: string;
  /** MSP Resource Names style: "Name (Organization)". */
  name: string;
  email?: string;
};

export type MspdiExportAssignmentPayload = {
  taskId: string;
  resourceId: string;
  /** Fraction (1 = 100%). */
  units?: number;
};

export type MspdiExportRequestPayload = {
  project: {
    name: string;
    startDate?: string;
    finishDate?: string;
    baselineStart?: string;
    baselineFinish?: string;
    durationDays?: number;
    baselineDurationDays?: number;
    percentComplete?: number;
    durationVarianceDays?: number;
  };
  tasks: MspdiExportTaskPayload[];
  dependencies: MspdiExportDependencyPayload[];
  holidays?: MspdiExportHolidayPayload[];
  resources?: MspdiExportResourcePayload[];
  assignments?: MspdiExportAssignmentPayload[];
};

export type MspdiExportFileResult = {
  filename: string;
  contentType: string;
  buffer: Buffer;
};
