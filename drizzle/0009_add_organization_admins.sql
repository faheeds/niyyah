CREATE TABLE IF NOT EXISTS `organization_admins` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `user_id` text,
  `email` text NOT NULL,
  `display_name` text,
  `role` text NOT NULL DEFAULT 'staff',
  `status` text NOT NULL DEFAULT 'invited',
  `invited_by_user_id` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  UNIQUE(`organization_id`,`email`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_org_admins_org` ON `organization_admins` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_org_admins_user` ON `organization_admins` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_org_admins_email` ON `organization_admins` (`email`);
