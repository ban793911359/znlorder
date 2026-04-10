ALTER TABLE `upload_files`
  MODIFY `biz_type` ENUM('order_product_image', 'order_payment_code_image') NOT NULL;
