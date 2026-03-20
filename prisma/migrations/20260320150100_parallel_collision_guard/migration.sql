-- DropForeignKey
ALTER TABLE `adminauditlog` DROP FOREIGN KEY `AdminAuditLog_admin_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `stockitem` DROP FOREIGN KEY `StockItem_owner_id_fkey`;

-- DropForeignKey
ALTER TABLE `stockitem` DROP FOREIGN KEY `StockItem_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `transaction` DROP FOREIGN KEY `Transaction_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `transaction` DROP FOREIGN KEY `Transaction_stock_id_fkey`;

-- DropForeignKey
ALTER TABLE `transaction` DROP FOREIGN KEY `Transaction_user_id_fkey`;

-- DropTable
DROP TABLE `adminauditlog`;

-- DropTable
DROP TABLE `emailotp`;

-- DropTable
DROP TABLE `otprequestlog`;

-- DropTable
DROP TABLE `product`;

-- DropTable
DROP TABLE `stockitem`;

-- DropTable
DROP TABLE `transaction`;

-- DropTable
DROP TABLE `user`;

-- DropTable
DROP TABLE `webhookeventlog`;

-- DropTable
DROP TABLE `webhookreplayguard`;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `is_verified` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `base_price` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('READY', 'DELIVERED', 'EXPIRED') NOT NULL DEFAULT 'READY',
    `owner_id` INTEGER NULL,

    INDEX `StockItem_product_id_idx`(`product_id`),
    INDEX `StockItem_owner_id_idx`(`owner_id`),
    INDEX `StockItem_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `stock_id` INTEGER NULL,
    `base_price` INTEGER NOT NULL,
    `unique_code` INTEGER NOT NULL,
    `total_price` INTEGER NOT NULL,
    `active_nominal` INTEGER NULL,
    `status` ENUM('PENDING', 'PAID', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Transaction_stock_id_key`(`stock_id`),
    UNIQUE INDEX `Transaction_active_nominal_key`(`active_nominal`),
    INDEX `Transaction_user_id_idx`(`user_id`),
    INDEX `Transaction_product_id_idx`(`product_id`),
    INDEX `Transaction_status_idx`(`status`),
    INDEX `Transaction_total_price_idx`(`total_price`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailOtp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `otp_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `attempt_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailOtp_email_key`(`email`),
    INDEX `EmailOtp_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpRequestLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OtpRequestLog_email_created_at_idx`(`email`, `created_at`),
    INDEX `OtpRequestLog_ip_address_created_at_idx`(`ip_address`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookReplayGuard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `replay_key` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WebhookReplayGuard_replay_key_key`(`replay_key`),
    INDEX `WebhookReplayGuard_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEventLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nominal` INTEGER NOT NULL,
    `timestamp` BIGINT NOT NULL,
    `signature` VARCHAR(128) NOT NULL,
    `request_ip` VARCHAR(128) NOT NULL,
    `validation_ok` BOOLEAN NOT NULL,
    `process_status` VARCHAR(64) NOT NULL,
    `error_message` VARCHAR(255) NULL,
    `transaction_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WebhookEventLog_created_at_idx`(`created_at`),
    INDEX `WebhookEventLog_validation_ok_idx`(`validation_ok`),
    INDEX `WebhookEventLog_process_status_idx`(`process_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_user_id` INTEGER NOT NULL,
    `action` VARCHAR(128) NOT NULL,
    `target_type` VARCHAR(64) NOT NULL,
    `target_id` INTEGER NULL,
    `details` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_admin_user_id_created_at_idx`(`admin_user_id`, `created_at`),
    INDEX `AdminAuditLog_action_idx`(`action`),
    INDEX `AdminAuditLog_target_type_target_id_idx`(`target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `StockItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

