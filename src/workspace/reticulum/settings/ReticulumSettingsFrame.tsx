/**
 * A Reticulum device's settings in the shared settings frame (Task 7.6,
 * `/source/:id/settings[/<page>]`, boards 9-06, 9-07, 9-13): LXMF identity and,
 * in own mode, RNode radio (today's Configuration view), on the shared
 * SettingsList, CategoryPage and category registry. Its In MeshMonitor group
 * is one link to Global Settings (today's Settings view held only that).
 *
 * - Desktop: the shell's sidebar is SettingsList; `/settings` opens the first page.
 * - Phone: `/settings` is the list page; each page has Back.
 * - A page this device lacks, or an unknown one, opens the first page.
 *
 * No runtime of the device screen runs here (no status poll): RNode radio
 * follows the source's configured mode, as today's status reports it.
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { SourceProvider } from '../../../contexts/SourceContext';
import type { DashboardSource } from '../../../hooks/useDashboardData';
import { appBasename } from '../../../init';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import CategoryPage from '../../settings/CategoryPage';
import SettingsList from '../../settings/SettingsList';
import { readOnlyFor, reticulumFacts, resolveSettingsPath, type CategoryTarget } from '../../settings/categories';
import { useVisibleCategories } from '../../settings/useVisibleCategories';

const LOCAL: CategoryTarget = { kind: 'local' };

export interface ReticulumSettingsFrameProps {
  sourceId: string;
  source: DashboardSource;
  /** What follows `/settings/` in the URL. */
  path: string;
}

export default function ReticulumSettingsFrame(props: ReticulumSettingsFrameProps) {
  return (
    <SourceProvider sourceId={props.sourceId} sourceName={props.source.name} sourceType={props.source.type}>
      <SettingsProvider baseUrl={appBasename}>
        <Frame {...props} />
      </SettingsProvider>
    </SourceProvider>
  );
}

function Frame({ sourceId, source, path }: ReticulumSettingsFrameProps) {
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  const { ready, categories } = useVisibleCategories(sourceId, 'reticulum', false, undefined, reticulumFacts(source.config));
  if (!ready) return <StateView kind="loading" page />;
  const base = `/source/${encodeURIComponent(sourceId)}/settings`;
  const { categoryId, sub } = resolveSettingsPath(path);
  const def = categories.find((c) => c.id === categoryId);
  let page: ReactNode;
  if (!path && isPhone) {
    page = <SettingsList sourceId={sourceId} sourceName={source.name} sourceType="reticulum" variant="page" />;
  } else if (def) {
    page = (
      <CategoryPage
        key={def.id}
        def={def}
        sub={sub}
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
  return page;
}
