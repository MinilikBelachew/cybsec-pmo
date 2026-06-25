/**
 * Generates Cybsec Gate 1 RBAC matrix Excel workbook.
 * Run: node scripts/generate-rbac-matrix.mjs
 */
import * as XLSX from 'xlsx';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../../docs/rbac');

const ROLES = [
  { id: 1, code: 'super_admin', label: 'Super Admin' },
  { id: 2, code: 'it_admin', label: 'IT Admin' },
  { id: 3, code: 'pmo_lead', label: 'PMO Lead' },
  { id: 4, code: 'pm', label: 'PM' },
  { id: 5, code: 'team_lead', label: 'Team Lead' },
  { id: 6, code: 'engineer', label: 'Engineer' },
  { id: 7, code: 'finance', label: 'Finance' },
  { id: 8, code: 'hr', label: 'HR' },
  { id: 9, code: 'sales', label: 'Sales' },
  { id: 10, code: 'client', label: 'Client' },
  { id: 11, code: 'vendor', label: 'Vendor' },
];

/** @type {Record<string, Record<string, string>>} */
const MATRIX = {
  'Auth — Login / SSO': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'View', hr: 'View', sales: 'View', client: 'View', vendor: 'View',
  },
  'Auth — Session refresh / timeout': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'View', hr: 'View', sales: 'View', client: 'View', vendor: 'View',
  },
  'Auth — MFA verify / enroll': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'View', hr: 'View', sales: 'View', client: 'None', vendor: 'None',
  },
  'Users — Directory list': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'View', sales: 'None', client: 'None', vendor: 'None',
  },
  'Users — Create / register': {
    super_admin: 'Edit', it_admin: 'Edit', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Users — Assign / change role': {
    super_admin: 'Edit', it_admin: 'Edit', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Roles & Permissions — View matrix': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Roles & Permissions — Edit grants': {
    super_admin: 'Edit', it_admin: 'Edit', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Audit Trail — View / search': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Audit Trail — Export': {
    super_admin: 'Edit', it_admin: 'View', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Settings — Security / break-glass': {
    super_admin: 'Edit', it_admin: 'View', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Integrations — View status': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Integrations — Configure credentials': {
    super_admin: 'Edit', it_admin: 'Edit', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Notifications — In-app view': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'View', hr: 'View', sales: 'View', client: 'View', vendor: 'View',
  },
  'Notifications — Manage preferences': {
    super_admin: 'Edit', it_admin: 'Edit', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'Edit',
    engineer: 'Edit', finance: 'Edit', hr: 'Edit', sales: 'Edit', client: 'Edit', vendor: 'Edit',
  },
  'Projects — List': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'View', hr: 'View', sales: 'View', client: 'View', vendor: 'None',
  },
  'Projects — Create': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Projects — Edit (own / assigned)': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'View',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Projects — Change status / close': {
    super_admin: 'Approve', it_admin: 'None', pmo_lead: 'Approve', pm: 'Approve', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Milestones — View': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'View', hr: 'View', sales: 'View', client: 'View', vendor: 'None',
  },
  'Milestones — Create / edit': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Dependencies — View (Gantt / graph)': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Dependencies — Create / edit (FS/SS/FF/SF)': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Dependencies — Validate cycles': {
    super_admin: 'Approve', it_admin: 'None', pmo_lead: 'Approve', pm: 'Approve', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project import — MPP / Excel': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project export — MPP / Excel': {
    super_admin: 'Edit', it_admin: 'View', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'Edit',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project templates — View library': {
    super_admin: 'View', it_admin: 'None', pmo_lead: 'View', pm: 'View', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project templates — Manage versions': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project templates — Instantiate on create': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project closure — View checklist': {
    super_admin: 'View', it_admin: 'None', pmo_lead: 'View', pm: 'View', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project closure — Initiate closure': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project closure — Approve closure': {
    super_admin: 'Approve', it_admin: 'None', pmo_lead: 'Approve', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project charter — View': {
    super_admin: 'View', it_admin: 'None', pmo_lead: 'View', pm: 'View', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'View', client: 'None', vendor: 'None',
  },
  'Project charter — Edit': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Project charter — Approve': {
    super_admin: 'Approve', it_admin: 'None', pmo_lead: 'Approve', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Tasks — List': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'View', hr: 'View', sales: 'View', client: 'View', vendor: 'View',
  },
  'Tasks — Create / edit': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'Edit',
    engineer: 'Edit', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Tasks — Comment': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'Edit',
    engineer: 'Edit', finance: 'None', hr: 'None', sales: 'None', client: 'Edit', vendor: 'Edit',
  },
  'Tasks — Attach files': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'Edit',
    engineer: 'Edit', finance: 'None', hr: 'None', sales: 'None', client: 'Edit', vendor: 'Edit',
  },
  'Sub-tasks — View': {
    super_admin: 'View', it_admin: 'None', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Sub-tasks — Create / edit': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'Edit',
    engineer: 'Edit', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Task Progress — Submit update': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'None', pm: 'None', team_lead: 'Edit',
    engineer: 'Edit', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Task Progress — Approve update (SoD)': {
    super_admin: 'Approve', it_admin: 'None', pmo_lead: 'Approve', pm: 'Approve', team_lead: 'Approve',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Timesheets — Submit own': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'None', pm: 'None', team_lead: 'Edit',
    engineer: 'Edit', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Timesheets — Approve team': {
    super_admin: 'Approve', it_admin: 'None', pmo_lead: 'Approve', pm: 'Approve', team_lead: 'Approve',
    engineer: 'None', finance: 'None', hr: 'View', sales: 'None', client: 'None', vendor: 'None',
  },
  'Team Directory — View': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'None', hr: 'View', sales: 'None', client: 'None', vendor: 'None',
  },
  'Financials — View costs / budget': {
    super_admin: 'View', it_admin: 'None', pmo_lead: 'View', pm: 'View', team_lead: 'None',
    engineer: 'None', finance: 'View', hr: 'None', sales: 'View', client: 'None', vendor: 'None',
  },
  'Financials — Edit budget / invoices': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'None', pm: 'None', team_lead: 'None',
    engineer: 'None', finance: 'Edit', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Reports — View / export': {
    super_admin: 'View', it_admin: 'View', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'None', finance: 'View', hr: 'View', sales: 'View', client: 'None', vendor: 'None',
  },
  'Risk Register — View': {
    super_admin: 'View', it_admin: 'None', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Risk Register — Edit': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'View',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Issues — View / manage': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'View',
    engineer: 'View', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Documents — Internal vault': {
    super_admin: 'View', it_admin: 'None', pmo_lead: 'View', pm: 'View', team_lead: 'View',
    engineer: 'View', finance: 'View', hr: 'None', sales: 'None', client: 'None', vendor: 'None',
  },
  'Documents — Shared / portal upload': {
    super_admin: 'Edit', it_admin: 'None', pmo_lead: 'Edit', pm: 'Edit', team_lead: 'Edit',
    engineer: 'Edit', finance: 'None', hr: 'None', sales: 'None', client: 'Edit', vendor: 'Edit',
  },
  'Client Portal — Shared projects only': {
    super_admin: 'View', it_admin: 'None', pmo_lead: 'View', pm: 'View', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'View', vendor: 'None',
  },
  'Vendor Portal — Assigned tasks only': {
    super_admin: 'View', it_admin: 'None', pmo_lead: 'View', pm: 'View', team_lead: 'None',
    engineer: 'None', finance: 'None', hr: 'None', sales: 'None', client: 'None', vendor: 'View',
  },
};

