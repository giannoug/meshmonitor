/**
 * Which repeaters relayed one of our MeshCore channel messages (board 8-19,
 * today's heard-by list, #6193): each required repeater first, relayed (with
 * its hops) or "not relayed yet", then every other repeater heard. Resend,
 * while today's resend window is open, closes this and asks first; its Sends
 * line names what it costs. Reading this sends nothing.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { heardByModel, type HeardByBubbleRepeater } from '../../components/MeshCore/HeardByBubble';
import { RESEND_MAX } from '../../components/MeshCore/meshcoreResend';
import { useSettings } from '../../contexts/SettingsContext';
import { formatMessageTime } from '../../utils/datetime';
import { meshcoreDisplayTimeMs } from '../../utils/meshcoreMessageTime';
import Sheet from '../patterns/Sheet';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import type { McRow } from './MeshCoreThread';
import { shortMark } from './meshcoreLabels';
import styles from './HeardBySheet.module.css';

export interface HeardBySheetProps {
  row: McRow;
  requiredKeys: string[];
  repeaters: HeardByBubbleRepeater[];
  scope: string;
  /** Resends left while one is allowed now, else null. */
  resendLeft: number | null;
  onResend(): void;
  onClose(): void;
}

export default function HeardBySheet({ row, requiredKeys, repeaters, scope, resendLeft, onResend, onClose }: HeardBySheetProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { timeFormat, dateFormat } = useSettings();
  const m = row.message;
  const model = heardByModel(m.heardBy, requiredKeys, repeaters);
  const total = model.greenCount + model.required.filter((r) => !r.entry).length;
  const time = formatMessageTime(new Date(meshcoreDisplayTimeMs(m)), timeFormat, dateFormat);
  const hops = (n?: number | null) => (typeof n === 'number' ? `${t('meshcore.heard_by_hops', { count: n })} · ` : '');
  const item = (key: string, name: string, line: string, missing: boolean) => (
    <li key={key} className={styles.row} data-phone={isPhone || undefined}>
      <span className={styles.avatar} aria-hidden="true">{shortMark(name)}</span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={missing ? styles.missing : styles.ok}>{line}</span>
      </span>
    </li>
  );
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('workspace.meshcore.heard_by_title', { heard: model.greenCount, total })}
      footer={
        resendLeft !== null && (
          <div className={styles.footer}>
            <button type="button" className={styles.resend} data-phone={isPhone || undefined} onClick={onResend}>
              <UiIcon name="resend" size={18} /> {t('meshcore.resend.button', 'Resend')}
            </button>
            <SendsLine>{t('workspace.meshcore.sends_resend', { left: resendLeft, max: RESEND_MAX })}</SendsLine>
          </div>
        )
      }
    >
      <div className={styles.pad}>
        <p className={styles.sub}>{[t('workspace.meshcore.your_message'), time, scope ? t('workspace.meshcore.scope_of', { scope }) : null].filter(Boolean).join(' · ')}</p>
        <ul className={styles.list}>
          {model.required.map((r) =>
            r.entry
              ? item(r.key, r.entry.name || r.name, `${hops(r.entry.hops)}${t('workspace.meshcore.relayed')}`, false)
              : item(r.key, r.name, `${t('meshcore.heard_by.not_yet', 'not relayed yet')} · ${t('workspace.meshcore.required_repeater')}`, true),
          )}
          {model.others.map((h, i) => item(`${h.hash}-${i}`, h.name || h.hash, `${hops(h.hops)}${t('workspace.meshcore.relayed')}`, false))}
          {model.required.length === 0 && model.others.length === 0 && <li className={styles.none}>{t('workspace.meshcore.heard_none')}</li>}
        </ul>
      </div>
    </Sheet>
  );
}
