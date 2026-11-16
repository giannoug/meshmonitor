import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { useToast } from '../ToastContainer';
import { DeviceRole } from '../../constants/index';

// Roles that make sense to favorite for zero-hop routing.
export const SELECTABLE_ROLES = [
  DeviceRole.ROUTER,
  DeviceRole.ROUTER_LATE,
  DeviceRole.CLIENT_BASE,
  DeviceRole.REPEATER,
  DeviceRole.ROUTER_CLIENT,
];

export interface AutoFavoriteConfig {
  configured: boolean;
  enabled: boolean;
  useNeighborInfo: boolean;
  useTraceroutes: boolean;
  intervalHours: number;
  maxNeighborAgeHours: number;
  maxNewPerCycle: number;
  maxRefavoritePerCycle: number;
  eligibleRoles: number[];
  lastRunAt: number | null;
  lastNeighborRequestAt: number | null;
  assignments: Array<{
    favoriteNodeNum: number;
    discoverySource: string | null;
    firstAssignedAt: number;
    lastAssignedAt: number;
    lastAckStatus: string | null;
    lastAckAt: number | null;
  }>;
}

/**
 * The per-target auto-favorite config and its three calls (#2608), moved out
 * of AutoFavoriteManagementSection so the Workspace's Node management page
 * shares them (#6365, Rule X): the GET on target change, the PUT on Save and
 * the cycle POST on Run now, each unchanged. Asking before a run, and holding
 * Save while a number field is invalid, stay with each caller.
 */
export function useAutoFavoriteTarget(selectedNodeNum: number | null, sourceId: string | null) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [config, setConfig] = useState<AutoFavoriteConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const loadConfig = useCallback(async () => {
    if (selectedNodeNum === null || !sourceId) {
      setConfig(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiService.get<AutoFavoriteConfig>(
        `/api/admin/auto-favorite-targets/${selectedNodeNum}?sourceId=${encodeURIComponent(sourceId)}`
      );
      setConfig(data);
    } catch (err) {
      const error = err as { message?: string } | null;
      showToast(error?.message || t('auto_favorite.load_failed', 'Failed to load auto-favorite config'), 'error');
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNodeNum, sourceId, showToast, t]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const update = useCallback((patch: Partial<AutoFavoriteConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const toggleRole = useCallback((role: number) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const has = prev.eligibleRoles.includes(role);
      const eligibleRoles = has ? prev.eligibleRoles.filter((r) => r !== role) : [...prev.eligibleRoles, role];
      return { ...prev, eligibleRoles };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (selectedNodeNum === null || !sourceId || !config) return;
    setIsSaving(true);
    try {
      await apiService.put(`/api/admin/auto-favorite-targets/${selectedNodeNum}`, {
        sourceId,
        enabled: config.enabled,
        useNeighborInfo: config.useNeighborInfo,
        useTraceroutes: config.useTraceroutes,
        intervalHours: config.intervalHours,
        maxNeighborAgeHours: config.maxNeighborAgeHours,
        maxNewPerCycle: config.maxNewPerCycle,
        maxRefavoritePerCycle: config.maxRefavoritePerCycle,
        eligibleRoles: config.eligibleRoles,
      });
      showToast(t('auto_favorite.saved', 'Auto-favorite settings saved'), 'success');
      await loadConfig();
    } catch (err) {
      const error = err as { message?: string } | null;
      showToast(error?.message || t('auto_favorite.save_failed', 'Failed to save auto-favorite settings'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [selectedNodeNum, sourceId, config, showToast, t, loadConfig]);

  const handleRunNow = useCallback(async () => {
    if (selectedNodeNum === null || !sourceId) return;
    setIsRunning(true);
    try {
      const result = await apiService.post<{ ran: boolean; reason?: string; discoveredNeighbors: number; newlyFavorited: number[]; reFavorited: number[] }>(
        `/api/admin/auto-favorite-targets/${selectedNodeNum}/run`,
        { sourceId }
      );
      if (!result.ran) {
        showToast(t('auto_favorite.run_skipped', 'Cycle skipped: {{reason}}', { reason: result.reason || 'unknown' }), 'error');
      } else {
        showToast(
          t('auto_favorite.run_done', 'Cycle complete: {{new}} new, {{re}} re-favorited ({{found}} neighbors found)', {
            new: result.newlyFavorited.length,
            re: result.reFavorited.length,
            found: result.discoveredNeighbors,
          }),
          'success'
        );
      }
      await loadConfig();
    } catch (err) {
      const error = err as { message?: string } | null;
      showToast(error?.message || t('auto_favorite.run_failed', 'Failed to run auto-favorite cycle'), 'error');
    } finally {
      setIsRunning(false);
    }
  }, [selectedNodeNum, sourceId, showToast, t, loadConfig]);

  return { config, isLoading, isSaving, isRunning, update, toggleRole, handleSave, handleRunNow };
}

