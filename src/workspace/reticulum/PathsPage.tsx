/**
 * Paths (boards 9-04, 9-12; notes s9n1, s9n4), native at `/source/:id/paths`,
 * on the screen's one poll: today's path table (destination, via, interface,
 * hops, age) with today's per-row Probe (`nodes:write`, as the route; one
 * probe packet per press, no retry) and Remote Fleet (today's on-demand
 * status query of a transport node, one request per press; nothing stored).
 *
 * Today keeps the last probe's result; this page also keeps each row's last
 * result while it is open, so several rows can show theirs at once. Opening
 * the page sends nothing. The phone stacks the rows as cards under the
 * Interfaces / Paths segment.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { UiIcon } from '../../components/icons';
import type { ReticulumProbeResult } from '../../types/reticulum';
import { formatRelativeTime } from '../../utils/datetime';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import ToolHead from '../meshcore/ToolHead';
import PhoneToolsHead from './PhoneToolsHead';
import { peerMark, peerTone, peerName, shortHash, useRnsRuntime } from './runtime';
import styles from './Reticulum.module.css';

export default function PathsPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  const { timeFormat, dateFormat } = useSettings();
  const { sourceId, rns } = useRnsRuntime();
  const { paths, destinations, loading, probe, probeResult, probingHash, remoteStatus, remoteStatusLoading, queryRemoteStatus } = rns;
  const canProbe = hasPermission('nodes', 'write', { sourceId });
  const [results, setResults] = useState<Record<string, ReticulumProbeResult>>({});
  useEffect(() => {
    if (probeResult) setResults((prev) => ({ ...prev, [probeResult.destinationHash]: probeResult }));
  }, [probeResult]);
  const [remoteHash, setRemoteHash] = useState('');

  const name = (hash: string) => peerName(hash, destinations);
  const result = (hash: string) => {
    if (probingHash === hash) {
      return (
        <span className={styles.probe}>
          <UiIcon name="time" size={14} /> {t('reticulum.paths.probing', 'Probing…')}
        </span>
      );
    }
    const r = results[hash];
    if (!r) return null;
    return (
      <span className={styles.probe} data-ok={r.ok || undefined} data-fail={!r.ok || undefined}>
        <UiIcon name={r.ok ? 'check' : 'close'} size={14} />{' '}
        {r.ok
          ? t('reticulum.paths.probe_ok', '{{rtt}}ms · {{hops}} hops', { rtt: r.rttMs ?? '—', hops: r.hops ?? '—' })
          : r.error ?? t('reticulum.paths.probe_no_reply', 'No reply')}
      </span>
    );
  };
  const probeButton = (hash: string) => (
    <button
      type="button"
      className={styles.button}
      disabled={probingHash === hash}
      title={t('reticulum.paths.probe_action', 'Probe {{hash}}', { hash: shortHash(hash) })}
      onClick={() => void probe(hash)}
    >
      <UiIcon name="activity" size={16} /> {t('reticulum.paths.probe', 'Probe')}
    </button>
  );
  const via = (hash: string | null) => (hash ? name(hash) : t('workspace.reticulum.direct'));
  const sendsProbe = t('workspace.reticulum.sends_probe');

  const table =
    paths.length === 0 ? (
      <p className={styles.empty} role="status">
        {loading ? t('reticulum.paths.loading', 'Loading paths…') : t('reticulum.paths.empty', 'No paths reported yet.')}
      </p>
    ) : isPhone ? (
      <>
        <h2 className={styles.sectionTitle}>{t('workspace.reticulum.paths_count', { count: paths.length })}</h2>
        <ul className={styles.cards}>
          {paths.map((p) => (
            <li key={p.destinationHash} className={styles.cardRow}>
              <span className={styles.convoText}>
                <span className={styles.convoName}>{name(p.destinationHash)}</span>
                <span className={styles.convoPreview}>{t('workspace.reticulum.via', { name: via(p.viaHash) })}</span>
                <span className={styles.convoPreview}>
                  {[p.interfaceName, p.hops != null ? t('workspace.reticulum.hops', { count: p.hops }) : null, formatRelativeTime(p.updatedAt, timeFormat, dateFormat)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {result(p.destinationHash)}
              </span>
              {canProbe && probeButton(p.destinationHash)}
            </li>
          ))}
        </ul>
        {canProbe && <SendsLine>{sendsProbe}</SendsLine>}
      </>
    ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('reticulum.paths.col_destination', 'Destination')}</th>
              <th>{t('reticulum.paths.col_via', 'Via')}</th>
              <th>{t('reticulum.paths.col_interface', 'Interface')}</th>
              <th>{t('reticulum.paths.col_hops', 'Hops')}</th>
              <th>{t('reticulum.paths.col_age', 'Age')}</th>
              {canProbe && <th>{t('reticulum.paths.col_probe', 'Probe')}</th>}
            </tr>
          </thead>
          <tbody>
            {paths.map((p) => {
              const n = name(p.destinationHash);
              const named = !n.startsWith('<');
              return (
                <tr key={p.destinationHash}>
                  <td>
                    <span className={styles.nameCell}>
                      <span className={styles.avatar} data-tone={peerTone(n)} data-anon={!named || undefined} aria-hidden="true">{peerMark(n)}</span>
                      <span className={styles.convoText}>
                        <strong>{n}</strong>
                        {named && <code className={styles.mono}>{shortHash(p.destinationHash)}</code>}
                      </span>
                    </span>
                  </td>
                  <td className={p.viaHash ? undefined : styles.muted}>{via(p.viaHash)}</td>
                  <td>{p.interfaceName ?? '—'}</td>
                  <td>{p.hops ?? '—'}</td>
                  <td>{formatRelativeTime(p.updatedAt, timeFormat, dateFormat)}</td>
                  {canProbe && (
                    <td>
                      <span className={styles.probeCell}>
                        {probeButton(p.destinationHash)}
                        {result(p.destinationHash)}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  const query = () => {
    const hash = remoteHash.trim();
    if (hash) void queryRemoteStatus(hash);
  };

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {isPhone ? (
        <PhoneToolsHead sourceId={sourceId} />
      ) : (
        <>
          <ToolHead
            title={t('reticulum.nav.paths', 'Paths')}
            subtitle={t('workspace.reticulum.paths_subtitle', { count: paths.length })}
            back={{ label: '', to: '' }}
          />
          {canProbe && <SendsLine>{sendsProbe}</SendsLine>}
        </>
      )}
      {table}

      <section className={styles.card} aria-labelledby="rns-remote-fleet">
        <h2 className={styles.cardTitle} id="rns-remote-fleet">{t('reticulum.paths.remote_title', 'Remote Fleet')}</h2>
        <p className={styles.muted}>
          {t('reticulum.paths.remote_hint', 'Query a remote Transport Node’s status and path table on demand. Nothing here is stored.')}
        </p>
        <div className={styles.remoteForm}>
          <input
            type="text"
            className={`${styles.input} ${styles.mono}`}
            value={remoteHash}
            onChange={(e) => setRemoteHash(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') query();
            }}
            placeholder={t('reticulum.paths.remote_placeholder', 'Destination hash…')}
            aria-label={t('reticulum.paths.remote_placeholder', 'Destination hash…')}
          />
          <button type="button" className={styles.primary} disabled={remoteStatusLoading || remoteHash.trim().length === 0} onClick={query}>
            {remoteStatusLoading ? t('reticulum.paths.remote_querying', 'Querying…') : t('reticulum.paths.remote_query', 'Query')}
          </button>
        </div>
        <SendsLine>{t('workspace.reticulum.sends_remote')}</SendsLine>
        {remoteStatus && (
          <p className={styles.result} data-ok={remoteStatus.ok || undefined} role="status">
            <UiIcon name={remoteStatus.ok ? 'check' : 'error'} size={16} />
            {remoteStatus.ok ? (
              <span>
                {t('reticulum.paths.remote_ok', '{{hash}} is reachable', { hash: shortHash(remoteStatus.destinationHash) })}
                {' · '}
                {t('reticulum.paths.remote_interfaces', '{{count}} interface(s)', { count: remoteStatus.status?.interfaces.length ?? 0 })}
                {' · '}
                {t('reticulum.paths.remote_links', '{{count}} link(s)', { count: remoteStatus.status?.linkCount ?? 0 })}
                {' · '}
                {t('reticulum.paths.remote_paths', '{{count}} known path(s)', { count: remoteStatus.path?.length ?? 0 })}
              </span>
            ) : (
              <span>{remoteStatus.error ?? t('reticulum.paths.remote_unreachable', 'No response from remote node')}</span>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
