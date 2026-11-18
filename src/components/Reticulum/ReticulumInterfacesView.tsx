/**
 * ReticulumInterfacesView — per-interface card grid for a Reticulum source
 * (#3960 Phase 1b WP4).
 *
 * R1 (build spec §0, "interface gauges DESCOPE"): renders ONLY the fields
 * Phase 1a actually persists on `reticulum_interfaces` — name, type,
 * status/online, bitrate, and cumulative tx/rx byte counters. Airtime,
 * channel load, noise floor, and battery are Phase-3 (`own` mode) LoRa
 * columns that don't exist on this table yet and must NOT be pulled
 * forward.
 *
 * The tx/rx-rate indicator on each card is derived client-side (build spec
 * §3a: "a small tx/rx-rate indicator if derivable") from the delta between
 * two consecutive polls of the cumulative byte counters — there is no
 * server-persisted rate field in 1b. It renders only once a second sample
 * has arrived for that interface; the first sample has nothing to diff
 * against.
 *
 * Below the cards, mounts the shared per-source `Dashboard` (mirroring
 * `MeshCoreTelemetryView`'s exact prop set) against
 * `reticulumDashboardSource` for the `reticulum_iface_tx_rate` /
 * `reticulum_iface_rx_rate` telemetry history persisted server-side.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import Dashboard from '../Dashboard/Dashboard';
import { reticulumDashboardSource } from '../Dashboard/dataSources';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon } from '../icons';
import type { ReticulumInterfaceRow } from '../../types/reticulum';
import { formatBytes, formatRate, useDerivedRates } from './interfaceRates';
import styles from './ReticulumInterfacesView.module.css';

interface ReticulumInterfacesViewProps {
  interfaces: ReticulumInterfaceRow[];
  baseUrl: string;
  sourceId: string;
  loading?: boolean;
}

export const ReticulumInterfacesView: React.FC<ReticulumInterfacesViewProps> = ({
  interfaces,
  baseUrl,
  sourceId: _sourceId,
  loading,
}) => {
  const { t } = useTranslation();
  const { temperatureUnit, telemetryVisualizationHours, favoriteTelemetryStorageDays } = useSettings();
  const { hasPermission } = useAuth();
  const rates = useDerivedRates(interfaces);

  return (
    <div className={styles.view} data-testid="reticulum-interfaces-view">
      {loading && interfaces.length === 0 ? (
        <div className={styles.empty}>{t('reticulum.interfaces.loading', 'Loading interfaces…')}</div>
      ) : interfaces.length === 0 ? (
        <div className={styles.empty}>{t('reticulum.interfaces.empty', 'No interfaces reported yet.')}</div>
      ) : (
        <div className={styles.cardGrid} data-testid="reticulum-interfaces-grid">
          {interfaces.map((iface) => {
            const rate = rates.get(iface.interfaceName);
            return (
              <section
                key={iface.interfaceName}
                className={styles.card}
                data-testid={`reticulum-interface-card-${iface.interfaceName}`}
              >
                <header className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <UiIcon name="network" size={16} />
                    <span className={styles.cardName}>{iface.interfaceName}</span>
                  </div>
                  <span
                    className={`${styles.chip} ${iface.online ? styles.chipOnline : styles.chipOffline}`}
                    data-testid={`reticulum-interface-chip-${iface.interfaceName}`}
                  >
                    <UiIcon name={iface.online ? 'statusOn' : 'statusOff'} size={12} />
                    {iface.online
                      ? t('reticulum.interfaces.online', 'Online')
                      : t('reticulum.interfaces.offline', 'Offline')}
                  </span>
                </header>

                <div className={styles.cardMeta}>
                  <span>{iface.interfaceType ?? t('reticulum.interfaces.unknown_type', 'Unknown type')}</span>
                  <span className={styles.statusText}>{iface.status}</span>
                </div>

                <dl className={styles.statGrid}>
                  <div className={styles.stat}>
                    <dt>
                      <UiIcon name="zap" size={13} />
                      {t('reticulum.interfaces.bitrate', 'Bitrate')}
                    </dt>
                    <dd>
                      {iface.bitrate != null
                        ? t('reticulum.interfaces.bitrate_value', '{{value}} bps', { value: iface.bitrate.toLocaleString() })
                        : '—'}
                    </dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>
                      <UiIcon name="upload" size={13} />
                      {t('reticulum.interfaces.tx_total', 'TX total')}
                    </dt>
                    <dd>{formatBytes(iface.txBytes)}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt>
                      <UiIcon name="download" size={13} />
                      {t('reticulum.interfaces.rx_total', 'RX total')}
                    </dt>
                    <dd>{formatBytes(iface.rxBytes)}</dd>
                  </div>
                </dl>

                <div className={styles.rateRow} data-testid={`reticulum-interface-rate-${iface.interfaceName}`}>
                  {rate ? (
                    <>
                      <span className={styles.rateItem}>
                        <UiIcon name="upload" size={12} />
                        {formatRate(rate.txRate)}
                      </span>
                      <span className={styles.rateItem}>
                        <UiIcon name="download" size={12} />
                        {formatRate(rate.rxRate)}
                      </span>
                    </>
                  ) : (
                    <span className={styles.rateUnavailable}>
                      {t('reticulum.interfaces.rate_pending', 'Rate pending next poll…')}
                    </span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className={styles.history}>
        <Dashboard
          baseUrl={baseUrl}
          dataSource={reticulumDashboardSource}
          temperatureUnit={temperatureUnit}
          telemetryHours={telemetryVisualizationHours}
          favoriteTelemetryStorageDays={favoriteTelemetryStorageDays}
          canEdit={hasPermission('dashboard', 'write')}
        />
      </div>
    </div>
  );
};

export default ReticulumInterfacesView;
