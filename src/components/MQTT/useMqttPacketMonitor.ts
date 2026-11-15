/**
 * The state and data of an MQTT source's packet monitor (#4114), shared by
 * MqttPacketMonitorView and the Workspace's MQTT receptions page (#6365):
 * the grouped packet list (5 s poll, skipped while paused), the gateway list,
 * filters (kept in this browser), capture settings (`mqtt_packet_log_*`,
 * settings:write; server-side logging only, it sends nothing on the mesh) and
 * clearing the log. `prefix` is the routes' base,
 * `${baseUrl}/api/sources/:id/mqtt/packets`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useAuth } from '../../contexts/AuthContext';
import { useNodes } from '../../hooks/useServerData';
import type { MqttGroupedPacket, MqttGateway } from './mqttPacketTypes';

const BROADCAST_NODE_NUM = 0xffffffff;

// Safe JSON parse helper — mirrors PacketMonitorPanel.tsx's localStorage guard.
const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse JSON from localStorage:', error);
    return fallback;
  }
};

export function useMqttPacketMonitor(baseUrl: string, sourceId: string) {
  const { t } = useTranslation();
  const csrfFetch = useCsrfFetch();
  const { hasPermission } = useAuth();
  const { nodes } = useNodes();

  // 'settings' is sourcey (Phase 6 #4416). Deviates from the PHASE6 spec §5.3
  // table's suggested `{ sourceId }` default: verified that saveSettings()
  // below POSTs `mqtt_packet_log_enabled` to /api/settings with no sourceId
  // query param, and the backend reads it via a plain getSettingAsync()
  // (mqttPacketLogService.ts) — it is a genuinely global, not per-source,
  // setting, and this component never calls useSource() (sourceId arrives
  // as a prop). anySource mirrors the unscoped write it actually gates.
  const canWriteSettings = hasPermission('settings', 'write', { anySource: true });
  const canClear = hasPermission('packetmonitor', 'write');

  const prefix = `${baseUrl}/api/sources/${encodeURIComponent(sourceId)}/mqtt/packets`;

  const nodeName = useCallback((n: number | null): string | null => {
    if (n === null) return null;
    const node = nodes.find(node => node.nodeNum === n);
    if (!node) return null;
    return node.user?.longName || node.user?.shortName || `Node ${n}`;
  }, [nodes]);

  const [packets, setPackets] = useState<MqttGroupedPacket[]>([]);
  const [total, setTotal] = useState(0);
  const [gateways, setGateways] = useState<MqttGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [showFilters, setShowFilters] = useState(() =>
    safeJsonParse(localStorage.getItem('mqttPacketMonitor.showFilters'), false)
  );
  const [selectedGateways, setSelectedGateways] = useState<string[]>(() =>
    safeJsonParse<string[]>(localStorage.getItem('mqttPacketMonitor.selectedGateways'), [])
  );
  const [encryptedFilter, setEncryptedFilter] = useState<'' | '1' | '0'>(() =>
    safeJsonParse<'' | '1' | '0'>(localStorage.getItem('mqttPacketMonitor.encryptedFilter'), '')
  );
  const [portnumFilter, setPortnumFilter] = useState<number | ''>(() =>
    safeJsonParse<number | ''>(localStorage.getItem('mqttPacketMonitor.portnumFilter'), '')
  );

  const [enabled, setEnabled] = useState(false);
  const [maxCount, setMaxCount] = useState(5000);
  const [maxAgeHours, setMaxAgeHours] = useState(24);
  const [savingSettings, setSavingSettings] = useState(false);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const hasLoadedOnceRef = useRef(false);
  // Persist filter/UI state to localStorage.
  useEffect(() => {
    localStorage.setItem('mqttPacketMonitor.showFilters', JSON.stringify(showFilters));
  }, [showFilters]);
  useEffect(() => {
    localStorage.setItem('mqttPacketMonitor.selectedGateways', JSON.stringify(selectedGateways));
  }, [selectedGateways]);
  useEffect(() => {
    localStorage.setItem('mqttPacketMonitor.encryptedFilter', JSON.stringify(encryptedFilter));
  }, [encryptedFilter]);
  useEffect(() => {
    localStorage.setItem('mqttPacketMonitor.portnumFilter', JSON.stringify(portnumFilter));
  }, [portnumFilter]);

  const load = useCallback(async () => {
    // Only show the full-page spinner on the very first load — subsequent
    // polls/refetches update the table in place.
    if (!hasLoadedOnceRef.current) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedGateways.length) params.set('gateways', selectedGateways.join(','));
      if (encryptedFilter !== '') params.set('encrypted', encryptedFilter);
      if (portnumFilter !== '') params.set('portnum', String(portnumFilter));
      // Don't send an explicit limit: let the server apply the configured
      // mqtt_packet_log_max_count as the effective page size.
      const res = await csrfFetch(`${prefix}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const payload = body.data ?? body; // MQTT routes always wrap in {success,data}
      setPackets(Array.isArray(payload.packets) ? payload.packets : []);
      if (typeof payload.total === 'number') setTotal(payload.total);
      if (typeof payload.enabled === 'boolean') setEnabled(payload.enabled);
      if (typeof payload.maxCount === 'number') setMaxCount(payload.maxCount);
      if (typeof payload.maxAgeHours === 'number') setMaxAgeHours(payload.maxAgeHours);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packets');
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [csrfFetch, prefix, selectedGateways, encryptedFilter, portnumFilter]);

  const loadGateways = useCallback(async () => {
    try {
      const res = await csrfFetch(`${prefix}/gateways`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const payload = body.data ?? body;
      const list: MqttGateway[] = Array.isArray(payload.gateways) ? payload.gateways : [];
      list.sort((a, b) => b.receptionCount - a.receptionCount);
      setGateways(list);
    } catch {
      // Non-fatal: the gateway filter simply stays empty.
      setGateways([]);
    }
  }, [csrfFetch, prefix]);

  // Initial load + reload whenever a filter changes.
  useEffect(() => {
    void load();
  }, [load]);

  // Gateway list: fetch once on mount (and available to be refreshed
  // alongside manual refresh by WP2's dropdown control).
  useEffect(() => {
    void loadGateways();
  }, [loadGateways]);

  // Poll every 5s; skip the tick while paused. No socket event exists for
  // the MQTT packet log (unlike MeshCore's meshcore:ota-packet).
  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current) void load();
    }, 5000);
    return () => clearInterval(id);
  }, [load]);

  const saveSettings = useCallback(async (patch: Record<string, string>): Promise<boolean> => {
    setSavingSettings(true);
    try {
      const res = await csrfFetch(`${baseUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      return false;
    } finally {
      setSavingSettings(false);
    }
  }, [csrfFetch, baseUrl]);

  const handleToggleEnabled = useCallback(async () => {
    // Commit the toggle only after the save succeeds, so a failed POST leaves
    // the control showing the real capture state instead of an optimistic lie.
    const next = !enabled;
    if (await saveSettings({ mqtt_packet_log_enabled: next ? '1' : '0' })) {
      setEnabled(next);
    }
  }, [enabled, saveSettings]);

  const clearLog = useCallback(async () => {
    try {
      const res = await csrfFetch(prefix, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPackets([]);
      setTotal(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear packets');
    }
  }, [csrfFetch, prefix]);

  const toggleGateway = useCallback((gatewayId: string, checked: boolean) => {
    setSelectedGateways(prev => (
      checked ? [...prev, gatewayId] : prev.filter(id => id !== gatewayId)
    ));
  }, []);

  const selectAllGateways = useCallback(() => {
    setSelectedGateways(gateways.map(g => g.gatewayId));
  }, [gateways]);

  const clearGatewaySelection = useCallback(() => {
    setSelectedGateways([]);
  }, []);

  const renderFrom = useCallback((p: MqttGroupedPacket): string => {
    return nodeName(p.fromNode) ?? p.fromNodeId ?? '—';
  }, [nodeName]);

  const renderTo = useCallback((p: MqttGroupedPacket): string => {
    if (p.toNode === BROADCAST_NODE_NUM || p.toNodeId === '!ffffffff') {
      return t('common.broadcast', 'Broadcast');
    }
    return nodeName(p.toNode) ?? p.toNodeId ?? '—';
  }, [nodeName, t]);

  return {
    csrfFetch, canWriteSettings, canClear, prefix, nodeName, packets, total, gateways, loading, error, paused, setPaused,
    showFilters, setShowFilters, selectedGateways, encryptedFilter, setEncryptedFilter, portnumFilter, setPortnumFilter,
    enabled, maxCount, setMaxCount, maxAgeHours, setMaxAgeHours, savingSettings, load, loadGateways, saveSettings,
    handleToggleEnabled, clearLog, toggleGateway, selectAllGateways, clearGatewaySelection, renderFrom, renderTo,
  };
}
