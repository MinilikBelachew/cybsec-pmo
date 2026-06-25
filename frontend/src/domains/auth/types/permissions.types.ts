export type PermissionRow = {
  module: string;
  action: string;
  recordScope: string | null;
  fieldScope: Record<string, unknown> | null;
};
