/**
 * The per-source "Re-apply after a reboot" setting for the Status Message
 * (#5745): loaded from and saved to the per-source settings endpoint on change.
 * `enabled` is null while it loads.
 */
import { useCallback, useEffect, useState } from 'react';
import apiService from '../../services/api';
import { isReapplyEnabled, STATUS_MESSAGE_REAPPLY_SETTING } from '../../utils/statusMessage';

export function useStatusMessageReapply(sourceId: string | null | undefined) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!sourceId) return undefined;
    let cancelled = false;
    setEnabled(null);
    void (async () => {
      try {
        const data = await apiService.get<Record<string, string>>(`/api/settings?sourceId=${encodeURIComponent(sourceId)}`);
        if (!cancelled) setEnabled(isReapplyEnabled(data[STATUS_MESSAGE_REAPPLY_SETTING]));
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sourceId]);

  const onChange = useCallback(async (next: boolean) => {
    if (!sourceId) return;
    setSaving(true);
    setError(false);
    try {
      await apiService.post(`/api/settings?sourceId=${encodeURIComponent(sourceId)}`, {
        [STATUS_MESSAGE_REAPPLY_SETTING]: next ? 'true' : 'false',
      });
      setEnabled(next);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }, [sourceId]);

  return { enabled, saving, error, onChange };
}
