import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

const MAX_EXCEL_TASK_ROWS = 50_000;

export { MAX_EXCEL_TASK_ROWS };

export async function loadExcelWorkbook(
  source: Buffer | string,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    if (typeof source === 'string') {
      await workbook.xlsx.readFile(source);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(source as any);
    }
  } catch {
    throw new BadRequestException(
      'Failed to parse XLSX file. Please ensure it is not password-protected or corrupted.',
    );
  }
  return workbook;
}

export function listExcelSheetNames(workbook: ExcelJS.Workbook): string[] {
  return workbook.worksheets.map((ws) => ws.name);
}

const EXCEL_SHEET_NAME_MAX = 31;

/**
 * Resolves `{projectName} Phases|Tasks|Milestones`, including Excel's 31-char
 * truncation used by the frontend exporter.
 */
export function findProjectNestedSheetName(
  sheetNames: string[],
  projectName: string,
  suffix: ' Phases' | ' Tasks' | ' Milestones',
): string | null {
  const exact = `${projectName}${suffix}`;
  if (sheetNames.includes(exact)) return exact;

  const clean = projectName.replace(/[\\/?*:[\]]/g, '').trim();
  if (!clean) return null;

  const maxPrefix = Math.max(1, EXCEL_SHEET_NAME_MAX - suffix.length);
  const candidates = [
    `${clean.slice(0, maxPrefix)}${suffix}`.slice(0, EXCEL_SHEET_NAME_MAX),
    `${clean.slice(0, 25)}${suffix}`.slice(0, EXCEL_SHEET_NAME_MAX),
  ];
  for (const candidate of candidates) {
    if (sheetNames.includes(candidate)) return candidate;
  }

  const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `^(.{1,${maxPrefix}})${escapedSuffix}(?: \\(\\d+\\))?$`,
  );

  let best: string | null = null;
  let bestPrefixLen = -1;
  for (const name of sheetNames) {
    const match = name.match(re);
    if (!match) continue;
    const sheetPrefix = match[1] ?? '';
    if (!sheetPrefix || !clean.startsWith(sheetPrefix)) continue;
    if (sheetPrefix.length > bestPrefixLen) {
      bestPrefixLen = sheetPrefix.length;
      best = name;
    }
  }
  return best;
}

/**
 * Convert a worksheet to a 2-D string grid.
 * When allowEmpty is true, returns [] for missing/empty sheets instead of throwing.
 */
export function worksheetToStringGrid(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  options?: { allowEmpty?: boolean; maxRows?: number },
): string[][] {
  const allowEmpty = options?.allowEmpty ?? false;
  const maxRows = options?.maxRows ?? MAX_EXCEL_TASK_ROWS;
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    if (allowEmpty) return [];
    throw new BadRequestException(`Sheet "${sheetName}" not found.`);
  }

  const rows: string[][] = [];
  let maxCol = 0;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as Array<ExcelJS.CellValue | undefined>;
    const cells: string[] = [];
    for (let c = 1; c < values.length; c++) {
      cells.push(cellToString(values[c]));
    }
    while (cells.length > 0 && cells[cells.length - 1] === '') {
      cells.pop();
    }
    if (cells.some((c) => c.trim() !== '')) {
      maxCol = Math.max(maxCol, cells.length);
      rows.push(cells);
    }
  });

  const normalized = rows.map((r) => {
    const next = [...r];
    while (next.length < maxCol) next.push('');
    return next;
  });

  if (normalized.length <= 1) {
    if (allowEmpty) return normalized;
    throw new BadRequestException(
      `Sheet "${sheetName}" is empty or only contains headers.`,
    );
  }

  const dataRowCount = normalized.length - 1;
  if (dataRowCount > maxRows) {
    throw new BadRequestException(
      `Sheet "${sheetName}" has too many rows (${dataRowCount}). Maximum is ${maxRows}.`,
    );
  }

  return normalized;
}

const NON_CYBSEC_TASK_SHEETS = new Set(['MS Project', 'Projects']);

/**
 * Prefer Cybsec task sheets: `Tasks`, then `{project} Tasks`.
 * Never returns the MS Project / Project Viewer sheet.
 */
export function resolveExcelTasksSheetName(
  sheetNames: string[],
  projectName?: string | null,
): string | null {
  if (sheetNames.includes('Tasks')) return 'Tasks';
  if (projectName) {
    const nested = findProjectNestedSheetName(sheetNames, projectName, ' Tasks');
    if (nested) return nested;
  }
  const bySuffix = sheetNames.find(
    (name) => name.endsWith(' Tasks') && !NON_CYBSEC_TASK_SHEETS.has(name),
  );
  if (bySuffix) return bySuffix;
  return (
    sheetNames.find((name) => !NON_CYBSEC_TASK_SHEETS.has(name)) ?? null
  );
}

/**
 * Read an XLSX workbook into a 2-D string grid (header + data rows).
 * Prefers the named Cybsec Tasks sheet; never falls back to "MS Project".
 */
export async function readExcelSheetAsStringGrid(
  source: Buffer | string,
  preferredSheetName = 'Tasks',
  options?: { projectName?: string | null },
): Promise<string[][]> {
  const workbook = await loadExcelWorkbook(source);
  const names = listExcelSheetNames(workbook);
  if (names.length === 0) {
    throw new BadRequestException('The XLSX file has no worksheets.');
  }

  const preferred =
    preferredSheetName && names.includes(preferredSheetName)
      ? preferredSheetName
      : null;
  const sheetName =
    preferred ?? resolveExcelTasksSheetName(names, options?.projectName);

  if (!sheetName || NON_CYBSEC_TASK_SHEETS.has(sheetName)) {
    throw new BadRequestException(
      'This file has no Tasks sheet. Use a Tasks export, or Import Projects for a full project workbook.',
    );
  }
  return worksheetToStringGrid(workbook, sheetName);
}

function cellToString(value: ExcelJS.CellValue | undefined): string {
  if (value == null || value === '') return '';

  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) {
    return formatDateYmd(value);
  }

  if (typeof value === 'object') {
    if ('result' in value && value.result != null) {
      return cellToString(value.result as ExcelJS.CellValue);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? '').join('').trim();
    }
    if ('text' in value && typeof (value as { text?: unknown }).text === 'string') {
      return String((value as { text: string }).text).trim();
    }
    if ('error' in value) return '';
  }

  return String(value).trim();
}

function formatDateYmd(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
