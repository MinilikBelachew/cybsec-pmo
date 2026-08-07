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

/**
 * Read an XLSX workbook into a 2-D string grid (header + data rows).
 * Prefers the named sheet, otherwise falls back to the first sheet.
 */
export async function readExcelSheetAsStringGrid(
  source: Buffer | string,
  preferredSheetName = 'Tasks',
): Promise<string[][]> {
  const workbook = await loadExcelWorkbook(source);
  const preferred = workbook.getWorksheet(preferredSheetName);
  const sheetName = preferred?.name ?? workbook.worksheets[0]?.name;
  if (!sheetName) {
    throw new BadRequestException('The XLSX file has no worksheets.');
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
