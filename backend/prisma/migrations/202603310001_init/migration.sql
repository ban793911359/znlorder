-- CreateTable
CREATE TABLE `users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(50) NOT NULL,
  `mobile` VARCHAR(20) NULL,
  `role` ENUM('operator', 'warehouse') NOT NULL,
  `status` ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_username_key`(`username`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `wechat_nickname` VARCHAR(100) NULL,
  `receiver_name` VARCHAR(50) NULL,
  `receiver_mobile` VARCHAR(20) NULL,
  `receiver_province` VARCHAR(50) NULL,
  `receiver_city` VARCHAR(50) NULL,
  `receiver_district` VARCHAR(50) NULL,
  `receiver_address` VARCHAR(255) NULL,
  `note` VARCHAR(500) NULL,
  `last_order_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `customers_mobile_key`(`mobile`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_sequences` (
  `biz_date` DATE NOT NULL,
  `current_value` INTEGER NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`biz_date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(20) NOT NULL,
  `customer_id` INTEGER NOT NULL,
  `status` ENUM('draft', 'pending_shipment', 'shipped', 'completed', 'cancelled') NOT NULL DEFAULT 'pending_shipment',
  `client_token_hash` VARCHAR(64) NOT NULL,
  `client_link_path` VARCHAR(255) NOT NULL,
  `created_by_id` INTEGER NOT NULL,
  `receiver_name` VARCHAR(50) NOT NULL,
  `receiver_mobile` VARCHAR(20) NOT NULL,
  `receiver_province` VARCHAR(50) NULL,
  `receiver_city` VARCHAR(50) NULL,
  `receiver_district` VARCHAR(50) NULL,
  `receiver_address` VARCHAR(255) NOT NULL,
  `total_amount` DECIMAL(10, 2) NOT NULL,
  `shipping_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `payable_amount` DECIMAL(10, 2) NOT NULL,
  `operator_remark` VARCHAR(1000) NULL,
  `warehouse_remark` VARCHAR(1000) NULL,
  `courier_company` VARCHAR(50) NULL,
  `tracking_no` VARCHAR(50) NULL,
  `shipped_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `cancelled_at` DATETIME(3) NULL,
  `cancelled_reason` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `orders_order_no_key`(`order_no`),
  INDEX `idx_orders_customer_id`(`customer_id`),
  INDEX `idx_orders_status_created_at`(`status`, `created_at`),
  INDEX `idx_orders_receiver_mobile`(`receiver_mobile`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `order_id` INTEGER NOT NULL,
  `product_name` VARCHAR(100) NOT NULL,
  `product_spec` VARCHAR(255) NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10, 2) NOT NULL,
  `line_amount` DECIMAL(10, 2) NOT NULL,
  `remark` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `idx_order_items_order_id`(`order_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `upload_files` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `order_id` INTEGER NULL,
  `uploader_id` INTEGER NOT NULL,
  `biz_type` ENUM('order_product_image') NOT NULL,
  `storage_driver` VARCHAR(32) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` INTEGER NOT NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_upload_files_order_id`(`order_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_logs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `order_id` INTEGER NOT NULL,
  `from_status` ENUM('draft', 'pending_shipment', 'shipped', 'completed', 'cancelled') NULL,
  `to_status` ENUM('draft', 'pending_shipment', 'shipped', 'completed', 'cancelled') NOT NULL,
  `action` VARCHAR(32) NOT NULL,
  `operator_id` INTEGER NULL,
  `note` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_order_status_logs_order_id`(`order_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `orders`
  ADD CONSTRAINT `orders_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `upload_files`
  ADD CONSTRAINT `upload_files_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `upload_files`
  ADD CONSTRAINT `upload_files_uploader_id_fkey`
  FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_status_logs`
  ADD CONSTRAINT `order_status_logs_order_id_fkey`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_status_logs`
  ADD CONSTRAINT `order_status_logs_operator_id_fkey`
  FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
