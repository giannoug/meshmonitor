/**
 * A remote category's head (boards b-set-d6, 12-20): the node it configures,
 * then "Read from node" with when it was last read. A remote category opens
 * empty and reads only when asked (never on open, on switching node, or on
 * reconnect); its fields show once a read has answered, so nothing read from
 * nowhere can be sent back. With transmit off on this radio, today's notice
 * replaces the button.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { formatRelativeTime } from '../../../utils/datetime';
import SendsLine from '../../patterns/SendsLine';
import { useIsPhone } from '../../shell/useIsPhone';
import { updateRemote } from './remoteTargetStore';
import { passkeyLine, useReadSends, useRemoteTarget } from './useRemoteTarget';
import styles from './Remote.module.css';

/** "Remote node · Hilltop Relay · !7c3e10a2 · 3 hops away · <passkey>": opens the picker. */
export function RemoteScope({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const remote = useRemoteTarget();
  if (!remote) return null;
  const { node } = remote;
  return (
    <button type="button" className={styles.scope} data-phone={isPhone || undefined} onClick={() => updateRemote(sourceId, { pickerOpen: true })}>
      <UiIcon name="radio" size={16} />
      <span className={styles.scopeRemote}>{t('workspace.settings.remote.remote_node')}</span>
      <span>{` · ${node.longName}`}</span>
      {isPhone && <br />}
      <span>{`${isPhone ? '' : ' · '}${node.nodeId}`}</span>
      {node.hopsAway != null && <span>{` · ${t('workspace.settings.remote.hops_away', { count: node.hopsAway })}`}</span>}
      {!isPhone && <span>{` · ${passkeyLine(t, node, remote.passkeyState)}`}</span>}
    </button>
  );
}

export default function RemoteReadBar({ id }: { id: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const remote = useRemoteTarget();
  const sends = useReadSends(id);
  if (!remote) return null;
  const last = remote.lastRead[id];
  const reading = remote.reading === id;
  return (
    <section className={styles.readBar} data-phone={isPhone || undefined} aria-label={t('workspace.settings.remote.read')}>
      <UiIcon name="info" size={20} className={styles.readIcon} />
      <div className={styles.readText}>
        <strong className={styles.readTitle}>
          {last ? t('workspace.settings.remote.read_when', { when: formatRelativeTime(last) }) : t('workspace.settings.remote.not_read')}
        </strong>
        <span className={styles.readHelp}>{t(isPhone ? 'workspace.settings.remote.read_help_short' : 'workspace.settings.remote.read_help')}</span>
      </div>
      {remote.blocked ? (
        <p className={styles.notice} role="status">
          <UiIcon name="alert" size={16} /> {t('tx_disabled.remote_admin_notice')}
        </p>
      ) : (
        <div className={styles.readAction}>
          <button
            type="button"
            className={styles.primary}
            disabled={remote.reading !== null}
            aria-busy={reading || undefined}
            onClick={() => void remote.readCategory(id)}
          >
            <UiIcon name="download" size={18} />
            {reading ? t('workspace.settings.remote.reading') : t('workspace.settings.remote.read')}
          </button>
          <SendsLine>{sends}</SendsLine>
        </div>
      )}
    </section>
  );
}
