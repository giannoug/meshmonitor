/**
 * Channel info (boards 10-03 side sheet, 10-12 phone): today's Channel
 * Information modal as a Sheet. Read here; channels are edited in the
 * device's settings.
 *
 * Rows: Encryption, PSK (masked, Show/Hide, for those the server sends it
 * to), MQTT Uplink/Downlink, AEAD, Location Sharing. On the phone the sheet
 * also carries "This channel" (Mute, Mark all as Read, Show MQTT/Bridge
 * Messages, Beacons), since the ⋯ opens it there. The Danger zone's Purge
 * All Messages (needs `channel_N:write`, as today) asks in a plain
 * ConfirmSheet with today's words; it deletes from MeshMonitor only.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { MuteMenu } from '../../components/notifications/MuteMenu';
import { MarkAllReadButton } from '../../components/messages/MarkAllReadButton';
import type { Channel } from '../../types/device';
import { formatPrecisionAccuracy } from '../../utils/distance';
import ConfirmSheet from '../patterns/ConfirmSheet';
import DangerZone from '../patterns/DangerZone';
import Sheet from '../patterns/Sheet';
import type { ChannelHeaderMenuProps } from './ChannelHeaderMenu';
import { encryptionOf } from './channelLabel';
import styles from './ChannelInfoSheet.module.css';

export interface ChannelInfoSheetProps {
  open: boolean;
  onClose(): void;
  channel: Channel | undefined;
  channelId: number;
  channelName: string;
  deviceName: string;
  /** The lowest slot sharing location: it sends the automatic position updates. */
  autoPositionChannelId: number | null;
  distanceUnit: 'km' | 'mi';
  /** `channel_N:write`: the Danger zone shows. */
  canPurge: boolean;
  onPurge(): Promise<void>;
  /** Phone: the ⋯ menu's rows, under "This channel". */
  actions?: Omit<ChannelHeaderMenuProps, 'channelName' | 'onInfo'>;
}

export default function ChannelInfoSheet(props: ChannelInfoSheetProps) {
  const { t } = useTranslation();
  const { channel, actions, distanceUnit } = props;
  const [showPsk, setShowPsk] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setShowPsk(false);
    props.onClose();
  };
  const onOff = (on: boolean | undefined) => (on ? t('channels.enabled') : t('channels.disabled'));
  const encryption = {
    secure: t('channels.status_secure'),
    default: t('channels.status_default_key'),
    none: t('channels.status_unencrypted'),
  }[encryptionOf(channel)];
  const precision = channel?.positionPrecision ?? 0;
  const location =
    precision <= 0
      ? t('channels.location_disabled')
      : `${props.autoPositionChannelId === props.channelId ? t('channels.location_auto_position') : t('channels.location_enabled')} (${formatPrecisionAccuracy(precision, distanceUnit)})`;

  const purge = async () => {
    setBusy(true);
    try {
      await props.onPurge();
      setConfirming(false);
      close();
    } finally {
      setBusy(false);
    }
  };

  const row = (label: string, value: ReactNode) => (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <>
      <Sheet open={props.open} onClose={close} title={t('channels.info_modal_title')}>
        <div className={styles.content}>
        <p className={styles.sub}># {props.channelName}</p>
        {actions && <h3 className={styles.section}>{t('workspace.chat.channel_section')}</h3>}
        <dl className={styles.card}>
          {row(t('channels.encryption'), encryption)}
          {channel?.psk &&
            row(
              t('channels.psk_base64'),
              <span className={styles.psk}>
                <code>{showPsk ? channel.psk : '••••••••'}</code>
                <button type="button" className={styles.small} onClick={() => setShowPsk((s) => !s)}>
                  <UiIcon name={showPsk ? 'visibilityOff' : 'visibility'} size={14} /> {showPsk ? t('channels.hide') : t('channels.show')}
                </button>
              </span>,
            )}
          {row(t('channels.mqtt_uplink'), onOff(channel?.uplinkEnabled))}
          {row(t('channels.mqtt_downlink'), onOff(channel?.downlinkEnabled))}
          {row(`${t('channels.aead_badge')} · ${t('channels.aead_label')}`, onOff(channel?.useAead))}
          {row(t('channels.location_sharing'), location)}
        </dl>
        <p className={styles.note}>{t('workspace.chat.edit_note', { device: props.deviceName })}</p>

        {actions && (
          <>
            <h3 className={styles.section}>{t('workspace.chat.this_channel')}</h3>
            <div className={styles.card}>
              <div className={styles.action}>
                <UiIcon name="notifications" size={18} />
                <span className={styles.actionText}>
                  <span className={styles.actionTitle}>{t('notifications.mute_channel')}</span>
                  <span className={styles.segments}>
                    <MuteMenu
                      variant="items"
                      muted={actions.muted}
                      onMute={actions.onMute}
                      onUnmute={actions.onUnmute}
                      itemClassName={styles.segment}
                    />
                  </span>
                </span>
              </div>
              <div className={styles.action}>
                <UiIcon name="checkAll" size={18} />
                <span className={styles.actionText}>
                  <MarkAllReadButton
                    className={styles.inline}
                    label={t('channels.mark_all_read_button')}
                    title={t('channels.mark_all_read_title')}
                    unreadCount={actions.unreadCount}
                    confirmMessage={t('workspace.chat.mark_read_confirm')}
                    onMarkAll={actions.onMarkAll}
                  />
                  <span className={styles.desc}>{t('workspace.chat.mark_read_desc')}</span>
                </span>
              </div>
              {actions.showMqtt !== null && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={actions.showMqtt}
                  className={styles.action}
                  onClick={actions.onToggleMqtt}
                >
                  <UiIcon name="network" size={18} />
                  <span className={styles.actionText}>
                    <span className={styles.actionTitle}>{t('channels.show_mqtt_messages')}</span>
                    <span className={styles.desc}>{t('workspace.chat.mqtt_desc')}</span>
                  </span>
                  <span className={styles.switch} data-on={actions.showMqtt || undefined} aria-hidden="true" />
                </button>
              )}
              {actions.beaconsPending !== null && (
                <button type="button" className={styles.action} onClick={() => { close(); actions.onBeacons(); }}>
                  <UiIcon name="announcement" size={18} />
                  <span className={styles.actionText}>
                    <span className={styles.actionTitle}>{t('beacons.button')}</span>
                    <span className={styles.desc}>{t('beacons.button_title')}</span>
                  </span>
                  {actions.beaconsPending > 0 && <span className={styles.badge}>{actions.beaconsPending}</span>}
                </button>
              )}
            </div>
          </>
        )}

        {props.canPurge && (
          <div className={styles.danger}>
            <DangerZone title={t('config.danger_zone')}>
              <div className={styles.dangerRow}>
                <span className={styles.actionText}>
                  <span className={styles.actionTitle}>{t('channels.purge_all_messages')}</span>
                  <span className={styles.desc}>{t('workspace.chat.purge_desc', { channel: props.channelName })}</span>
                </span>
                <button type="button" className={styles.purge} title={t('channels.purge_messages_title')} onClick={() => setConfirming(true)}>
                  {t('workspace.chat.purge')}
                </button>
              </div>
            </DangerZone>
          </div>
        )}
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirming}
        title={t('channels.purge_all_messages')}
        body={t('workspace.chat.purge_confirm', { channel: props.channelName })}
        confirmLabel={t('workspace.chat.purge')}
        danger
        busy={busy}
        onConfirm={purge}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
