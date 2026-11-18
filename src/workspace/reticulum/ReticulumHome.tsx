/**
 * A Reticulum device's phone Home (board 9-09, notes s9n0, s9n4): its own
 * header (the square and name open the switcher, the status line "Connected ·
 * own · 4 interfaces" its Connection card, the gear Settings, and Refresh),
 * then the device's tools and LXMF MESSAGES (ReticulumSidebar). Refresh is
 * today's re-fetch, once per press; it sends nothing on the network.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon } from '../../components/icons';
import OfflineBanner from '../devices/OfflineBanner';
import { useShellDevices } from '../shell/shellDevices';
import PhoneDeviceHeader from '../meshcore/PhoneDeviceHeader';
import ReticulumSidebar from './ReticulumSidebar';
import { useRnsRuntime } from './runtime';
import homeStyles from '../meshcore/MeshCoreHome.module.css';
import styles from './Reticulum.module.css';

export default function ReticulumHome() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { sources } = useShellDevices();
  const { sourceId, rns } = useRnsRuntime();
  const source = sources.find((s) => s.id === sourceId);
  if (!source) return null;
  const status = rns.status;
  const detail = status?.connected
    ? [status.mode, t('workspace.reticulum.interfaces_count', { count: status.interfaceCount })].filter(Boolean).join(' · ')
    : null;

  return (
    <>
      <PhoneDeviceHeader sourceId={sourceId} detail={detail}>
        <button
          type="button"
          className={styles.headIcon}
          disabled={rns.loading}
          aria-label={t('common.refresh', 'Refresh')}
          onClick={() => void rns.refresh()}
        >
          <UiIcon name="refresh" size={22} />
        </button>
        {hasPermission('configuration', 'read', { sourceId }) && (
          <Link className={homeStyles.icon} to={`/source/${encodeURIComponent(sourceId)}/settings`} aria-label={t('nav.settings', 'Settings')}>
            <UiIcon name="settings" size={22} />
          </Link>
        )}
      </PhoneDeviceHeader>
      <OfflineBanner sourceId={sourceId} />
      {rns.error && (
        <div className={styles.errorBar} role="alert" data-phone="">
          <span className={styles.statusError}>{rns.error}</span>
          <button type="button" className={styles.plainButton} disabled={rns.loading} onClick={() => void rns.refresh()}>
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}
      <div className={homeStyles.lists}>
        <ReticulumSidebar source={source} variant="home" />
      </div>
    </>
  );
}
