export type WorkspaceDocumentCategory =
  | "Project"
  | "Phase"
  | "Milestone"
  | "SignOff"
  | "Technical"
  | "Task";

export interface WorkspaceDocumentUploader {
  id: string;
  displayName: string;
  email: string;
}

export interface WorkspaceDocument {
  id: string;
  projectId: string;
  logicalDocId: string;
  version: number;
  category: WorkspaceDocumentCategory;
  phaseId: string | null;
  milestoneId: string | null;
  taskId: string | null;
  filename: string;
  s3Key: string;
  mimeType: string | null;
  sizeBytes: number | null;
  tags: string[];
  isInternal: boolean;
  uploadedBy: string;
  createdAt: string;
  url: string | null;
  uploader: WorkspaceDocumentUploader;
  phase?: { id: string; name: string } | null;
  milestone?: { id: string; title: string } | null;
  task?: { id: string; title: string } | null;
}

export interface CreateWorkspaceDocumentPayload {
  projectId: string;
  storageKey: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  category: WorkspaceDocumentCategory;
  phaseId?: string;
  milestoneId?: string;
  taskId?: string;
  tags?: string[];
  isInternal?: boolean;
}

export interface GetWorkspaceDocumentsParams {
  projectId: string;
  category?: WorkspaceDocumentCategory;
  phaseId?: string;
  milestoneId?: string;
  taskId?: string;
}
