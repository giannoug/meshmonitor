/**
 * The offline note (boards h5, i4; note ds7): an offline device keeps its
 * history and pauses sending, and this says so where its conversations and
 * Home are. It opens the device's Connection card: from its button on
 * desktop, and on the phone the whole note is the button. Nothing shows
 * while the device is connected, still loading, or disabled. A device that
 * never sends (receive-only, an MQTT mirror) is not told sending is paused:
 * its conversations already say why it cannot send.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { isReceiveOnly } from '../shell/deviceTabs';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import ConnectionCard from './ConnectionCard';
import styles from './OfflineBanner.module.css';

export default function OfflineBanner({ sourceId }: { sourceId: string | null | undefined }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sources } = useShellDevices();
  const [open, setOpen] = useState(false);
  const source = sources.find((s) => s.id === sourceId);
  if (source?.status !== 'offline') return null;

  // The chat's receive-only line covers the MQTT mirrors (broker and bridge) and receive-only devices.
  const listenOnly = isReceiveOnly(source) || source.type === 'mqtt_bridge';
  const text = (key: string) => t(listenOnly ? 'workspace.connection.banner_listen_only' : key, { name: source.name });
  const card = <ConnectionCard source={source} open={open} onClose={() => setOpen(false)} />;
  if (isPhone) {
    return (
      <>
        <button type="button" className={styles.banner} data-phone="" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <UiIcon name="info" size={20} />
          <span className={styles.text}>{text('workspace.connection.banner_short')}</span>
        </button>
        {card}
      </>
    );
  }
  return (
    <div className={styles.banner} role="status">
      <UiIcon name="info" size={18} />
      <span className={styles.text}>{text('workspace.connection.banner')}</span>
      <button type="button" className={styles.button} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t('workspace.connection.title')}
      </button>
      {card}
    </div>
  );
}
