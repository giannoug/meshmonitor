/**
 * The data of the cross-source Telemetry Dashboard's "Latest" tab (#5896),
 * shared by UnifiedTelemetryLatest and the Workspace's Overview › Telemetry
 * (#6365): the latest reading per node per source, polled every 60 s, with
 * its range, filters, sort and the per-source favorite star.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import apiService, { ApiError } from '../../services/api';
import { setTelemetryFavorite } from '../../services/telemetryFavorites';
import { type TemperatureUnit, formatTemperature, getTemperatureUnit, isTemperatureType } from '../../utils/temperature';
import { unitScale, formatDuration, isUptimeType } from '../../utils/telemetryFormat';
import type { TranslateFn } from '../../types/translate';

/** Snapshot poll interval. One batched request per poll. */
export const LATEST_POLL_MS = 60_000;

type TFn = TranslateFn;

export interface TelemetryEntry {
  nodeId: string;
  nodeNum: number;
  telemetryType: string;
  value: number;
  unit?: string | null;
  timestamp: number;
  sourceId: string;
  sourceName: string;
  nodeLongName?: string | null;
  nodeShortName?: string | null;
  /** On this source's favorites list. */
  favorited?: boolean;
  /** The caller may change this source's favorites. */
  canEditFavorite?: boolean;
}

// Compact labels for the card view. Keys must match the telemetryType values
// written by meshtasticManager — mostly camelCase, with a few legacy snake_case
// types (gps-related, snr_local/remote, estimated_*). Falls back to the raw
// type string when a label is missing.
export const TYPE_LABELS: Record<string, string> = {
  // Power / device
  batteryLevel: 'Battery',
  voltage: 'Voltage',
  current: 'Current',
  channelUtilization: 'Ch Util',
  airUtilTx: 'Air TX',
  uptimeSeconds: 'Uptime',
  // Radio
  snr: 'SNR',
  snr_local: 'SNR (local)',
  snr_remote: 'SNR (remote)',
  rssi: 'RSSI',
  linkQuality: 'Link Q',
  messageHops: 'Hops',
  // LocalStats. The five that are also plotted per-transport (#5101 Phase 3,
  // D8) carry "(Device)" here so a reader isn't left assuming this combined
  // figure and the RF/UDP/MQTT lines below it should add up.
  numOnlineNodes: 'Nodes Online (Device)',
  numTotalNodes: 'Nodes Total',
  numPacketsTx: 'Packets TX (Device)',
  numPacketsRx: 'Packets RX (Device)',
  numPacketsRxBad: 'Bad RX (Device)',
  numRxDupe: 'Dup RX (Device)',
  numTxRelay: 'TX Relay',
  numTxRelayCanceled: 'TX Relay X',
  numTxDropped: 'TX Drop',
  heapTotalBytes: 'Heap Total',
  heapFreeBytes: 'Heap Free',
  // MeshMonitor-computed per-transport traffic series (#5101 Phase 3)
  systemNodesHeardRf: 'Heard RF',
  systemNodesHeardUdp: 'Heard UDP',
  systemNodesHeardMqtt: 'Heard MQTT',
  systemPacketsRxRf: 'RX RF',
  systemPacketsRxUdp: 'RX UDP',
  systemPacketsRxMqtt: 'RX MQTT',
  // MeshCore. Other mc_* types still fall back to their raw key here; this one
  // is labelled because an MQTT ingest source has no other telemetry surface —
  // it has no local node, so the per-source Node Info page does not apply.
  mc_status_noise_floor: 'Noise Floor',
  // Environment
  temperature: 'Temp',
  humidity: 'Humidity',
  pressure: 'Pressure',
  gasResistance: 'Gas',
  iaq: 'IAQ',
  lux: 'Lux',
  whiteLux: 'White Lux',
  irLux: 'IR Lux',
  uvLux: 'UV Lux',
  windDirection: 'Wind Dir',
  windSpeed: 'Wind',
  windGust: 'Wind Gust',
  windLull: 'Wind Lull',
  rainfall1h: 'Rain 1h',
  rainfall24h: 'Rain 24h',
  soilMoisture: 'Soil Moist',
  soilTemperature: 'Soil Temp',
  radiation: 'Radiation',
  distance: 'Distance',
  weight: 'Weight',
  envVoltage: 'Env V',
  envCurrent: 'Env I',
  // Air quality
  pm10Standard: 'PM1.0',
  pm25Standard: 'PM2.5',
  pm100Standard: 'PM10',
  pm10Environmental: 'PM1.0 Env',
  pm25Environmental: 'PM2.5 Env',
  pm100Environmental: 'PM10 Env',
  particles03um: 'Part 0.3µm',
  particles05um: 'Part 0.5µm',
  particles10um: 'Part 1.0µm',
  particles25um: 'Part 2.5µm',
  particles50um: 'Part 5.0µm',
  particles100um: 'Part 10µm',
  co2: 'CO₂',
  co2Temperature: 'CO₂ Temp',
  co2Humidity: 'CO₂ RH',
  pm40Standard: 'PM4.0',
  particles40um: 'Part 4.0µm',
  particlesTps: 'Part Size',
  formFormaldehyde: 'CH₂O',
  formHumidity: 'CH₂O RH',
  formTemperature: 'CH₂O Temp',
  pmTemperature: 'PM Temp',
  pmHumidity: 'PM RH',
  pmVocIdx: 'VOC',
  pmNoxIdx: 'NOx',
  // GPS / location
  latitude: 'Lat',
  longitude: 'Lon',
  altitude: 'Alt',
  sats_in_view: 'Sats',
  ground_speed: 'Speed',
  ground_track: 'Heading',
  estimated_latitude: 'Est Lat',
  estimated_longitude: 'Est Lon',
  // Paxcounter
  paxcounterWifi: 'Pax WiFi',
  paxcounterBle: 'Pax BLE',
  paxcounterUptime: 'Pax Uptime',
  // Host metrics
  hostUptimeSeconds: 'Host Uptime',
  hostFreememBytes: 'Host Free Mem',
  hostLoad1: 'Load 1m',
  hostLoad5: 'Load 5m',
  hostLoad15: 'Load 15m',
  // MeshMonitor system
  systemNodeCount: 'Active Nodes',
  systemDirectNodeCount: 'Direct Nodes',
  timeOffset: 'Clock Δ',
};

