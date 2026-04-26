CREATE TABLE `product_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`clientId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`note` text,
	`status` enum('received','confirmed','preparing','ready','delivered','cancelled') NOT NULL DEFAULT 'received',
	`estimatedDays` int,
	`cancelledAt` timestamp,
	`cancelReason` text,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_orders_id` PRIMARY KEY(`id`)
);
