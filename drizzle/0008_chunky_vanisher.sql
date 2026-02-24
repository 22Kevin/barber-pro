CREATE TABLE `recurring_appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`barberId` int NOT NULL,
	`serviceId` int NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`startTime` time NOT NULL,
	`endTime` time NOT NULL,
	`intervalWeeks` int NOT NULL DEFAULT 4,
	`occurrences` int NOT NULL DEFAULT 6,
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`type` enum('in','out','adjustment') NOT NULL,
	`quantity` int NOT NULL,
	`reason` varchar(255),
	`barberId` int,
	`saleId` int,
	`date` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
