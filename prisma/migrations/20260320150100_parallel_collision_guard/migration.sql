-- Add active nominal lock column for race-safe pending transactions
ALTER TABLE `Transaction`
    ADD COLUMN `active_nominal` INTEGER NULL;

-- Enforce one active pending nominal at a time
CREATE UNIQUE INDEX `Transaction_active_nominal_key` ON `Transaction`(`active_nominal`);
