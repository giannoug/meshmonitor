/**
 * "Import from MeshCore device"'s state and actions (#5552), moved unchanged
 * out of MeshCoreChannelImport (Rule X, #6365) so the Workspace's Channel
 * database page loads the MeshCore device sources, imports one and counts
 * what was skipped exactly as today.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { useToast } from '../ToastContainer';
import { logger } from '../../utils/logger';

export interface SourceRow {
  id: string;
  name: string;
  type: string;
}

export interface ImportResult {
  imported: Array<{ id: number; name: string }>;
  skipped: Array<{ name: string; reason: 'duplicate' | 'no_secret' }>;
}

/** `open`: the dialog is showing (the source list is read on each opening). */
export function useMeshCoreChannelImport(open: boolean, onImported: () => void) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadFailed(false);
    void (async () => {
      try {
        const all = await apiService.get<SourceRow[]>('/api/sources');
        if (cancelled) return;
        // Only device sources hold channels; an MQTT ingest source has none.
        const devices = (Array.isArray(all) ? all : []).filter((s) => s.type === 'meshcore');
        setSources(devices);
        setSourceId((prev) => prev || devices[0]?.id || '');
      } catch (error) {
        logger.error('Error loading sources for MeshCore channel import:', error);
        if (!cancelled) {
          setSources([]);
          setLoadFailed(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const runImport = async () => {
    if (!sourceId) return;
    setBusy(true);
    try {
      const response = await apiService.importMeshcoreChannels(sourceId);
      setResult(response.data);
      if (response.data.imported.length > 0) onImported();
    } catch (error) {
      logger.error('Error importing MeshCore channels:', error);
      showToast(
        error instanceof Error ? error.message : t('channel_database.meshcore_import_failed', 'Import failed'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const duplicates = result?.skipped.filter((s) => s.reason === 'duplicate').length ?? 0;
  const noSecret = result?.skipped.filter((s) => s.reason === 'no_secret').length ?? 0;

  return { sources, sourceId, setSourceId, busy, result, setResult, loadFailed, runImport, duplicates, noSecret };
}
