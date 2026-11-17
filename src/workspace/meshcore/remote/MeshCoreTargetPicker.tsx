/**
 * The MeshCore remote target picker (Task 7.3; "Configuring Remote: …", as
 * b-set-d6): the settings list's Configuring button opens it through the
 * store. It offers This radio (today's settings page) and the repeaters and
 * room servers in this radio's contacts, with a search. Picking sends nothing:
 * each page asks the node only when a control is pressed.
 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import type { MeshCoreContact } from '../../../utils/meshcoreHelpers';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import { useIsPhone } from '../../shell/useIsPhone';
import { clearRemote, updateRemote, useRemoteEntry } from '../../settings/remote/remoteTargetStore';
import { DiscardChangesSheet } from '../../settings/LeaveGuard';
import { contactLabel } from './remoteTarget';
import styles from '../../settings/remote/Remote.module.css';

export interface MeshCoreTargetPickerProps {
  sourceId: string;
  targets: MeshCoreContact[];
  deviceName: string;
}

export default function MeshCoreTargetPicker({ sourceId, targets, deviceName }: MeshCoreTargetPickerProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const entry = useRemoteEntry(sourceId);
  const [query, setQuery] = useState('');
  const close = () => {
    setQuery('');
    updateRemote(sourceId, { pickerOpen: false });
  };
  // A switch drops the node's unsent settings: ask first, with the leave guard's words (as Task 5.9); one sheet at a time.
  const [asking, setAsking] = useState<{ key: string | null } | null>(null);
  const pick = (key: string | null) => {
    close();
    const same = key === (entry.node?.nodeId ?? null);
    if (entry.node && !same && entry.unsent.length > 0) {
      setAsking({ key });
      return;
    }
    go(key);
  };
  const go = (key: string | null) => {
    if (key) {
      void navigate(`${pathname}?node=${key}`);
      return;
    }
    // This radio: today's settings page, with the target forgotten.
    void navigate(`/source/${encodeURIComponent(sourceId)}/settings`);
    clearRemote(sourceId);
  };
  const q = query.trim().toLowerCase();
  const shown = q ? targets.filter((c) => contactLabel(c).toLowerCase().includes(q) || c.publicKey.toLowerCase().includes(q)) : targets;
  const kind = (c: MeshCoreContact) => t(c.advType === 2 ? 'workspace.meshcore.remote.kind_repeater' : 'workspace.meshcore.remote.kind_room');

  return (
    <>
    <DiscardChangesSheet
      open={asking !== null}
      cards={entry.unsent}
      onDiscard={() => {
        const next = asking;
        setAsking(null);
        if (next) go(next.key);
      }}
      onCancel={() => setAsking(null)}
    />
    <Sheet open={entry.pickerOpen} onClose={close} title={t('workspace.settings.remote.configuring')} side={isPhone ? 'bottom' : 'auto'}>
      <div className={styles.picker} data-phone={isPhone || undefined}>
        <p className={styles.help}>{t('workspace.meshcore.remote.picker_help')}</p>
        <button type="button" className={styles.option} aria-pressed={!entry.node} onClick={() => pick(null)}>
          <span className={styles.optionText}>
            <span className={styles.optionName}>
              {t('workspace.settings.remote.this_radio')} <span className={styles.chip}>{t('admin_commands.local_node_indicator')}</span>
            </span>
            <span className={styles.optionSub}>{deviceName}</span>
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
          {shown.map((c) => {
            const chosen = entry.node?.nodeId === c.publicKey;
            return (
              <li key={c.publicKey}>
                <button type="button" className={styles.option} aria-pressed={chosen} onClick={() => pick(c.publicKey)}>
                  <span className={styles.optionText}>
                    <span className={styles.optionName}>{contactLabel(c)}</span>
                    <span className={styles.optionSub}>{`${kind(c)} • ${c.publicKey.slice(0, 8)}`}</span>
                  </span>
                  {chosen && <UiIcon name="check" size={20} />}
                </button>
              </li>
            );
          })}
        </ul>
        {targets.length === 0 && <p className={styles.help}>{t('workspace.meshcore.remote.no_targets')}</p>}
        <SendsLine>{t('workspace.settings.remote.picker_sends')}</SendsLine>
      </div>
    </Sheet>
    </>
  );
}
