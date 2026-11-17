/**
 * The embed profiles' list, form and actions, moved unchanged out of
 * EmbedSettings (Rule X, #6365) so the Workspace's Server › Embed page
 * creates, edits, deletes and builds the embed code exactly as today. The
 * delete question stays with the caller.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useToast } from '../ToastContainer';
import { useNumberInputScope } from '../common/numberInputScopeContext';
import { getAllTilesets } from '../../config/tilesets';
import { useSettings } from '../../contexts/SettingsContext';
import { useDashboardSources } from '../../hooks/useDashboardData';

/** Shape matching the backend EmbedProfile */
export interface EmbedProfile {
  id: string;
  name: string;
  enabled: boolean;
  channels: number[];
  tileset: string;
  defaultLat: number;
  defaultLng: number;
  defaultZoom: number;
  showTooltips: boolean;
  showPopups: boolean;
  showLegend: boolean;
  showPaths: boolean;
  showNeighborInfo: boolean;
  showTraceroutes: boolean;
  showMqttNodes: boolean;
  pollIntervalSeconds: number;
  allowedOrigins: string[];
  sourceId: string | null;
  createdAt: number;
  updatedAt: number;
}

export type ProfileFormData = Omit<EmbedProfile, 'id' | 'createdAt' | 'updatedAt'>;

export const DEFAULT_FORM: ProfileFormData = {
  name: '',
  enabled: true,
  channels: [0],
  tileset: 'osm',
  defaultLat: 0,
  defaultLng: 0,
  defaultZoom: 10,
  showTooltips: true,
  showPopups: true,
  showLegend: true,
  showPaths: false,
  showNeighborInfo: false,
  showTraceroutes: false,
  showMqttNodes: true,
  pollIntervalSeconds: 30,
  allowedOrigins: [],
  sourceId: null,
};

