ALTER TABLE `tenants` ADD `latitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `tenants` ADD `longitude` decimal(10,7);--> statement-breakpoint
ALTER TABLE `tenants` ADD `descricao` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `fotoCapa` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `visivelMarketplace` boolean DEFAULT false NOT NULL;