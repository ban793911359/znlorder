ALTER TABLE `upload_files`
  ADD COLUMN `storage_key` VARCHAR(500) NULL AFTER `storage_driver`,
  ADD COLUMN `expires_at` DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) AFTER `file_url`,
  ADD COLUMN `deleted_at` DATETIME(3) NULL AFTER `expires_at`;

UPDATE `upload_files`
SET
  `storage_key` = CASE
    WHEN `file_url` LIKE '/uploads/%' THEN SUBSTRING(`file_url`, LENGTH('/uploads/') + 1)
    ELSE `file_name`
  END,
  `expires_at` = DATE_ADD(`created_at`, INTERVAL 30 DAY)
WHERE `storage_key` IS NULL;

ALTER TABLE `upload_files`
  ALTER COLUMN `expires_at` DROP DEFAULT;

CREATE INDEX `idx_upload_files_expires_at`
  ON `upload_files` (`expires_at`);
