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
  url: string;
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
  status: TaskStatus;
  phaseId: string | null;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string };
  owner?: TaskUserSummary;
  parentTask?: { id: string; title: string };
  phase?: { id: string; name: string } | null;
  subTasks?: TaskSubTask[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
}

export interface PaginatedTasksResponse {
  data: Task[];
  hasNextPage: boolean;
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
