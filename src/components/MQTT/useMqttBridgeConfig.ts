/**
 * An mqtt_bridge source's bridge setup: its state, requests and save, shared
 * by today's MqttBridgeConfigurationView and the Workspace MQTT bridge page
 * (Task 5.8, Rule X). Moved from the view unchanged.
 *
 * Loads the source config via GET /api/sources/:id (plus the source list,
 * channel database and the source's channels for name suggestions) and saves
 * the reassembled config via PUT /api/sources/:id, only when the user saves.
 * Both routes check `sources`: `canWrite` is `sources:write`. Saving
 * reconnects the upstream broker. The caller registers its own save bar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { appBasename } from '../../init';
import { logger } from '../../utils/logger';
import type { BBoxValue } from '../BBoxMapEditor';
import { useSourceStatuses } from '../../hooks/useDashboardData';
import {
  buildBridgeConfig,
  formFromBridgeConfig,
  emptyBridgeForm,
  BRIDGE_CLIENT_ID_PATTERN,
  type BridgeConfigForm,
} from './mqttBridgeConfig';
import {
  applyPresetToBridge,
  matchBridgePreset,
  type BrokerPreset,
  type KeptCredentials,
} from './brokerPresets';
import type { BrokerPresetDraft } from './SavedBrokerPresetDialogs';
import { parseBridgeUrl } from '../../utils/mqttBrokerEndpoint';

/**
 * Is a password saved for this bridge that the form does not show? The form
 * never round-trips it (an admin's GET carries it in `config`, a non-admin
 * editor's names it in `maskedConfigFields`, #5635).
 */
function hasStoredPassword(src: { config?: unknown; maskedConfigFields?: unknown } | null | undefined): boolean {
  if (isMaskedField(src, 'upstream.password')) return true;
  const pw = (src?.config as { upstream?: { password?: unknown } } | undefined)?.upstream?.password;
  return typeof pw === 'string' && pw !== '';
}

function isMaskedField(src: { maskedConfigFields?: unknown } | null | undefined, path: string): boolean {
  return Array.isArray(src?.maskedConfigFields) && src.maskedConfigFields.includes(path);
}

/**
 * Shape of the geo-filter-observability fields we read off GET
 * /api/sources/:id/status (via useSourceStatuses). Deliberately a narrow,
 * local slice — not an import of a server-side type — since the status
 * endpoint's payload crosses the client/server boundary as plain JSON.
 */
export interface GeoFilterSourceStatus {
  downlinkDrops?: { geo?: number };
  uplinkDrops?: { geo?: number };
  /** Bridge-level uplink policy drops (outside the filter chain). */
  uplinkOkToMqttDrops?: number;
  uplinkAutomationDrops?: number;
  uplinkBridgeRelayDrops?: number;
  /** #5893: uplinks dropped while the upstream connection was down. */
  uplinkDisconnectedDrops?: number;
  /** #5893: another bridge shares this parent broker + upstream in per_gateway mode. */
  sharedUpstreamWarning?: string | null;
  lastGeoSweep?: {
    timestamp: number;
    scanned: number;
    ignored: number;
    purged: number;
    lifted: number;
    durationMs: number;
  } | null;
}

export interface SourceSummary {
  id: string;
  name: string;
  type: string;
  /** Only the parent broker's gateway id is read (#5893); absent when not shown. */
  config?: { gateway?: { nodeId?: unknown } } | null;
}

/** #5893: a broker source's gateway id as `!xxxxxxxx`, or null when unknown. */
export function brokerGatewayClientId(broker: SourceSummary | undefined): string | null {
  const id = broker?.config?.gateway?.nodeId;
  if (typeof id !== 'string' || !BRIDGE_CLIENT_ID_PATTERN.test(id)) return null;
  return '!' + id.replace(/^!/, '').toLowerCase();
}

export const GEO_KEYS = ['minLat', 'maxLat', 'minLng', 'maxLng'] as const;

/** Parse the four geo string fields into a BBoxValue, or null if incomplete. */
export function bboxFromForm(g: BridgeConfigForm['geo']): BBoxValue | null {
  if (GEO_KEYS.some((k) => g[k] === '')) return null;
  const nums = {
    minLat: Number(g.minLat),
    maxLat: Number(g.maxLat),
    minLng: Number(g.minLng),
    maxLng: Number(g.maxLng),
  };
  if (Object.values(nums).some((n) => Number.isNaN(n))) return null;
  return nums;
}


