/**
 * MqttPacketMonitorView — gateway-aware packet monitor for an MQTT source
 * (`mqtt_broker` / `mqtt_bridge`).
 *
 * MQTT's defining trait is N receptions per packet (one per gateway), so the
 * backend serves a query-time deduplicated/grouped list
 * (`GET /api/sources/:id/mqtt/packets`) rather than a raw reception feed.
 * There is no live socket event for the MQTT packet log (unlike MeshCore's
 * `meshcore:ota-packet`), so this view polls on a 5s interval instead of
 * subscribing — see MQTT_PACKET_MONITOR_PHASE2_SPEC.md §3.2 for the
 * justification.
 *
 * IMPORTANT: unlike the MeshCore `/packets` routes (which return bare
 * bodies), the MQTT Phase-1 routes use the `ok(res, {...})` envelope helper,
 * so every response here is wrapped in `{ success: true, data: {...} }` and
 * must be unwrapped via `body.data` (§2 of the spec — "the envelope
 * gotcha").
 *
 * WP1 shipped the toolbar/banner/table/polling/settings shell. WP2 adds the
 * gateway multi-select filter (§4 of the spec). The packet detail modal
 * (WP3) mounts near the end of the JSX.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Filter, Trash2, Pause, Play, RefreshCw, ChevronDown, Circle, Square } from 'lucide-react';
import type { MqttGroupedPacket } from './mqttPacketTypes';
import { useMqttPacketMonitor } from './useMqttPacketMonitor';
import MqttPacketDetailModal from './MqttPacketDetailModal';
import { okToMqttState } from './okToMqttState';
import MqttOkToMqttMarker from './MqttOkToMqttMarker';
import { NumberInput } from '../common/NumberInput';
import './MqttPacketMonitor.css';

interface MqttPacketMonitorViewProps {
  baseUrl: string;
  sourceId: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

const ENCRYPTED_OUTCOME_BADGES = new Set(['encrypted', 'ignored', 'geo-ignored', 'distance', 'unsupported-portnum', 'decode-error']);

function outcomeBadgeClass(outcome: string): string {
  switch (outcome) {
    case 'encrypted':
      return 'mqpm-badge mqpm-badge-encrypted';
    case 'ignored':
      return 'mqpm-badge mqpm-badge-ignored';
    case 'geo-ignored':
      return 'mqpm-badge mqpm-badge-geo-ignored';
    case 'distance':
      return 'mqpm-badge mqpm-badge-distance';
    case 'unsupported-portnum':
    case 'decode-error':
      return 'mqpm-badge mqpm-badge-error';
    default:
      return 'mqpm-badge';
  }
}

export const MqttPacketMonitorView: React.FC<MqttPacketMonitorViewProps> = ({ baseUrl, sourceId }) => {
  const { t } = useTranslation();
  const {
    csrfFetch, canWriteSettings, canClear, prefix, nodeName, packets, total, gateways, loading, error, paused, setPaused,
    showFilters, setShowFilters, selectedGateways, encryptedFilter, setEncryptedFilter, portnumFilter, setPortnumFilter,
    enabled, maxCount, setMaxCount, maxAgeHours, setMaxAgeHours, savingSettings, load, loadGateways, saveSettings,
    handleToggleEnabled, clearLog, toggleGateway, selectAllGateways, clearGatewaySelection, renderFrom, renderTo,
  } = useMqttPacketMonitor(baseUrl, sourceId);
  const [gatewayDropdownOpen, setGatewayDropdownOpen] = useState(false);

  const [selectedPacket, setSelectedPacket] = useState<MqttGroupedPacket | null>(null);

  const gatewayDropdownRef = useRef<HTMLDivElement>(null);

  // Close the gateway dropdown when clicking outside it.
  useEffect(() => {
    if (!gatewayDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (gatewayDropdownRef.current && !gatewayDropdownRef.current.contains(event.target as Node)) {
        setGatewayDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gatewayDropdownOpen]);

  const handleClear = useCallback(async () => {
    if (!window.confirm(t('mqtt.packets.clearConfirm', 'Clear the captured MQTT packet log for this source?'))) {
      return;
    }
    await clearLog();
  }, [clearLog, t]);

  const renderType = useCallback((p: MqttGroupedPacket) => {
    const typeBadge = (p.encrypted && !p.portnumName && ENCRYPTED_OUTCOME_BADGES.has(p.ingestOutcome))
      ? <span className={outcomeBadgeClass(p.ingestOutcome)}>{p.ingestOutcome}</span>
      : <span className="mqpm-badge">{p.portnumName ?? '—'}</span>;
    // MAX(okToMqttViolation) => "at least one gateway violated" (#4114 §2(a)).
    // Only the violation state is surfaced in the list; the full four-state
    // readout lives in the detail modal.
    if (okToMqttState(p) !== 'violation') return typeBadge;
    return (
      <span className="mqpm-type-cell">
        {typeBadge}
        <MqttOkToMqttMarker state="violation" scope="packet" />
      </span>
    );
  }, []);

  return (
    <div className="mqtt-packet-monitor">
      <div className="mqpm-header">
        <h3>{t('mqtt.packets.title', 'Packet Monitor')}</h3>
        <span className="mqpm-count">
          {total > packets.length ? `${packets.length} / ${total}` : packets.length}
        </span>
        <div className="mqpm-header-controls">
          {canWriteSettings && (
            <button
              className={`mqpm-btn ${enabled ? 'mqpm-btn-danger' : ''}`}
              onClick={() => void handleToggleEnabled()}
              disabled={savingSettings}
              title={enabled
                ? t('mqtt.packets.stopCapture', 'Stop capturing')
                : t('mqtt.packets.startCapture', 'Start capturing')}
            >
              {enabled ? <Square size={14} /> : <Circle size={14} />}
            </button>
          )}
          <button
            className="mqpm-btn"
            onClick={() => setPaused(p => !p)}
            title={paused ? t('common.resume', 'Resume') : t('common.pause', 'Pause')}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            className={`mqpm-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(s => !s)}
            title={t('common.filters', 'Filters')}
          >
            <Filter size={14} />
          </button>
          <button
            className="mqpm-btn"
            onClick={() => { void load(); void loadGateways(); }}
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={14} />
          </button>
          {canClear && (
            <button className="mqpm-btn mqpm-btn-danger" onClick={() => void handleClear()} title={t('common.clear', 'Clear')}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {!enabled && (
        <div className="mqpm-disabled-banner">
          <span>
            {t('mqtt.packets.disabled', 'MQTT packet capture is off. No new packets will be recorded until you enable it.')}
            {' '}
            <span className="mqpm-banner-note">
              {t('mqtt.packets.violationsStillRecorded', 'ok_to_mqtt violation detection keeps running while capture is off — turning capture on only makes the per-packet violation badge visible here. Confirmed violations are always listed in Analysis & Reports → ok_to_mqtt violations.')}
            </span>
          </span>
          {canWriteSettings && (
            <button className="mqpm-btn" disabled={savingSettings} onClick={() => void handleToggleEnabled()}>
              {t('mqtt.packets.enable', 'Enable capture')}
            </button>
          )}
        </div>
      )}

      {showFilters && (
        <div className="mqpm-filters">
          <div className="mqpm-gateway-dropdown" ref={gatewayDropdownRef}>
            <button
              type="button"
              className={`mqpm-btn ${selectedGateways.length > 0 ? 'active' : ''}`}
              onClick={() => {
                // Refresh the gateway list on closed->open so the panel is
                // always fresh at the moment of use — new gateways appear
                // over time and mount-only loading left the list stale.
                if (!gatewayDropdownOpen) void loadGateways();
                setGatewayDropdownOpen(o => !o);
              }}
            >
              {t('mqtt.packets.gateways', 'Gateways')}
              {' '}
              ({selectedGateways.length > 0 ? selectedGateways.length : t('common.all', 'all')})
              <ChevronDown size={12} />
            </button>
            {gatewayDropdownOpen && (
              <div className="mqpm-gateway-dropdown-panel">
                <div className="mqpm-gateway-dropdown-actions">
                  <button type="button" onClick={selectAllGateways}>
                    {t('mqtt.packets.selectAll', 'Select all')}
                  </button>
                  <button type="button" onClick={clearGatewaySelection}>
                    {t('mqtt.packets.clearSelection', 'Clear')}
                  </button>
                </div>
                {gateways.length === 0 ? (
                  <div className="mqpm-gateway-option">{t('common.none', 'None')}</div>
                ) : (
                  gateways.map(gw => (
                    <label key={gw.gatewayId} className="mqpm-gateway-option">
                      <input
                        type="checkbox"
                        checked={selectedGateways.includes(gw.gatewayId)}
                        onChange={e => toggleGateway(gw.gatewayId, e.target.checked)}
                      />
                      <span>{nodeName(gw.gatewayNodeNum) ?? gw.gatewayId}</span>
                      <span className="mqpm-gateway-option-count">{gw.receptionCount}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
          <label>
            {t('mqtt.packets.encrypted', 'Encrypted')}
            <select
              value={encryptedFilter}
              onChange={e => setEncryptedFilter(e.target.value as '' | '1' | '0')}
            >
              <option value="">{t('common.all', 'All')}</option>
              <option value="1">{t('mqtt.packets.encrypted', 'Encrypted')}</option>
              <option value="0">{t('mqtt.packets.decrypted', 'Decrypted')}</option>
            </select>
          </label>
          <label>
            {t('mqtt.packets.portnum', 'Port')}
            <NumberInput
              min={0}
              integer
              allowEmpty
              value={portnumFilter === '' ? null : portnumFilter}
              onChange={v => setPortnumFilter(v === null ? '' : v)}
            />
          </label>
          {selectedGateways.length > 0 && (
            <div className="mqpm-filter-note">
              {t('mqtt.packets.gatewayCountFiltered', 'Gateway counts reflect the selected gateways only.')}
            </div>
          )}
          {canWriteSettings && (
            <>
              <label className="mqpm-toggle">
                <input type="checkbox" checked={enabled} disabled={savingSettings} onChange={() => void handleToggleEnabled()} />
                {t('mqtt.packets.captureEnabled', 'Capture enabled')}
              </label>
              <label>
                {t('mqtt.packets.maxCount', 'Max count')}
                <NumberInput
                  min={100}
                  max={50000}
                  step={100}
                  integer
                  value={maxCount}
                  onChange={setMaxCount}
                  // Saves on blur. Invalid text was never emitted, so there is
                  // nothing new to send: skip the write (#5649).
                  onBlur={e => {
                    if (e.currentTarget.dataset.numberInvalid === 'true') return;
                    void saveSettings({ mqtt_packet_log_max_count: String(maxCount) });
                  }}
                />
              </label>
              <label>
                {t('mqtt.packets.maxAgeHours', 'Max age (h)')}
                <NumberInput
                  min={1}
                  max={720}
                  integer
                  value={maxAgeHours}
                  onChange={setMaxAgeHours}
                  onBlur={e => {
                    if (e.currentTarget.dataset.numberInvalid === 'true') return;
                    void saveSettings({ mqtt_packet_log_max_age_hours: String(maxAgeHours) });
                  }}
                />
              </label>
            </>
          )}
        </div>
      )}

      {error && <div className="mqpm-error">{error}</div>}

      <div className="mqpm-table-container">
        {loading ? (
          <div className="mqpm-empty">{t('common.loading', 'Loading…')}</div>
        ) : packets.length === 0 ? (
          <div className="mqpm-empty">
            {enabled
              ? t('mqtt.packets.empty', 'No packets captured yet. Waiting for MQTT traffic…')
              : t('mqtt.packets.emptyDisabled', 'No packets captured. Enable capture to start recording.')}
            {!enabled && (
              <div className="mqpm-empty-note">
                {t('mqtt.packets.violationsStillRecorded', 'ok_to_mqtt violation detection keeps running while capture is off — turning capture on only makes the per-packet violation badge visible here. Confirmed violations are always listed in Analysis & Reports → ok_to_mqtt violations.')}
              </div>
            )}
          </div>
        ) : (
          <table className="mqpm-table">
            <thead>
              <tr>
                <th>{t('mqtt.packets.time', 'Time')}</th>
                <th>{t('mqtt.packets.from', 'From')}</th>
                <th>{t('mqtt.packets.to', 'To')}</th>
                <th>{t('mqtt.packets.type', 'Type')}</th>
                <th>{t('mqtt.packets.channel', 'Channel')}</th>
                <th
                  title={selectedGateways.length > 0
                    ? t('mqtt.packets.gatewayCountFiltered', 'Gateway counts reflect the selected gateways only.')
                    : undefined}
                >
                  {t('mqtt.packets.gatewayCount', 'Gateways')}
                </th>
                <th>{t('mqtt.packets.size', 'Size')}</th>
                <th>{t('mqtt.packets.preview', 'Preview')}</th>
              </tr>
            </thead>
            <tbody>
              {packets.map(p => {
                const key = `${p.packetId}-${p.fromNode}-${p.lastHeard}`;
                return (
                  <tr
                    key={key}
                    className="mqpm-row"
                    onClick={() => setSelectedPacket(p)}
                    title={t('mqtt.packets.clickToView', 'Click to view receptions')}
                  >
                    <td className="mqpm-mono">{formatTime(p.lastHeard)}</td>
                    <td>{renderFrom(p)}</td>
                    <td>{renderTo(p)}</td>
                    <td>{renderType(p)}</td>
                    <td>{p.channelId ?? (p.channel != null ? `#${p.channel}` : '—')}</td>
                    <td
                      className="mqpm-mono"
                      title={`${p.receptionCount} ${t('mqtt.packets.receptions', 'Receptions')}${
                        selectedGateways.length > 0 ? ` — ${t('mqtt.packets.gatewayCountFiltered', 'Gateway counts reflect the selected gateways only.')}` : ''
                      }`}
                    >
                      {p.gatewayCount}
                    </td>
                    <td className="mqpm-mono">{p.payloadSize ?? '—'}</td>
                    <td className="mqpm-mono mqpm-preview">{p.payloadPreview ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedPacket && createPortal(
        <MqttPacketDetailModal
          packet={selectedPacket}
          prefix={prefix}
          csrfFetch={csrfFetch}
          nodeName={nodeName}
          onClose={() => setSelectedPacket(null)}
        />,
        document.body
      )}
    </div>
  );
};

export default MqttPacketMonitorView;
