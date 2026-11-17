/** The autosave core of the status-backed rows (statusRows.tsx), Task 6.5. */
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import apiService, { ApiError } from '../../services/api';
import { useAutosaveValue } from '../settings/useAutosaveSetting';

/** The autosave core for a status-backed value; also used for the mesh issues rule list. */
export function useStatusSetting<T>({ value, body, queryKey }: { value: T; body(value: T): Record<string, string>; queryKey: QueryKey }, commit: 'change' | 'blur') {
  const queryClient = useQueryClient();
  return useAutosaveValue<T>(value, {
    commit,
    same: (v) => JSON.stringify(body(v)) === JSON.stringify(body(value)),
    // Read again before the row lets go of the new value, so it never shows the old one in between.
    write: async (v) => {
      await apiService.post('/api/settings', body(v));
      await queryClient.invalidateQueries({ queryKey });
    },
    errorText: (error) => (error instanceof ApiError && error.message ? error.message : undefined),
  });
}
