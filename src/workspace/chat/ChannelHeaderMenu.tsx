/**
 * The channel header's ⋯ menu on desktop (board 10-03): today's channel
 * actions in one list. Channel info (opens ChannelInfoSheet), Mute (today's
 * MuteMenu items: indefinitely, 1 hour, 1 week, or Unmute), Mark all as Read
 * (asks first above today's threshold), Show MQTT/Bridge Messages, Beacons
 * with the pending count. Nothing here transmits.
 *
 * On the phone the ⋯ opens ChannelInfoSheet directly, which carries the same
 * rows (board 10-12).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { MuteMenu } from '../../components/notifications/MuteMenu';
import { MarkAllReadButton } from '../../components/messages/MarkAllReadButton';
import styles from './ChannelHeaderMenu.module.css';

export interface ChannelHeaderMenuProps {
  channelName: string;
  muted: boolean;
  onMute(until: number | null): void;
  onUnmute(): void;
  onInfo(): void;
  unreadCount: number;
  onMarkAll(): void;
  /** null: not offered (an MQTT bridge mirror is all MQTT). */
  showMqtt: boolean | null;
  onToggleMqtt(): void;
  /** null: no beacon heard on this device, so no Beacons row (as today). */
  beaconsPending: number | null;
  onBeacons(): void;
}

export default function ChannelHeaderMenu(props: ChannelHeaderMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const label = t('channels.channel_options', 'Channel options');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const then = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <UiIcon name="more" size={18} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label={label}>
          <p className={styles.heading}># {props.channelName}</p>
          <button type="button" role="menuitem" className={styles.item} onClick={then(props.onInfo)}>
            <UiIcon name="info" size={18} />
            <span className={styles.text}>
              <span className={styles.title}>{t('channels.info_modal_title')}</span>
              <span className={styles.desc}>{t('workspace.chat.info_desc')}</span>
            </span>
            <UiIcon name="chevronRight" size={16} />
          </button>
          <div className={styles.group}>
            <UiIcon name="notifications" size={18} />
            <span className={styles.text}>
              <span className={styles.title}>{t('notifications.mute_channel')}</span>
              <span className={styles.segments}>
                <MuteMenu
                  variant="items"
                  muted={props.muted}
                  onMute={props.onMute}
                  onUnmute={props.onUnmute}
                  itemClassName={styles.segment}
                  onDone={() => setOpen(false)}
                />
              </span>
            </span>
          </div>
          <div className={styles.group}>
            <UiIcon name="checkAll" size={18} />
            <span className={styles.text}>
              <MarkAllReadButton
                className={styles.inlineButton}
                label={t('channels.mark_all_read_button')}
                title={t('channels.mark_all_read_title')}
                unreadCount={props.unreadCount}
                confirmMessage={t('workspace.chat.mark_read_confirm')}
                onMarkAll={then(props.onMarkAll)}
              />
              <span className={styles.desc}>{t('workspace.chat.mark_read_desc')}</span>
            </span>
          </div>
          {props.showMqtt !== null && (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={props.showMqtt}
              className={styles.item}
              onClick={props.onToggleMqtt}
            >
              <UiIcon name="network" size={18} />
              <span className={styles.text}>
                <span className={styles.title}>{t('channels.show_mqtt_messages')}</span>
                <span className={styles.desc}>{t('workspace.chat.mqtt_desc')}</span>
              </span>
              <span className={styles.switch} data-on={props.showMqtt || undefined} aria-hidden="true" />
            </button>
          )}
          {props.beaconsPending !== null && (
            <button type="button" role="menuitem" className={styles.item} onClick={then(props.onBeacons)}>
              <UiIcon name="announcement" size={18} />
              <span className={styles.text}>
                <span className={styles.title}>{t('beacons.button')}</span>
                <span className={styles.desc}>{t('beacons.button_title')}</span>
              </span>
              {props.beaconsPending > 0 && <span className={styles.badge}>{props.beaconsPending}</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
