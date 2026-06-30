/** Shared task sheet layout tokens */
export const TASK_SHEET_MAX_WIDTH = "!max-w-[min(1400px,98vw)]";
export const TASK_SHEET_COLUMN_CLASS =
  "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden lg:w-1/2";
export const TASK_SHEET_MAIN_PADDING = "px-8 py-6";
export const TASK_SHEET_FOOTER_PADDING = "px-8 py-4";

/** Create project sheet — narrower single-column layout */
export const CREATE_PROJECT_SHEET_MAX_WIDTH = "!max-w-[min(720px,96vw)]";
export const CREATE_PROJECT_SHEET_CLASS =
  `flex h-full w-full ${CREATE_PROJECT_SHEET_MAX_WIDTH} flex-col gap-0 overflow-hidden p-0 rounded-l-[10px]`;

/** Detail / view task sheet */
export const TASK_SHEET_CONTENT_CLASS =
  `flex h-full w-full !max-w-[800px] flex-col gap-0 overflow-hidden p-0 rounded-l-[10px]`;

/** Edit task detail sheet — two-column layout */
export const TASK_DETAIL_SHEET_CLASS =
  `flex h-full w-full ${TASK_SHEET_MAX_WIDTH} flex-col gap-0 overflow-hidden p-0 rounded-l-[10px]`;

/** Create task sheet — wider two-column layout */
export const ADD_TASK_SHEET_CLASS =
  `flex h-full w-full ${TASK_SHEET_MAX_WIDTH} flex-col gap-0 overflow-hidden p-0 rounded-l-[10px]`;
