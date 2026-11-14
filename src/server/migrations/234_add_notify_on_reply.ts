/**
 * Migration 234: `notify_on_reply` on `user_notification_preferences` (#6365).
 *
 * The per-(user, source) opt-in for a push when someone replies to one of the
 * source's own Meshtastic messages (Workspace D13). Defaults FALSE, so an
 * upgrade alerts nobody.
 *
 * Pure additive, idempotent `ADD COLUMN` across SQLite / PostgreSQL / MySQL
 * via the shared helpers (full DDL).
 */
import type { Database } from 'better-sqlite3';
import { logger } from '../../utils/logger.js';
import {
  addColumnIfMissing,
  addColumnIfMissingPostgres,
  addColumnIfMissingMysql,
} from './helpers.js';

const LABEL = 'Migration 234';
const TABLE = 'user_notification_preferences';

// ============ SQLite ============

export const migration = {
  up: (db: Database): void => {
    logger.info(`${LABEL} (SQLite): adding notify_on_reply to ${TABLE}...`);
    addColumnIfMissing(db, TABLE, 'notify_on_reply', 'notify_on_reply INTEGER DEFAULT 0');
    logger.info(`${LABEL} complete (SQLite)`);
  },

  down: (_db: Database): void => {
    logger.debug(`${LABEL} down: not implemented (column drops are destructive)`);
  },
};

// ============ PostgreSQL ============

export async function runMigration234Postgres(client: import('pg').PoolClient): Promise<void> {
  logger.info(`${LABEL} (PostgreSQL): adding notifyOnReply to ${TABLE}...`);
  await addColumnIfMissingPostgres(client, TABLE, 'notifyOnReply', '"notifyOnReply" BOOLEAN DEFAULT FALSE');
  logger.info(`${LABEL} complete (PostgreSQL)`);
}

// ============ MySQL ============

export async function runMigration234Mysql(pool: import('mysql2/promise').Pool): Promise<void> {
  logger.info(`${LABEL} (MySQL): adding notifyOnReply to ${TABLE}...`);
  await addColumnIfMissingMysql(pool, TABLE, 'notifyOnReply', 'notifyOnReply BOOLEAN DEFAULT FALSE');
  logger.info(`${LABEL} complete (MySQL)`);
}
