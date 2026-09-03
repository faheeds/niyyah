CREATE TABLE IF NOT EXISTS `volunteer_challenges` (
  `inviter_user_id` text PRIMARY KEY NOT NULL,
  `inviter_email` text NOT NULL,
  `invite_code` text NOT NULL UNIQUE,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `volunteer_referrals` (
  `id` text PRIMARY KEY NOT NULL,
  `inviter_user_id` text NOT NULL,
  `invitee_email` text NOT NULL UNIQUE,
  `invitee_user_id` text,
  `status` text NOT NULL DEFAULT 'pending',
  `created_at` text NOT NULL,
  `completed_at` text,
  UNIQUE(`inviter_user_id`,`invitee_email`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_referrals_inviter_status` ON `volunteer_referrals` (`inviter_user_id`,`status`);
