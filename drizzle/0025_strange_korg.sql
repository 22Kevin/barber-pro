CREATE TABLE `orbit_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`tenantId` int NOT NULL,
	`loginAt` timestamp NOT NULL DEFAULT (now()),
	`convertedAt` timestamp,
	`source` enum('link','geo') NOT NULL DEFAULT 'link',
	CONSTRAINT `orbit_leads_id` PRIMARY KEY(`id`)
);
