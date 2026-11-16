/**
 * The remote target picker (boards b-set-d6 "Configuring Remote: …", 12-20):
 * the settings list's "Configuring" button opens a sheet with today's node
 * search (nodeOptionsUtils: the local node marked Local, then nodes with
 * remote admin, then A–Z), today's words and the chosen node's passkey line.
 * Picking a node sends nothing; each category reads from it when asked.
 * With transmit off on this radio, today's notice says remote admin is off.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { filterNodes } from '../../../components/admin-commands/nodeOptionsUtils';
import { useTxStatus } from '../../../hooks/useTxStatus';
import { appBasename } from '../../../init';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import { useIsPhone } from '../../shell/useIsPhone';
import { updateRemote, useRemoteEntry, type RemoteNode } from './remoteTargetStore';
import { passkeyLine, useSetRemoteTarget } from './useRemoteTarget';
import { DiscardChangesSheet } from '../LeaveGuard';
import styles from './Remote.module.css';

export interface TargetPickerSheetProps {
  sourceId: string;
  nodes: RemoteNode[];
  local: RemoteNode | null;
  deviceName: string;
}

export default function TargetPickerSheet({ sourceId, nodes, local, deviceName }: TargetPickerSheetProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const entry = useRemoteEntry(sourceId);
  const setTarget = useSetRemoteTarget(sourceId, nodes);
  const [query, setQuery] = useState('');
  // Read when the picker opens, with no timer of its own (Ruling N).
  const { isTxDisabled } = useTxStatus({ baseUrl: appBasename, sourceId, enabled: entry.pickerOpen, refetchInterval: 0 });
  const close = () => {
    setQuery('');
    updateRemote(sourceId, { pickerOpen: false });
  };
  // A switch drops the node's unsent edits: ask first, with the leave guard's words (I3); one sheet at a time (D9c).
  const [asking, setAsking] = useState<number | 'local' | null>(null);
  const pick = (next: number | 'local') => {
    setQuery('');
    const same = next === 'local' ? !entry.node : entry.node?.nodeNum === next;
    if (entry.node && !same && entry.unsent.length > 0) {
      updateRemote(sourceId, { pickerOpen: false });
      setAsking(next);
      return;
    }
    setTarget(next);
  };
  const shown = filterNodes(nodes, query);
  const sub = (n: RemoteNode) => `${n.shortName} • ${n.nodeId}`;

  return (
    <>
    <DiscardChangesSheet
      open={asking !== null}
      cards={entry.unsent}
      onDiscard={() => {
        const next = asking;
        setAsking(null);
        if (next !== null) setTarget(next);
      }}
      onCancel={() => setAsking(null)}
    />
    <Sheet open={entry.pickerOpen} onClose={close} title={t('workspace.settings.remote.configuring')} side={isPhone ? 'bottom' : 'auto'}>
      <div className={styles.picker} data-phone={isPhone || undefined}>
        <p className={styles.help}>{t('admin_commands.select_node_help')}</p>
        {isTxDisabled && (
          <p className={styles.notice} role="status">
            <UiIcon name="alert" size={16} /> {t('tx_disabled.remote_admin_notice')}
          </p>
        )}
        <button type="button" className={styles.option} aria-pressed={!entry.node} onClick={() => pick('local')}>
          <span className={styles.optionText}>
            <span className={styles.optionName}>
              {t('workspace.settings.remote.this_radio')} <span className={styles.chip}>{t('admin_commands.local_node_indicator')}</span>
            </span>
            <span className={styles.optionSub}>{local ? `${deviceName} • ${local.nodeId}` : deviceName}</span>
          </span>
          {!entry.node && <UiIcon name="check" size={20} />}
        </button>
        <label className={styles.search}>
          <UiIcon name="search" size={18} />
          <span className={styles.srOnly}>{t('admin_commands.search_node_placeholder')}</span>
          <input
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder={t('admin_commands.search_node_placeholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <ul className={styles.options} aria-label={t('admin_commands.target_node')}>
          {shown.map((n) => {
            const chosen = entry.node?.nodeNum === n.nodeNum;
            return (
              <li key={n.nodeNum}>
                <button type="button" className={styles.option} aria-pressed={chosen} disabled={isTxDisabled} onClick={() => pick(n.nodeNum)}>
                  <span className={styles.optionText}>
                    <span className={styles.optionName}>{n.longName}</span>
                    <span className={styles.optionSub}>{sub(n)}</span>
                  </span>
                  {chosen && <UiIcon name="check" size={20} />}
                </button>
              </li>
            );
          })}
        </ul>
        <p className={styles.help}>{passkeyLine(t, entry.node, entry.passkey)}</p>
        <SendsLine>{t('workspace.settings.remote.picker_sends')}</SendsLine>
      </div>
    </Sheet>
    </>
  );
}
