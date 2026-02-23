CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`barberId` int NOT NULL,
	`serviceId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`startTime` time NOT NULL,
	`endTime` time NOT NULL,
	`status` enum('scheduled','confirmed','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
	`notes` text,
	`reminderSent` boolean NOT NULL DEFAULT false,
	`whatsappConfirmationSent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `barbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`photoUrl` text,
	`role` enum('super_admin','barber','receptionist') NOT NULL DEFAULT 'barber',
	`specialties` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`passwordHash` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `barbers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blocked_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`barberId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`startTime` time NOT NULL,
	`endTime` time NOT NULL,
	`reason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocked_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('service','product') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`points` int NOT NULL,
	`type` enum('earned','redeemed','expired','adjusted') NOT NULL,
	`description` varchar(255),
	`saleId` int,
	`rewardId` int,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_points_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20) NOT NULL,
	`birthDate` varchar(10),
	`photoUrl` text,
	`notes` text,
	`totalPoints` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`description` varchar(255),
	`discountType` enum('percent','fixed') NOT NULL,
	`discountValue` decimal(10,2) NOT NULL,
	`minOrderValue` decimal(10,2) DEFAULT '0',
	`maxUses` int,
	`usedCount` int NOT NULL DEFAULT 0,
	`validFrom` varchar(10),
	`validUntil` varchar(10),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`barberId` int,
	`category` varchar(100) NOT NULL,
	`description` varchar(500) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`date` varchar(10) NOT NULL,
	`paymentMethod` varchar(50),
	`receiptUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`pointsPerService` int NOT NULL DEFAULT 10,
	`pointsPerReal` decimal(5,2) NOT NULL DEFAULT '1',
	`pointsExpireMonths` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyalty_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loyalty_rewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`pointsRequired` int NOT NULL,
	`rewardType` enum('free_service','discount_percent','discount_fixed','free_product') NOT NULL,
	`rewardValue` decimal(10,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loyalty_rewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('service','product') NOT NULL,
	`entityId` int NOT NULL,
	`url` text NOT NULL,
	`type` enum('image','video') NOT NULL,
	`order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`stock` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`itemType` enum('service','product') NOT NULL,
	`itemId` int NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL,
	`total` decimal(10,2) NOT NULL,
	CONSTRAINT `sale_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int,
	`barberId` int NOT NULL,
	`appointmentId` int,
	`subtotal` decimal(10,2) NOT NULL,
	`discount` decimal(10,2) NOT NULL DEFAULT '0',
	`total` decimal(10,2) NOT NULL,
	`paymentMethod` enum('cash','credit_card','debit_card','pix','mercado_pago','other') NOT NULL,
	`paymentStatus` enum('pending','paid','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`couponId` int,
	`couponCode` varchar(50),
	`mercadoPagoPaymentId` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`durationMinutes` int NOT NULL DEFAULT 30,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopName` varchar(255) NOT NULL DEFAULT 'Barber Pro',
	`address` text,
	`phone` varchar(20),
	`whatsapp` varchar(20),
	`logoUrl` text,
	`mercadoPagoAccessToken` text,
	`mercadoPagoPublicKey` text,
	`whatsappMessageTemplate` text,
	`reminderMessageTemplate` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shop_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `working_hours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`barberId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`startTime` time NOT NULL,
	`endTime` time NOT NULL,
	`lunchStart` time,
	`lunchEnd` time,
	`isWorking` boolean NOT NULL DEFAULT true,
	CONSTRAINT `working_hours_id` PRIMARY KEY(`id`)
);
