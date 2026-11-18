/**
 * Info (boards 9-08, 9-16; notes s9n2, s9n4), native at `/source/:id/info`:
 * today's read-only summary of the screen's most recent status poll
 * (ReticulumInfoView). Connection and today's mode wording (own mode reads
 * "Unknown", as today: s9n2 records the gap), the RNS and bridge versions,
 * the interface and destination counts, and each RNode's live gauges
 * (today's rows, hidden when empty). The other interfaces are listed with
 * Online / Offline, since their health figures come from RNodes only.
 * It only reads; nothing here sends.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { buildInterfaceGaugeRows } from '../../components/Reticulum/interfaceGauges';
import { useIsPhone } from '../shell/useIsPhone';
import ToolHead from '../meshcore/ToolHead';
import { useRnsRuntime } from './runtime';
import styles from './Reticulum.module.css';

export default function ReticulumInfoPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sourceId, deviceName, rns } = useRnsRuntime();
  const { status, interfaces, loading } = rns;
  const head = (
    <ToolHead
      title={t('reticulum.nav.info', 'Info')}
      subtitle={t('workspace.reticulum.info_subtitle', { device: deviceName })}
      back={{ label: t('workspace.home.tools'), to: `/source/${encodeURIComponent(sourceId)}` }}
    />
  );
  if (!status) {
    return (
      <div className={styles.page} data-phone={isPhone || undefined}>
        {head}
        <p className={styles.empty}>
          {loading ? t('reticulum.info.loading', 'Loading status…') : t('reticulum.info.no_status', 'No status available yet.')}
        </p>
      </div>
    );
  }
  const modeLabel =
    status.mode === 'attach'
      ? t('reticulum.info.mode_attach', 'Attach (shared rnsd)')
      : status.mode === 'tcp_peer'
        ? t('reticulum.info.mode_tcp_peer', 'TCP peer')
        : t('reticulum.info.mode_unknown', 'Unknown');
  const gauges = interfaces.map((iface, idx) => ({ iface, idx, rows: buildInterfaceGaugeRows(iface, t) }));
  const withGauges = gauges.filter((g) => g.rows.length > 0);
  const others = gauges.filter((g) => g.rows.length === 0);

  const group = (title: string, rows: Array<[string, ReactNode]>) => (
    <section className={styles.infoGroup}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.factsCard}>
        <dl className={styles.facts}>
          {rows.map(([k, v]) => (
            <div key={k} className={styles.fact}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {head}
      <div className={styles.infoGrid}>
        {group(t('reticulum.info.connection', 'Connection'), [
          [
            t('reticulum.info.connection', 'Connection'),
            <span key="c" className={status.connected ? styles.good : styles.muted}>
              {status.connected ? t('reticulum.status.connected', 'Connected') : t('reticulum.status.disconnected', 'Disconnected')}
            </span>,
          ],
          [t('workspace.reticulum.mode'), modeLabel],
        ])}
        {group(t('reticulum.info.versions', 'Versions'), [
          [t('reticulum.info.rns_version', 'RNS version'), status.rnsVersion ?? '—'],
          [t('reticulum.info.bridge_version', 'Bridge version'), status.bridgeVersion ?? t('reticulum.info.version_unknown', 'unknown')],
        ])}
        {group(t('reticulum.info.inventory', 'Inventory'), [
          [t('reticulum.info.interfaces', 'Interfaces'), status.interfaceCount],
          [t('reticulum.info.destinations', 'Destinations'), status.destinationCount],
        ])}
      </div>
      {interfaces.length > 0 && (
        <section className={styles.infoGroup}>
          <h2 className={styles.sectionTitle}>{t('reticulum.info.interface_status', 'Interface status')}</h2>
          <div className={styles.cardGrid}>
            {withGauges.map(({ iface, idx, rows }) => (
              <section key={iface.interfaceName} className={styles.factsCard} aria-label={iface.interfaceName}>
                <header className={styles.ifaceHead}>
                  <span className={styles.swatch} data-tone={idx % 6} aria-hidden="true" />
                  <strong>{iface.interfaceName}</strong>
                  <code className={styles.mono}>{iface.interfaceType}</code>
                  <span className={styles.pill} data-on={iface.online || undefined}>
                    {iface.online ? t('reticulum.interfaces.online', 'Online') : t('reticulum.interfaces.offline', 'Offline')}
                  </span>
                </header>
                <dl className={styles.facts}>
                  {rows.map((row) => (
                    <div key={row.key} className={styles.fact}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {others.length > 0 && (
              <section className={styles.factsCard}>
                {others.map(({ iface, idx }) => (
                  <header key={iface.interfaceName} className={styles.ifaceHead}>
                    <span className={styles.swatch} data-tone={idx % 6} data-off={!iface.online || undefined} aria-hidden="true" />
                    <span>{iface.interfaceName}</span>
                    <code className={styles.mono}>{iface.interfaceType}</code>
                    <span className={styles.pill} data-on={iface.online || undefined}>
                      {iface.online ? t('reticulum.interfaces.online', 'Online') : t('reticulum.interfaces.offline', 'Offline')}
                    </span>
                  </header>
                ))}
                <p className={styles.muted}>{t('workspace.reticulum.rnode_only')}</p>
              </section>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
