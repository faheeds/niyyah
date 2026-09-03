CREATE TABLE `member_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text,
	`postcode` text,
	`interests` text DEFAULT '[]' NOT NULL,
	`instagram` text,
	`tiktok` text,
	`other_social` text,
	`discoverable` integer DEFAULT false NOT NULL,
	`share_activity` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `volunteer_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization` text NOT NULL,
	`role` text NOT NULL,
	`hours` integer NOT NULL,
	`activity_date` text NOT NULL,
	`status` text DEFAULT 'self_reported' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `member_connections_requester_id_recipient_id_unique` UNIQUE(`requester_id`,`recipient_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_profiles_discoverable` ON `member_profiles` (`discoverable`,`display_name`);
--> statement-breakpoint
CREATE INDEX `idx_activities_user_date` ON `volunteer_activities` (`user_id`,`activity_date`);
--> statement-breakpoint
CREATE INDEX `idx_connections_recipient_status` ON `member_connections` (`recipient_id`,`status`);
--> statement-breakpoint
PRAGMA optimize;
