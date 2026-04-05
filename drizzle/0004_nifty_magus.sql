ALTER TABLE `todos` ADD `user_id` integer NOT NULL REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `todos` ADD `due_date` integer;--> statement-breakpoint
ALTER TABLE `todos` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `todos` ADD `updated_at` integer NOT NULL;--> statement-breakpoint
CREATE INDEX `todos_user_id_idx` ON `todos` (`user_id`);