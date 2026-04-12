export const ORDER_STATUS_VALUES = [
  'draft',
  'pending_shipment',
  'partial_shipped',
  'shipped',
  'completed',
  'cancelled',
] as const;

export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];

export const ORDER_STATUS: Record<OrderStatusValue, OrderStatusValue> = {
  draft: 'draft',
  pending_shipment: 'pending_shipment',
  partial_shipped: 'partial_shipped',
  shipped: 'shipped',
  completed: 'completed',
  cancelled: 'cancelled',
};

export const SHIPMENT_STATUS_VALUES = ['partial_shipped', 'shipped'] as const;

export type ShipmentStatusValue = (typeof SHIPMENT_STATUS_VALUES)[number];

export const SHIPMENT_STATUS: Record<
  ShipmentStatusValue,
  ShipmentStatusValue
> = {
  partial_shipped: 'partial_shipped',
  shipped: 'shipped',
};
