/**
 * A MeshCore device's phone Home (board 8-16, note s8n6): its own header (the
 * device square and name open the switcher, the status line its Connection
 * card, the gear today's Settings, and ⋯ Advert nearby, Flood advert and
 * Disconnect; no bell, Activity stays in the tab bar), then the device's tools,
 * Channels, Rooms and Direct messages (MeshCoreSidebar).
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon } from '../../components/icons';
import { visibleMeshCoreViews } from '../../components/MeshCore/meshCoreViewAccess';
import OfflineBanner from '../devices/OfflineBanner';
import { useShellDevices } from '../shell/shellDevices';
import AdvertMenu from './AdvertMenu';
import PhoneDeviceHeader from './PhoneDeviceHeader';
import MeshCoreSidebar from './MeshCoreSidebar';
import MeshCoreErrorBar from './MeshCoreErrorBar';
import { useMeshCoreRuntime } from './runtime';
import threadStyles from '../chat/ChannelThread.module.css';
import styles from './MeshCoreHome.module.css';

export default function MeshCoreHome() {
  const { t } = useTranslation();
  const { authStatus, hasPermission } = useAuth();
  const { sources } = useShellDevices();
  const { sourceId, meshCore } = useMeshCoreRuntime();
  const source = sources.find((s) => s.id === sourceId);
  const visible = visibleMeshCoreViews({
    canRead: (resource) => hasPermission(resource, 'read', { sourceId }),
    isAuthenticated: authStatus?.authenticated ?? false,
  });
  if (!source) return null;
  const type = meshCore.status?.connected ? meshCore.status.deviceTypeName : null;

  return (
    <div className={threadStyles.page} data-phone="">
      <PhoneDeviceHeader sourceId={sourceId} detail={type}>
        {visible.includes('settings') && (
          <Link className={styles.icon} to={`/source/${encodeURIComponent(sourceId)}/settings`} aria-label={t('nav.settings', 'Settings')}>
            <UiIcon name="settings" size={22} />
          </Link>
        )}
        <AdvertMenu />
      </PhoneDeviceHeader>
      <OfflineBanner sourceId={sourceId} />
      <MeshCoreErrorBar />
      <div className={styles.lists}>
        <MeshCoreSidebar source={source} variant="home" />
      </div>
    </div>
  );
}