/** The bridge setup of `sourceId`: see the file comment. */
export function useMqttBridgeConfig(sourceId: string) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const csrfFetch = useCsrfFetch();
  const canWrite = hasPermission('sources', 'write');

  // Read-only geo-filter observability (Phase 4 WP2) — reuses the dashboard's
  // 15s-polling status hook rather than opening a second polling loop.
  const sourceStatuses = useSourceStatuses([sourceId]);
  const geoStatus = sourceStatuses.get(sourceId) as GeoFilterSourceStatus | null | undefined;
  const downlinkGeoDrops = geoStatus?.downlinkDrops?.geo ?? 0;
  const uplinkGeoDrops = geoStatus?.uplinkDrops?.geo ?? 0;
  const lastGeoSweep = geoStatus?.lastGeoSweep ?? null;
  const uplinkOkToMqttDrops = geoStatus?.uplinkOkToMqttDrops ?? 0;
  const uplinkAutomationDrops = geoStatus?.uplinkAutomationDrops ?? 0;
  const uplinkBridgeRelayDrops = geoStatus?.uplinkBridgeRelayDrops ?? 0;
  const uplinkDisconnectedDrops = geoStatus?.uplinkDisconnectedDrops ?? 0;
  const sharedUpstreamWarning = geoStatus?.sharedUpstreamWarning ?? null;

  const [form, setForm] = useState<BridgeConfigForm>(emptyBridgeForm());
  // The form as last loaded or saved: what "unsaved changes" is measured
  // against, and what the save bar's Dismiss puts back.
  const [savedForm, setSavedForm] = useState<BridgeConfigForm>(emptyBridgeForm());
  const [brokers, setBrokers] = useState<SourceSummary[]>([]);
  const [knownChannels, setKnownChannels] = useState<string[]>([]);
  const [customChannel, setCustomChannel] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  // Raw loaded config — passed as `base` on save so any config sub-keys this
  // page doesn't render (e.g. node/portnum filters) are preserved, not wiped.
  const baseConfigRef = useRef<Record<string, unknown> | null>(null);
  const [passwordStored, setPasswordStored] = useState(false);
  const [usernameMasked, setUsernameMasked] = useState(false);
  // A saved preset (#5794) whose hidden login the server fills in on save.
  const [serverFillPreset, setServerFillPreset] = useState<BrokerPreset | null>(null);

  // Shallow patch helper for the form state.
  const patch = useCallback(
    <K extends keyof BridgeConfigForm>(key: K, value: BridgeConfigForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    void (async () => {
      try {
        const [srcRes, listRes, chDbRes, srcChRes] = await Promise.all([
          csrfFetch(`${appBasename}/api/sources/${sourceId}`),
          csrfFetch(`${appBasename}/api/sources`),
          // Global decryption channels — auto-populated with every channel name
          // any bridge observes, plus user-added rows. Best source of names.
          csrfFetch(`${appBasename}/api/channel-database`),
          // Per-source channels (sparse for bridges; populated from live traffic).
          csrfFetch(`${appBasename}/api/v1/channels?sourceId=${encodeURIComponent(sourceId)}`),
        ]);
        if (!srcRes.ok) throw new Error(`GET source failed: ${srcRes.status}`);
        const src = await srcRes.json();
        if (cancelled) return;
        baseConfigRef.current = (src?.config as Record<string, unknown>) ?? {};
        setPasswordStored(hasStoredPassword(src));
        setUsernameMasked(isMaskedField(src, 'upstream.username'));
        setForm(formFromBridgeConfig(src?.config));
        setSavedForm(formFromBridgeConfig(src?.config));
        if (listRes.ok) {
          const list: SourceSummary[] = await listRes.json();
          if (!cancelled) setBrokers(list.filter((s) => s.type === 'mqtt_broker'));
        }
        // Channel-name suggestions (best-effort — failures just yield no list).
        const names = new Set<string>();
        const collect = (body: unknown) => {
          const rows = Array.isArray(body)
            ? body
            : ((body as { data?: unknown[]; channels?: unknown[] })?.data ??
               (body as { channels?: unknown[] })?.channels ??
               []);
          for (const r of rows as Array<{ name?: unknown }>) {
            if (typeof r?.name === 'string' && r.name.trim()) names.add(r.name.trim());
          }
        };
        if (chDbRes.ok) collect(await chDbRes.json().catch(() => null));
        if (srcChRes.ok) collect(await srcChRes.json().catch(() => null));
        if (!cancelled) {
          setKnownChannels(Array.from(names).sort((a, b) => a.localeCompare(b)));
        }
      } catch (err) {
        logger.error('Failed to load bridge config:', err);
        if (!cancelled) {
          setLoadError(
            t('mqtt_bridge_config.load_error', 'Failed to load bridge configuration.'),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceId, csrfFetch, t]);

  const handleSave = useCallback(async () => {
    setSaveError('');
    setSaved(false);
    const result = buildBridgeConfig(form, { editing: true, base: baseConfigRef.current });
    if (result.error) {
      setSaveError(t(result.error.key, result.error.fallback));
      return;
    }
    // Only while the URL still reaches that preset; the server checks again.
    if (
      result.config &&
      serverFillPreset?.savedId !== undefined &&
      matchBridgePreset(form.url, [serverFillPreset])
    ) {
      result.config.upstream = { ...result.config.upstream, brokerPresetId: serverFillPreset.savedId };
    }
    setSaving(true);
    try {
      const res = await csrfFetch(`${appBasename}/api/sources/${sourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: result.config }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `PUT failed: ${res.status}`);
      }
      const updated = await res.json();
      // Re-hydrate from the server's stored config (clears the password field
      // and reflects any server-side normalization).
      baseConfigRef.current = (updated?.config as Record<string, unknown>) ?? {};
      setPasswordStored(hasStoredPassword(updated));
      setUsernameMasked(isMaskedField(updated, 'upstream.username'));
      setForm(formFromBridgeConfig(updated?.config));
      setSavedForm(formFromBridgeConfig(updated?.config));
      setServerFillPreset(null);
      setSaved(true);
    } catch (err) {
      logger.error('Failed to save bridge config:', err);
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [form, sourceId, csrfFetch, t, serverFillPreset]);

  // One section of the page's shared save bar. `hasChanges` is false until the
  // user edits a field, so opening the page or saving another section never
  // sends this form.
  const hasChanges = canWrite && !loading && !loadError
    && JSON.stringify(form) !== JSON.stringify(savedForm);
  const handleDismiss = useCallback(() => {
    setForm(savedForm);
    setSaveError('');
  }, [savedForm]);

  // Broker presets (#5689): fill URL and login only, never save by themselves,
  // and never type over or blank a stored password the form does not show.
  const applyBrokerPreset = useCallback(
    (preset: BrokerPreset): KeptCredentials => {
      const { fields, kept } = applyPresetToBridge(
        preset,
        { url: form.url, username: form.username, password: form.password },
        { passwordStored, usernameStored: usernameMasked },
      );
      setForm((prev) => ({ ...prev, ...fields }));
      setServerFillPreset(kept.serverFill ? preset : null);
      setSaved(false);
      return kept;
    },
    [form.url, form.username, form.password, passwordStored, usernameMasked],
  );

  // "Save as preset" (#5794, admins): the URL's endpoint, the login as shown,
  // and the root of a single `<root>/#` subscription.
  const getPresetDraft = useCallback((): BrokerPresetDraft | null => {
    const endpoint = parseBridgeUrl(form.url);
    if (!endpoint) return null;
    const subs = form.subscriptions.split('\n').map((x) => x.trim()).filter(Boolean);
    const root = subs.length === 1 && subs[0].endsWith('/#') ? subs[0].slice(0, -2) : '';
    return { ...endpoint, username: form.username, password: form.password, rootTopic: root };
  }, [form.url, form.subscriptions, form.username, form.password]);

  const selectedChannels = form.uplinkChannels ?? [];
  const toggleChannel = (name: string, checked: boolean) => {
    const next = new Set(selectedChannels);
    if (checked) next.add(name);
    else next.delete(name);
    patch('uplinkChannels', Array.from(next));
  };
  const addCustomChannel = () => {
    const name = customChannel.trim();
    if (name && !selectedChannels.includes(name)) {
      patch('uplinkChannels', [...selectedChannels, name]);
    }
    setCustomChannel('');
  };
  // Candidate checkboxes = known channel names ∪ anything already selected
  // (so a saved channel that's no longer "known" still shows, checked).
  const channelOptions = Array.from(new Set([...knownChannels, ...selectedChannels])).sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    canWrite,
    downlinkGeoDrops,
    uplinkGeoDrops,
    lastGeoSweep,
    uplinkOkToMqttDrops,
    uplinkAutomationDrops,
    uplinkBridgeRelayDrops,
    uplinkDisconnectedDrops,
    sharedUpstreamWarning,
    form,
    savedForm,
    brokers,
    customChannel,
    setCustomChannel,
    loading,
    loadError,
    saving,
    saveError,
    saved,
    passwordStored,
    usernameMasked,
    serverFillPreset,
    patch,
    handleSave,
    hasChanges,
    handleDismiss,
    applyBrokerPreset,
    getPresetDraft,
    selectedChannels,
    toggleChannel,
    addCustomChannel,
    channelOptions,
  };
}

export type MqttBridgeConfig = ReturnType<typeof useMqttBridgeConfig>;
