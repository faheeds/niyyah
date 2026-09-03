CREATE TABLE IF NOT EXISTS `event_signup_slots` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `user_id` text NOT NULL,
  `selected_date` text NOT NULL,
  `selected_time` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  UNIQUE(`event_id`,`user_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_signup_slots_event_date` ON `event_signup_slots` (`event_id`,`selected_date`,`selected_time`);
