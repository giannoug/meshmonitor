/**
 * useMeshCoreTelemetrySettingsDraft: the MeshCore telemetry settings' draft
 * and save (#6258), moved as is out of MeshCoreTelemetrySettingsSection (Rule
 * X, Task 7.4) for the Workspace's Display page. The section keeps today's
 * SaveBar registration.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import { useToast } from '../../ToastContainer';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { logger } from '../../../utils/logger';

export interface TelemetryDraft {
  telemetryVisualizationHours: number;
  favoriteTelemetryStorageDays: number;
}

export function useMeshCoreTelemetrySettingsDraft(baseUrl: string, sourceId: string) {
  const { t } = useTranslation();
  const csrfFetch = useCsrfFetch();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = hasPermission('settings', 'write', { sourceId });
  const {
    telemetryVisualizationHours,
    favoriteTelemetryStorageDays,
    setTelemetryVisualizationHours,
    setFavoriteTelemetryStorageDays,
  } = useSettings();

  const buildDraft = useCallback((): TelemetryDraft => ({
    telemetryVisualizationHours,
    favoriteTelemetryStorageDays,
  }), [telemetryVisualizationHours, favoriteTelemetryStorageDays]);

  const [draft, setDraft] = useState<TelemetryDraft>(buildDraft);
  const [initial, setInitial] = useState<TelemetryDraft>(buildDraft);
  const [isSaving, setIsSaving] = useState(false);

  // Re-seed when the context value changes (it loads from the server after mount).
  useEffect(() => {
    const next = buildDraft();
    setDraft(next);
    setInitial(next);
  }, [buildDraft]);

  const hasChanges =
    draft.telemetryVisualizationHours !== initial.telemetryVisualizationHours
    || draft.favoriteTelemetryStorageDays !== initial.favoriteTelemetryStorageDays;

  const update = (key: keyof TelemetryDraft, value: number) => {
    // Backstop: NaN would serialize as "NaN" in the POST body.
    setDraft((prev) => ({ ...prev, [key]: Number.isNaN(value) ? prev[key] : value }));
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await csrfFetch(`${baseUrl}/api/settings?sourceId=${encodeURIComponent(sourceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetryVisualizationHours: String(draft.telemetryVisualizationHours),
          favoriteTelemetryStorageDays: String(draft.favoriteTelemetryStorageDays),
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          showToast(t('settings.node_display.insufficient_permissions', 'Insufficient permissions'), 'error');
          return;
        }
        throw new Error(`Server returned ${res.status}`);
      }
      setTelemetryVisualizationHours(draft.telemetryVisualizationHours);
      setFavoriteTelemetryStorageDays(draft.favoriteTelemetryStorageDays);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      setInitial(draft);
      showToast(t('settings.node_display.settings_saved', 'Settings saved'), 'success');
    } catch (err) {
      logger.error('Failed to save MeshCore telemetry settings:', err);
      showToast(t('settings.node_display.settings_save_failed', 'Failed to save settings'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    draft, baseUrl, sourceId, csrfFetch, queryClient, showToast, t,
    setTelemetryVisualizationHours, setFavoriteTelemetryStorageDays,
  ]);

  const handleDismiss = useCallback(() => {
    setDraft(initial);
  }, [initial]);

  return { canWrite, draft, hasChanges, isSaving, update, handleSave, handleDismiss };
}
