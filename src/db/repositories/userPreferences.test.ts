import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createSqliteBackend,
  createIsolatedPostgresDatabase,
  createIsolatedMysqlDatabase,
  postgresAvailable,
  mysqlAvailable,
  type TestBackend,
} from './test-utils.js';
import { UserPreferencesRepository } from './userPreferences.js';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import * as schema from '../schema/index.js';
import type { DatabaseType } from '../types.js';

const SQLITE_DDL = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT);
  CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX up_uniq ON user_preferences(user_id, key);
`;
const PG_DDL = `
  CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT);
  CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "key" TEXT NOT NULL, "value" TEXT NOT NULL, "updatedAt" BIGINT NOT NULL,
    UNIQUE ("userId", "key")
  )`;
const MYSQL_DDL = [
  'CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(64))',
  `CREATE TABLE user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL,
    \`key\` VARCHAR(191) NOT NULL, \`value\` TEXT NOT NULL, updatedAt BIGINT NOT NULL,
    UNIQUE KEY up_uniq (userId, \`key\`),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE)`,
];

function suite(name: string, make: () => Promise<{ repo: UserPreferencesRepository; exec: (s: string) => Promise<any>; users: () => Promise<number[]>; delUser: (id: number) => Promise<void>; rows: (id: number) => Promise<number>; done: () => Promise<void> }>) {
  describe(name, () => {
    let ctx: Awaited<ReturnType<typeof make>>;
    let u: number[];
    beforeAll(async () => { ctx = await make(); u = await ctx.users(); });
    afterAll(async () => { await ctx.done(); });

    it('set then get round-trips JSON', async () => {
      await ctx.repo.set(u[0], 'a', { a: [1, 'x'] });
      expect(await ctx.repo.get(u[0], 'a')).toEqual({ a: [1, 'x'] });
      expect(await ctx.repo.get(u[0], 'missing')).toBeUndefined();
    });
    it('set twice keeps one row', async () => {
      await ctx.repo.set(u[0], 'dup', 1);
      await ctx.repo.set(u[0], 'dup', 2);
      expect(await ctx.repo.get(u[0], 'dup')).toBe(2);
      expect(Object.keys(await ctx.repo.getAll(u[0])).filter(k => k === 'dup')).toHaveLength(1);
    });
    it('getAll only returns that user rows; delete removes', async () => {
      await ctx.repo.set(u[1], 'only1', true);
      expect(await ctx.repo.getAll(u[0])).not.toHaveProperty('only1');
      expect(await ctx.repo.getAll(u[1])).toEqual({ only1: true });
      await ctx.repo.delete(u[1], 'only1');
      expect(await ctx.repo.getAll(u[1])).toEqual({});
    });
    it('countByValue counts values', async () => {
      await ctx.repo.set(u[0], 'layout', 'workspace');
      await ctx.repo.set(u[1], 'layout', 'workspace');
      await ctx.repo.set(u[2], 'layout', 'classic');
      expect(await ctx.repo.countByValue('layout', u)).toEqual({ workspace: 2, classic: 1 });
      expect(await ctx.repo.countByValue('layout', [])).toEqual({});
    });
    it('deleting the user cascades', async () => {
      await ctx.repo.set(u[2], 'x', 1);
      expect(await ctx.rows(u[2])).toBeGreaterThan(0);
      await ctx.delUser(u[2]);
      expect(await ctx.rows(u[2])).toBe(0);
    });
  });
}

suite('UserPreferencesRepository (sqlite)', async () => {
  const b: TestBackend = createSqliteBackend(SQLITE_DDL);
  const raw = (b.drizzleDb as any).session.client;
  raw.exec("INSERT INTO users (username) VALUES ('a'),('b'),('c')");
  return {
    repo: new UserPreferencesRepository(b.drizzleDb, 'sqlite' as DatabaseType),
    exec: async () => {},
    users: async () => raw.prepare('SELECT id FROM users ORDER BY id').all().map((r: any) => r.id),
    delUser: async (id) => { raw.prepare('DELETE FROM users WHERE id=?').run(id); },
    rows: async (id) => (raw.prepare('SELECT COUNT(*) c FROM user_preferences WHERE user_id=?').get(id) as any).c,
    done: () => b.close(),
  };
});

describe.skipIf(!postgresAvailable)('pg', () => {
  suite('UserPreferencesRepository (postgres)', async () => {
    const iso = await createIsolatedPostgresDatabase('userprefs');
    await iso.pool.query(PG_DDL);
    await iso.pool.query("INSERT INTO users (username) VALUES ('a'),('b'),('c')");
    return {
      repo: new UserPreferencesRepository(drizzlePg(iso.pool, { schema }) as any, 'postgres' as DatabaseType),
      exec: async () => {},
      users: async () => (await iso.pool.query('SELECT id FROM users ORDER BY id')).rows.map((r: any) => r.id),
      delUser: async (id) => { await iso.pool.query('DELETE FROM users WHERE id=$1', [id]); },
      rows: async (id) => Number((await iso.pool.query('SELECT COUNT(*) c FROM user_preferences WHERE "userId"=$1', [id])).rows[0].c),
      done: () => iso.cleanup(),
    };
  });
});

describe.skipIf(!mysqlAvailable)('mysql', () => {
  suite('UserPreferencesRepository (mysql)', async () => {
    const iso = await createIsolatedMysqlDatabase('userprefs');
    for (const s of MYSQL_DDL) await iso.pool.query(s);
    await iso.pool.query("INSERT INTO users (username) VALUES ('a'),('b'),('c')");
    return {
      repo: new UserPreferencesRepository(drizzleMysql(iso.pool, { schema, mode: 'default' }) as any, 'mysql' as DatabaseType),
      exec: async () => {},
      users: async () => ((await iso.pool.query('SELECT id FROM users ORDER BY id'))[0] as any[]).map(r => r.id),
      delUser: async (id) => { await iso.pool.query('DELETE FROM users WHERE id=?', [id]); },
      rows: async (id) => Number(((await iso.pool.query('SELECT COUNT(*) c FROM user_preferences WHERE userId=?', [id]))[0] as any[])[0].c),
      done: () => iso.cleanup(),
    };
  });
});
