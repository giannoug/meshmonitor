/**
 * One MeshMonitor setting, saved as you go (Task 5.8, s12n1): the In
 * MeshMonitor categories have no Save; each row writes itself.
 *
 * - Read: the source's `GET /api/settings?sourceId=` once on open and again
 *   after our own writes (Ruling DM; no poll), shared by every row of the page.
 * - Write: today's `POST /api/settings[?sourceId]` with SettingsTab's split:
 *   the per-source keys (SETTINGS_TAB_PER_SOURCE_KEYS) go to the source, the
 *   rest to the unscoped POST. A self-saving section that already writes a
 *   key to the source (Reliable PKI, coverage recording) passes `scoped`.
 * - `commit: 'change'` (toggles, selects) writes on every set. `'blur'` (text,
 *   numbers) only stages the value; `status.commit()` writes it, which the row
 *   calls on blur or Enter. Never per keystroke, no debounce timer.
 * - Writes for one key run one at a time: a value set while one is in flight
 *   waits, and only the latest waiting value is sent. No retries: a failure
 *   shows today's words and the row goes back to the server's value.
 */
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { SETTINGS_TAB_PER_SOURCE_KEYS } from '../../constants/nodeDisplayDefaults';

export type ServerSettings = Record<string, string>;

const query = (sourceId?: string) => (sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '');

export const serverSettingsKey = (sourceId?: string) => ['settings', 'workspace', sourceId ?? ''] as const;

/** The source's stored settings, as SettingsTab reads them (global keys merged in). */
export function useServerSettings(sourceId?: string) {
  return useQuery({
    queryKey: serverSettingsKey(sourceId),
    queryFn: () => apiService.get<ServerSettings>(`/api/settings${query(sourceId)}`),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export interface AutosaveOptions<T> {
  sourceId?: string;
  commit: 'change' | 'blur';
  /** The stored string (undefined when unset) as the row's value. */
  parse(raw: string | undefined): T;
  /** The value as stored; default `String(value)`. */
  serialize?(value: T): string;
  /** Write to `?sourceId=`. Default: SettingsTab's split. */
  scoped?: boolean;
  /** After a successful write: today's fan-out to SettingsContext. */
  onSaved?(value: T): void;
}

export interface AutosaveStatus {
  saved: boolean;
  error?: string;
  /** Writes the staged value of a blur row (a no-op when nothing changed). */
  commit(): void;
}

export function useAutosaveSetting<T>(key: string, opts: AutosaveOptions<T>): [T, (value: T) => void, AutosaveStatus] {
  const queryClient = useQueryClient();
  const { data } = useServerSettings(opts.sourceId);
  const serialize = opts.serialize ?? String;
  const stored = data?.[key];
  const latest = useRef(opts);
  latest.current = opts;
  const scoped = opts.scoped ?? (SETTINGS_TAB_PER_SOURCE_KEYS as readonly string[]).includes(key);
  const url = `/api/settings${scoped ? query(opts.sourceId) : ''}`;
  return useAutosaveValue<T>(opts.parse(stored), {
    commit: opts.commit,
    same: (v) => serialize(v) === stored,
    write: async (v) => {
      const text = serialize(v);
      await apiService.post(url, { [key]: text });
      queryClient.setQueryData<ServerSettings>(serverSettingsKey(latest.current.sourceId), (prev) => ({ ...prev, [key]: text }));
      latest.current.onSaved?.(v);
    },
    // Read again after our own write (Ruling DM).
    settled: () => void queryClient.invalidateQueries({ queryKey: serverSettingsKey(latest.current.sourceId) }),
  });
}

/**
 * The autosave core for any store: `current` is the stored value, `write`
 * saves one value (and updates the caller's cache). Serialized per hook, the
 * latest waiting value only, no retries; `settled` runs when the queue empties.
 */
export function useAutosaveValue<T>(
  current: T,
  {
    commit: mode,
    write,
    same,
    settled,
    errorText,
  }: {
    commit: 'change' | 'blur';
    write(v: T): Promise<void>;
    same(v: T): boolean;
    settled?(): void;
    /** The words for a failure, when today shows more than its generic line. */
    errorText?(error: unknown): string | undefined;
  },
): [T, (value: T) => void, AutosaveStatus] {
  const { t } = useTranslation();
  // What the row shows ahead of the store: staged, waiting or in flight.
  const [local, setLocal] = useState<{ v: T } | null>(null);
  const [state, setState] = useState<{ saved: boolean; error?: string }>({ saved: false });
  const staged = useRef<{ v: T } | null>(null);
  const waiting = useRef<{ v: T } | null>(null);
  const busy = useRef(false);
  const io = useRef({ write, settled });
  io.current = { write, settled };

  const send = async (first: { v: T }) => {
    if (busy.current) {
      waiting.current = first;
      return;
    }
    busy.current = true;
    let next: { v: T } | null = first;
    try {
      while (next) {
        waiting.current = null;
        await io.current.write(next.v);
        next = waiting.current;
      }
      setState({ saved: true });
    } catch (error) {
      waiting.current = null;
      setState({ saved: false, error: errorText?.(error) ?? t('settings.save_failed') });
    } finally {
      busy.current = false;
      staged.current = null;
      setLocal(null);
      io.current.settled?.();
    }
  };

  const set = (v: T) => {
    setLocal({ v });
    setState({ saved: false });
    if (mode === 'change') void send({ v });
    else staged.current = { v };
  };

  const commit = () => {
    const pending = staged.current;
    if (!pending) return;
    staged.current = null;
    if (same(pending.v)) setLocal(null);
    else void send(pending);
  };

  return [local ? local.v : current, set, { ...state, commit }];
}
