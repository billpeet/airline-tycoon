CREATE TABLE `aircraft_type` (
	`id` text PRIMARY KEY NOT NULL,
	`icao_code` text NOT NULL,
	`manufacturer` text NOT NULL,
	`family` text NOT NULL,
	`model` text NOT NULL,
	`type_class` text NOT NULL,
	`range_km` integer NOT NULL,
	`typical_pax` integer NOT NULL,
	`max_pax` integer NOT NULL,
	`cargo_kg` integer NOT NULL,
	`cruise_speed_kts` integer NOT NULL,
	`mtow_kg` integer NOT NULL,
	`list_price_musd` real NOT NULL,
	`lease_rate_kusd_month` real NOT NULL,
	`fuel_burn_lph` integer NOT NULL,
	`crew_cockpit` integer NOT NULL,
	`crew_cabin` integer NOT NULL,
	`intro_year` integer NOT NULL,
	`retired_year` integer
);
--> statement-breakpoint
CREATE INDEX `aircraft_type_class_idx` ON `aircraft_type` (`type_class`);--> statement-breakpoint
CREATE INDEX `aircraft_type_manufacturer_idx` ON `aircraft_type` (`manufacturer`);--> statement-breakpoint
CREATE TABLE `airline` (
	`id` text PRIMARY KEY NOT NULL,
	`iata` text,
	`icao` text NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`type` text NOT NULL,
	`alliance` text,
	`founded` integer NOT NULL,
	`fleet_size` integer NOT NULL,
	`ai_aggression` real NOT NULL,
	`ai_expansion` real NOT NULL,
	`color` text
);
--> statement-breakpoint
CREATE INDEX `airline_country_idx` ON `airline` (`country`);--> statement-breakpoint
CREATE INDEX `airline_alliance_idx` ON `airline` (`alliance`);--> statement-breakpoint
CREATE TABLE `airline_hub` (
	`airline_id` text NOT NULL,
	`airport_id` text NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`airline_id`, `airport_id`),
	FOREIGN KEY (`airline_id`) REFERENCES `airline`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`airport_id`) REFERENCES `airport`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `airline_hub_airport_idx` ON `airline_hub` (`airport_id`);--> statement-breakpoint
CREATE TABLE `airport` (
	`id` text PRIMARY KEY NOT NULL,
	`iata` text,
	`icao` text,
	`name` text NOT NULL,
	`city` text,
	`country` text NOT NULL,
	`continent` text,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`elevation_ft` integer,
	`size` text NOT NULL,
	`slot_constrained` integer DEFAULT false NOT NULL,
	`timezone` text
);
--> statement-breakpoint
CREATE INDEX `airport_country_idx` ON `airport` (`country`);--> statement-breakpoint
CREATE INDEX `airport_continent_idx` ON `airport` (`continent`);--> statement-breakpoint
CREATE INDEX `airport_size_idx` ON `airport` (`size`);--> statement-breakpoint
CREATE INDEX `airport_iata_idx` ON `airport` (`iata`);