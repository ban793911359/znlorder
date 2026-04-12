ALTER TABLE `orders`
  MODIFY `status` ENUM(
    'draft',
    'pending_shipment',
    'partial_shipped',
    'shipped',
    'completed',
    'cancelled'
  ) NOT NULL DEFAULT 'pending_shipment';

CREATE TABLE `order_shipments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `order_id` INTEGER NOT NULL,
  `sequence_no` INTEGER NOT NULL,
  `shipment_status` ENUM('partial_shipped', 'shipped') NOT NULL,
  `courier_company` VARCHAR(50) NOT NULL,
  `tracking_no` VARCHAR(50) NOT NULL,
  `shipment_remark` VARCHAR(1000) NULL,
  `operator_id` INTEGER NULL,
  `shipped_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uniq_order_shipments_order_sequence`(`order_id`, `sequence_no`),
  INDEX `idx_order_shipments_order_shipped_at`(`order_id`, `shipped_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `order_shipments`
  ADD CONSTRAINT `order_shipments_order_id_fkey`
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `order_shipments_operator_id_fkey`
    FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