const TYPE_UNITS: Record<string, string> = {
  batteryLevel: '%',
  voltage: 'V',
  current: 'mA',
  channelUtilization: '%',
  airUtilTx: '%',
  snr: 'dB',
  snr_local: 'dB',
  snr_remote: 'dB',
  rssi: 'dBm',
  linkQuality: '%',
  temperature: '°C',
  humidity: '%',
  pressure: 'hPa',
  gasResistance: 'MΩ',
  lux: 'lx',
  whiteLux: 'lx',
  irLux: 'lx',
  uvLux: 'lx',
  windDirection: '°',
  windSpeed: 'm/s',
  windGust: 'm/s',
  windLull: 'm/s',
  rainfall1h: 'mm',
  rainfall24h: 'mm',
  soilMoisture: '%',
  soilTemperature: '°C',
  distance: 'mm',
  weight: 'kg',
  envVoltage: 'V',
  envCurrent: 'mA',
  pm10Standard: 'µg/m³',
  pm25Standard: 'µg/m³',
  pm100Standard: 'µg/m³',
  pm10Environmental: 'µg/m³',
  pm25Environmental: 'µg/m³',
  pm100Environmental: 'µg/m³',
  // Particle counts (#/0.1L) — mirror AIR_QUALITY_UNITS so the fleet overview
  // shows a unit for every bin (previously these fell back to a blank unit).
  particles03um: '#/0.1L',
  particles05um: '#/0.1L',
  particles10um: '#/0.1L',
  particles25um: '#/0.1L',
  particles40um: '#/0.1L',
  particles50um: '#/0.1L',
  particles100um: '#/0.1L',
  co2: 'ppm',
  co2Temperature: '°C',
  co2Humidity: '%',
  pm40Standard: 'µg/m³',
  particlesTps: 'µm',
  formFormaldehyde: 'ppb',
  formHumidity: '%',
  formTemperature: '°C',
  pmTemperature: '°C',
  pmHumidity: '%',
  pmVocIdx: 'VOC',
  pmNoxIdx: 'NOx',
  latitude: '°',
  longitude: '°',
  altitude: 'm',
  ground_speed: 'km/h',
  ground_track: '°',
  estimated_latitude: '°',
  estimated_longitude: '°',
  timeOffset: 'ms',
  hostLoad1: '',
  hostLoad5: '',
  hostLoad15: '',
};

/** Fallback unit inference — ch*Voltage / ch*Current pattern. */
export function inferUnit(type: string): string {
  if (TYPE_UNITS[type] !== undefined) return TYPE_UNITS[type];
  if (/Voltage$/.test(type)) return 'V';
  if (/Current$/.test(type)) return 'mA';
  if (/Bytes$/.test(type)) return 'B';
  if (/Seconds$/.test(type)) return '';
  return '';
}

