export const IMPORTS_QUEUE = 'imports';

export const MPP_IMPORT_JOB = 'mpp-import';
export const MPP_PORTFOLIO_IMPORT_JOB = 'mpp-portfolio-import';
export const EXCEL_TASKS_IMPORT_JOB = 'excel-tasks-import';
export const EXCEL_PROJECTS_IMPORT_JOB = 'excel-projects-import';

export const IMPORT_LOCK_KEY_PREFIX = 'import:lock:';
/** Pending FIFO queue per user: import:pending:{userId} */
export const IMPORT_QUEUE_KEY_PREFIX = 'import:pending:';
/** Safety TTL if a worker dies without releasing the lock. */
export const IMPORT_LOCK_TTL_SECONDS = 60 * 60;
/** Max imports per user: 1 active + up to 19 queued. */
export const IMPORT_MAX_PER_USER = 20;

export const IMPORT_ALREADY_RUNNING = 'IMPORT_ALREADY_RUNNING';
export const IMPORT_QUEUE_FULL = 'IMPORT_QUEUE_FULL';
/** Maps client queue id → started job id once dequeued. */
export const IMPORT_CLIENT_QUEUE_KEY_PREFIX = 'import:client-queue:';
export const IMPORT_CLIENT_QUEUE_TTL_SECONDS = 60 * 60 * 6;
