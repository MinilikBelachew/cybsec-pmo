import { CreateMppPortfolioImportDto } from '../mpp-import/dto/create-mpp-portfolio-import.dto';

export type ImportJobKind =
  | 'mpp'
  | 'mpp-portfolio'
  | 'excel-tasks'
  | 'excel-projects';

export type ImportJobProgress = {
  percent: number;
  step: string | null;
};

export type ImportJobResultSummary = {
  kind: ImportJobKind;
  projectsCreated?: number;
  projectsUpdated?: number;
  phasesCreated?: number;
  phasesUpdated?: number;
  tasksCreated?: number;
  tasksUpdated?: number;
  milestonesCreated?: number;
  milestonesUpdated?: number;
  dependenciesCreated?: number;
  dependenciesUpdated?: number;
  failed?: number;
  warnings?: string[];
  message?: string;
};

export type MppImportJobData = {
  kind: 'mpp';
  userId: string;
  projectId: string;
  fileName: string;
  filePath: string;
};

export type MppPortfolioImportJobData = {
  kind: 'mpp-portfolio';
  userId: string;
  fileName: string;
  filePath: string;
  portfolioDto: CreateMppPortfolioImportDto;
};

export type ExcelTaskImportRow = {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  effortHours?: number;
  durationDays?: number;
  baselineStart?: string;
  baselineEnd?: string;
  baselineDurationDays?: number;
  actualStart?: string;
  actualEnd?: string;
  progressApproved?: number;
  resolvedAssigneeId?: string | null;
  resolvedPhaseId?: string | null;
  /** Excel "Phase" name. Used when resolvedPhaseId is missing (new project import). */
  phaseName?: string;
  importMode: 'create' | 'update';
  resolvedTaskId?: string;
  predecessors?: Array<{
    predecessorTitle: string;
    depType?: string;
    lagDays?: number;
  }>;
  /** Excel "Parent Task" title. Undefined when the column is absent. */
  parentTaskTitle?: string;
};

export type ExcelTasksImportJobData = {
  kind: 'excel-tasks';
  userId: string;
  projectId: string;
  rows: ExcelTaskImportRow[];
};

export type ExcelProjectImportRow = {
  name: string;
  objective: string;
  engagementType: string;
  billingModel: string;
  methodology?: string;
  priority: string;
  startDate: string;
  endDate: string;
  value: number;
  currency: string;
  status?: string;
  durationDays?: number;
  baselineStartDate?: string;
  baselineEndDate?: string;
  baselineDurationDays?: number;
  actualStartDate?: string;
  actualEndDate?: string;
  percentComplete?: number;
  importMode: 'create' | 'update';
  resolvedProjectId?: string;
  resolvedDepartmentId: string;
  resolvedCustomerId: string;
  resolvedPrimaryPmId: string;
  resolvedSecondaryPmId?: string | null;
};

export type ExcelPhaseImportRow = {
  name: string;
  description?: string;
  orderIndex?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  importMode: 'create' | 'update';
  resolvedPhaseId?: string;
};

export type ExcelMilestoneImportRow = {
  title: string;
  targetDate?: string;
  weight?: number;
  status?: string;
  phaseName?: string;
  resolvedPhaseId?: string | null;
  importMode: 'create' | 'update';
  resolvedMilestoneId?: string;
};

export type ExcelProjectsImportJobData = {
  kind: 'excel-projects';
  userId: string;
  projects: ExcelProjectImportRow[];
  phasesByProject: Record<string, ExcelPhaseImportRow[]>;
  tasksByProject: Record<string, ExcelTaskImportRow[]>;
  milestonesByProject: Record<string, ExcelMilestoneImportRow[]>;
};

export type ImportJobData =
  | MppImportJobData
  | MppPortfolioImportJobData
  | ExcelTasksImportJobData
  | ExcelProjectsImportJobData;
