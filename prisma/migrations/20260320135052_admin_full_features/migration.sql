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
ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
