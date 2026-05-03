CREATE TABLE `aircraft` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`type_id` text NOT NULL,
	`tail` text NOT NULL,
	`base_airport_id` text NOT NULL,
	`status` text DEFAULT 'in_service' NOT NULL,
	`acquired_on_day` integer NOT NULL,
	`acquisition_mode` text DEFAULT 'cash' NOT NULL,
	`cycle_hours` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`type_id`) REFERENCES `aircraft_type`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`base_airport_id`) REFERENCES `airport`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `aircraft_game_idx` ON `aircraft` (`game_id`);--> statement-breakpoint
CREATE INDEX `aircraft_base_idx` ON `aircraft` (`base_airport_id`);--> statement-breakpoint
CREATE TABLE `game` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`airline_name` text NOT NULL,
	`airline_code` text NOT NULL,
	`home_airport_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`last_simulated_at` integer NOT NULL,
	`current_day` integer DEFAULT 0 NOT NULL,
	`rate_multiplier` integer DEFAULT 1 NOT NULL,
	`rng_seed` integer NOT NULL,
	`cash_cents` integer NOT NULL,
	`reputation` integer DEFAULT 32 NOT NULL,
	`fuel_price_cents_per_liter` integer DEFAULT 85 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_airport_id`) REFERENCES `airport`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `game_user_idx` ON `game` (`user_id`);--> statement-breakpoint
CREATE TABLE `news_event` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`game_day` integer NOT NULL,
	`category` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`headline` text NOT NULL,
	`body` text,
	`meta` text,
	`pinned` integer DEFAULT false NOT NULL,
	`seen` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `news_game_day_idx` ON `news_event` (`game_id`,`game_day`);--> statement-breakpoint
CREATE INDEX `news_seen_idx` ON `news_event` (`game_id`,`seen`);--> statement-breakpoint
CREATE TABLE `route` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`from_airport_id` text NOT NULL,
	`to_airport_id` text NOT NULL,
	`aircraft_id` text NOT NULL,
	`distance_km` real NOT NULL,
	`fare_economy_cents` integer NOT NULL,
	`frequency_per_week` integer NOT NULL,
	`opened_on_day` integer NOT NULL,
	`closed_on_day` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`last_daily_pax` integer DEFAULT 0 NOT NULL,
	`last_daily_revenue_cents` integer DEFAULT 0 NOT NULL,
	`last_daily_cost_cents` integer DEFAULT 0 NOT NULL,
	`last_load_factor` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_airport_id`) REFERENCES `airport`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_airport_id`) REFERENCES `airport`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aircraft_id`) REFERENCES `aircraft`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `route_game_idx` ON `route` (`game_id`);--> statement-breakpoint
CREATE INDEX `route_aircraft_idx` ON `route` (`aircraft_id`);--> statement-breakpoint
CREATE TABLE `txn` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`game_day` integer NOT NULL,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`ref_table` text,
	`ref_id` text,
	`note` text,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `txn_game_day_idx` ON `txn` (`game_id`,`game_day`);--> statement-breakpoint
CREATE INDEX `txn_kind_idx` ON `txn` (`kind`);