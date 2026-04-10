CREATE TABLE `order_drafts` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `owner_id` INTEGER NOT NULL,
  `title` VARCHAR(100) NULL,
  `payload` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `idx_order_drafts_owner_updated`(`owner_id`, `updated_at`),
  PRIMARY KEY (`id`)
);

ALTER TABLE `order_drafts`
  ADD CONSTRAINT `order_drafts_owner_id_fkey`
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

