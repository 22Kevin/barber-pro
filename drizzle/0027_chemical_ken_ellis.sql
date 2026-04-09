CREATE TABLE `client_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`planId` int NOT NULL,
	`clientId` int NOT NULL,
	`barberId` int,
	`selectedServiceIds` text,
	`selectedProductIds` text,
	`status` enum('active','cancelled','expired') NOT NULL DEFAULT 'active',
	`paymentMethod` enum('credit_card','pix','cash','debit_card') NOT NULL DEFAULT 'cash',
	`price` decimal(10,2) NOT NULL,
	`cycleStart` date NOT NULL,
	`cycleEnd` date NOT NULL,
	`usedRecurrences` int NOT NULL DEFAULT 0,
	`cancelledAt` timestamp,
	`cancelReason` text,
	`autoRenew` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriptionId` int NOT NULL,
	`appointmentId` int NOT NULL,
	`tenantId` int NOT NULL,
	`recurrenceIndex` int NOT NULL DEFAULT 1,
	CONSTRAINT `subscription_appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plan_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`productId` int NOT NULL,
	`tenantId` int NOT NULL,
	CONSTRAINT `subscription_plan_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plan_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`serviceId` int NOT NULL,
	`tenantId` int NOT NULL,
	CONSTRAINT `subscription_plan_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`recurrences` int NOT NULL DEFAULT 4,
	`maxServices` int NOT NULL DEFAULT 1,
	`maxProducts` int NOT NULL DEFAULT 0,
	`price` decimal(10,2) NOT NULL,
	`suggestedPrice` decimal(10,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`)
);
