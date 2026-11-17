/**
 * useCliHistory: one target's stored command history (#5892), moved as is out
 * of CliHistoryPanel so the Workspace console (Task 7.3) draws it its own way.
 * Loads the newest page while `open`, then older pages with `load(cursor)`;
 * `user` narrows it to one user (today's history filter). Reads only: no mesh traffic.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchSourceCliHistory, nextCliHistoryCursor, type CliHistoryCursor, type CliHistoryEntry } from '../cliHistoryApi';

const PAGE_SIZE = 25;

export function useCliHistory(sourceId: string, target: string, open: boolean, user?: string) {
  const [entries, setEntries] = useState<CliHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<CliHistoryCursor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor: CliHistoryCursor | null) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchSourceCliHistory(sourceId, { target, user, limit: PAGE_SIZE, before: cursor?.before, beforeId: cursor?.beforeId });
      setEntries((prev) => (cursor === null ? page.entries : [...prev, ...page.entries]));
      setNextCursor(nextCliHistoryCursor(page));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sourceId, target, user]);

  // A new target starts empty.
  useEffect(() => {
    setEntries([]);
    setNextCursor(null);
    setError(null);
  }, [sourceId, target]);

  useEffect(() => {
    if (open) void load(null);
  }, [open, load]);

  return { entries, nextCursor, loading, error, load };
}
