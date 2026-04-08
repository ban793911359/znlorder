export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string | string[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResult<T> {
  list: T[];
  pagination: Pagination;
}
