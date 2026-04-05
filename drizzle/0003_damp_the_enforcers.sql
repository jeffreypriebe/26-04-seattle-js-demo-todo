CREATE TABLE `team_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_tasks_team_id_idx` ON `team_tasks` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_tasks_created_by_user_id_idx` ON `team_tasks` (`created_by_user_id`);