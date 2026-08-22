CREATE TABLE `community_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`content` text NOT NULL,
	`mood` enum('Calm','Anxious','Spiraling','Victory') NOT NULL,
	`flagged` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interpretations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`receivedMessage` text NOT NULL,
	`meaning` text NOT NULL,
	`attachmentSignals` text NOT NULL,
	`suggestedResponse` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interpretations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`mood` enum('Calm','Anxious','Spiraling','Victory') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`emoji` varchar(8) NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_reactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`style` enum('secure','anxious','avoidant','fearful') NOT NULL,
	`answers` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `quiz_results_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `verdicts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`message` text NOT NULL,
	`context` text,
	`verdict` enum('SEND','WAIT','DO NOT SEND') NOT NULL,
	`explanation` text NOT NULL,
	`attachmentStyle` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verdicts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `attachmentStyle` enum('secure','anxious','avoidant','fearful');