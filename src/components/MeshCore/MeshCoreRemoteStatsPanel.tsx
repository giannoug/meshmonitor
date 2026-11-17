/**
 * MeshCoreRemoteStatsPanel
 *
 * Renders the typed status snapshot returned by MeshCore's SendStatusReq
 * (wrapped by GET /admin/status/:publicKey → `getRemoteStatus`). Mounted
 * inside MeshCoreRemoteConsole once the user has an active admin session.
 *
 * On-demand only: status is fetched when the user clicks "Fetch stats" (or
 * "Refresh"). It does NOT auto-fetch on mount or poll on a timer — querying a
 * remote repeater costs radio airtime, so it's an explicit user action.
 * Failures render a soft "unavailable" state — typical when the remote
 * firmware is a Companion (which doesn't populate the full counter set) or the
 * path has gone stale since login.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeshCoreActions } from './hooks/useMeshCore';
import { useRemoteStats } from './hooks/useRemoteStats';
import { formatAirTime, formatBattery, formatNumber, formatRssi, formatSnr, formatUptime } from './remoteStatsFormat';
import './MeshCoreRemoteStatsPanel.css';
import { UiIcon } from '../icons';

interface Props {
  publicKey: string;
  /** Pulled from the same useMeshCore actions bundle the console uses. */
  fetchStatus: MeshCoreActions['getRemoteStatus'];
  /** True when this MeshCore source is in strict receive-only mode (#4547
   *  Phase 2). Plumbed here in WP1; WP3 wires the actual gating (refresh /
   *  empty-state buttons disabled, and the auto-load silently skipped). */
  receiveOnly?: boolean;
}

export const MeshCoreRemoteStatsPanel: React.FC<Props> = ({
  publicKey,
  fetchStatus,
  receiveOnly = false,
}) => {
  const { t } = useTranslation();
  const { status, loading, error, lastUpdated, load } = useRemoteStats(publicKey, fetchStatus, receiveOnly);
  const [collapsed, setCollapsed] = useState(false);

  // No auto-fetch and no polling — status is loaded only when the user asks
  // (the "Fetch stats" / "Refresh" buttons below), to avoid spending radio
  // airtime on a remote query the user didn't request.

  return (
    <section className="meshcore-remote-stats" aria-label={t('meshcore.remoteStats.title', 'Remote node status')}>
      <header
        className="mrs-header"
        onClick={() => setCollapsed((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed((v) => !v); } }}
      >
        <span className="mrs-chevron" aria-hidden="true"><UiIcon name={collapsed ? 'forward' : 'chevronDown'} size={14} /></span>
        <h4 className="mrs-title">{t('meshcore.remoteStats.title', 'Remote node status')}</h4>
        {lastUpdated !== null && !collapsed && (
          <span className="mrs-updated">
            {t('meshcore.remoteStats.updated', 'Updated {{ago}}s ago', {
              ago: Math.floor((Date.now() - lastUpdated) / 1000),
            })}
          </span>
        )}
        <button
          type="button"
          className="mrs-refresh-btn"
          onClick={(e) => { e.stopPropagation(); void load(); }}
          disabled={loading || receiveOnly}
          title={receiveOnly ? t('meshcore.receive_only.control_tooltip', 'Receive-only mode is on for this MeshCore source. Turn it off in MeshCore Settings to use this.') : undefined}
        >
          {loading
            ? t('meshcore.remoteStats.refreshing', 'Refreshing…')
            : status
              ? t('meshcore.remoteStats.refresh', 'Refresh')
              : t('meshcore.remoteStats.fetch', 'Fetch stats')}
        </button>
      </header>

      {!collapsed && (
        <div className="mrs-body">
          {error && !status && (
            <p className="mrs-error">{error}</p>
          )}
          {status && (
            <div className="mrs-grid">
              <StatField label={t('meshcore.remoteStats.uptime', 'Uptime')} value={formatUptime(status.uptimeSecs)} />
              <StatField label={t('meshcore.remoteStats.battery', 'Battery')} value={formatBattery(status.batteryMv)} />
              <StatField label={t('meshcore.remoteStats.queue', 'TX queue')} value={formatNumber(status.queueLen)} />
              <StatField label={t('meshcore.remoteStats.last_rssi', 'Last RSSI')} value={formatRssi(status.lastRssi)} />
              <StatField label={t('meshcore.remoteStats.last_snr', 'Last SNR')} value={formatSnr(status.lastSnr)} />
              <StatField label={t('meshcore.remoteStats.noise_floor', 'Noise floor')} value={formatRssi(status.noiseFloor)} />
              <StatField label={t('meshcore.remoteStats.air_time', 'Air time')} value={formatAirTime(status.airTimeSecs)} />
              <StatField label={t('meshcore.remoteStats.rx_air_time', 'RX air time')} value={formatAirTime(status.rxAirTimeSecs)} />
              <StatField label={t('meshcore.remoteStats.errors', 'Error Events')} value={formatNumber(status.errors)} />
              <StatField label={t('meshcore.remoteStats.recv_errors', 'Receive errors')} value={formatNumber(status.recvErrors)} />

              <div className="mrs-section">
                <h5>{t('meshcore.remoteStats.rx', 'Received')}</h5>
                <div className="mrs-subgrid">
                  <StatField compact label={t('meshcore.remoteStats.total', 'Total')} value={formatNumber(status.packetsRecv)} />
                  <StatField compact label={t('meshcore.remoteStats.flood', 'Flood')} value={formatNumber(status.recvFlood)} />
                  <StatField compact label={t('meshcore.remoteStats.direct', 'Direct')} value={formatNumber(status.recvDirect)} />
                  <StatField compact label={t('meshcore.remoteStats.flood_dups', 'Flood dups')} value={formatNumber(status.floodDups)} />
                  <StatField compact label={t('meshcore.remoteStats.direct_dups', 'Direct dups')} value={formatNumber(status.directDups)} />
                </div>
              </div>

              <div className="mrs-section">
                <h5>{t('meshcore.remoteStats.tx', 'Sent')}</h5>
                <div className="mrs-subgrid">
                  <StatField compact label={t('meshcore.remoteStats.total', 'Total')} value={formatNumber(status.packetsSent)} />
                  <StatField compact label={t('meshcore.remoteStats.flood', 'Flood')} value={formatNumber(status.sentFlood)} />
                  <StatField compact label={t('meshcore.remoteStats.direct', 'Direct')} value={formatNumber(status.sentDirect)} />
                </div>
              </div>
            </div>
          )}
          {loading && !status && (
            <p className="mrs-loading">{t('meshcore.remoteStats.loading', 'Loading status…')}</p>
          )}
          {!status && !loading && (
            <div className="mrs-empty">
              <p className="mrs-empty-hint">
                {t('meshcore.remoteStats.empty_hint', 'Status is not fetched automatically.')}
              </p>
              <button
                type="button"
                className="mrs-fetch-btn"
                onClick={() => void load()}
                disabled={receiveOnly}
                title={receiveOnly ? t('meshcore.receive_only.control_tooltip', 'Receive-only mode is on for this MeshCore source. Turn it off in MeshCore Settings to use this.') : undefined}
              >
                {t('meshcore.remoteStats.fetch', 'Fetch stats')}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

interface StatFieldProps {
  label: string;
  value: string;
  compact?: boolean;
}

const StatField: React.FC<StatFieldProps> = ({ label, value, compact }) => (
  <div className={`mrs-field${compact ? ' mrs-field-compact' : ''}`}>
    <span className="mrs-field-label">{label}</span>
    <span className="mrs-field-value">{value}</span>
  </div>
);
