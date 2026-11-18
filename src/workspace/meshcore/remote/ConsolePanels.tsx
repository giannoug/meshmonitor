/**
 * The Console's two side panels as board 8-06 draws them, over today's hooks:
 *
 * - Remote node status (useRemoteStats, today's MeshCoreRemoteStatsPanel
 *   logic): Fetch stats sends one status request per press; nothing fetches
 *   it on its own or on a timer; off in receive-only. Today's formatters.
 * - History (useCliHistory, today's CliHistoryPanel logic): the target's
 *   stored commands, All users or Mine (today's history `user` filter),
 *   secrets masked by the server, Load more. Reads only.
 *
 * On the phone each is a row that opens it in a sheet (note s8n6).
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../../components/icons';
import { useAuth } from '../../../contexts/AuthContext';
import { useCliHistory } from '../../../components/MeshCore/hooks/useCliHistory';
import { cliActorLabel } from '../../../components/MeshCore/cliHistoryApi';
import {
  formatAirTime,
  formatBattery,
  formatNumber,
  formatRssi,
  formatSnr,
  formatUptime,
} from '../../../components/MeshCore/remoteStatsFormat';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import { useIsPhone } from '../../shell/useIsPhone';
import type { MeshCoreTarget } from './remoteTarget';
import styles from './McRemote.module.css';

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** A panel on desktop; on the phone, a row that opens it in a sheet. */
function PhoneRow({ icon, title, meta, children }: { icon: UiIconName; title: string; meta: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={styles.row} onClick={() => setOpen(true)}>
        <span className={styles.rowIcon} aria-hidden="true"><UiIcon name={icon} size={20} /></span>
        <span className={styles.rowLabel}>{title}</span>
        <span className={styles.muted}>{meta}</span>
        <UiIcon name="chevronRight" size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} side="bottom">
        <div className={styles.sheet} data-phone="">
          {open && children}
        </div>
      </Sheet>
    </>
  );
}

