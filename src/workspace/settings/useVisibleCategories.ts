import { useAuth } from '../../contexts/AuthContext';
import { useHealth } from '../../hooks/useHealth';
import { appBasename } from '../../init';
import { RADIO, visibleCategories, type CategoryDef } from './categories';

/**
 * The categories this viewer may open on a device, once the grants (and, for
 * an admin on a radio, the OTA flag) are known: deciding on an empty grant set
 * would send a deep link to the first category.
 */
export function useVisibleCategories(sourceId: string, sourceType: string): { ready: boolean; categories: CategoryDef[] } {
  const { authStatus, loading, hasPermission } = useAuth();
  const isAdmin = authStatus?.user?.isAdmin === true;
  const askHealth = isAdmin && (RADIO as string[]).includes(sourceType);
  // ConfigurationTab's firmware gate, with its cache key and interval (Ruling BF).
  const health = useHealth({ baseUrl: appBasename, refetchInterval: 60000, enabled: askHealth });
  const ready = !loading && (!askHealth || !health.isPending);
  const categories = visibleCategories({
    sourceId,
    sourceType,
    isAdmin,
    isAuthenticated: authStatus?.authenticated === true,
    firmwareOtaEnabled: health.data?.firmwareOtaEnabled === true,
    hasPermission,
  });
  return { ready, categories };
}
