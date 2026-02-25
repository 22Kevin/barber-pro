CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(20),
	`cnpj` varchar(20),
	`address` text,
	`cep` varchar(10),
	`addressNumber` varchar(20),
	`addressComplement` varchar(100),
	`city` varchar(100),
	`state` varchar(2),
	`plan` enum('solo','team','studio') NOT NULL DEFAULT 'solo',
	`status` enum('active','trial','suspended','cancelled') NOT NULL DEFAULT 'trial',
	`trialEndsAt` timestamp,
	`logoUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `barbers` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `clients` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `tenantId` int;