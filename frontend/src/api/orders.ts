import http from './http';
import type { ApiResponse, PaginatedResult } from '@/types/common';
import type {
  CreateOrderPayload,
  CreateOrderResponse,
  OrderDraft,
  OrderDetail,
  OrderSummary,
  UpdateOrderPayload,
} from '@/types/order';

export function createOrder(payload: CreateOrderPayload) {
  return http.post<never, ApiResponse<CreateOrderResponse>>('/orders', payload);
}

export function getOrderDrafts() {
  return http.get<never, ApiResponse<OrderDraft[]>>('/orders/drafts', {
    silent: true,
  } as never);
}

export function getOrderDraft(draftId: number) {
  return http.get<never, ApiResponse<OrderDraft>>(`/orders/drafts/${draftId}`, {
    silent: true,
  } as never);
}

export function saveOrderDraft(payload: {
  id?: number;
  title?: string;
  payload: unknown;
}) {
  if (payload.id) {
    return http.patch<never, ApiResponse<OrderDraft>>(
      `/orders/drafts/${payload.id}`,
      payload,
      { silent: true } as never,
    );
  }

  return http.post<never, ApiResponse<OrderDraft>>('/orders/drafts', payload, {
    silent: true,
  } as never);
}

export function deleteOrderDraft(draftId: number) {
  return http.delete<never, ApiResponse<{ id: number; deleted: boolean }>>(
    `/orders/drafts/${draftId}`,
    { silent: true } as never,
  );
}

export function updateOrder(orderId: number, payload: UpdateOrderPayload) {
  return http.patch<never, ApiResponse<OrderDetail>>(`/orders/${orderId}`, payload);
}

export function cancelOrder(orderId: number, payload?: { reason?: string }) {
  return http.post<never, ApiResponse<OrderDetail>>(`/orders/${orderId}/cancel`, payload);
}

export function getOrderList(params: Record<string, string | number | boolean | undefined>) {
  return http.get<never, ApiResponse<PaginatedResult<OrderSummary>>>('/orders', {
    params,
  });
}

export function getOrderDetail(orderId: number) {
  return http.get<never, ApiResponse<OrderDetail>>(`/orders/${orderId}`);
}

export function getPendingShipmentOrders(
  params: Record<string, string | number | boolean | undefined>,
) {
  return http.get<never, ApiResponse<PaginatedResult<OrderSummary>>>(
    '/warehouse/orders/pending',
    { params },
  );
}

export function getWarehouseOrders(
  params: Record<string, string | number | boolean | undefined>,
) {
  return http.get<never, ApiResponse<PaginatedResult<OrderSummary>>>(
    '/warehouse/orders',
    { params },
  );
}

export function getWarehouseOrderDetail(orderId: number) {
  return http.get<never, ApiResponse<OrderSummary>>(`/warehouse/orders/${orderId}`);
}

export function shipOrder(
  orderId: number,
  payload: {
    courierCompany: string;
    trackingNo: string;
    shipmentRemark?: string;
    isPartialShipment?: boolean;
    isFullyShipped?: boolean;
  },
) {
  return http.post<never, ApiResponse<OrderDetail>>(
    `/warehouse/orders/${orderId}/ship`,
    payload,
  );
}

export function getPublicOrder(orderNo: string, token: string) {
  return http.get<never, ApiResponse<OrderDetail>>(`/public/orders/${orderNo}`, {
    params: { token },
  });
}
