/**
 * Message Route (boards 8-02, 8-24; today's MeshCoreMessageRouteModal): for a
 * received MeshCore message, From, Time, Hops, Scope and the text, then the
 * route resolved from its path hashes (hash width, one row per relay, guesses
 * from other sources marked as today) and the packet flow on a map when every
 * relay has a position. A panel beside the thread on desktop, a bottom sheet on
 * the phone. Reading it sends nothing (the cross-source name lookup is a
 * MeshMonitor request, as today).
 */
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { RouteFlowMap } from '../../components/map/RouteFlowMap';
import { RouteHopRows } from '../../components/MeshCore/MeshCoreRouteHops';
import { routeFlowPoints, useResolvedRouteHops } from '../../components/MeshCore/useResolvedRouteHops';
import { darkOverlayColors } from '../../config/overlayColors';
import { parsePathHops } from '../../utils/meshcorePath';
import { meshcoreDisplayTimeMs } from '../../utils/meshcoreMessageTime';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import { useMeshCoreRuntime } from './runtime';
import type { McRow } from './MeshCoreThread';
import '../../components/MeshCore/MeshCorePacketMonitor.css';
import styles from './RouteDetails.module.css';

export default function RouteDetails({ row, onClose }: { row: McRow; onClose(): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sourceId, meshCore } = useMeshCoreRuntime();
  const m = row.message;
  const contacts = meshCore.contacts;
  const hops = useMemo(() => parsePathHops(m.routePath), [m.routePath]);
  const { rows, width } = useResolvedRouteHops(hops, sourceId, contacts);
  const flow = useMemo(
    () => routeFlowPoints(rows, contacts, m.fromPublicKey, row.name, t('meshcore.route_detail_you', 'You')),
    [rows, contacts, m.fromPublicKey, row.name, t],
  );
  const scope = m.scopeName
    ? m.scopeName
    : typeof m.scopeCode === 'number' && m.scopeCode !== 0
      ? `#${m.scopeCode.toString(16).padStart(4, '0')}`
      : '—';
  const title = t('meshcore.route_detail_title', 'Message Route');
  const fact = (label: string, value: ReactNode, mono = false) => (
    <div className={styles.fact}>
      <dt className={styles.label}>{label}</dt>
      <dd className={mono ? `${styles.value} ${styles.mono}` : styles.value}>{value}</dd>
    </div>
  );
  const body = (
    <div className={styles.body} data-phone={isPhone || undefined}>
      {m.text && <p className={styles.quote}>{t('workspace.meshcore.quoted', { text: m.text })}</p>}
      <dl className={styles.facts}>
        {fact(t('meshcore.route_detail_from', 'From'), row.name)}
        {fact(t('meshcore.route_detail_time', 'Time'), new Date(meshcoreDisplayTimeMs(m)).toLocaleTimeString(), true)}
        {fact(t('meshcore.route_detail_hops', 'Hops'), typeof m.hopCount === 'number' ? m.hopCount : '—', true)}
        {fact(t('meshcore.route_detail_scope', 'Scope'), scope)}
        {fact(t('meshcore.packets.hashWidth', 'Hash width'), `${width} B`, true)}
      </dl>
      <section className={styles.section}>
        <h3 className={styles.heading}>{t('meshcore.route_detail_route', 'Route')}</h3>
        {/* Today's per-hop rows (mcpm-* styles). */}
        <div className="mcpm-dl-section">
          <RouteHopRows rows={rows} />
        </div>
      </section>
      {flow && flow.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>{t('meshcore.route_detail_flow', 'Packet flow')}</h3>
          <div className={styles.map}>
            <RouteFlowMap points={flow} snrColors={darkOverlayColors.snrColors} />
          </div>
        </section>
      )}
    </div>
  );

  if (isPhone) {
    return (
      <Sheet open onClose={onClose} title={title}>
        {body}
      </Sheet>
    );
  }
  return (
    <aside className={styles.panel} aria-label={title}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
          <UiIcon name="close" size={18} />
        </button>
      </div>
      {body}
    </aside>
  );
}
