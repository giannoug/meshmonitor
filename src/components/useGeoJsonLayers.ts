/**
 * The GeoJSON layers' list and actions, moved unchanged out of
 * GeoJsonLayerManager (Rule X, #6365) so the Workspace's Server › Map & tiles
 * page reads and writes them exactly as today. An upload failure goes to
 * `report` (Classic passes `alert`); the delete question stays with the caller.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { GeoJsonLayer } from '../server/services/geojsonService.js';
import api from '../services/api';
import { useCsrfFetch } from '../hooks/useCsrfFetch';

export function useGeoJsonLayers(report: (message: string) => void) {
  const [layers, setLayers] = useState<GeoJsonLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csrfFetch = useCsrfFetch();

  const fetchLayers = useCallback(async () => {
    try {
      const data = await api.get<GeoJsonLayer[]>('/api/geojson/layers');
      setLayers(data);
    } catch (err) {
      console.error('Failed to fetch GeoJSON layers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLayers();
  }, [fetchLayers]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const baseUrl = await api.getBaseUrl();
      const buffer = await file.arrayBuffer();
      const response = await csrfFetch(`${baseUrl}/api/geojson/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Filename': file.name,
        },
        body: buffer,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error ?? 'Upload failed');
      }
      await fetchLayers();
    } catch (err) {
      console.error('Failed to upload GeoJSON file:', err);
      report(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateLayer = async (id: string, updates: Partial<GeoJsonLayer>) => {
    try {
      const baseUrl = await api.getBaseUrl();
      const response = await csrfFetch(`${baseUrl}/api/geojson/layers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Update failed');
      const updated = await response.json();
      setLayers(prev => prev.map(l => l.id === id ? updated : l));
    } catch (err) {
      console.error('Failed to update layer:', err);
    }
  };

  const removeLayer = async (id: string) => {
    try {
      const baseUrl = await api.getBaseUrl();
      const response = await csrfFetch(`${baseUrl}/api/geojson/layers/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');
      setLayers(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error('Failed to delete layer:', err);
    }
  };

  return { layers, setLayers, loading, uploading, fileInputRef, handleUpload, updateLayer, removeLayer };
}
