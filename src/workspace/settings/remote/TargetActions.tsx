/**
 * The rest of today's Target node section for a remote node (boards 12-11,
 * 12-29): Attempts for this command, Load All Config, Retrieve Device
 * Metadata and Set time, with what each sends. On desktop it heads the
 * remote-only pages; on phone it is the page header's ⋯ sheet.
 *
 * Load All Config keeps today's order and 200 ms spacing (useRemoteTarget).
 * Each button sends only when pressed.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { NumberInput } from '../../../components/common/NumberInput';
import { getHardwareModelName, getRoleName } from '../../../utils/nodeHelpers';
import { decodePositionFlagNames } from '../../../utils/positionFlags';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import { useIsPhone } from '../../shell/useIsPhone';
import { categoryById } from '../categories';
import { LOAD_ALL_ORDER } from './remoteConfig';
import { useRemoteTarget, type DeviceMetadata } from './useRemoteTarget';
import styles from './Remote.module.css';

/** The load-config sections of Load All Config (Identity and the channel slots are counted apart). */
const SECTIONS = LOAD_ALL_ORDER.filter((id) => id !== 'identity' && id !== 'channels').length;

function capabilities(m: DeviceMetadata): string[] {
  return [
    m.hasWifi && 'WiFi',
    m.hasBluetooth && 'Bluetooth',
    m.hasEthernet && 'Ethernet',
    m.canShutdown && 'Shutdown',
    m.hasRemoteHardware && 'Remote HW',
    m.hasXeddsa && 'XEdDSA',
  ].filter((c): c is string => !!c);
}

function Attempts({ id }: { id: string }) {
  const { t } = useTranslation();
  const remote = useRemoteTarget()!;
  return (
    <div className={styles.attempts}>
      <label htmlFor={id} className={styles.actionLabel}>{t('admin_commands.retry_attempts_label', 'Attempts for this command')}</label>
      <NumberInput
        id={id}
        className={styles.attemptsInput}
        min={1}
        max={10}
        integer
        allowEmpty
        placeholder={t('admin_commands.retry_attempts_placeholder', 'default')}
        value={remote.attempts}
        onChange={remote.setAttempts}
        // Out of range: no override applies, as today (#5649).
        onValidityChange={(valid) => !valid && remote.setAttempts(null)}
      />
      <span className={styles.actionHelp}>
        {t('admin_commands.retry_attempts_description', 'Leave blank to use the Remote Administration setting. Only a command that gets no reply is retried — one the node refuses is never resent. Range 1–10.')}
      </span>
    </div>
  );
}

function useActionParts() {
  const { t } = useTranslation();
  const remote = useRemoteTarget()!;
  const progress = remote.progress;
  const loadLabel = progress
    ? t('admin_commands.loading_config_progress', { configType: t(categoryById(progress.id)?.labelKey ?? progress.id), current: progress.current, total: progress.total })
    : t('admin_commands.load_all_configs');
  const hops = remote.node.hopsAway != null ? t('workspace.settings.remote.hops_suffix', { count: remote.node.hopsAway }) : '';
  const off = remote.reading !== null || remote.busy !== null || remote.blocked;
  return { t, remote, loadLabel, hops, off };
}

