ALTER TABLE `users`
  MODIFY `role` ENUM('operator', 'warehouse', 'super_admin') NOT NULL;
