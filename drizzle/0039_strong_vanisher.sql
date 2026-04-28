CREATE TABLE `error_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(20) NOT NULL DEFAULT 'browser',
	`message` text NOT NULL,
	`stack` text,
	`url` varchar(500),
	`userAgent` varchar(500),
	`tenantId` int,
	`context` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `error_logs_id` PRIMARY KEY(`id`)
);
