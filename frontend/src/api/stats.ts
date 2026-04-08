import http from './http';
import type { ApiResponse } from '@/types/common';

export interface TodayStats {
  totalOrders: number;
  draftCount: number;
  pendingShipmentCount: number;
  shippedCount: number;
  completedCount: number;
  cancelledCount: number;
  totalPayableAmount: number;
}

export function getTodayStats() {
  return http.get<never, ApiResponse<TodayStats>>('/stats/today-orders');
}
