#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SCHEMA_PATH="${REPO_ROOT}/prisma/schema.prisma"

DEFAULT_MIGRATION="20260320150100_parallel_collision_guard"
MIGRATION_NAME="${1:-$DEFAULT_MIGRATION}"
RESOLVE_MODE="${2:-auto}"

if [[ ! -f "$SCHEMA_PATH" ]]; then
  echo "Schema file not found: $SCHEMA_PATH"
  exit 1
fi

echo "Using repository root: ${REPO_ROOT}"
echo "Using schema: ${SCHEMA_PATH}"
echo "Recovery migration target: ${MIGRATION_NAME}"
echo "Resolve mode: ${RESOLVE_MODE}"

cd "$REPO_ROOT"

if [[ "${MIGRATION_NAME}" == "20260320150100_parallel_collision_guard" ]]; then
  echo
  echo "[0/4] Repair partial state for ${MIGRATION_NAME} (idempotent SQL)..."
  npx prisma db execute --schema "$SCHEMA_PATH" --stdin <<'SQL'
SET @tx_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND LOWER(TABLE_NAME) = LOWER('Transaction')
);

SET @has_active_nominal := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND LOWER(TABLE_NAME) = LOWER('Transaction')
    AND COLUMN_NAME = 'active_nominal'
);

SET @add_column_sql := IF(
  @tx_exists = 1 AND @has_active_nominal = 0,
  'ALTER TABLE `Transaction` ADD COLUMN `active_nominal` INTEGER NULL',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @add_column_sql;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

SET @has_active_nominal_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND LOWER(TABLE_NAME) = LOWER('Transaction')
    AND INDEX_NAME = 'Transaction_active_nominal_key'
);

SET @add_index_sql := IF(
  @tx_exists = 1 AND @has_active_nominal_idx = 0,
  'CREATE UNIQUE INDEX `Transaction_active_nominal_key` ON `Transaction`(`active_nominal`)',
  'SELECT 1'
);
PREPARE stmt_add_idx FROM @add_index_sql;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;
SQL
fi

echo
echo "[1/4] Resolve failed migration state..."
if [[ "$RESOLVE_MODE" == "applied" ]]; then
  npx prisma migrate resolve --applied "$MIGRATION_NAME" --schema "$SCHEMA_PATH" || true
elif [[ "$RESOLVE_MODE" == "rolled-back" ]]; then
  npx prisma migrate resolve --rolled-back "$MIGRATION_NAME" --schema "$SCHEMA_PATH" || true
else
  npx prisma migrate resolve --applied "$MIGRATION_NAME" --schema "$SCHEMA_PATH" || true
  npx prisma migrate resolve --rolled-back "$MIGRATION_NAME" --schema "$SCHEMA_PATH" || true
fi

echo
echo "[2/4] Deploy migrations..."
npx prisma migrate deploy --schema "$SCHEMA_PATH"

echo
echo "[3/4] Show migration status..."
npx prisma migrate status --schema "$SCHEMA_PATH"

echo
echo "[4/4] Validate schema..."
npx prisma validate --schema "$SCHEMA_PATH"

echo
echo "Prisma migration recovery flow completed."
