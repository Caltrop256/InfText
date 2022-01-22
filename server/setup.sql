CREATE DATABASE `inftext`;
use `inftext`;

CREATE TABLE IF NOT EXISTS `chunks` (
	`x` BIGINT NOT NULL,
    `y` BIGINT NOT NULL,
    `data` BLOB NOT NULL,
    PRIMARY KEY(`x`, `y`)
);

CREATE DATABASE `meta`;
use `meta`;

CREATE TABLE IF NOT EXISTS `analytics` (
	`id` CHAR(44) CHARACTER SET ascii NOT NULL,
	`timestamp` TIMESTAMP NOT NULL,
    `ip` VARCHAR(45) CHARACTER SET ascii,
    `domain` VARCHAR(64) CHARACTER SET ascii NOT NULL,
    `location` VARCHAR(512) CHARACTER SET ascii NOT NULL,
    `userAgent` VARCHAR(512) CHARACTER SET ascii,
    `referer` VARCHAR(512),
    `method` VARCHAR(15) NOT NULL,
    `sessionLength` INT UNSIGNED,
    PRIMARY KEY (`id`)
);