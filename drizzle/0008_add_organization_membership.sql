CREATE TABLE IF NOT EXISTS `organization_email_domains` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `domain` text NOT NULL,
  `created_at` text NOT NULL,
  UNIQUE(`organization_id`,`domain`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organization_members` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `user_id` text NOT NULL,
  `email` text NOT NULL,
  `display_name` text NOT NULL,
  `tag` text NOT NULL DEFAULT 'external',
  `status` text NOT NULL DEFAULT 'pending',
  `source` text NOT NULL DEFAULT 'self_requested',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  UNIQUE(`organization_id`,`user_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_org_domains_domain` ON `organization_email_domains` (`domain`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_org_members_org_status` ON `organization_members` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_org_members_user` ON `organization_members` (`user_id`);