export function useEmbedProfiles() {
  const { t } = useTranslation();
  const csrfFetch = useCsrfFetch();
  const { showToast } = useToast();
  const { customTilesets } = useSettings();
  const { data: sources = [] } = useDashboardSources();

  const [profiles, setProfiles] = useState<EmbedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state: null = closed, 'new' = creating, string = editing that id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormData>({ ...DEFAULT_FORM });
  const numberScope = useNumberInputScope();

  // Raw text for the allowed-origins input so users can type commas freely
  const [originsText, setOriginsText] = useState('');

  // Embed-code modal
  const [copyProfileId, setCopyProfileId] = useState<string | null>(null);

  const tilesets = getAllTilesets(customTilesets);

  // ---- Data fetching ----
  const fetchProfiles = useCallback(async () => {
    try {
      const data = await apiService.get<EmbedProfile[]>('/api/embed-profiles');
      setProfiles(data);
    } catch (err) {
      showToast((err as Error).message || t('settings.embed.fetch_error', 'Failed to load embed profiles'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  // ---- Form helpers ----
  const openCreate = async () => {
    const defaults = { ...DEFAULT_FORM };

    // Try to compute centroid from active nodes so the map doesn't start at 0,0
    try {
      const nodes = await apiService.get<Array<{ latitude?: number; longitude?: number }>>('/api/nodes/active');
      const withPos = nodes.filter(
        (n) => n.latitude != null && n.longitude != null && !(n.latitude === 0 && n.longitude === 0),
      );
      if (withPos.length > 0) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const n of withPos) {
          if (n.latitude! < minLat) minLat = n.latitude!;
          if (n.latitude! > maxLat) maxLat = n.latitude!;
          if (n.longitude! < minLng) minLng = n.longitude!;
          if (n.longitude! > maxLng) maxLng = n.longitude!;
        }
        defaults.defaultLat = Math.round(((minLat + maxLat) / 2) * 1e6) / 1e6;
        defaults.defaultLng = Math.round(((minLng + maxLng) / 2) * 1e6) / 1e6;

        // Rough zoom from bounding box span
        const latSpan = maxLat - minLat;
        const lngSpan = maxLng - minLng;
        const span = Math.max(latSpan, lngSpan);
        if (span < 0.01) defaults.defaultZoom = 15;
        else if (span < 0.05) defaults.defaultZoom = 13;
        else if (span < 0.2) defaults.defaultZoom = 11;
        else if (span < 1) defaults.defaultZoom = 9;
        else if (span < 5) defaults.defaultZoom = 7;
        else defaults.defaultZoom = 5;
      }
    } catch {
      // Fall back to DEFAULT_FORM values (0,0) if node fetch fails
    }

    setForm(defaults);
    setOriginsText('');
    setEditingId('new');
  };

  const openEdit = (profile: EmbedProfile) => {
    setForm({
      name: profile.name,
      enabled: profile.enabled,
      channels: [...profile.channels],
      tileset: profile.tileset,
      defaultLat: profile.defaultLat,
      defaultLng: profile.defaultLng,
      defaultZoom: profile.defaultZoom,
      showTooltips: profile.showTooltips,
      showPopups: profile.showPopups,
      showLegend: profile.showLegend,
      showPaths: profile.showPaths,
      showNeighborInfo: profile.showNeighborInfo,
      showTraceroutes: profile.showTraceroutes,
      showMqttNodes: profile.showMqttNodes,
      pollIntervalSeconds: profile.pollIntervalSeconds,
      allowedOrigins: [...profile.allowedOrigins],
      sourceId: profile.sourceId ?? null,
    });
    setOriginsText(profile.allowedOrigins.join(', '));
    setEditingId(profile.id);
  };

  // Stable identities: useDialogA11y re-binds its Escape listener whenever
  // onClose changes, so an inline arrow would re-bind on every keystroke.
  const closeModal = useCallback(() => {
    setEditingId(null);
  }, []);
  const closeCodeModal = useCallback(() => {
    setCopyProfileId(null);
  }, []);

  const toggleChannel = (ch: number) => {
    setForm(prev => {
      const next = prev.channels.includes(ch)
        ? prev.channels.filter(c => c !== ch)
        : [...prev.channels, ch].sort((a, b) => a - b);
      return { ...prev, channels: next };
    });
  };

  // Parse origins text into a clean array
  const parseOrigins = (text: string): string[] =>
    text.split(',').map(s => s.trim()).filter(Boolean);

  // Validate a single origin (standard URL or CSP wildcard like https://*.example.com)
  const isValidOrigin = (origin: string): boolean => {
    // CSP wildcard host pattern
    const wildcardMatch = origin.match(/^(https?:\/\/)\*\.(.+)$/);
    if (wildcardMatch) {
      try {
        const testUrl = new URL(`${wildcardMatch[1]}wildcard.${wildcardMatch[2]}`);
        const reconstructed = `${testUrl.protocol}//*.${testUrl.host.replace(/^wildcard\./, '')}`;
        return reconstructed === origin;
      } catch {
        return false;
      }
    }
    try {
      const url = new URL(origin);
      return (url.protocol === 'https:' || url.protocol === 'http:') &&
        !url.hostname.includes('*') && origin === url.origin;
    } catch {
      return false;
    }
  };

  // Compute validation results for the current origins text
  const originsValidation = parseOrigins(originsText).map(origin => ({
    origin,
    valid: isValidOrigin(origin),
  }));

  // ---- CRUD ----
  const handleSave = async () => {
    // #5649: a blank or out-of-range poll interval is never saved.
    if (numberScope.invalid) return;
    if (!form.name.trim()) {
      showToast(t('settings.embed.name_required', 'Profile name is required'), 'error');
      return;
    }

    // Parse the raw origins text into the form before saving
    const payload = { ...form, allowedOrigins: parseOrigins(originsText) };

    try {
      if (editingId === 'new') {
        await apiService.post<EmbedProfile>('/api/embed-profiles', payload);
        showToast(t('settings.embed.created', 'Embed profile created'), 'success');
      } else {
        await apiService.put<EmbedProfile>(`/api/embed-profiles/${editingId}`, payload);
        showToast(t('settings.embed.updated', 'Embed profile updated'), 'success');
      }
      setEditingId(null);
      await fetchProfiles();
    } catch (err) {
      showToast((err as Error).message || t('settings.embed.save_error', 'Failed to save embed profile'), 'error');
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      const baseUrl = await apiService.getBaseUrl();
      const res = await csrfFetch(`${baseUrl}/api/embed-profiles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(err.error);
      }
      showToast(t('settings.embed.deleted', 'Embed profile deleted'), 'success');
      await fetchProfiles();
    } catch (err) {
      showToast((err as Error).message || t('settings.embed.delete_error', 'Failed to delete embed profile'), 'error');
    }
  };

  // ---- Embed code builder ----
  const [embedBaseUrl, setEmbedBaseUrl] = useState('');
  useEffect(() => {
    void apiService.getBaseUrl().then(base => setEmbedBaseUrl(base));
  }, []);

  const buildEmbedUrl = (profileId: string): string => {
    const origin = window.location.origin;
    return `${origin}${embedBaseUrl}/embed/${profileId}`;
  };

  const buildIframeSnippet = (profileId: string): string => {
    const url = buildEmbedUrl(profileId);
    return `<iframe src="${url}" width="800" height="600" frameborder="0" style="border:0" allowfullscreen></iframe>`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('settings.embed.copied', 'Copied to clipboard'), 'success');
    } catch {
      showToast(t('settings.embed.copy_failed', 'Failed to copy'), 'error');
    }
  };

  return {
    csrfFetch,
    showToast,
    customTilesets,
    sources,
    profiles,
    setProfiles,
    loading,
    setLoading,
    editingId,
    setEditingId,
    form,
    setForm,
    numberScope,
    originsText,
    setOriginsText,
    copyProfileId,
    setCopyProfileId,
    tilesets,
    fetchProfiles,
    openCreate,
    openEdit,
    closeModal,
    closeCodeModal,
    toggleChannel,
    parseOrigins,
    isValidOrigin,
    originsValidation,
    handleSave,
    deleteProfile,
    embedBaseUrl,
    setEmbedBaseUrl,
    buildEmbedUrl,
    buildIframeSnippet,
    copyToClipboard,
  };
}
