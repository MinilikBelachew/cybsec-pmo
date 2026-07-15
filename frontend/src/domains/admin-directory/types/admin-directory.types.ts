export type QueryAdminDepartmentsParams = {
  search?: string;
  isActive?: boolean;
  sortBy?: "name" | "code" | "employeeCount" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export type AdminDepartmentRow = {
  id: string;
  code: string;
  name: string;
  kekaDepartmentId: string | null;
  isActive: boolean;
  employeeCount: number;
  projectCount: number;
  createdAt: string;
};

export type AdminDepartmentListResponse = {
  data: AdminDepartmentRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
