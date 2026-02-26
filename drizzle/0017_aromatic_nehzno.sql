CREATE TABLE `whatsapp_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`clientId` int NOT NULL,
	`barberId` int NOT NULL,
	`direction` enum('outgoing','incoming') NOT NULL DEFAULT 'outgoing',
	`message` text NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('sent','delivered','read') NOT NULL DEFAULT 'sent',
	CONSTRAINT `whatsapp_messages_id` PRIMARY KEY(`id`)
);
