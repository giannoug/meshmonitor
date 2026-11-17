/**
 * Server › Background jobs › Solar Monitoring (board 13-26's Solar row; s13n7):
 * on phone the Solar rows of 13-10 are a page of their own, saved as you go.
 */
import { useTranslation } from 'react-i18next';
import SettingGroup from '../settings/kit/SettingGroup';
import { SolarRows } from './BackgroundJobsPage';
import ServerFrame from './ServerFrame';
import { useServerAccess } from './serverEntries';

export default function SolarPage() {
  const { t } = useTranslation();
  const { isAdmin } = useServerAccess();
  return (
    <ServerFrame
      categoryId="background-jobs"
      title={t('settings.solar_monitoring')}
      scope={t('workspace.server.jobs_scope')}
      icon="sun"
      gate="write"
      readOnly={!isAdmin}
      back={{ label: t('workspace.server.nav.background_jobs'), to: '/server/background-jobs' }}
    >
      <SettingGroup>
        <SolarRows />
      </SettingGroup>
    </ServerFrame>
  );
}
