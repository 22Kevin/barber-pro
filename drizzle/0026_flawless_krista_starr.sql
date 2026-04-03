ALTER TABLE `recurring_appointments` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `recurring_appointments` ADD `cancelReason` varchar(255);