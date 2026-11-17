/**
 * The map styles' list and actions, moved unchanged out of MapStyleManager
 * (Rule X, #6365) so the Workspace's Server › Map & tiles page uploads,
 * imports, generates, activates and deletes exactly as today. Failures go to
 * `report` (Classic passes `alert`); the delete question stays with the caller.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapStyle } from '../server/services/mapStyleService.js';
import api from '../services/api';
import { useCsrfFetch } from '../hooks/useCsrfFetch';
import { useSettings } from '../contexts/SettingsContext';

export function useMapStyles(report: (message: string) => void) {
  const { t } = useTranslation();
  const [styles, setStyles] = useState<MapStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importName, setImportName] = useState('');
  const [tileJsonUrl, setTileJsonUrl] = useState('');
  const [tileJsonName, setTileJsonName] = useState('');
  const [generatingStyle, setGeneratingStyle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csrfFetch = useCsrfFetch();
  const { activeStyleId, setActiveMapStyleId, loadMapStyles } = useSettings();

  const fetchStyles = useCallback(async () => {
    try {
      const data = await api.get<MapStyle[]>('/api/map-styles/styles');
      setStyles(data);
    } catch (err) {
      console.error('Failed to fetch map styles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStyles();
  }, [fetchStyles]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const baseUrl = await api.getBaseUrl();
      const buffer = await file.arrayBuffer();
      const response = await csrfFetch(`${baseUrl}/api/map-styles/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Filename': file.name,
        },
        body: buffer,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? t('map_style_manager.unknown_error'));
      }
      await fetchStyles();
      await loadMapStyles();
    } catch (err) {
      console.error('Failed to upload map style:', err);
      report(t('map_style_manager.upload_failed', {
        message: err instanceof Error ? err.message : t('map_style_manager.unknown_error'),
      }));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFetchUrl = async () => {
    if (!importUrl.trim()) return;
    setFetchingUrl(true);
    try {
      const baseUrl = await api.getBaseUrl();
      const response = await csrfFetch(`${baseUrl}/api/map-styles/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim(), name: importName.trim() || undefined }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? t('map_style_manager.unknown_error'));
      }
      setImportUrl('');
      setImportName('');
      await fetchStyles();
      await loadMapStyles();
    } catch (err) {
      console.error('Failed to import map style from URL:', err);
      report(t('map_style_manager.import_failed', {
        message: err instanceof Error ? err.message : t('map_style_manager.unknown_error'),
      }));
    } finally {
      setFetchingUrl(false);
    }
  };

  const handleGenerateFromTileserver = async () => {
    if (!tileJsonUrl.trim()) return;
    setGeneratingStyle(true);
    try {
      const baseUrl = await api.getBaseUrl();
      const response = await csrfFetch(`${baseUrl}/api/map-styles/generate-from-tileserver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileJsonUrl: tileJsonUrl.trim(), name: tileJsonName.trim() || undefined }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? t('map_style_manager.unknown_error'));
      }
      const { style, filename } = await response.json() as { style: object; filename: string };
      // Trigger browser download
      const blob = new Blob([JSON.stringify(style, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setTileJsonUrl('');
      setTileJsonName('');
    } catch (err) {
      console.error('Failed to generate map style from tileserver:', err);
      // The static hint is a separate key so translators get a clean sentence
      // instead of one string mixing {{message}} with literal \n\n formatting.
      const failure = t('map_style_manager.generate_failed', {
        message: err instanceof Error ? err.message : t('map_style_manager.unknown_error'),
      });
      report(`${failure}\n\n${t('map_style_manager.generate_failed_hint')}`);
    } finally {
      setGeneratingStyle(false);
    }
  };

  const updateStyle = async (id: string, updates: { name: string }) => {
    try {
      const baseUrl = await api.getBaseUrl();
      const response = await csrfFetch(`${baseUrl}/api/map-styles/styles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Update failed');
      const updated = await response.json();
      setStyles(prev => prev.map(s => s.id === id ? updated : s));
    } catch (err) {
      console.error('Failed to update map style:', err);
    }
  };

  const removeStyle = async (id: string) => {
    try {
      const baseUrl = await api.getBaseUrl();
      const response = await csrfFetch(`${baseUrl}/api/map-styles/styles/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(t('map_style_manager.unknown_error'));
      setStyles(prev => prev.filter(s => s.id !== id));
      if (activeStyleId === id) {
        // The active style just got deleted — clear the selection everywhere.
        await setActiveMapStyleId(null);
      }
      await loadMapStyles();
    } catch (err) {
      console.error('Failed to delete map style:', err);
      report(t('map_style_manager.delete_failed', {
        message: err instanceof Error ? err.message : t('map_style_manager.unknown_error'),
      }));
    }
  };

  return {
    styles, setStyles, loading, uploading, fetchingUrl, importUrl, setImportUrl, importName, setImportName,
    tileJsonUrl, setTileJsonUrl, tileJsonName, setTileJsonName, generatingStyle, fileInputRef,
    activeStyleId, setActiveMapStyleId, handleUpload, handleFetchUrl, handleGenerateFromTileserver, updateStyle, removeStyle,
  };
}
