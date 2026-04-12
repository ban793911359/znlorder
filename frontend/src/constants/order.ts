import type { OrderStatus } from '@/types/order';

export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  draft: '草稿',
  pending_shipment: '待发货',
  partial_shipped: '部分发货',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

export const ORDER_STATUS_OPTIONS = [
  { text: '全部状态', value: '' },
  { text: '草稿', value: 'draft' },
  { text: '待发货', value: 'pending_shipment' },
  { text: '部分发货', value: 'partial_shipped' },
  { text: '已发货', value: 'shipped' },
  { text: '已完成', value: 'completed' },
  { text: '已取消', value: 'cancelled' },
];

export const DRAFT_STORAGE_KEY = 'wechat-order-h5:draft-order';

export function getDefaultPaymentImagesStorageKey(userId?: number | string) {
  return `wechat-order-h5:default-payment-images:${userId || 'guest'}`;
}
