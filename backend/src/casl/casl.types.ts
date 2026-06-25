import { MongoAbility } from '@casl/ability';

export type CaslAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'manage';

/** Module-level ability for guards and UI; record filtering uses RecordScopeWhereService. */
export type AppAbility = MongoAbility<[CaslAction, string]>;

export type CaslUserContext = {
  id: string;
  roleId: number;
  roleCode: string;
  departmentId?: string | null;
};

export type PermissionRow = {
  module: string;
  action: string;
  recordScope: string | null;
  fieldScope: Record<string, unknown> | null;
};
