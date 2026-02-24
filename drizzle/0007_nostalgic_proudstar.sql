CREATE TABLE `commission_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`barberId` int NOT NULL,
	`defaultRate` decimal(5,2) NOT NULL DEFAULT '50.00',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commission_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `commission_configs_barberId_unique` UNIQUE(`barberId`)
);
--> statement-breakpoint
CREATE TABLE `commission_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`barberId` int NOT NULL,
	`appointmentId` int,
	`saleId` int,
	`grossValue` decimal(10,2) NOT NULL,
	`commissionRate` decimal(5,2) NOT NULL,
	`commissionValue` decimal(10,2) NOT NULL,
	`type` enum('service','product') NOT NULL DEFAULT 'service',
	`description` varchar(255),
	`date` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commission_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`targetAudience` enum('all','inactive_30','inactive_60','birthday_month') NOT NULL DEFAULT 'all',
	`sentAt` timestamp,
	`recipientCount` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `return_message_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`delayDays` int NOT NULL DEFAULT 21,
	`messageTemplate` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `return_message_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `return_message_configs_serviceId_unique` UNIQUE(`serviceId`)
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`barberId` int,
	`serviceId` int,
	`date` varchar(10) NOT NULL,
	`notifiedAt` timestamp,
	`status` enum('waiting','notified','booked','cancelled') NOT NULL DEFAULT 'waiting',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waitlist_id` PRIMARY KEY(`id`)
);
