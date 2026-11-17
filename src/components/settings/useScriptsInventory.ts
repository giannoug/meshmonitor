/**
 * The Scripts inventory's state and requests (issue #4942, #5255), moved out of
 * ScriptsSection (#6365 Rule X) so Server › Scripts uses the same ones: the
 * inventory read, Check for updates, Update, Roll back, Save source, Import
 * and Delete, with today's endpoints, bodies and toasts.
 */
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import apiService from '../../services/api';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useToast } from '../ToastContainer';
import type { UiIconName } from '../icons';

export type ScriptTriggerType = 'auto-responder' | 'timer' | 'geofence';
export type ScriptProtocol = 'meshtastic' | 'meshcore';

export interface ScriptUsageRef {
  type: ScriptTriggerType;
  protocol: ScriptProtocol;
  sourceId: string;
  sourceName?: string;
  triggerId?: string;
  triggerName?: string;
  enabled: boolean;
}

export interface InventoryScript {
  path: string;
  filename: string;
  name?: string;
  emoji?: string;
  language: string;
  version?: string;
  author?: string;
  sizeBytes?: number;
  lastModified?: number;
  usedBy: ScriptUsageRef[];
}

export type StatusFilter = 'all' | 'used' | 'unused';

/**
 * Update status for one script (#5255). Checking reaches out to GitHub, so it
 * only happens when an admin asks, and installing is always a separate click.
 */
export interface ScriptUpdateStatus {
  filename: string;
  installedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  sourceOrigin: 'script' | 'manual' | 'gallery' | null;
  source: string | null;
  sourceUrl: string | null;
  hasBackup: boolean;
  backupVersion: string | null;
  error: string | null;
}

export const VALID_EXTENSIONS = ['.js', '.mjs', '.py', '.sh'];

export const getLanguageIcon = (language: string): UiIconName => {
  switch (language.toLowerCase()) {
    case 'shell': return 'terminal';
    case 'python':
    case 'javascript': return 'code';
    default: return 'fileCode';
  }
};

export const formatBytes = (bytes?: number): string => {
  if (bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
};

export const formatDate = (ms?: number): string => {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return '—';
  }
};

export const TRIGGER_LABEL: Record<ScriptTriggerType, string> = {
  'auto-responder': 'Auto Responder',
  timer: 'Timer',
  geofence: 'Geofence',
};

export const describeRef = (ref: ScriptUsageRef): string => {
  const kind = TRIGGER_LABEL[ref.type];
  const proto = ref.protocol === 'meshcore' ? 'MeshCore ' : '';
  const name = ref.triggerName ? ` "${ref.triggerName}"` : '';
  const source = ref.sourceName ? ` · ${ref.sourceName}` : '';
  const disabled = ref.enabled ? '' : ' (disabled)';
  return `${proto}${kind}${name}${source}${disabled}`;
};

