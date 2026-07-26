export { DocumentVaultPage } from "./components/document-vault-page";
export { createDocumentVaultColumns } from "./components/document-vault-columns";
export {
  useGetVaultDocumentsQuery,
  useGetDocumentVaultStatsQuery,
} from "./api/documents.api";
export type {
  WorkspaceDocument,
  WorkspaceDocumentCategory,
  GetVaultDocumentsParams,
  PaginatedVaultDocumentsResponse,
  DocumentVaultStats,
} from "./types/documents.types";