/** Human-readable byte size. */
function formatBytes(v: number): string {
  if (v >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)}M`;
  if (v >= 1024) return `${(v / 1024).toFixed(1)}K`;
  return String(Math.round(v));
}

export function formatValue(type: string, value: number): string {
  // Durations (seconds) → human-readable
  if (isUptimeType(type)) {
    return formatDuration(value);
  }
  // Bytes → KB / MB
  if (/Bytes$/.test(type)) return formatBytes(value);
  // Precision presets
  if (type === 'voltage' || /Voltage$/.test(type)) return value.toFixed(2);
  if (type === 'pressure' || type === 'temperature' || type === 'soilTemperature' ||
      type === 'co2Temperature' || type === 'humidity' || type === 'co2Humidity' ||
      type === 'snr' || type === 'snr_local' || type === 'snr_remote' || type === 'rssi' ||
      type === 'hostLoad1' || type === 'hostLoad5' || type === 'hostLoad15') {
    return value.toFixed(1);
  }
  if (type === 'latitude' || type === 'longitude' ||
      type === 'estimated_latitude' || type === 'estimated_longitude') {
    return value.toFixed(5);
  }
  // Default: 1 decimal
  return String(Math.round(value * 10) / 10);
}

/** Telemetry timestamps are stored in milliseconds (Unix ms). */
export function formatAge(timestampMs: number, t: TFn): string {
  const s = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (s < 60) return t('unified.telemetry.age_seconds', { count: s });
  if (s < 3600) return t('unified.telemetry.age_minutes', { count: Math.floor(s / 60) });
  if (s < 86400) return t('unified.telemetry.age_hours', { count: Math.floor(s / 3600) });
  return t('unified.telemetry.age_days', { count: Math.floor(s / 86400) });
}

export type HoursOption = 1 | 6 | 24 | 72 | 168;
export const HOURS_OPTIONS: HoursOption[] = [1, 6, 24, 72, 168];
export const HOURS_LABELS: Record<HoursOption, string> = { 1: '1h', 6: '6h', 24: '24h', 72: '3d', 168: '7d' };

export type SortKey = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
export const SORT_KEYS: SortKey[] = ['newest', 'oldest', 'name-asc', 'name-desc'];
export const SORT_I18N_KEY: Record<SortKey, string> = {
  newest: 'unified.telemetry.sort_newest',
  oldest: 'unified.telemetry.sort_oldest',
  'name-asc': 'unified.telemetry.sort_name_asc',
  'name-desc': 'unified.telemetry.sort_name_desc',
};

/**
 * How a card shows one reading: its label, the value as text and its unit.
 * Device temperatures arrive in Celsius and honour the unit preference;
 * current/power auto-scale; uptime renders as a duration with no unit (#3261).
 */
export function readingDisplay(r: TelemetryEntry, temperatureUnit: TemperatureUnit): { label: string; text: string; unit: string } {
  const label = TYPE_LABELS[r.telemetryType] ?? r.telemetryType;
  const isTemp = isTemperatureType(r.telemetryType);
  const rawUnit = r.unit ?? inferUnit(r.telemetryType);
  const scaled = isTemp ? null : unitScale(rawUnit, Math.abs(r.value));
  const value = isTemp
    ? formatTemperature(r.value, 'C', temperatureUnit)
    : r.value * (scaled ? scaled.factor : 1);
  const unit = isTemp
    ? getTemperatureUnit(temperatureUnit)
    : isUptimeType(r.telemetryType)
      ? ''
      : (scaled ? scaled.unit : rawUnit);
  return { label, text: formatValue(r.telemetryType, value), unit };
}

type NodeTypeMap = Record<string, TelemetryEntry>;
type SourceNodeMap = Record<string, NodeTypeMap>;

/** `onFavoritesChanged`: called after a favorite changes, so a graphs view can refetch. */
export function useUnifiedTelemetryLatest(onFavoritesChanged?: () => void) {
  const { t } = useTranslation();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [entries, setEntries] = useState<TelemetryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hours, setHours] = useState<HoursOption>(24);
  const [typeFilter, setTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  // This page renders outside SettingsProvider, so read the persisted
  // temperature-unit preference directly (same localStorage key SettingsContext uses).
  const temperatureUnit: TemperatureUnit = localStorage.getItem('temperatureUnit') === 'F' ? 'F' : 'C';

  const fetchTelemetry = useCallback(async () => {
    try {
      const data = await apiService.get<TelemetryEntry[]>(`/api/unified/telemetry?hours=${hours}`);
      setEntries(data);
      setError('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t('unified.telemetry.failed'));
      } else {
        setError(t('unified.telemetry.network_error'));
      }
    } finally {
      setLoading(false);
    }
  }, [hours, t]);

  useEffect(() => {
    setLoading(true);
    void fetchTelemetry();
    const iv = setInterval(fetchTelemetry, LATEST_POLL_MS);
    return () => clearInterval(iv);
  }, [fetchTelemetry]);

  // Full source list (unfiltered) — stable palette + dropdown options. Using
  // a ref-ish memo over `entries` only so the color assignment doesn't change
  // when the user filters by source.
  const allSources = useMemo(() => {
    const seen = new Map<string, string>(); // id → name
    for (const e of entries) if (!seen.has(e.sourceId)) seen.set(e.sourceId, e.sourceName);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);
  const sourceIds = allSources.map((s) => s.id);
  const allTypes = useMemo(
    () => Array.from(new Set(entries.map((e) => e.telemetryType))).sort(),
    [entries],
  );

  // Group entries → sourceId → nodeId → telemetryType → latest entry. Apply
  // type/source/search filters as we walk. Memoized so sort-only changes
  // don't re-scan the raw entry list.
  const searchLower = search.trim().toLowerCase();
  const bySource = useMemo(() => {
    const out: Record<string, SourceNodeMap> = {};
    for (const e of entries) {
      if (typeFilter && e.telemetryType !== typeFilter) continue;
      if (sourceFilter && e.sourceId !== sourceFilter) continue;
      if (searchLower) {
        const haystack = [e.nodeLongName, e.nodeShortName, e.nodeId, e.sourceName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(searchLower)) continue;
      }
      if (!out[e.sourceId]) out[e.sourceId] = {};
      if (!out[e.sourceId][e.nodeId]) out[e.sourceId][e.nodeId] = {};
      const cur = out[e.sourceId][e.nodeId][e.telemetryType];
      if (!cur || e.timestamp > cur.timestamp) {
        out[e.sourceId][e.nodeId][e.telemetryType] = e;
      }
    }
    return out;
  }, [entries, typeFilter, sourceFilter, searchLower]);

  // Return nodes in the order the user asked for. `first` is any reading in
  // the node's type map used to pull the node name / latest timestamp.
  const sortNodes = (nodeMap: SourceNodeMap): Array<[string, NodeTypeMap]> => {
    const arr = Object.entries(nodeMap);
    const getName = (m: NodeTypeMap): string => {
      const first = Object.values(m)[0];
      return (first?.nodeLongName || first?.nodeShortName || '').toLowerCase();
    };
    const getLatest = (m: NodeTypeMap): number =>
      Math.max(...Object.values(m).map((r) => r.timestamp));

    switch (sortKey) {
      case 'newest':
        return arr.sort((a, b) => getLatest(b[1]) - getLatest(a[1]));
      case 'oldest':
        return arr.sort((a, b) => getLatest(a[1]) - getLatest(b[1]));
      case 'name-asc':
        return arr.sort((a, b) => getName(a[1]).localeCompare(getName(b[1])));
      case 'name-desc':
        return arr.sort((a, b) => getName(b[1]).localeCompare(getName(a[1])));
    }
  };

  // Star a reading on (or off) its own source's favorites list. Optimistic:
  // the star flips at once and flips back if the save fails.
  const toggleFavorite = useCallback(async (entry: TelemetryEntry) => {
    const key = `${entry.sourceId}|${entry.nodeId}|${entry.telemetryType}`;
    const next = !entry.favorited;
    const apply = (value: boolean) => setEntries((prev) => prev.map((e) =>
      e.sourceId === entry.sourceId && e.nodeId === entry.nodeId && e.telemetryType === entry.telemetryType
        ? { ...e, favorited: value }
        : e));
    setBusyKey(key);
    apply(next);
    try {
      await setTelemetryFavorite(entry.sourceId, entry.nodeId, entry.telemetryType, next);
      onFavoritesChanged?.();
    } catch {
      apply(!next);
      setError(t('unified.telemetry.favorite_failed'));
    } finally {
      setBusyKey(null);
    }
  }, [onFavoritesChanged, t]);

  return {
    entries, loading, error, hours, setHours, typeFilter, setTypeFilter, sourceFilter, setSourceFilter, search, setSearch,
    sortKey, setSortKey, busyKey, temperatureUnit, allSources, sourceIds, allTypes, bySource, sortNodes, toggleFavorite,
    fetchTelemetry,
  };
}
