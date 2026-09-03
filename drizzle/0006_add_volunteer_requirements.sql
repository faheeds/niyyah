CREATE TABLE IF NOT EXISTS `event_volunteer_requirements` (
  `event_id` text PRIMARY KEY NOT NULL,
  `gender_appropriateness` text NOT NULL DEFAULT 'Any gender',
  `location_preference` text,
  `travel_required` integer NOT NULL DEFAULT 0,
  `volunteers_needed` integer NOT NULL DEFAULT 1,
  `auto_pause` integer NOT NULL DEFAULT 1,
  `preferred_interests` text,
  `notes` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_requirements_needed` ON `event_volunteer_requirements` (`volunteers_needed`,`auto_pause`);
