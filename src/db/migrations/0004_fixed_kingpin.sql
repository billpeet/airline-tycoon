CREATE TABLE `finance_instrument` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`principal_cents` integer NOT NULL,
	`outstanding_cents` integer NOT NULL,
	`monthly_payment_cents` integer DEFAULT 0 NOT NULL,
	`rate_bps` integer DEFAULT 0 NOT NULL,
	`term_months` integer DEFAULT 0 NOT NULL,
	`months_paid` integer DEFAULT 0 NOT NULL,
	`collateral_aircraft_id` text,
	`started_on_day` integer NOT NULL,
	`ends_on_day` integer,
	`notes` text,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `finance_game_idx` ON `finance_instrument` (`game_id`);--> statement-breakpoint
CREATE INDEX `finance_kind_idx` ON `finance_instrument` (`kind`);--> statement-breakpoint
CREATE INDEX `finance_status_idx` ON `finance_instrument` (`status`);--> statement-breakpoint
ALTER TABLE `aircraft` ADD `finance_instrument_id` text;