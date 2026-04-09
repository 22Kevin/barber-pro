ALTER TABLE `coupons` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `loyalty_config` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `loyalty_rewards` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `promotions` ADD `tenantId` int;