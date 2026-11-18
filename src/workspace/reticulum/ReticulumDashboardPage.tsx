/**
 * The device's Dashboard (board 9-01's sidebar row, note s9n3), native at
 * `/source/:id/dashboard`: today's per-source Dashboard widget grid against
 * today's Reticulum data source (interfaces' rate history, peers sharing
 * telemetry), which today sat under the Interfaces cards. Phase 8 redraws the
 * Dashboard for every device type; until then its grid is today's.
 * It reads; nothing here sends.
 */
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { appBasename } from '../../init';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { reticulumDashboardSource } from '../../components/Dashboard/dataSources';
import ToolHead from '../meshcore/ToolHead';
import { useIsPhone } from '../shell/useIsPhone';
import { useRnsRuntime } from './runtime';
import styles from './Reticulum.module.css';

const Dashboard = lazy(() => import('../../components/Dashboard/Dashboard.tsx'));

export default function ReticulumDashboardPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  const { temperatureUnit, telemetryVisualizationHours, favoriteTelemetryStorageDays } = useSettings();
  const { sourceId } = useRnsRuntime();
  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      <ToolHead title={t('nav.dashboard')} back={{ label: t('workspace.tabs.home'), to: `/source/${encodeURIComponent(sourceId)}` }} />
      <Suspense fallback={<RouteLoading />}>
        <Dashboard
          baseUrl={appBasename}
          dataSource={reticulumDashboardSource}
          temperatureUnit={temperatureUnit}
          telemetryHours={telemetryVisualizationHours}
          favoriteTelemetryStorageDays={favoriteTelemetryStorageDays}
          canEdit={hasPermission('dashboard', 'write', { sourceId })}
        />
      </Suspense>
    </div>
  );
}
