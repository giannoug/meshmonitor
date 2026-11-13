/**
 * Migration 233 — PostgreSQL / MySQL container behaviour (isolated DBs).
 * A silent skip still reports success; confirm via `numPendingTests`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import mysql from 'mysql2/promise';
import { runMigration233Postgres, runMigration233Mysql } from './233_add_user_preferences.js';
import {
  postgresAvailable,
  mysqlAvailable,
  createIsolatedPostgresDatabase,
  createIsolatedMysqlDatabase,
} from '../../db/repositories/test-utils.js';

describe.skipIf(!postgresAvailable)('migration 233 — PostgreSQL (container)', () => {
  let pool: pg.Pool;
  let cleanup: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    ({ pool, cleanup } = await createIsolatedPostgresDatabase('mig233'));
    await pool.query('CREATE TABLE users (id SERIAL PRIMARY KEY)');
    await pool.query('INSERT INTO users DEFAULT VALUES');
  });
  afterAll(async () => {
    await cleanup?.();
  });

  it('is idempotent, enforces unique (userId,key) and cascades on user delete', async () => {
    const client = await pool.connect();
    try {
      await runMigration233Postgres(client);
      await expect(runMigration233Postgres(client)).resolves.toBeUndefined();
    } finally {
      client.release();
    }
    const ins = `INSERT INTO user_preferences ("userId","key","value","updatedAt") VALUES (1,'layout','"workspace"',1)`;
    await pool.query(ins);
    await expect(pool.query(ins)).rejects.toThrow();
    await pool.query('DELETE FROM users WHERE id = 1');
    const { rows } = await pool.query('SELECT 1 FROM user_preferences');
    expect(rows).toHaveLength(0);
  });
});

describe.skipIf(!mysqlAvailable)('migration 233 — MySQL (container)', () => {
  let pool: mysql.Pool;
  let cleanup: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    ({ pool, cleanup } = await createIsolatedMysqlDatabase('mig233'));
    await pool.query('CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY)');
    await pool.query('INSERT INTO users () VALUES ()');
  });
  afterAll(async () => {
    await cleanup?.();
  });

  it('is idempotent, enforces unique (userId,key) and cascades on user delete', async () => {
    await runMigration233Mysql(pool);
    await expect(runMigration233Mysql(pool)).resolves.toBeUndefined();
    const ins = `INSERT INTO user_preferences (userId, \`key\`, \`value\`, updatedAt) VALUES (1,'layout','"workspace"',1)`;
    await pool.query(ins);
    await expect(pool.query(ins)).rejects.toThrow();
    await pool.query('DELETE FROM users WHERE id = 1');
    const [rows] = await pool.query('SELECT 1 FROM user_preferences');
    expect(rows as any[]).toHaveLength(0);
  });
});
