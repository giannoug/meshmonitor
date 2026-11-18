/**
 * The LXMF identity's state and actions (#6011), shared by today's
 * `ReticulumIdentitySection` and the Workspace LXMF identity page (#6365):
 * the announce settings read, the name and interval drafts, Save (only what
 * changed, once per press; saving never announces) and Announce now (one
 * POST per press).
 *
 * Routes (all `ok()` envelopes, so bodies are read via `.data`):
 *   GET  /api/sources/:id/reticulum/announce-settings   configuration:read
 *   PUT  /api/sources/:id/reticulum/display-name        configuration:write
 *   PUT  /api/sources/:id/reticulum/announce-interval   configuration:write
 *   POST /api/sources/:id/reticulum/announce            configuration:write
 *
 * The server enforces the 60 s "Announce now" cooldown and answers 429 with
 * `retryAfterSeconds`; this only mirrors it, counting down once a second
 * from what the server said. The countdown sends nothing.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';

export interface AnnounceSettings {
  connected: boolean;
  destinationHash: string | null;
  displayName: string | null;
  maxDisplayNameLength: number;
  announceIntervalHours: number;
  cooldownSeconds: number;
  lastAnnounceAt: number | null;
  cooldownRemainingSeconds: number;
  nextPeriodicAnnounceAt: number | null;
}

/** Interval choices, in hours. 0 = off (the default). The server accepts any whole 1–24. */
export const ANNOUNCE_INTERVAL_CHOICES = [0, 1, 2, 3, 6, 12, 24] as const;

const DEFAULT_MAX_NAME = 64;

function unwrap<T>(res: unknown): T | null {
  if (res && typeof res === 'object' && 'data' in (res as Record<string, unknown>)) {
    return (res as { data: T }).data;
  }
  return (res as T) ?? null;
}

export function useReticulumIdentity(sourceId: string) {
  const { t } = useTranslation();
  const base = `/api/sources/${encodeURIComponent(sourceId)}/reticulum`;

  const [settings, setSettings] = useState<AnnounceSettings | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [intervalDraft, setIntervalDraft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Client-clock time the cooldown ends, from the server's remaining seconds. */
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const data = unwrap<AnnounceSettings>(await api.get<unknown>(`${base}/announce-settings`));
      if (!data) return;
      setSettings(data);
      setNameDraft(data.displayName ?? '');
      setIntervalDraft(data.announceIntervalHours ?? 0);
      setCooldownUntil(Date.now() + (data.cooldownRemainingSeconds ?? 0) * 1000);
      setNow(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('reticulum.identity.loadError', 'Failed to load the LXMF identity settings'));
    }
  }, [base, t]);

  useEffect(() => { void load(); }, [load]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // Tick once a second while the cooldown runs, so the button counts down.
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= cooldownUntil) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const maxName = settings?.maxDisplayNameLength ?? DEFAULT_MAX_NAME;
  const trimmedName = nameDraft.trim();
  const nameChanged = settings !== null && trimmedName !== (settings.displayName ?? '');
  const intervalChanged = settings !== null && intervalDraft !== settings.announceIntervalHours;
  const nameTooLong = Array.from(trimmedName).length > maxName;
  const connected = settings?.connected ?? false;

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      let applied = true;
      if (nameChanged) {
        const res = unwrap<{ applied: boolean }>(await api.put<unknown>(`${base}/display-name`, { name: trimmedName }));
        applied = res?.applied ?? false;
      }
      if (intervalChanged) {
        await api.put(`${base}/announce-interval`, { hours: intervalDraft });
      }
      setMessage(
        nameChanged && !applied
          ? t('reticulum.identity.savedOffline', 'Saved. The name is applied when the source next connects.')
          : t('reticulum.identity.saved', 'Saved. Press Announce now to send the name to the network.'),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('reticulum.identity.saveError', 'Failed to save'));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const announce = async () => {
    setAnnouncing(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(`${base}/announce`);
      setMessage(t('reticulum.identity.announced', 'Announce sent.'));
      await load();
    } catch (e) {
      // ApiError carries the server's 429 `retryAfterSeconds` (services/api.ts).
      const err = e as { status?: number; retryAfterSeconds?: number };
      if (err.status === 429 && typeof err.retryAfterSeconds === 'number') {
        setCooldownUntil(Date.now() + err.retryAfterSeconds * 1000);
        setNow(Date.now());
      } else {
        setError(e instanceof Error ? e.message : t('reticulum.identity.announceError', 'Failed to announce'));
      }
    } finally {
      setAnnouncing(false);
    }
  };

  return {
    settings, nameDraft, setNameDraft, intervalDraft, setIntervalDraft, saving, announcing, error, message,
    cooldownLeft, maxName, trimmedName, nameTooLong, nameChanged, intervalChanged, connected, save, announce,
  };
}
