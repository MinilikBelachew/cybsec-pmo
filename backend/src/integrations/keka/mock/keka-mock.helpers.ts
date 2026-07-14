import { KekaPagedResponse } from '../keka.types';

export function buildKekaPagedResponse<T>(
  items: T[],
  pageNumber: number,
  pageSize: number,
  basePath: string,
): KekaPagedResponse<T> {
  const safePageSize = Math.max(1, pageSize);
  const safePageNumber = Math.max(1, pageNumber);
  const totalRecords = items.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / safePageSize));
  const start = (safePageNumber - 1) * safePageSize;
  const data = items.slice(start, start + safePageSize);

  const pageUrl = (page: number) =>
    `${basePath}?pageNumber=${page}&pageSize=${safePageSize}`;

  return {
    succeeded: true,
    message: null,
    errors: null,
    data,
    pageNumber: safePageNumber,
    pageSize: safePageSize,
    firstPage: pageUrl(1),
    lastPage: pageUrl(totalPages),
    totalPages,
    totalRecords,
    nextPage: safePageNumber < totalPages ? pageUrl(safePageNumber + 1) : null,
    previousPage: safePageNumber > 1 ? pageUrl(safePageNumber - 1) : null,
  };
}

export function parseIsoDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
