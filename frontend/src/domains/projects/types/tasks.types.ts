export type TaskPriority = "Low" | "Medium" | "High" | "Critical";

export type TaskStatus =
  | "To_Do"
  | "In_Progress"
  | "Submitted_for_Review"
  | "Approved"
  | "Rework"
  | "Done";

export interface TaskUserSummary {
  id: string;
  displayName: string;
  email: string;
}

export interface TaskScheduleImpact {
  hasLeaveConflict: boolean;
  overlapDays: number;
  estimatedDelayDays: number;
  projectedTaskEnd: string | null;
  downstreamTaskCount: number;
  leaveFrom: string | null;
  leaveTo: string | null;
  leaveType: string | null;
  isCritical: boolean;
  hasBackup: boolean;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: TaskUserSummary;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  uploadedBy: string;
  s3Key: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string | null;
  createdAt: string;
  uploader: TaskUserSummary;
}

export interface TaskSubTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  endDate?: string | null;
  owner?: TaskUserSummary;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  ownerId: string | null;
  startDate: string | null;
  endDate: string | null;
  effortHours: number | null;
  progressApproved: number;
  progressPending: number;
  status: TaskStatus;
  phaseId: string | null;
  isOnCriticalPath?: boolean;
  backupOwnerId?: string | null;
  backupOwner?: TaskUserSummary;
  scheduleImpact?: TaskScheduleImpact | null;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string };
  owner?: TaskUserSummary;
  parentTask?: { id: string; title: string };
  phase?: { id: string; name: string } | null;
  subTasks?: TaskSubTask[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  warnings?: string[];
}

export type ProgressUpdateStatus = "Pending" | "Approved" | "Rejected" | "Rework";

export type ProgressReviewDecision = "approve" | "reject" | "rework";

export interface ProgressEvidenceFile {
  storageKey: string;
  filename: string;
  url?: string;
}

export interface TaskProgressUpdate {
  id: string;
  taskId: string;
  engineerId: string;
  progressPercent: number;
  hoursSpent: number;
  comment: string | null;
  s3EvidenceKey: string | null;
  evidenceUrl: string | null;
  evidenceFiles?: ProgressEvidenceFile[];
  status: ProgressUpdateStatus;
  reviewedBy: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  engineer: TaskUserSummary;
  reviewer?: TaskUserSummary | null;
  task?: { id: string; title: string; projectId: string };
}

export interface SubmitProgressUpdatePayload {
  taskId: string;
  progressPercent: number;
  hoursSpent: number;
  comment?: string;
  s3EvidenceKey?: string;
  evidenceFiles?: Pick<ProgressEvidenceFile, "storageKey" | "filename">[];
}

export interface ReviewProgressUpdatePayload {
  taskId: string;
  updateId: string;
  decision: ProgressReviewDecision;
  reviewReason?: string;
}

export interface PendingProgressReviewsResponse {
  data: TaskProgressUpdate[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedTasksResponse {
  data: Task[];
  hasNextPage: boolean;
  meta?: {
    total: number;
  };
}

export interface TaskActiveStats {
  total: number;
  todo: number;
  inProgress: number;
  rework: number;
  done: number;
  overdue: number;
}

export interface GetTasksParams {
  page?: number;
  limit?: number;
  projectId?: string;
  parentTaskId?: string;
  topLevelOnly?: boolean;
  status?: string;
  priority?: TaskPriority;
  search?: string;
  phaseId?: string;
  ownerId?: string;
}

export interface CreateTaskBundlePayload {
  payload: Record<string, unknown>;
  files?: File[];
}

export interface UpdateTaskBundlePayload {
  taskId: string;
  payload: Record<string, unknown>;
  files?: File[];
}

export interface AddTaskCommentPayload {
  taskId: string;
  body: string;
  isInternal?: boolean;
}

export interface AddTaskAttachmentPayload {
  taskId: string;
  storageKey: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface UpdateTaskPayload {
  id: string;
  body: Record<string, unknown>;
}

export type TaskDependencyType = "FS" | "SS" | "FF" | "SF";

export interface TaskDependencyTaskSummary {
  id: string;
  title: string;
  projectId: string;
  startDate: string | null;
  endDate: string | null;
  ownerId: string | null;
  owner?: TaskUserSummary | null;
}

export interface TaskDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  depType: TaskDependencyType;
  lagDays: number;
  createdAt: string;
  predecessor: TaskDependencyTaskSummary;
  successor: TaskDependencyTaskSummary;
}

export interface CreateTaskDependencyPayload {
  predecessorId: string;
  successorId: string;
  depType: TaskDependencyType;
  lagDays?: number;
}

export interface ValidateTaskDependencyResponse {
  valid: boolean;
  cyclic: boolean;
  predecessor: { id: string; title: string };
  successor: { id: string; title: string };
}
