/**
 * Device-config backups for one source (#6285): the schedule (registered with
 * today's SaveBar), the saved list, create, download, restore (summary first)
 * and delete. Extracted from BackupManagementSection (Rule X) so the Workspace
 * Backup page runs the same requests, toasts and save; each caller draws its
 * own UI and asks before a delete.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiService, { ApiError } from '../../services/api';
import { useToast } from '../ToastContainer';
import { logger } from '../../utils/logger';
import { useSaveBar } from '../../hooks/useSaveBar';
import { useNumberInputScope } from '../common/numberInputScopeContext';
import { useSource } from '../../contexts/SourceContext';
import type { BackupProtocol, BackupSummaryData } from './BackupRestoreConfirmDialog';

export interface BackupFile {
  filename: string;
  timestamp: string;
  size: number;
  type: 'manual' | 'automatic';
  /** An unowned (legacy / orphaned) file; the server sends these to admins only. */
  legacy?: boolean;
}

export interface UseBackupManagementOptions {
  onBackupCreated?: () => void;
  protocol: BackupProtocol;
  /** The source to act on. undefined: the surrounding SourceContext. */
  sourceId?: string | null;
}

/** Add `sourceId` to a URL's query string when a source is selected. */
function withSource(url: string, sourceId: string | null): string {
  if (!sourceId) return url;
  return `${url}${url.includes('?') ? '&' : '?'}sourceId=${encodeURIComponent(sourceId)}`;
}

export const formatBackupSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatBackupTimestamp = (timestamp: string): string => {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
};

/**
 * The backups' state and requests without the SaveBar registration (Rule X,
 * Task 7.4): the Workspace's MeshCore Maintenance saves the schedule from its
 * own dock. `useBackupManagement` is this plus today's SaveBar registration.
 */
