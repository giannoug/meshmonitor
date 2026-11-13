/**
 * UserPreferences Repository (#6365)
 *
 * Per-user key/value store; values are JSON text. Global per user (no sourceId).
 */
import { and, eq, inArray } from 'drizzle-orm';
import { BaseRepository, DrizzleDatabase } from './base.js';
import { DatabaseType } from '../types.js';

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export class UserPreferencesRepository extends BaseRepository {
  constructor(db: DrizzleDatabase, dbType: DatabaseType) {
    super(db, dbType);
  }

  async getAll(userId: number): Promise<Record<string, unknown>> {
    const t = this.tables.userPreferences;
    const rows = await this.db.select().from(t).where(eq(t.userId, userId));
    const out: Record<string, unknown> = {};
    for (const r of rows as any[]) {
      const v = parse(r.value);
      if (v !== undefined) out[r.key] = v;
    }
    return out;
  }

  async get(userId: number, key: string): Promise<unknown | undefined> {
    const t = this.tables.userPreferences;
    const rows = await this.db
      .select()
      .from(t)
      .where(and(eq(t.userId, userId), eq(t.key, key)))
      .limit(1);
    return rows.length ? parse((rows[0] as any).value) : undefined;
  }

  async set(userId: number, key: string, value: unknown): Promise<void> {
    const t = this.tables.userPreferences;
    const json = JSON.stringify(value);
    const updatedAt = Date.now();
    await this.upsert(t, { userId, key, value: json, updatedAt }, [t.userId, t.key], {
      value: json,
      updatedAt,
    });
  }

  async delete(userId: number, key: string): Promise<void> {
    const t = this.tables.userPreferences;
    await this.db.delete(t).where(and(eq(t.userId, userId), eq(t.key, key)));
  }

  /** Count how many of `userIds` hold each (string) value of `key`. */
  async countByValue(key: string, userIds: number[]): Promise<Record<string, number>> {
    if (userIds.length === 0) return {};
    const t = this.tables.userPreferences;
    const rows = await this.db
      .select()
      .from(t)
      .where(and(eq(t.key, key), inArray(t.userId, userIds)));
    const out: Record<string, number> = {};
    for (const r of rows as any[]) {
      const v = parse(r.value);
      if (v === undefined) continue;
      const k = String(v);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }
}
