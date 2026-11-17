/**
 * Script dependencies' state and requests (GET /api/scripts/dependencies,
 * POST /api/scripts/dependencies/install), moved out of ScriptDependenciesPanel
 * (#6365 Rule X) so Server › Scripts uses the same ones.
 */
import { useCallback, useEffect, useState } from 'react';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

export interface KindStatus {
  manifestPresent: boolean;
  installed: boolean;
  packages: string[];
}
export interface DependencyStatus {
  python: KindStatus;
  node: KindStatus;
  allowSourceBuilds: boolean;
  scriptsDir: string;
}

export function useScriptDependencies() {
  const csrfFetch = useCsrfFetch();
  const { hasPermission } = useAuth();
  // 'settings' is sourcey (Phase 6 #4416). POST /api/scripts/dependencies/install
  // declares requirePermission('settings','write') with no sourceIdFrom — one
  // script directory, install-wide — so anySource mirrors the server's union check.
  const canInstall = hasPermission('settings', 'write', { anySource: true });

  const [status, setStatus] = useState<DependencyStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const baseUrl = await apiService.getBaseUrl();
      const res = await csrfFetch(`${baseUrl}/api/scripts/dependencies`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
    } catch {
      setStatus(null);
    }
  }, [csrfFetch]);

  useEffect(() => { void load(); }, [load]);

  const install = useCallback(async () => {
    setInstalling(true);
    setError(null);
    setLog(null);
    try {
      const baseUrl = await apiService.getBaseUrl();
      const res = await csrfFetch(`${baseUrl}/api/scripts/dependencies/install`, { method: 'POST' });
      const data = await res.json();
      setLog(data.log || '');
      if (!data.success) setError(data.error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInstalling(false);
    }
  }, [csrfFetch, load]);

  return { canInstall, status, installing, log, error, install };
}