export function useScriptsInventory(baseUrl: string) {
  const csrfFetch = useCsrfFetch();
  const { showToast } = useToast();

  const [scripts, setScripts] = useState<InventoryScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updates, setUpdates] = useState<Record<string, ScriptUpdateStatus>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [busyScript, setBusyScript] = useState<string | null>(null);
  const [sourceDraft, setSourceDraft] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchInventory = useCallback(async () => {
    try {
      // The endpoint uses the shared envelope: { success, data: { scripts } }.
      // apiService.get returns the raw body and does not unwrap `data`.
      const body = await apiService.get<{ data?: { scripts?: InventoryScript[] } }>('/api/scripts/inventory');
      setScripts(body.data?.scripts ?? []);
    } catch (error) {
      console.error('Failed to load script inventory:', error);
      showToast('Failed to load script inventory', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  // #5255: ask GitHub what each script's source publishes. Manual, never on a
  // timer, so an operator is never surprised by outbound requests.
  const handleCheckUpdates = useCallback(async () => {
    setIsChecking(true);
    try {
      // The endpoint uses the shared envelope, and apiService does not unwrap it.
      const body = await apiService.get<{ data?: { scripts?: ScriptUpdateStatus[]; checkedAt?: number } }>('/api/scripts/updates');
      const byName: Record<string, ScriptUpdateStatus> = {};
      for (const status of body.data?.scripts ?? []) byName[status.filename] = status;
      setUpdates(byName);
      setCheckedAt(body.data?.checkedAt ?? Date.now());

      const available = Object.values(byName).filter(u => u.updateAvailable).length;
      showToast(available === 0 ? 'All scripts are up to date' : `${available} update${available === 1 ? '' : 's'} available`, 'success');
    } catch (error) {
      console.error('Failed to check scripts for updates:', error);
      showToast('Failed to check scripts for updates', 'error');
    } finally {
      setIsChecking(false);
    }
  }, [showToast]);

  const handleUpdate = async (filename: string) => {
    setBusyScript(filename);
    try {
      const response = await csrfFetch(`${baseUrl}/api/scripts/${encodeURIComponent(filename)}/update`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Update failed');
      const result = body.data ?? body;
      showToast(`Updated ${filename} to v${result.newVersion ?? 'the latest version'}`, 'success');
      // The response carries this script's fresh status, so refresh one card
      // rather than re-checking every script against GitHub.
      if (result.status) setUpdates(prev => ({ ...prev, [filename]: result.status }));
      await fetchInventory();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Update failed', 'error');
    } finally {
      setBusyScript(null);
    }
  };

  const handleRollback = async (filename: string) => {
    setBusyScript(filename);
    try {
      const response = await csrfFetch(`${baseUrl}/api/scripts/${encodeURIComponent(filename)}/rollback`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Rollback failed');
      const result = body.data ?? body;
      showToast(`Restored ${filename}${result.restoredVersion ? ` to v${result.restoredVersion}` : ''}`, 'success');
      if (result.status) setUpdates(prev => ({ ...prev, [filename]: result.status }));
      await fetchInventory();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Rollback failed', 'error');
    } finally {
      setBusyScript(null);
    }
  };

  const handleSaveSource = async (filename: string) => {
    setBusyScript(filename);
    try {
      const response = await csrfFetch(`${baseUrl}/api/scripts/${encodeURIComponent(filename)}/source`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourceDraft[filename] ?? '' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Could not save that source');
      showToast(`Update source saved for ${filename}`, 'success');
      setSourceDraft(prev => ({ ...prev, [filename]: '' }));
      await handleCheckUpdates();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save that source', 'error');
    } finally {
      setBusyScript(null);
    }
  };

  const updateCount = useMemo(
    () => Object.values(updates).filter(u => u.updateAvailable).length,
    [updates]
  );
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!VALID_EXTENSIONS.includes(ext)) {
      showToast(`Unsupported file type. Allowed: ${VALID_EXTENSIONS.join(', ')}`, 'error');
      return;
    }

    setIsImporting(true);
    try {
      const body = await file.arrayBuffer();
      const response = await csrfFetch(`${baseUrl}/api/scripts/import`, {
        method: 'POST',
        headers: { 'x-filename': file.name, 'Content-Type': 'application/octet-stream' },
        body,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to import script');
      }
      showToast(`Imported ${file.name}`, 'success');
      await fetchInventory();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to import script', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = async (filename: string) => {
    setIsDeleting(filename);
    try {
      const response = await csrfFetch(`${baseUrl}/api/scripts/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete script');
      }
      showToast(`Deleted ${filename}`, 'success');
      setConfirmDelete(null);
      await fetchInventory();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete script', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const usedCount = useMemo(() => scripts.filter(s => s.usedBy.length > 0).length, [scripts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scripts.filter(s => {
      if (statusFilter === 'used' && s.usedBy.length === 0) return false;
      if (statusFilter === 'unused' && s.usedBy.length > 0) return false;
      if (!q) return true;
      return (
        s.filename.toLowerCase().includes(q) ||
        (s.name?.toLowerCase().includes(q) ?? false) ||
        (s.author?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [scripts, search, statusFilter]);

  return {
    scripts, loading, isImporting, isDeleting, confirmDelete, setConfirmDelete, search, setSearch,
    updates, isChecking, checkedAt, busyScript, sourceDraft, setSourceDraft, statusFilter, setStatusFilter,
    handleCheckUpdates, handleUpdate, handleRollback, handleSaveSource, updateCount, handleFileSelected,
    handleDelete, usedCount, filtered,
  };
}
