export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SelectOption<T = string> {
  label: string;
  value: T;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}
