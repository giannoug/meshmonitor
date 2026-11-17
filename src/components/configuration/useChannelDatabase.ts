/**
 * The Channel Database's state and actions (#5552), moved unchanged out of
 * ChannelDatabaseSection (Rule X, #6365) so the Workspace's Server › Channel
 * database page runs the same requests, validation and progress read. The
 * Classic section renders exactly what it rendered before.
 */
import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import apiService, { type ChannelDatabaseEntry, type RetroactiveDecryptionProgress } from '../../services/api';
import { useToast } from '../ToastContainer';
import { logger } from '../../utils/logger';
import { normalizeChannelUrlPskToBase64, getPskBase64ByteLength } from '../../utils/channelUrl';

/**
 * Shape of a decoded channel returned by `apiService.decodeChannelUrl`
 * (mirrors `DecodedChannelSettings` on the server). `psk` may be a
 * shorthand string like `'default'` or `'simpleN'` — `normalizeChannelUrlPskToBase64`
 * converts these to a Channel-Database-compatible base64 PSK.
 */
export interface DecodedUrlChannel {
  name?: string;
  psk?: string;
  id?: number;
  role?: number;
  uplinkEnabled?: boolean;
  downlinkEnabled?: boolean;
  /** ChannelSettings.use_aead (#5248). */
  useAead?: boolean;
}

// Meshtastic Channel.Role enum (subset we render labels for).
export const ROLE_DISABLED = 0;
export const ROLE_PRIMARY = 1;
export const ROLE_SECONDARY = 2;

export interface ChannelEditState {
  id?: number;
  name: string;
  psk: string;
  description: string;
  isEnabled: boolean;
  enforceNameValidation: boolean;
  /** AES-CCM channel, firmware 2.8.1+ (#5248). Meshtastic only. */
  useAead: boolean;
  /** 'meshcore' rows hold a 16-byte MeshCore secret (#5552). */
  protocol: 'meshtastic' | 'meshcore';
}

/**
 * Check a MeshCore channel secret as typed (#5552): 32 hex characters or
 * Base64 of 16 bytes. Empty is allowed only for a `#hashtag` name, whose
 * secret the server derives from the name.
 */
export function isValidMeshcoreSecretInput(name: string, secret: string): boolean {
  const s = secret.trim();
  if (s === '') return name.trim().startsWith('#');
  if (/^[0-9a-fA-F]+$/.test(s)) return s.length === 32;
  try {
    // atob yields one character per decoded byte, so length is the byte count.
    return atob(s).length === 16;
  } catch {
    return false;
  }
}

