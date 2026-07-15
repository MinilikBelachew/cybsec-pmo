import type {
  WorkspaceDocument,
  WorkspaceDocumentCategory,
} from "@/domains/projects/types/project-documents.types";

export type {
  WorkspaceDocument,
  WorkspaceDocumentCategory,
  WorkspaceDocumentUploader,
} from "@/domains/projects/types/project-documents.types";

export interface GetVaultDocumentsParams {
  page?: number;
  limit?: number;
  search?: string;
  projectId?: string;
  category?: WorkspaceDocumentCategory;
}

export interface PaginatedVaultDocumentsResponse {
  data: WorkspaceDocument[];
  hasNextPage: boolean;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DocumentVaultStats {
  total: number;
  project: number;
  phase: number;
  milestone: number;
  signOff: number;
  technical: number;
  task: number;
}