export function RemoteStatusPanel({ target }: { target: MeshCoreTarget }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { status, loading, error, lastUpdated, load } = target.stats;
  const title = t('meshcore.remoteStats.title', 'Remote node status');
  const fetched = lastUpdated !== null ? t('workspace.meshcore.remote.fetched', { time: clock(lastUpdated) }) : null;
  const off = loading || target.receiveOnly;
  const fields: Array<[string, string]> = status
    ? [
        [t('meshcore.remoteStats.battery', 'Battery'), formatBattery(status.batteryMv)],
        [t('meshcore.remoteStats.uptime', 'Uptime'), formatUptime(status.uptimeSecs)],
        [t('meshcore.remoteStats.air_time', 'Air time'), formatAirTime(status.airTimeSecs)],
        [t('meshcore.remoteStats.noise_floor', 'Noise floor'), formatRssi(status.noiseFloor)],
        [t('meshcore.remoteStats.queue', 'TX queue'), formatNumber(status.queueLen)],
        [t('meshcore.remoteStats.last_rssi', 'Last RSSI'), formatRssi(status.lastRssi)],
        [t('meshcore.remoteStats.last_snr', 'Last SNR'), formatSnr(status.lastSnr)],
        [t('meshcore.remoteStats.tx', 'Sent'), t('workspace.meshcore.remote.split', {
          total: formatNumber(status.packetsSent), flood: formatNumber(status.sentFlood), direct: formatNumber(status.sentDirect),
        })],
        [t('meshcore.remoteStats.rx', 'Received'), t('workspace.meshcore.remote.split', {
          total: formatNumber(status.packetsRecv), flood: formatNumber(status.recvFlood), direct: formatNumber(status.recvDirect),
        })],
        [t('workspace.meshcore.remote.dups'), t('workspace.meshcore.remote.split_short', {
          flood: formatNumber(status.floodDups), direct: formatNumber(status.directDups),
        })],
        [t('meshcore.remoteStats.recv_errors', 'Receive errors'), formatNumber(status.recvErrors)],
        [t('meshcore.remoteStats.errors', 'Error Events'), formatNumber(status.errors)],
        [t('meshcore.remoteStats.rx_air_time', 'RX air time'), formatAirTime(status.rxAirTimeSecs)],
      ]
    : [];
  const body = (
    <>
      <div className={styles.panelHead}>
        {!isPhone && <h2 className={styles.cardTitle}>{title}</h2>}
        <span className={styles.muted}>{fetched ?? t('meshcore.remoteStats.empty_hint', 'Status is not fetched automatically.')}</span>
        <span className={styles.panelTools}>
          <SendsLine>{t('workspace.meshcore.remote.sends_status')}</SendsLine>
          <button
            type="button"
            className={styles.button}
            disabled={off}
            aria-busy={loading || undefined}
            title={target.receiveOnly ? t('meshcore.receive_only.control_tooltip') : undefined}
            onClick={() => void load()}
          >
            <UiIcon name="refresh" size={16} /> {t('meshcore.remoteStats.fetch', 'Fetch stats')}
          </button>
        </span>
      </div>
      {error && !status && <p className={styles.error}>{error}</p>}
      {fields.length > 0 && (
        <dl className={styles.stats}>
          {fields.map(([label, value]) => (
            <div key={label} className={styles.stat}>
              <dt className={styles.muted}>{label}</dt>
              <dd className={styles.statValue}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
  if (isPhone) {
    return <PhoneRow icon="activity" title={title} meta={fetched ?? ''}>{body}</PhoneRow>;
  }
  return <section className={styles.card} aria-label={title}>{body}</section>;
}

/** `target`: the history's target, a node's public key or `local` (this radio's serial console). */
export function HistoryPanel({ target, sourceId }: { target: string; sourceId: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const title = t('meshcore.cliHistory.title');
  const all = t('workspace.meshcore.remote.all_users');
  if (isPhone) {
    return (
      <PhoneRow icon="time" title={title} meta={all}>
        <HistoryBody target={target} sourceId={sourceId} />
      </PhoneRow>
    );
  }
  return (
    <section className={styles.card} aria-label={title}>
      <HistoryBody target={target} sourceId={sourceId} heading={title} />
    </section>
  );
}

function HistoryBody({ target, sourceId, heading }: { target: string; sourceId: string; heading?: string }) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const me = authStatus?.user?.username;
  const [mine, setMine] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  // Opened with the page (desktop) or its sheet (phone): reads only.
  const { entries, nextCursor, loading, error, load } = useCliHistory(sourceId, target, true, mine ? me : undefined);
  const vn = t('meshcore.cliHistory.vn_client', 'Virtual Node app');
  const unknown = t('meshcore.cliHistory.unknown_user', 'Unknown');
  return (
    <>
      <div className={styles.panelHead}>
        {heading && <h2 className={styles.cardTitle}>{heading}</h2>}
        <div className={styles.segments} role="group" aria-label={heading ?? t('meshcore.cliHistory.title')}>
          <button type="button" className={styles.segment} aria-pressed={!mine} onClick={() => setMine(false)}>
            {t('workspace.meshcore.remote.all_users')}
          </button>
          <button type="button" className={styles.segment} aria-pressed={mine} disabled={!me} onClick={() => setMine(true)}>
            {t('workspace.meshcore.remote.mine')}
          </button>
        </div>
      </div>
      <p className={styles.note}>{t('meshcore.cliHistory.hint')}</p>
      {error && <p className={styles.error}>{error}</p>}
      {!error && entries.length === 0 && !loading && <p className={styles.note}>{t('meshcore.cliHistory.empty')}</p>}
      {entries.length > 0 && (
        <ul className={styles.history}>
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" className={styles.historyRow} aria-expanded={expanded === e.id} onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                <span className={styles.historyUser}>{cliActorLabel(e, vn, unknown)}</span>
                <code className={styles.historyCommand}>{e.command}</code>
                <span className={styles.muted}>{clock(e.timestamp)}</span>
              </button>
              {expanded === e.id && (e.reply ?? e.error) && <pre className={styles.historyReply}>{e.reply ?? e.error}</pre>}
            </li>
          ))}
        </ul>
      )}
      {nextCursor !== null && (
        <button type="button" className={styles.button} onClick={() => void load(nextCursor)} disabled={loading}>
          {t('meshcore.cliHistory.load_more')}
        </button>
      )}
      {loading && <p className={styles.note}>{t('meshcore.cliHistory.loading')}</p>}
    </>
  );
}
