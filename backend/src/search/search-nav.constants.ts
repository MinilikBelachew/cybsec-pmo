import { CaslAction } from '../casl/casl.types';

export type NavSearchPermission = {
  action: CaslAction;
  subject: string;
};

export type NavSearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  permission?: NavSearchPermission | null;
};

/** Navigation targets mirrored from the dashboard sidebar (permission-gated). */
export const SEARCH_NAV_ITEMS: NavSearchItem[] = [
  {
    id: 'dashboard',
    title: 'My Workspace',
    subtitle: 'Dashboard',
    href: '/dashboard',
    permission: null,
  },
  {
    id: 'projects',
    title: 'Projects',
    subtitle: 'Project portfolio',
    href: '/dashboard/projects',
    permission: { action: 'read', subject: 'Project' },
  },
  {
    id: 'tasks',
    title: 'Active Tasks',
    subtitle: 'Task list',
    href: '/dashboard/tasks',
    permission: { action: 'read', subject: 'Task' },
  },
  {
    id: 'gantt',
    title: 'Gantt & Dependencies',
    subtitle: 'Project execution',
    href: '/dashboard/gantt',
    permission: { action: 'read', subject: 'Project' },
  },
  {
    id: 'audit',
    title: 'Audit Trail',
    subtitle: 'Compliance log',
    href: '/dashboard/audit',
    permission: { action: 'read', subject: 'AuditLog' },
  },
  {
    id: 'roles',
    title: 'Roles',
    subtitle: 'Roles & permissions',
    href: '/dashboard/roles',
    permission: { action: 'read', subject: 'Rbac' },
  },
  {
    id: 'permissions',
    title: 'Permissions',
    subtitle: 'Roles & permissions',
    href: '/dashboard/roles/permissions',
    permission: { action: 'read', subject: 'Rbac' },
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Organization settings',
    href: '/dashboard/settings',
    permission: { action: 'read', subject: 'User' },
  },
];
