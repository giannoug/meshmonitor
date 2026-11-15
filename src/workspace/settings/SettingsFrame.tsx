/**
 * A device's settings, `/source/:id/settings[/<category>[/<sub>]]` (Task 5.2,
 * spec §6 P5), for the device types Classic serves with App. App is not
 * mounted here (Ruling AD); the remote target (`?node=`) stays with today's
 * Admin Commands until Task 5.9.
 *
 * - Desktop: the shell's sidebar is SettingsList; this draws the open
 *   category, and `/settings` opens the first one.
 * - Phone: `/settings` is the list page; each category or group index is a page.
 * - A category this device lacks (after switching devices) or an unknown one
 *   opens the device's first category.
 *
 * Ruling DG: the device's configuration is loaded once here, for a viewer who
 * may open its radio categories (today's Configuration tab load), and shared
 * through `useSharedDeviceConfig()` (sharedDeviceConfig.ts); no category page loads its own. Its
 * saves are today's handlers: the Classic sections a category shows until
 * Tasks 5.3–5.8 save through today's SaveBar and reboot notice.
 */
import { useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { RebootModal } from '../../components/RebootModal';
import { SaveBar } from '../../components/SaveBar';
import { useAuth } from '../../contexts/AuthContext';
import { DataProvider } from '../../contexts/DataContext';
import { SaveBarProvider } from '../../contexts/SaveBarContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useDeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import { useDeviceConfigSaves } from '../../hooks/deviceConfig/useDeviceConfigSaves';
import { appBasename } from '../../init';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import { readOnlyFor, resolveSettingsPath, type CategoryTarget } from './categories';
import CategoryPage from './CategoryPage';
import SettingsList from './SettingsList';
import { DeviceConfigContext } from './sharedDeviceConfig';
import { useVisibleCategories } from './useVisibleCategories';

/** Settings always configure the device this source is connected to, until Task 5.9 adds the remote target. */
const LOCAL: CategoryTarget = { kind: 'local' };

export interface SettingsFrameProps {
  sourceId: string;
  source: DashboardSource;
  /** What follows `/settings/` in the URL (or in the URL a Classic link is being redirected to). */
  path: string;
}

export default function SettingsFrame({ sourceId, source, path }: SettingsFrameProps) {
  return (
    <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
      <SettingsProvider baseUrl={appBasename}>
        <DataProvider>
          <SaveBarProvider>
            <Frame sourceId={sourceId} source={source} path={path} />
            <SaveBar />
          </SaveBarProvider>
        </DataProvider>
      </SettingsProvider>
    </SourceProvider>
  );
}

function Frame({ sourceId, source, path: rest }: SettingsFrameProps) {
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  const { ready, categories } = useVisibleCategories(sourceId, source.type);
  if (!ready) return <RouteLoading />;

  const base = `/source/${encodeURIComponent(sourceId)}/settings`;
  const { categoryId, group } = resolveSettingsPath(rest);
  const def = categories.find((c) => c.id === categoryId);
  const groupShown = !!group && categories.some((c) => c.group === group);
  const radio = categories.some((c) => c.scope === 'radio');

  let page: ReactNode;
  if (!rest && isPhone) {
    page = <SettingsList sourceId={sourceId} sourceName={source.name} sourceType={source.type} variant="page" />;
  } else if (def || groupShown) {
    page = (
      <CategoryPage
        key={def?.id ?? group}
        def={def}
        group={def ? undefined : group}
        categories={categories}
        sourceId={sourceId}
        target={LOCAL}
        readOnly={readOnlyFor(def, hasPermission, sourceId)}
      />
    );
  } else if (categories.length > 0) {
    page = <Navigate replace to={`${base}/${categories[0].id}`} />;
  } else {
    page = <StateView kind="noPermission" />;
  }

  return radio ? <RadioConfig sourceId={sourceId}>{page}</RadioConfig> : page;
}

/** The one useDeviceConfigState of this device (Ruling DG), with today's saves and reboot notice. */
function RadioConfig({ sourceId, children }: { sourceId: string; children: ReactNode }) {
  const [refresh, setRefresh] = useState(0);
  const [reboot, setReboot] = useState<'always' | 'possible' | null>(null);
  const state = useDeviceConfigState(sourceId, refresh);
  // App's handler: one modal while several saves land, keeping the stronger expectation.
  const saves = useDeviceConfigSaves(state, {
    onRebootExpected: (e) => setReboot((prev) => (prev === 'always' ? 'always' : e)),
  });
  return (
    <DeviceConfigContext.Provider value={{ state, saves }}>
      {children}
      <RebootModal
        isOpen={reboot !== null}
        expectation={reboot ?? 'always'}
        onClose={() => {
          setReboot(null);
          setRefresh((n) => n + 1);
        }}
      />
    </DeviceConfigContext.Provider>
  );
}
