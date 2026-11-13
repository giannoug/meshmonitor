/**
 * Migration 233: user_preferences (#6365).
 *
 * Per-user key/value store (JSON text values) for the Workspace layout:
 * layout choice, pins, dashboard. GLOBAL per user (no sourceId); rows are
 * removed with the user (ON DELETE CASCADE). Unique (userId, key).
 * Idempotent on all three backends. No backfill.
 */
import type { Database } from 'better-sqlite3';
import { logger } from '../../utils/logger.js';
import { createTableIfMissingMysql } from './helpers.js';

const LABEL = 'Migration 233';
const TABLE = 'user_preferences';
const UNIQUE_INDEX = 'user_preferences_user_key_uniq';

export const migration = {
  up: (db: Database): void => {
    logger.info(`${LABEL} (SQLite): creating ${TABLE}...`);
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${UNIQUE_INDEX} ON ${TABLE}(user_id, key)`);
    logger.info(`${LABEL} complete (SQLite)`);
  },

  down: (db: Database): void => {
    db.exec(`DROP TABLE IF EXISTS ${TABLE}`);
  },
};

export async function runMigration233Postgres(client: import('pg').PoolClient): Promise<void> {
  logger.info(`${LABEL} (PostgreSQL): creating ${TABLE}...`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" BIGINT NOT NULL
    )
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${UNIQUE_INDEX} ON ${TABLE}("userId", "key")`);
  logger.info(`${LABEL} complete (PostgreSQL)`);
}

export async function runMigration233Mysql(pool: import('mysql2/promise').Pool): Promise<void> {
  logger.info(`${LABEL} (MySQL): creating ${TABLE}...`);
  await createTableIfMissingMysql(
    pool,
    TABLE,
    `
    CREATE TABLE ${TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      \`key\` VARCHAR(191) NOT NULL,
      \`value\` MEDIUMTEXT NOT NULL,
      updatedAt BIGINT NOT NULL,
      UNIQUE KEY ${UNIQUE_INDEX} (userId, \`key\`),
      CONSTRAINT user_preferences_user_fk FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `
  );
  logger.info(`${LABEL} complete (MySQL)`);
}
