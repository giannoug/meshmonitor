/**
 * A MeshCore device's settings in the shared settings frame (Task 7.3): the
 * remote target pages, `/source/:id/settings[/node-settings|/console]?node=<key>`.
 * SettingsFrame hands a MeshCore device to MeshCoreScreen, so these pages run
 * on the screen's one useMeshCore (Ruling AD); the frame's parts are the
 * shared ones (SettingsList, CategoryPage, the category registry).
 *
 * The node comes from `?node=<public key>` (the node page's Log in and Console
 * links), else the target picked earlier while these settings stay open;
 * links inside drop the query, so the frame puts it back. A key that is not a
 * repeater or room server in this radio's contacts, or a viewer without
 * today's `remote_admin:write`, leaves for today's settings page (the URL
 * without the query). Picking or opening a target sends nothing.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import RouteLoading from '../../../components/RouteLoading/RouteLoading';
import { useAuth } from '../../../contexts/AuthContext';
import type { MeshCoreContact } from '../../../utils/meshcoreHelpers';
import { Redirect } from '../../rehost/pages';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import CategoryPage from '../../settings/CategoryPage';
import SettingsList from '../../settings/SettingsList';
import { readOnlyFor, resolveSettingsPath, type CategoryTarget } from '../../settings/categories';
import { useVisibleCategories } from '../../settings/useVisibleCategories';
import { clearRemote, updateRemote, useRemoteEntry, type RemoteNode } from '../../settings/remote/remoteTargetStore';
import { useMeshCoreRuntime } from '../runtime';
import { MeshCoreTargetProvider } from './MeshCoreRemoteTarget';
import { contactLabel, isRemoteTarget } from './remoteTarget';
import MeshCoreTargetPicker from './MeshCoreTargetPicker';

// A MeshCore node has no node number: its pages read the target from useMeshCoreTarget().
const TARGET: CategoryTarget = { kind: 'remote', nodeNum: 0 };

/** The store's shape for the settings list and its trigger; `nodeId` holds the public key. */
const asRemoteNode = (c: MeshCoreContact): RemoteNode => ({
  nodeNum: 0,
  nodeId: c.publicKey,
  longName: contactLabel(c),
  shortName: '',
  isLocal: false,
  role: c.advType ?? null,
});

function useTargetFromUrl(sourceId: string, allowed: boolean) {
  const [params] = useSearchParams();
  const { pathname, hash } = useLocation();
  const entry = useRemoteEntry(sourceId);
  const { meshCore } = useMeshCoreRuntime();
  const asked = params.get('node');
  const wanted = (asked ?? entry.node?.nodeId ?? null)?.toLowerCase() ?? null;
  const targets = useMemo(
    () => meshCore.contacts.filter(isRemoteTarget).sort((x, y) => contactLabel(x).localeCompare(contactLabel(y))),
    [meshCore.contacts],
  );
  const pending = allowed && !!wanted && !meshCore.hasLoadedOnce;
  const contact = allowed && wanted ? targets.find((c) => c.publicKey.toLowerCase() === wanted) ?? null : null;
  let fix: string | null = null;
  if (!pending && asked && !contact) fix = pathname + hash;
  else if (contact && asked !== contact.publicKey) fix = `${pathname}?node=${contact.publicKey}${hash}`;

  // The settings list (sidebar) reads the target from the store.
  useEffect(() => {
    if (pending || entry.node?.nodeId === (contact?.publicKey ?? undefined)) return;
    updateRemote(sourceId, { node: contact ? asRemoteNode(contact) : null });
  }, [pending, sourceId, contact, entry.node?.nodeId]);
  // Closing the device's settings forgets the target.
  useEffect(() => () => clearRemote(sourceId), [sourceId]);

  return { pending, contact, targets, fix };
}

export default function MeshCoreSettingsFrame({ path }: { path: string }) {
  const { sourceId, deviceName } = useMeshCoreRuntime();
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  // Today's remote console: remote_admin:write on this source.
  const allowed = hasPermission('remote_admin', 'write', { sourceId });
  const pick = useTargetFromUrl(sourceId, allowed);
  const { ready, categories } = useVisibleCategories(sourceId, 'meshcore', !!pick.contact);
  if (!ready || pick.pending) return <RouteLoading />;

  const base = `/source/${encodeURIComponent(sourceId)}/settings`;
  const { categoryId, sub } = resolveSettingsPath(path);
  const def = categories.find((c) => c.id === categoryId);
  let page: ReactNode;
  if (!path && isPhone) {
    page = <SettingsList sourceId={sourceId} sourceName={deviceName} sourceType="meshcore" variant="page" />;
  } else if (def) {
    page = (
      <CategoryPage
        key={def.id}
        def={def}
        sub={sub}
        categories={categories}
        sourceId={sourceId}
        target={TARGET}
        readOnly={readOnlyFor(def, hasPermission, sourceId)}
      />
    );
  } else if (categories.length > 0) {
    page = <Navigate replace to={`${base}/${categories[0].id}`} />;
  } else {
    page = <StateView kind="noPermission" />;
  }
  return (
    <Redirect to={pick.fix}>
      {pick.contact ? (
        <MeshCoreTargetProvider key={pick.contact.publicKey} contact={pick.contact}>
          {page}
        </MeshCoreTargetProvider>
      ) : (
        page
      )}
      {allowed && <MeshCoreTargetPicker sourceId={sourceId} targets={pick.targets} deviceName={deviceName} />}
    </Redirect>
  );
}
