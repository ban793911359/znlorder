ALTER TABLE `order_status_logs`
  MODIFY `from_status` ENUM(
    'draft',
    'pending_shipment',
    'partial_shipped',
    'shipped',
    'completed',
    'cancelled'
  ) NULL;

ALTER TABLE `order_status_logs`
  MODIFY `to_status` ENUM(
    'draft',
    'pending_shipment',
    'partial_shipped',
    'shipped',
    'completed',
    'cancelled'
  ) NOT NULL;