export function useChannelDatabase(isAdmin: boolean) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [channels, setChannels] = useState<ChannelDatabaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChannel, setEditingChannel] = useState<ChannelEditState | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUrlImportModal, setShowUrlImportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [importFileContent, setImportFileContent] = useState<string>('');
  // URL-import modal state. `urlDecodedChannels` is populated after a
  // successful /api/channels/decode-url call. `urlSelectedIndexes` and
  // `urlEditedNames` track per-row include/rename overrides.
  const [urlImportInput, setUrlImportInput] = useState<string>('');
  const [urlDecodedChannels, setUrlDecodedChannels] = useState<DecodedUrlChannel[]>([]);
  const [urlSelectedIndexes, setUrlSelectedIndexes] = useState<Set<number>>(new Set());
  const [urlEditedNames, setUrlEditedNames] = useState<Record<number, string>>({});
  const [urlImportError, setUrlImportError] = useState<string | null>(null);
  const [isDecodingUrl, setIsDecodingUrl] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [decryptionProgress, setDecryptionProgress] = useState<RetroactiveDecryptionProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = channels.findIndex((ch) => ch.id === active.id);
      const newIndex = channels.findIndex((ch) => ch.id === over.id);

      // Optimistically update UI
      const newChannels = arrayMove(channels, oldIndex, newIndex);
      setChannels(newChannels);

      // Build reorder updates with new sortOrder values
      const updates = newChannels.map((ch, index) => ({
        id: ch.id,
        sortOrder: index,
      }));

      try {
        await apiService.reorderChannelDatabaseEntries(updates);
        showToast(t('channel_database.reorder_success'), 'success');
      } catch (error) {
        logger.error('Error reordering channels:', error);
        const errorMsg = error instanceof Error ? error.message : t('channel_database.reorder_error');
        showToast(errorMsg, 'error');
        // Revert on error
        void fetchChannels();
      }
    }
  };

  // Fetch channels on mount
  useEffect(() => {
    if (isAdmin) {
      void fetchChannels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 moved verbatim from ChannelDatabaseSection (Rule X)
  }, [isAdmin]);

  // Poll for decryption progress when running
  useEffect(() => {
    if (decryptionProgress?.status === 'running' || decryptionProgress?.status === 'pending') {
      const interval = setInterval(async () => {
        try {
          const response = await apiService.getRetroactiveDecryptionProgress();
          if (response.progress) {
            setDecryptionProgress(response.progress);
            if (response.progress.status === 'completed') {
              // Refresh channels to show updated decrypted counts
              void fetchChannels();
              showToast(
                t('channel_database.toast_decryption_completed', {
                  decrypted: response.progress.decrypted,
                  total: response.progress.total
                }),
                'success'
              );
            } else if (response.progress.status === 'failed') {
              // Refresh channels and show error
              void fetchChannels();
              const errorMsg = response.progress.error || t('channel_database.toast_decryption_failed');
              showToast(errorMsg, 'error');
            }
          } else if (!response.isRunning) {
            setDecryptionProgress(null);
          }
        } catch (err) {
          logger.warn('Failed to fetch decryption progress:', err);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 moved verbatim from ChannelDatabaseSection (Rule X)
  }, [decryptionProgress?.status]);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      // 'all': this page manages both protocols' entries (#5552).
      const response = await apiService.getChannelDatabaseEntries('all');
      setChannels(response.data || []);
    } catch (error) {
      logger.error('Error fetching channel database:', error);
      const errorMsg = error instanceof Error ? error.message : t('channel_database.toast_fetch_failed');
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChannel = () => {
    setEditingChannel({
      name: '',
      psk: '',
      description: '',
      isEnabled: true,
      enforceNameValidation: false,
      useAead: false,
      protocol: 'meshtastic'
    });
    setShowEditModal(true);
  };

  const handleEditChannel = (channel: ChannelDatabaseEntry) => {
    setEditingChannel({
      id: channel.id,
      name: channel.name,
      psk: channel.psk || '',
      description: channel.description || '',
      isEnabled: channel.isEnabled,
      enforceNameValidation: channel.enforceNameValidation ?? false,
      useAead: channel.useAead ?? false,
      protocol: channel.protocol === 'meshcore' ? 'meshcore' : 'meshtastic'
    });
    setShowEditModal(true);
  };

  const handleSaveChannel = async () => {
    if (!editingChannel) return;

    if (editingChannel.protocol === 'meshcore') {
      await saveMeshcoreChannel(editingChannel);
      return;
    }

    if (!editingChannel.psk.trim()) {
      showToast(t('channel_database.toast_psk_required'), 'error');
      return;
    }

    // Validate PSK length only — preserve the user's exact input. 1-byte
    // shorthand keys (e.g. `AQ==`) are stored as-is and expanded at runtime
    // by channelDecryptionService.refreshChannelCache.
    const finalPsk = editingChannel.psk;
    try {
      const pskBytes = atob(editingChannel.psk);

      if (pskBytes.length === 0) {
        showToast(t('channel_database.toast_psk_no_crypto'), 'error');
        return;
      } else if (pskBytes.length === 1) {
        // Shorthand PSK — byte 0 means "no crypto" and is not a valid stored key.
        if (pskBytes.charCodeAt(0) === 0) {
          showToast(t('channel_database.toast_psk_no_crypto'), 'error');
          return;
        }
      } else if (pskBytes.length !== 16 && pskBytes.length !== 32) {
        showToast(t('channel_database.toast_psk_invalid_length'), 'error');
        return;
      }
    } catch (_e) {
      showToast(t('channel_database.toast_psk_invalid_base64'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (editingChannel.id) {
        // Update existing
        await apiService.updateChannelDatabaseEntry(editingChannel.id, {
          name: editingChannel.name,
          psk: finalPsk,
          description: editingChannel.description || undefined,
          isEnabled: editingChannel.isEnabled,
          enforceNameValidation: editingChannel.enforceNameValidation,
          useAead: editingChannel.useAead
        });
        showToast(t('channel_database.toast_channel_updated'), 'success');
      } else {
        // Create new
        await apiService.createChannelDatabaseEntry({
          name: editingChannel.name,
          psk: finalPsk,
          description: editingChannel.description || undefined,
          isEnabled: editingChannel.isEnabled,
          enforceNameValidation: editingChannel.enforceNameValidation,
          useAead: editingChannel.useAead
        });
        showToast(t('channel_database.toast_channel_created'), 'success');

        // Check for retroactive decryption progress
        const progressResponse = await apiService.getRetroactiveDecryptionProgress();
        if (progressResponse.isRunning && progressResponse.progress) {
          setDecryptionProgress(progressResponse.progress);
        }
      }

      setShowEditModal(false);
      setEditingChannel(null);
      void fetchChannels();
    } catch (error) {
      logger.error('Error saving channel:', error);
      const errorMsg = error instanceof Error ? error.message : t('channel_database.toast_save_failed');
      showToast(errorMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Save a MeshCore virtual channel (#5552). None of the Meshtastic PSK rules
   * apply: the secret is 16 bytes, or left empty for a `#hashtag` name.
   */
  const saveMeshcoreChannel = async (entry: ChannelEditState) => {
    if (!entry.name.trim()) {
      showToast(t('channel_database.toast_name_required', 'Enter a channel name'), 'error');
      return;
    }
    if (!isValidMeshcoreSecretInput(entry.name, entry.psk)) {
      showToast(
        t('channel_database.toast_meshcore_secret_invalid', 'A MeshCore secret is 16 bytes: 32 hex characters or Base64. Leave it empty only for a #hashtag channel.'),
        'error',
      );
      return;
    }
    setIsSaving(true);
    try {
      const secret = entry.psk.trim();
      if (entry.id) {
        await apiService.updateChannelDatabaseEntry(entry.id, {
          name: entry.name.trim(),
          // Unchanged or empty secret: leave the stored one alone.
          ...(secret ? { psk: secret } : {}),
          description: entry.description || undefined,
          isEnabled: entry.isEnabled,
        });
        showToast(t('channel_database.toast_channel_updated'), 'success');
      } else {
        await apiService.createChannelDatabaseEntry({
          name: entry.name.trim(),
          psk: secret,
          description: entry.description || undefined,
          isEnabled: entry.isEnabled,
          protocol: 'meshcore',
        });
        showToast(t('channel_database.toast_channel_created'), 'success');
      }
      setShowEditModal(false);
      setEditingChannel(null);
      void fetchChannels();
    } catch (error) {
      logger.error('Error saving MeshCore channel:', error);
      const errorMsg = error instanceof Error ? error.message : t('channel_database.toast_save_failed');
      showToast(errorMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChannel = async (id: number) => {
    setIsSaving(true);
    try {
      await apiService.deleteChannelDatabaseEntry(id);
      showToast(t('channel_database.toast_channel_deleted'), 'success');
      setShowDeleteConfirm(null);
      void fetchChannels();
    } catch (error) {
      logger.error('Error deleting channel:', error);
      const errorMsg = error instanceof Error ? error.message : t('channel_database.toast_delete_failed');
      showToast(errorMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (channel: ChannelDatabaseEntry) => {
    try {
      await apiService.updateChannelDatabaseEntry(channel.id, {
        isEnabled: !channel.isEnabled
      });
      showToast(
        channel.isEnabled
          ? t('channel_database.toast_channel_disabled')
          : t('channel_database.toast_channel_enabled'),
        'success'
      );
      void fetchChannels();
    } catch (error) {
      logger.error('Error toggling channel:', error);
      const errorMsg = error instanceof Error ? error.message : t('channel_database.toast_update_failed');
      showToast(errorMsg, 'error');
    }
  };

  const handleTriggerDecryption = async (channelId: number) => {
    try {
      const response = await apiService.triggerRetroactiveDecryption(channelId);
      if (response.progress) {
        setDecryptionProgress(response.progress);
      }
      showToast(t('channel_database.toast_decryption_started'), 'success');
    } catch (error) {
      logger.error('Error triggering decryption:', error);
      const errorMsg = error instanceof Error ? error.message : t('channel_database.toast_decryption_failed');
      showToast(errorMsg, 'error');
    }
  };

  const handleGeneratePSK = () => {
    // 32 random bytes (AES-256) for Meshtastic; MeshCore secrets are 16 bytes.
    const randomBytes = new Uint8Array(editingChannel?.protocol === 'meshcore' ? 16 : 32);
    crypto.getRandomValues(randomBytes);

    // Convert to base64
    const base64Key = btoa(String.fromCharCode(...randomBytes));

    if (editingChannel) {
      setEditingChannel({ ...editingChannel, psk: base64Key });
      showToast(t('channel_database.toast_key_generated'), 'success');
    }
  };

  const handleExportChannels = () => {
    try {
      if (channels.length === 0) {
        showToast(t('channel_database.toast_export_empty'), 'error');
        return;
      }

      const exportData = channels
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ch) => ({
          name: ch.name,
          psk: ch.psk ?? '',
          description: ch.description ?? '',
          isEnabled: ch.isEnabled,
          enforceNameValidation: ch.enforceNameValidation ?? false,
          useAead: ch.useAead ?? false,
          protocol: ch.protocol === 'meshcore' ? 'meshcore' : 'meshtastic',
        }));

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `meshmonitor-channels-${timestamp}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(t('channel_database.toast_export_success', { count: exportData.length }), 'success');
    } catch (error) {
      logger.error('Error exporting channels:', error);
      const errorMsg = error instanceof Error ? error.message : t('channel_database.toast_export_failed');
      showToast(errorMsg, 'error');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleImportChannels = async () => {
    if (!importFileContent) {
      showToast(t('channel_database.toast_select_file'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      const importData = JSON.parse(importFileContent);

      // Support both single channel and array of channels
      const channelsToImport = Array.isArray(importData) ? importData : [importData];

      let imported = 0;
      for (const channelData of channelsToImport) {
        if (channelData.name && channelData.psk) {
          await apiService.createChannelDatabaseEntry({
            name: channelData.name,
            psk: channelData.psk,
            description: channelData.description,
            isEnabled: channelData.isEnabled ?? true,
            ...(channelData.protocol === 'meshcore'
              ? { protocol: 'meshcore' as const }
              : { useAead: Boolean(channelData.useAead) })
          });
          imported++;
        }
      }

      showToast(t('channel_database.toast_import_success', { count: imported }), 'success');
      setShowImportModal(false);
      setImportFileContent('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      void fetchChannels();
    } catch (error) {
      logger.error('Error importing channels:', error);
      const errorMsg = error instanceof Error ? error.message : t('channel_database.toast_import_failed');
      showToast(errorMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Reset the URL-import modal back to its initial empty state. Used both
   * on close and after a successful batch import.
   */
  const resetUrlImportState = () => {
    setUrlImportInput('');
    setUrlDecodedChannels([]);
    setUrlSelectedIndexes(new Set());
    setUrlEditedNames({});
    setUrlImportError(null);
  };

  /**
   * Decode the pasted Meshtastic URL via the existing
   * `/api/channels/decode-url` endpoint. Pre-selects all importable rows
   * (skips role=DISABLED and PSK='none' — those can't go in the
   * decryption store).
   */
  const handleDecodeUrl = async () => {
    const url = urlImportInput.trim();
    if (!url) {
      setUrlImportError(t('channel_database.toast_url_required'));
      return;
    }
    setIsDecodingUrl(true);
    setUrlImportError(null);
    try {
      const decoded = await apiService.decodeChannelUrl(url);
      const channels: DecodedUrlChannel[] = Array.isArray(decoded?.channels)
        ? decoded.channels
        : [];
      if (channels.length === 0) {
        setUrlImportError(t('channel_database.toast_url_no_channels'));
        setUrlDecodedChannels([]);
        setUrlSelectedIndexes(new Set());
        setUrlEditedNames({});
        return;
      }
      setUrlDecodedChannels(channels);
      // Pre-select rows that have a usable key — skip DISABLED and no-crypto.
      const preselected = new Set<number>();
      const names: Record<number, string> = {};
      channels.forEach((ch, idx) => {
        names[idx] = ch.name ?? '';
        const importable = ch.role !== ROLE_DISABLED && normalizeChannelUrlPskToBase64(ch.psk) !== null;
        if (importable) preselected.add(idx);
      });
      setUrlSelectedIndexes(preselected);
      setUrlEditedNames(names);
    } catch (err) {
      logger.error('Failed to decode channel URL:', err);
      const msg = err instanceof Error ? err.message : t('channel_database.toast_url_decode_failed');
      setUrlImportError(msg);
      setUrlDecodedChannels([]);
    } finally {
      setIsDecodingUrl(false);
    }
  };

  /**
   * Toggle a single row's inclusion in the import batch.
   */
  const toggleUrlChannelSelected = (idx: number) => {
    setUrlSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  /**
   * Create Channel Database rows for each selected decoded channel.
   * Per-row failures don't abort the batch — we continue and report the
   * imported / skipped / failed counts at the end.
   */
  const handleImportFromUrl = async () => {
    if (urlSelectedIndexes.size === 0) {
      showToast(t('channel_database.toast_url_no_selection'), 'error');
      return;
    }
    setIsSaving(true);
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (const idx of urlSelectedIndexes) {
        const ch = urlDecodedChannels[idx];
        if (!ch) continue;
        const psk = normalizeChannelUrlPskToBase64(ch.psk);
        if (!psk) {
          // No-crypto / unparseable PSK — nothing to store.
          skipped++;
          continue;
        }
        const name = (urlEditedNames[idx] ?? ch.name ?? '').trim()
          || t('channel_database.imported_channel_default_name', { index: idx + 1 });
        try {
          await apiService.createChannelDatabaseEntry({
            name,
            psk,
            pskLength: getPskBase64ByteLength(psk),
            description: t('channel_database.imported_from_url_description'),
            isEnabled: true,
            useAead: Boolean(ch.useAead),
          });
          imported++;
        } catch (err) {
          logger.error(`Failed to import channel ${name}:`, err);
          failed++;
        }
      }
      if (imported > 0) {
        showToast(t('channel_database.toast_url_import_success', { count: imported }), 'success');
      }
      if (failed > 0 || (imported === 0 && skipped > 0)) {
        const msg = failed > 0
          ? t('channel_database.toast_url_import_partial', { imported, failed })
          : t('channel_database.toast_url_import_all_skipped');
        showToast(msg, failed > 0 ? 'error' : 'info');
      }
      if (imported > 0) {
        await fetchChannels();
        setShowUrlImportModal(false);
        resetUrlImportState();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return t('common.never');
    return new Date(timestamp).toLocaleString();
  };

  return {
    channels,
    setChannels,
    loading,
    setLoading,
    editingChannel,
    setEditingChannel,
    showEditModal,
    setShowEditModal,
    showImportModal,
    setShowImportModal,
    showUrlImportModal,
    setShowUrlImportModal,
    showDeleteConfirm,
    setShowDeleteConfirm,
    importFileContent,
    setImportFileContent,
    urlImportInput,
    setUrlImportInput,
    urlDecodedChannels,
    setUrlDecodedChannels,
    urlSelectedIndexes,
    setUrlSelectedIndexes,
    urlEditedNames,
    setUrlEditedNames,
    urlImportError,
    setUrlImportError,
    isDecodingUrl,
    setIsDecodingUrl,
    isSaving,
    setIsSaving,
    decryptionProgress,
    setDecryptionProgress,
    fileInputRef,
    sensors,
    handleDragEnd,
    fetchChannels,
    handleAddChannel,
    handleEditChannel,
    handleSaveChannel,
    saveMeshcoreChannel,
    handleDeleteChannel,
    handleToggleEnabled,
    handleTriggerDecryption,
    handleGeneratePSK,
    handleExportChannels,
    handleFileSelect,
    handleImportChannels,
    resetUrlImportState,
    handleDecodeUrl,
    toggleUrlChannelSelected,
    handleImportFromUrl,
    formatTimestamp,
  };
}
