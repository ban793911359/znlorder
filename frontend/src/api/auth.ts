import http from './http';
import type { ApiResponse } from '@/types/common';
import type { LoginResponse } from '@/types/auth';

export function login(payload: { username: string; password: string }) {
  return http.post<never, ApiResponse<LoginResponse>>('/auth/login', payload);
}
