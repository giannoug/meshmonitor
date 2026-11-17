/**
 * Server settings writes as today's global Save made them (Task 6.5): the
 * body to `POST /api/settings`, then every `settings` query read again, so the
 * translation, elevation, ducting and ADS-B consumers see the change.
 */
import { useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

/** Writes settings as today's Save did, then reads every `settings` query again. */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return async (body: Record<string, string>) => {
    await apiService.post('/api/settings', body);
    await queryClient.invalidateQueries({ queryKey: ['settings'] });
  };
}

/** After a row saves itself: today's Save refreshed every `settings` query (translation, elevation, ducting, ADS-B consumers). */
export function useRefreshSettings() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['settings'] });
}
