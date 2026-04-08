import http from './http';
import type { ApiResponse } from '@/types/common';
import type { IdentifyCustomerResult } from '@/types/order';

export function identifyCustomer(mobile: string) {
  return http.get<never, ApiResponse<IdentifyCustomerResult>>('/customers/identify', {
    params: { mobile },
  });
}