export function useBackupManagementState({ onBackupCreated, protocol, sourceId: sourceIdProp }: UseBackupManagementOptions) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId: contextSourceId } = useSource();
  const sourceId = sourceIdProp !== undefined ? sourceIdProp : contextSourceId;
  const [lastAuto, setLastAuto] = useState<{ at: string | null; error: string | null }>({ at: null, error: null });
  const [pendingRestore, setPendingRestore] = useState<{ filename: string; summary: BackupSummaryData } | null>(null);

  // State
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [maxBackups, setMaxBackups] = useState(7);
  const [backupTime, setBackupTime] = useState('02:00');
  const [backupList, setBackupList] = useState<BackupFile[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [saveCounter, setSaveCounter] = useState(0); // Triggers hasChanges recalculation

  // Track initial values loaded from API for change detection
  const initialValuesRef = useRef({
    autoBackupEnabled: false,
    maxBackups: 7,
    backupTime: '02:00'
  });

  // Calculate if there are unsaved changes
  // saveCounter forces recalculation after save updates initialValuesRef
  const hasChanges = useMemo(() => {
    const initial = initialValuesRef.current;
    return (
      autoBackupEnabled !== initial.autoBackupEnabled ||
      maxBackups !== initial.maxBackups ||
      backupTime !== initial.backupTime
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 saveCounter re-reads the ref after a save (moved from BackupManagementSection)
  }, [autoBackupEnabled, maxBackups, backupTime, saveCounter]);

  // Reset to initial values (for SaveBar dismiss)
  const resetChanges = useCallback(() => {
    const initial = initialValuesRef.current;
    setAutoBackupEnabled(initial.autoBackupEnabled);
    setMaxBackups(initial.maxBackups);
    setBackupTime(initial.backupTime);
  }, []);

  // Load backup settings on mount
  useEffect(() => {
    void loadBackupSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6285 reload the schedule when the source changes
  }, [sourceId]);

  const loadBackupSettings = async () => {
    try {
      const settings = await apiService.get<{
        enabled?: boolean; maxBackups?: number; backupTime?: string;
        lastAutomaticBackupAt?: string | null; lastAutomaticBackupError?: string | null;
      }>(withSource('/api/backup/settings', sourceId));
      setLastAuto({ at: settings.lastAutomaticBackupAt ?? null, error: settings.lastAutomaticBackupError ?? null });
      const enabled = settings.enabled || false;
      const max = settings.maxBackups || 7;
      const time = settings.backupTime || '02:00';
      setAutoBackupEnabled(enabled);
      setMaxBackups(max);
      setBackupTime(time);
      // Update initial values to match loaded settings
      initialValuesRef.current = {
        autoBackupEnabled: enabled,
        maxBackups: max,
        backupTime: time
      };
    } catch (error) {
      // Preserve the prior silent-ignore on a non-ok HTTP response; only a
      // genuine network/transport failure gets logged (same split as the
      // old `if (response.ok) {...}` with no else branch).
      if (error instanceof ApiError) return;
      logger.error('Error loading backup settings:', error);
    }
  };

  const handleSaveBackupSettings = async () => {
    try {
      setIsSavingSettings(true);
      await apiService.post('/api/backup/settings', {
        enabled: autoBackupEnabled,
        maxBackups,
        backupTime,
        ...(sourceId ? { sourceId } : {}),
      });

      // Update initial values to match saved settings
      initialValuesRef.current = {
        autoBackupEnabled,
        maxBackups,
        backupTime
      };
      // Trigger hasChanges recalculation
      setSaveCounter(c => c + 1);

      showToast(t('backup_management.toast_settings_saved'), 'success');
    } catch (error) {
      logger.error('Error saving backup settings:', error);
      showToast(t('backup_management.toast_settings_failed', { error: error instanceof Error ? error.message : 'Unknown error' }), 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // The scope blocks Save while a number field is blank (#5649).
  const numberScope = useNumberInputScope();

  const handleManualBackup = async () => {
    try {
      showToast(t('backup_management.toast_creating_backup'), 'info');

      // Always scoped to this section's source. When sourceId is null
      // (legacy/single-source view) the backend falls back to the primary
      // Meshtastic source, preserving existing behavior.
      const endpoint = withSource('/api/device/backup?save=true', sourceId);
      await apiService.download(endpoint, {
        defaultName: protocol === 'meshcore' ? 'meshcore-backup.yaml' : 'meshtastic-backup.yaml',
      });

      showToast(t('backup_management.toast_backup_created'), 'success');
      if (onBackupCreated) onBackupCreated();
    } catch (error) {
      logger.error('Error creating backup:', error);
      showToast(t('backup_management.toast_backup_failed', { error: error instanceof Error ? error.message : 'Unknown error' }), 'error');
    }
  };

  /** Reads the saved list; true when it loaded (a failure toasts). */
  const loadBackups = async (): Promise<boolean> => {
    try {
      setIsLoadingBackups(true);
      const backups = await apiService.get<BackupFile[]>(withSource('/api/backup/list', sourceId));
      setBackupList(backups);
      return true;
    } catch (error) {
      logger.error('Error loading backup list:', error);
      showToast(t('backup_management.toast_list_failed', { error: error instanceof Error ? error.message : 'Unknown error' }), 'error');
      return false;
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      const yamlContent = await apiService.getText(withSource(`/api/backup/download/${encodeURIComponent(filename)}`, sourceId));

      const blob = new Blob([yamlContent], { type: 'application/x-yaml' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast(t('backup_management.toast_downloaded'), 'success');
    } catch (error) {
      logger.error('Error downloading backup:', error);
      showToast(t('backup_management.toast_download_failed', { error: error instanceof Error ? error.message : 'Unknown error' }), 'error');
    }
  };

  // Step 1: fetch the no-secret summary and show it in the confirm dialog.
  const handleRestoreBackup = async (filename: string) => {
    try {
      setRestoringFilename(filename);
      const resp = await apiService.get<{ data?: BackupSummaryData }>(
        withSource(`/api/backup/summary/${encodeURIComponent(filename)}`, sourceId),
      );
      if (!resp?.data) throw new Error(t('backup_management.summary_missing'));
      setPendingRestore({ filename, summary: resp.data });
    } catch (error) {
      logger.error('Error reading backup summary:', error);
      showToast(t('backup_management.toast_restore_failed', { error: error instanceof Error ? error.message : 'Unknown error' }), 'error');
    } finally {
      setRestoringFilename(null);
    }
  };

  // Step 2: the user confirmed in the dialog.
  const confirmRestore = async () => {
    if (!pendingRestore) return;
    const { filename, summary } = pendingRestore;
    setPendingRestore(null);
    try {
      setRestoringFilename(filename);
      showToast(t('backup_management.toast_restoring'), 'info');

      // Server envelope: ok(res, result) => { success, data: { applied, failed, channels, requiresReboot } }.
      // ApiService does not unwrap `data`, so read result off the `data` field.
      const resp = await apiService.post<{ data?: { failed?: unknown[]; requiresReboot?: boolean } }>(
        `/api/backup/restore/${encodeURIComponent(filename)}`,
        { ...(sourceId ? { sourceId } : {}), ...(summary.legacy ? { confirmLegacy: true } : {}) }
      );
      const failedCount = resp?.data?.failed?.length ?? 0;
      // Only mention a reboot when the backend actually applied a change that
      // needs one. Meshtastic restarts to apply LoRa; a MeshCore radio only
      // takes a changed BLE PIN at its next boot.
      const requiresReboot = resp?.data?.requiresReboot ?? false;
      const keySuffix = protocol === 'meshcore' ? '_meshcore_boot' : '_reboot';

      if (failedCount > 0) {
        showToast(
          t(requiresReboot ? `backup_management.toast_restored_partial${keySuffix}` : 'backup_management.toast_restored_partial', { failed: failedCount }),
          'success'
        );
      } else {
        showToast(
          t(requiresReboot ? `backup_management.toast_restored${keySuffix}` : 'backup_management.toast_restored'),
          'success'
        );
      }
    } catch (error) {
      logger.error('Error restoring backup:', error);
      showToast(t('backup_management.toast_restore_failed', { error: error instanceof Error ? error.message : 'Unknown error' }), 'error');
    } finally {
      setRestoringFilename(null);
    }
  };

  /** Deletes without asking (the caller asks first), then reads the list again. */
  const deleteBackup = async (filename: string) => {
    try {
      await apiService.delete(withSource(`/api/backup/delete/${encodeURIComponent(filename)}`, sourceId));

      showToast(t('backup_management.toast_deleted'), 'success');
      // Refresh the backup list
      await loadBackups();
    } catch (error) {
      logger.error('Error deleting backup:', error);
      showToast(t('backup_management.toast_delete_failed', { error: error instanceof Error ? error.message : 'Unknown error' }), 'error');
    }
  };

  return {
    hasChanges,
    isSavingSettings,
    handleSaveBackupSettings,
    resetChanges,
    numberScope,
    lastAuto,
    autoBackupEnabled,
    setAutoBackupEnabled,
    maxBackups,
    setMaxBackups,
    backupTime,
    setBackupTime,
    backupList,
    isLoadingBackups,
    restoringFilename,
    pendingRestore,
    cancelRestore: () => setPendingRestore(null),
    handleManualBackup,
    loadBackups,
    handleDownloadBackup,
    handleRestoreBackup,
    confirmRestore,
    deleteBackup,
  };
}

/** Today's hook: the backups' state, with the schedule registered on the page's SaveBar. */
export function useBackupManagement(options: UseBackupManagementOptions) {
  const { t } = useTranslation();
  const b = useBackupManagementState(options);
  useSaveBar({
    id: 'backup-management',
    sectionName: t('backup_management.title'),
    hasChanges: b.hasChanges,
    isSaving: b.isSavingSettings,
    onSave: b.handleSaveBackupSettings,
    onDismiss: b.resetChanges,
    numberScope: b.numberScope,
  });
  return b;
}
