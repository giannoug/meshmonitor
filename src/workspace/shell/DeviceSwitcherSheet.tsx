/**
 * The phone device switcher (board c-home-e2-switcher): Overview first (note
 * ds3), then the readable devices in Server › Devices order with their state
 * and unread (disabled ones drop out, note ds6), then Add device for admins.
 * On desktop the rail is the switcher.
 */
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon } from '../../components/icons';
import Sheet from '../patterns/Sheet';
import TwoLineRow from '../patterns/TwoLineRow';
import { statusLabel } from './deviceTabs';
import type { WorkspaceSource } from './useWorkspaceSources';
import styles from './DeviceSwitcherSheet.module.css';

interface DeviceSwitcherSheetProps {
  open: boolean;
  onClose(): void;
  sources: WorkspaceSource[];
  openId: string | null;
  overviewActive: boolean;
}

/** Receive-only: MQTT ingest with no radio of its own, or a MeshCore node set never to transmit. */
const isReceiveOnly = (s: WorkspaceSource) =>
  s.type === 'mqtt_broker' || s.type === 'meshcore_mqtt' || s.radio?.receiveOnly === true;

const TYPE_KEYS: Record<string, string> = {
  meshtastic_tcp: 'meshtastic',
  meshtastic_mqtt: 'meshtastic',
  meshcore: 'meshcore',
  meshcore_mqtt: 'meshcore_mqtt',
  reticulum: 'reticulum',
  mqtt_broker: 'mqtt_broker',
  mqtt_bridge: 'mqtt_bridge',
};

export default function DeviceSwitcherSheet({ open, onClose, sources, openId, overviewActive }: DeviceSwitcherSheetProps) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const isAdmin = authStatus?.authenticated === true && authStatus.user?.isAdmin === true;

  const line = (s: WorkspaceSource) => {
    const type = TYPE_KEYS[s.type] ? t(`workspace.switcher.type.${TYPE_KEYS[s.type]}`) : s.type;
    // A Reticulum device says what it carries rather than "Connected" (board).
    const state = s.type === 'reticulum' && s.status === 'connected' ? t('workspace.switcher.lxmf') : statusLabel(t, s.status);
    return `${type} · ${state}`;
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('workspace.shell.devices')}>
      <TwoLineRow
        to="/overview"
        onClick={onClose}
        active={overviewActive}
        leading={<span className={`${styles.square} ${styles.plain}`}><UiIcon name="dashboard" size={22} /></span>}
        title={t('workspace.shell.overview')}
        subtitle={t('workspace.switcher.overview_subtitle')}
        trailing={<UiIcon name="chevronRight" size={18} />}
      />
      <h3 className={styles.label}>{t('workspace.shell.devices')}</h3>
      <div className={styles.devices}>
        {sources
          .filter((s) => s.status !== 'disabled')
          .map((s) => {
            const current = s.id === openId;
            return (
              <TwoLineRow
                key={s.id}
                to={`/source/${encodeURIComponent(s.id)}`}
                onClick={onClose}
                active={current}
                leading={
                  <span className={styles.square} style={{ background: s.colorToken }} aria-hidden="true">
                    {s.abbrev}
                  </span>
                }
                title={
                  <>
                    <span className={styles.name}>{s.name}</span>
                    {isReceiveOnly(s) && <span className={styles.chip}>{t('workspace.switcher.receive_only')}</span>}
                  </>
                }
                subtitle={
                  <>
                    <span className={styles.dot} data-status={s.status} aria-hidden="true" />
                    <span>{line(s)}</span>
                  </>
                }
                trailing={
                  current ? (
                    <span className={styles.check}>
                      <UiIcon name="check" size={20} />
                    </span>
                  ) : (
                    s.unread > 0 && (
                      <span className={styles.badge}>
                        {s.unread > 99 ? '99+' : s.unread}
                      </span>
                    )
                  )
                }
              />
            );
          })}
        {isAdmin && (
          <TwoLineRow
            to="/server/devices?add=1"
            onClick={onClose}
            leading={<span className={`${styles.square} ${styles.plain}`}><UiIcon name="plus" size={22} /></span>}
            title={<span className={styles.add}>{t('workspace.shell.add_device')}</span>}
          />
        )}
      </div>
    </Sheet>
  );
}
