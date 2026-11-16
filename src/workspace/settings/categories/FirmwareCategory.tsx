/**
 * Maintenance › Firmware (boards 12-09 / 12-19, Task 5.7): today's OTA wizard,
 * FirmwareUpdateSection, as it is (its steps, the unsupported-board card, what
 * it downloads and flashes), under the Workspace header. Listed only for an
 * admin on a server with OTA updates on (categories.ts, today's gate).
 *
 * FirmwareCard is the Maintenance page's link here, with the newest release
 * from today's releases query (same key, so the page reads it once).
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UiIcon } from '../../../components/icons';
import FirmwareUpdateSection from '../../../components/configuration/FirmwareUpdateSection';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import { appBasename } from '../../../init';
import { compareVersions } from '../../../utils/scriptSource';
import SendsLine from '../../patterns/SendsLine';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import type { CategoryProps } from '../categories';
import { MaintenancePage } from './maintenanceShared';
// Today's section reads the settings sheet's classes (setting-item, save-button).
import '../../../styles/settings.css';
import styles from './Maintenance.module.css';

export default function FirmwareCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  return (
    // The phone bar fits "Firmware" beside "‹ Maintenance" (12-19); today's "Firmware Updates" does not.
    <MaintenancePage child={{ sourceId, scope: t('workspace.settings.maintenance.firmware_scope'), phoneTitle: t('workspace.settings.maintenance.firmware') }}>
      <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
      <FirmwareUpdateSection baseUrl={appBasename} />
    </MaintenancePage>
  );
}

/** "2.7.15.567b8ea" → "2.7.15", the form releases are named in. */
const release = (version: string) => version.split('.').slice(0, 3).join('.');

export function FirmwareCard({ base }: { base: string }) {
  const { t } = useTranslation();
  const csrfFetch = useCsrfFetch();
  const config = useSharedDeviceConfig();
  // FirmwareUpdateSection's releases query (key, URL, staleTime), so both share one read.
  const { data } = useQuery<{ releases?: Array<{ version: string }> }>({
    queryKey: ['firmware', 'releases'],
    queryFn: async () => {
      const res = await csrfFetch(`${appBasename}/api/firmware/releases`);
      if (!res.ok) throw new Error('Failed to fetch firmware releases');
      return res.json();
    },
    staleTime: 60000,
  });
  const installed = config && !config.state.loading ? release(config.state.localFirmwareVersion ?? '') : '';
  const latest = data?.releases?.[0]?.version;
  const newer = !!latest && !!installed && compareVersions(latest, installed) > 0;
  return (
    <Link to={`${base}/maintenance/firmware`} className={styles.firmware}>
      <UiIcon name="upload" size={20} />
      <span className={styles.firmwareLabel}>{t('workspace.settings.maintenance.firmware')}</span>
      <span className={styles.versions}>
        {newer ? t('workspace.settings.maintenance.firmware_versions', { installed, latest }) : installed}
      </span>
      {newer && <span className={styles.tag}>{t('firmware.update_available')}</span>}
      <UiIcon name="chevronRight" size={18} />
    </Link>
  );
}
