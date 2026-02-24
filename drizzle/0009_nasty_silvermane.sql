ALTER TABLE `products` ADD `productType` enum('sale','internal') DEFAULT 'sale' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `stockQuantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `minStockAlert` int DEFAULT 5 NOT NULL;