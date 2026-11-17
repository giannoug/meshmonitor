/**
 * A MeshCore device's phone Home (board 8-16, note s8n6): its own header (the
 * device square and name open the switcher, the status line its Connection
 * card, the gear today's Settings, and ⋯ Advert nearby, Flood advert and
 * Disconnect; no bell, Activity stays in the tab bar), then the device's tools,
 * Channels, Rooms and Direct messages (MeshCoreSidebar).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon } from '../../components/icons';
import { visibleMeshCoreViews } from '../../components/MeshCore/meshCoreViewAccess';
import ConnectionCard from '../devices/ConnectionCard';
import OfflineBanner from '../devices/OfflineBanner';
import { statusLabel } from '../shell/deviceTabs';
import { useShellDevices } from '../shell/shellDevices';
import AdvertMenu from './AdvertMenu';
import MeshCoreSidebar from './MeshCoreSidebar';
import MeshCoreErrorBar from './MeshCoreErrorBar';
import { useMeshCoreRuntime } from './runtime';
import threadStyles from '../chat/ChannelThread.module.css';
import styles from './MeshCoreHome.module.css';

export default function MeshCoreHome() {
  const { t } = useTranslation();
  const { authStatus, hasPermission } = useAuth();
  const { sources, openSwitcher } = useShellDevices();
  const { sourceId, meshCore } = useMeshCoreRuntime();
  const [cardOpen, setCardOpen] = useState(false);
  const source = sources.find((s) => s.id === sourceId);
  const visible = visibleMeshCoreViews({
    canRead: (resource) => hasPermission(resource, 'read', { sourceId }),
    isAuthenticated: authStatus?.authenticated ?? false,
  });
  if (!source) return null;
  const type = meshCore.status?.connected ? meshCore.status.deviceTypeName : null;
  const line = [statusLabel(t, source.status), type].filter(Boolean).join(' · ');

  return (
    <div className={threadStyles.page} data-phone="">
      <header className={styles.header}>
        <div className={styles.ident}>
          <button type="button" className={styles.name} onClick={openSwitcher} aria-haspopup="dialog" aria-label={t('workspace.switcher.open', { name: source.name })}>
            <span className={styles.square} style={{ background: source.colorToken }} aria-hidden="true">{source.abbrev}</span>
            <span className={styles.nameText}>{source.name}</span>
            <UiIcon name="chevronDown" size={18} />
          </button>
          <button
            type="button"
            className={styles.status}
            aria-haspopup="dialog"
            aria-label={t('workspace.connection.status_line', { name: source.name, status: line })}
            onClick={() => setCardOpen(true)}
          >
            <span className={styles.dot} data-status={source.status} aria-hidden="true" />
            <span>{line}</span>
          </button>
        </div>
        {visible.includes('settings') && (
          <Link className={styles.icon} to={`/source/${encodeURIComponent(sourceId)}/settings`} aria-label={t('nav.settings', 'Settings')}>
            <UiIcon name="settings" size={22} />
          </Link>
        )}
        <AdvertMenu />
      </header>
      <ConnectionCard source={source} open={cardOpen} onClose={() => setCardOpen(false)} />
      <OfflineBanner sourceId={sourceId} />
      <MeshCoreErrorBar />
      <div className={styles.lists}>
        <MeshCoreSidebar source={source} variant="home" />
      </div>
    </div>
  );
}
