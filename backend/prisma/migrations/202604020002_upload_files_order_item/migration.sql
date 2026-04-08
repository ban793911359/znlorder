ALTER TABLE `upload_files`
  ADD COLUMN `order_item_id` INTEGER NULL;

CREATE INDEX `idx_upload_files_order_item_id`
  ON `upload_files`(`order_item_id`);

ALTER TABLE `upload_files`
  ADD CONSTRAINT `upload_files_order_item_id_fkey`
  FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
