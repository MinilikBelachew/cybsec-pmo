export const WORKSPACE_DOCUMENT_CATEGORIES = [
  'Project',
  'Phase',
  'Milestone',
  'SignOff',
  'Technical',
  'Task',
] as const;

export type WorkspaceDocumentCategory =
  (typeof WORKSPACE_DOCUMENT_CATEGORIES)[number];
