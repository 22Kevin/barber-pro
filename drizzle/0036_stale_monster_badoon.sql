ALTER TABLE `reviews` MODIFY COLUMN `serviceId` int;--> statement-breakpoint
ALTER TABLE `product_orders` ADD `confirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `reviews` ADD `productId` int;--> statement-breakpoint
ALTER TABLE `reviews` ADD `orderId` int;