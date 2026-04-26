ALTER TABLE `product_orders` ADD `totalPrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `product_orders` ADD `paymentMethod` varchar(50);--> statement-breakpoint
ALTER TABLE `product_orders` ADD `paidAt` timestamp;