/**
 * A user's notification preferences for one source (today's NotificationsTab
 * store, Task 5.8): read once from `GET /api/push/preferences?sourceId=` (no
 * poll), each field saved as you go through today's `POST /api/push/preferences`,
 * which merges only the fields sent onto the stored row (or the defaults).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { defaultNotificationPreferences, type NotificationPreferenceDefaults } from '../../utils/notificationDefaults';
import { useAutosaveValue, type AutosaveStatus } from './useAutosaveSetting';

export type NotificationPrefs = NotificationPreferenceDefaults & { usingDefaults?: boolean };

export const notificationPrefsKey = (sourceId: string) => ['workspace', 'notificationPrefs', sourceId] as const;

export function useNotificationPrefs(sourceId: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: notificationPrefsKey(sourceId),
    queryFn: async () => ({
      ...defaultNotificationPreferences(),
      ...(await apiService.get<Partial<NotificationPrefs>>(`/api/push/preferences?sourceId=${encodeURIComponent(sourceId)}`)),
    }),
    staleTime: Infinity,
    retry: false,
  });
}

/** A rejected template (#5593) says what is wrong; anything else is today's "save failed". */
function templateProblem(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return error instanceof Error && typeof code === 'string' && code.startsWith('TEMPLATE_') ? error.message : undefined;
}

/** One preference field, saved as you go (or on commit() for text and numbers). */
export function usePrefField<K extends keyof NotificationPreferenceDefaults>(
  sourceId: string,
  field: K,
  commit: 'change' | 'blur' = 'change',
): [NotificationPreferenceDefaults[K], (v: NotificationPreferenceDefaults[K]) => void, AutosaveStatus] {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useNotificationPrefs(sourceId);
  const current = (data ?? defaultNotificationPreferences())[field];
  return useAutosaveValue(current, {
    commit,
    same: (v) => JSON.stringify(v) === JSON.stringify(current),
    errorText: (error) => templateProblem(error) ?? t('notifications.alert_save_failed'),
    write: async (v) => {
      await apiService.post('/api/push/preferences', { [field]: v, sourceId });
      queryClient.setQueryData<NotificationPrefs>(notificationPrefsKey(sourceId), (prev) => prev && { ...prev, [field]: v, usingDefaults: false });
    },
    settled: () => void queryClient.invalidateQueries({ queryKey: notificationPrefsKey(sourceId) }),
  });
}
