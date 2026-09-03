CREATE TABLE `community_members` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`age_group` text NOT NULL,
	`postcode` text NOT NULL,
	`interests` text NOT NULL,
	`preferred_contact` text NOT NULL,
	`heard_about_us` text,
	`instagram` text,
	`tiktok` text,
	`other_social` text,
	`updates_opt_in` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `community_members_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_community_members_email` ON `community_members` (`email`);
--> statement-breakpoint
PRAGMA optimize;
