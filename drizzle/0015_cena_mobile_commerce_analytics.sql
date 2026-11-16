CREATE TABLE `eventTickets` (
`id` int AUTO_INCREMENT NOT NULL,
`eventId` int NOT NULL,
`name` varchar(100) NOT NULL,
`price` decimal(10,2) NOT NULL DEFAULT '0.00',
`quantityAvailable` int NOT NULL DEFAULT 0,
`quantityReserved` int NOT NULL DEFAULT 0,
`pixKey` varchar(255),
`isAvailable` boolean NOT NULL DEFAULT true,
`createdAt` timestamp NOT NULL DEFAULT (now()),
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `eventTickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `merchandise` (
`id` int AUTO_INCREMENT NOT NULL,
`artistId` int NOT NULL,
`name` varchar(160) NOT NULL,
`description` text,
`price` decimal(10,2) NOT NULL DEFAULT '0.00',
`stock` int NOT NULL DEFAULT 0,
`imageUrl` text,
`externalUrl` text,
`isAvailable` boolean NOT NULL DEFAULT true,
`createdAt` timestamp NOT NULL DEFAULT (now()),
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `merchandise_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `events` ADD `address` varchar(255);
--> statement-breakpoint
ALTER TABLE `events` ADD `latitude` decimal(10,7);
--> statement-breakpoint
ALTER TABLE `events` ADD `longitude` decimal(10,7);
--> statement-breakpoint
ALTER TABLE `trackPlays` ADD `listenedSeconds` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `trackPlays` ADD `city` varchar(120);
--> statement-breakpoint
ALTER TABLE `eventTickets` ADD CONSTRAINT `eventTickets_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `merchandise` ADD CONSTRAINT `merchandise_artistId_artists_id_fk` FOREIGN KEY (`artistId`) REFERENCES `artists`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `idx_event_tickets_event_available` ON `eventTickets` (`eventId`,`isAvailable`);
--> statement-breakpoint
CREATE INDEX `idx_merchandise_artist_available` ON `merchandise` (`artistId`,`isAvailable`);