const RECORD_SCOPES = [
  ['Scope', 'Description', 'Used for'],
  ['all', 'All records in module', 'Super Admin, PMO Lead (cross-project)'],
  ['own_projects', 'Projects where user is primary/secondary PM', 'PM'],
  ['assigned', 'Tasks/resources explicitly assigned to user', 'Engineer, Vendor'],
  ['team', 'Records for user\'s team', 'Team Lead'],
  ['shared', 'Records explicitly shared to external user', 'Client, Vendor'],
  ['department', 'Records in user\'s department', 'HR, Finance (partial)'],
  ['none', 'No record access', 'Denied roles'],
];

const LEGEND = [
  ['Value', 'Meaning', 'Maps to permission action'],
  ['View', 'Read-only access to module/records', 'view'],
  ['Edit', 'Create, update, delete within scope', 'create, edit, delete, import, export, instantiate, initiate, configure, manage, submit, attach, comment'],
  ['Approve', 'Approve submissions (SoD: cannot approve own)', 'approve, validate'],
  ['None', 'No access — API returns 403', '(no permission row)'],
];

function buildMatrixSheet() {
  const header = [
    'Module / Action',
    'Record Scope (default)',
    'Field Notes',
    ...ROLES.map((r) => r.label),
  ];

  const scopeNotes = {
    'Financials — View costs / budget': 'all | own_projects',
    'Task Progress — Approve update (SoD)': 'own_projects | assigned',
    'Client Portal — Shared projects only': 'shared',
    'Vendor Portal — Assigned tasks only': 'assigned',
  };

  const fieldNotes = {
    'Financials — View costs / budget': 'Strip cost/budget for non-Finance',
    'Tasks — Comment': 'Strip internal comments for Client/Vendor',
    'Documents — Internal vault': 'Hide internal docs from external roles',
    'Task Progress — Approve update (SoD)': 'actorId !== submitterId',
  };

  const rows = [header];
  for (const [rowLabel, cells] of Object.entries(MATRIX)) {
    rows.push([
      rowLabel,
      scopeNotes[rowLabel] ?? 'per role',
      fieldNotes[rowLabel] ?? '',
      ...ROLES.map((r) => cells[r.code] ?? 'None'),
    ]);
  }
  return rows;
}