/** The desktop card above Node management and the Remote console (12-11). */
export function TargetActionsCard() {
  const { t, remote, loadLabel, off } = useActionParts();
  const m = remote.metadata;
  return (
    <section className={styles.actionsCard} aria-label={t('admin_commands.target_node')}>
      <div className={styles.actionsRow}>
        <Attempts id="remote-attempts" />
        <div className={styles.actionButtons}>
          <button type="button" className={styles.button} disabled={off} aria-busy={remote.reading === 'all' || undefined} onClick={() => void remote.loadAll()}>
            <UiIcon name="download" size={16} /> {loadLabel}
          </button>
          <button type="button" className={styles.button} disabled={off} onClick={() => void remote.retrieveMetadata()}>
            <UiIcon name="info" size={16} /> {t('admin_commands.retrieve_device_metadata')}
          </button>
          <button type="button" className={styles.button} disabled={off} onClick={() => void remote.setTime()}>
            <UiIcon name="timer" size={16} /> {t('admin_commands.set_time')}
          </button>
        </div>
      </div>
      <SendsLine>{t('workspace.settings.remote.actions_sends', { sections: SECTIONS })}</SendsLine>
      {remote.blocked && <p className={styles.notice} role="status"><UiIcon name="alert" size={16} /> {t('tx_disabled.remote_admin_notice')}</p>}
      {m && (
        <p className={styles.metadata}>
          <strong>{t('admin_commands.device_metadata_title')}</strong>
          {[
            [t('admin_commands.firmware_version'), m.firmwareVersion],
            [t('admin_commands.hardware_model'), getHardwareModelName(m.hwModel) || String(m.hwModel)],
            [t('admin_commands.device_role'), getRoleName(m.role) || String(m.role)],
            [t('admin_commands.device_state_version'), String(m.deviceStateVersion)],
            [t('admin_commands.capabilities'), capabilities(m).join(', ') || t('common.none', 'None')],
            [t('admin_commands.position_flags'), decodePositionFlagNames(m.positionFlags ?? 0)],
            [t('admin_commands.ble_address'), m.bleAddress || '—'],
          ].map(([k, v]) => (
            <span key={k}>
              {' · '}
              <span className={styles.metaKey}>{k}</span> {v}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

/** The phone header's ⋯ and its sheet (12-29). */
export function TargetActionsButton() {
  const { t, remote, loadLabel, hops, off } = useActionParts();
  const [open, setOpen] = useState(false);
  const m = remote.metadata;
  const row = (icon: 'download' | 'info' | 'timer', label: string, help: string, sends: string, run: () => Promise<void>, busy: boolean) => (
    <button type="button" className={styles.actionRow} disabled={off} aria-busy={busy || undefined} onClick={() => void run()}>
      <UiIcon name={icon} size={22} />
      <span className={styles.actionText}>
        <span className={styles.actionName}>{label}</span>
        {help && <span className={styles.actionHelp}>{help}</span>}
        <SendsLine>{sends}</SendsLine>
      </span>
    </button>
  );
  return (
    <>
      <button type="button" className={styles.more} aria-label={t('workspace.settings.remote.actions')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <UiIcon name="more" size={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={remote.node.longName} side="bottom">
        <div className={styles.actionSheet} data-phone="">
          <Attempts id="remote-attempts-sheet" />
          {remote.blocked && <p className={styles.notice} role="status"><UiIcon name="alert" size={16} /> {t('tx_disabled.remote_admin_notice')}</p>}
          {row('download', loadLabel, t('workspace.settings.remote.load_all_help'), t('workspace.settings.remote.load_all_sends', { sections: SECTIONS }) + hops, remote.loadAll, remote.reading === 'all')}
          {row(
            'info',
            t('admin_commands.retrieve_device_metadata'),
            m ? [m.firmwareVersion, getHardwareModelName(m.hwModel) || String(m.hwModel), getRoleName(m.role) || String(m.role), t('workspace.settings.remote.state_version', { version: m.deviceStateVersion })].join(' · ') : '',
            t('workspace.settings.remote.request_sends'),
            remote.retrieveMetadata,
            remote.busy === 'metadata',
          )}
          {row('timer', t('admin_commands.set_time'), t('workspace.settings.remote.set_time_help'), t('workspace.settings.remote.admin_packet_sends'), remote.setTime, remote.busy === 'time')}
        </div>
      </Sheet>
    </>
  );
}

/** Desktop: the card. Phone: nothing here (the header's ⋯ holds it). */
export default function TargetActions() {
  const isPhone = useIsPhone();
  return isPhone ? null : <TargetActionsCard />;
}