function buildRolesSheet() {
  return [
    ['Role ID', 'Code', 'Label', 'External (B2B)'],
    ...ROLES.map((r) => [
      r.id,
      r.code,
      r.label,
      r.code === 'client' || r.code === 'vendor' ? 'Yes' : 'No',
    ]),
  ];
}

function buildPermissionsSeedSheet() {
  const header = ['role_id', 'role_code', 'module', 'action', 'record_scope', 'field_scope'];
  const rows = [header];

  const moduleMap = {
    'Auth — Login / SSO': { module: 'auth', action: 'login' },
    'Auth — Session refresh / timeout': { module: 'auth', action: 'session' },
    'Auth — MFA verify / enroll': { module: 'auth', action: 'mfa' },
    'Users — Directory list': { module: 'users', action: 'view' },
    'Users — Create / register': { module: 'users', action: 'create' },
    'Users — Assign / change role': { module: 'users', action: 'assign_role' },
    'Roles & Permissions — View matrix': { module: 'rbac', action: 'view' },
    'Roles & Permissions — Edit grants': { module: 'rbac', action: 'manage' },
    'Audit Trail — View / search': { module: 'audit', action: 'view' },
    'Audit Trail — Export': { module: 'audit', action: 'export' },
    'Settings — Security / break-glass': { module: 'settings', action: 'security' },
    'Integrations — View status': { module: 'integrations', action: 'view' },
    'Integrations — Configure credentials': { module: 'integrations', action: 'configure' },
    'Notifications — In-app view': { module: 'notifications', action: 'view' },
    'Notifications — Manage preferences': { module: 'notifications', action: 'manage' },
    'Projects — List': { module: 'projects', action: 'view' },
    'Projects — Create': { module: 'projects', action: 'create' },
    'Projects — Edit (own / assigned)': { module: 'projects', action: 'edit' },
    'Projects — Change status / close': { module: 'projects', action: 'approve' },
    'Milestones — View': { module: 'milestones', action: 'view' },
    'Milestones — Create / edit': { module: 'milestones', action: 'edit' },
    'Dependencies — View (Gantt / graph)': { module: 'dependencies', action: 'view' },
    'Dependencies — Create / edit (FS/SS/FF/SF)': { module: 'dependencies', action: 'edit' },
    'Dependencies — Validate cycles': { module: 'dependencies', action: 'validate' },
    'Project import — MPP / Excel': { module: 'project_import', action: 'import' },
    'Project export — MPP / Excel': { module: 'project_export', action: 'export' },
    'Project templates — View library': { module: 'project_templates', action: 'view' },
    'Project templates — Manage versions': { module: 'project_templates', action: 'manage' },
    'Project templates — Instantiate on create': { module: 'project_templates', action: 'instantiate' },
    'Project closure — View checklist': { module: 'project_closure', action: 'view' },
    'Project closure — Initiate closure': { module: 'project_closure', action: 'initiate' },
    'Project closure — Approve closure': { module: 'project_closure', action: 'approve' },
    'Project charter — View': { module: 'charter', action: 'view' },
    'Project charter — Edit': { module: 'charter', action: 'edit' },
    'Project charter — Approve': { module: 'charter', action: 'approve' },
    'Tasks — List': { module: 'tasks', action: 'view' },
    'Tasks — Create / edit': { module: 'tasks', action: 'edit' },
    'Tasks — Comment': { module: 'tasks', action: 'comment' },
    'Tasks — Attach files': { module: 'tasks', action: 'attach' },
    'Sub-tasks — View': { module: 'subtasks', action: 'view' },
    'Sub-tasks — Create / edit': { module: 'subtasks', action: 'edit' },
    'Task Progress — Submit update': { module: 'task_progress', action: 'submit' },
    'Task Progress — Approve update (SoD)': { module: 'task_progress', action: 'approve' },
    'Timesheets — Submit own': { module: 'timesheets', action: 'submit' },
    'Timesheets — Approve team': { module: 'timesheets', action: 'approve' },
    'Team Directory — View': { module: 'team', action: 'view' },
    'Financials — View costs / budget': { module: 'financials', action: 'view' },
    'Financials — Edit budget / invoices': { module: 'financials', action: 'edit' },
    'Reports — View / export': { module: 'reports', action: 'view' },
    'Risk Register — View': { module: 'risks', action: 'view' },
    'Risk Register — Edit': { module: 'risks', action: 'edit' },
    'Issues — View / manage': { module: 'issues', action: 'edit' },
    'Documents — Internal vault': { module: 'documents', action: 'view_internal' },
    'Documents — Shared / portal upload': { module: 'documents', action: 'upload_shared' },
    'Client Portal — Shared projects only': { module: 'portal_client', action: 'view' },
    'Vendor Portal — Assigned tasks only': { module: 'portal_vendor', action: 'view' },
  };

  const actionFromCell = { View: 'view', Edit: 'edit', Approve: 'approve' };
  const scopeByRole = {
    super_admin: 'all',
    it_admin: 'all',
    pmo_lead: 'all',
    pm: 'own_projects',
    team_lead: 'team',
    engineer: 'assigned',
    finance: 'department',
    hr: 'department',
    sales: 'all',
    client: 'shared',
    vendor: 'assigned',
  };

  for (const [rowLabel, cells] of Object.entries(MATRIX)) {
    const mapped = moduleMap[rowLabel];
    if (!mapped) continue;
    for (const role of ROLES) {
      const cell = cells[role.code];
      if (!cell || cell === 'None') continue;
      const action =
        mapped.action === 'view' && cell === 'Edit'
          ? 'edit'
          : mapped.action === 'view' && cell === 'Approve'
            ? 'approve'
            : actionFromCell[cell] ?? mapped.action;
      rows.push([
        role.id,
        role.code,
        mapped.module,
        action,
        scopeByRole[role.code],
        '',
      ]);
    }
  }
  return rows;
}

mkdirSync(OUT_DIR, { recursive: true });

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildMatrixSheet()), 'Matrix');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildRolesSheet()), 'Roles');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(LEGEND), 'Legend');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(RECORD_SCOPES), 'Record Scopes');
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet(buildPermissionsSeedSheet()),
  'Permission Seed',
);

const outPath = join(OUT_DIR, 'Cybsec_Role_Permission_Matrix_v1.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`Wrote ${outPath}`);
