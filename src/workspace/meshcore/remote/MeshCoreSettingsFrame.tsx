/**
 * A MeshCore device's settings in the shared settings frame: this radio's
 * pages (Task 7.4, `/source/:id/settings[/<page>]`) and a remote target's
 * (Task 7.3, `/source/:id/settings[/node-settings|/console]?node=<key>`).
 * SettingsFrame hands a MeshCore device to MeshCoreScreen, so these pages run
 * on the screen's one useMeshCore (Ruling AD); the frame's parts are the
 * shared ones (SettingsList, CategoryPage, the category registry).
 *
 * The node comes from `?node=<public key>` (the node page's Log in and Console
 * links), else the target picked earlier while these settings stay open;
 * links inside drop the query, so the frame puts it back. A key that is not a
 * repeater or room server in this radio's contacts, or a viewer without
 * today's `remote_admin:write`, gets a not-found or no-permission note with a
 * link to the node's page (Ruling 7.3 HJ). Picking or opening a target sends nothing.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RouteLoading from '../../../components/RouteLoading/RouteLoading';
import { useAuth } from '../../../contexts/AuthContext';
import type { MeshCoreContact } from '../../../utils/meshcoreHelpers';
import { Redirect } from '../../rehost/pages';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import CategoryPage from '../../settings/CategoryPage';
import SettingsList from '../../settings/SettingsList';
import { useQuery } from '@tanstack/react-query';
import { RADIO_PRESETS, findPresetId } from '../../../components/MeshCore/radioPresets';
import { MESHCORE_DEFAULT_MAX_CHANNELS } from '../../../utils/meshcoreChannelUrl';
import { readOnlyFor, resolveSettingsPath, type CategoryTarget } from '../../settings/categories';
import { useVisibleCategories } from '../../settings/useVisibleCategories';
import { clearRemote, updateRemote, useRemoteEntry, type RemoteNode } from '../../settings/remote/remoteTargetStore';
import { useMeshCoreRuntime } from '../runtime';
import { channelsQuery } from '../useMeshCoreLists';
import LocalRepeaterProvider from '../settings/LocalRepeaterProvider';
import { MeshCoreTargetProvider } from './MeshCoreRemoteTarget';
import { contactLabel, isRemoteTarget } from './remoteTarget';
import MeshCoreTargetPicker from './MeshCoreTargetPicker';
import styles from './McRemote.module.css';

// A MeshCore node has no node number: its pages read the target from useMeshCoreTarget().
const TARGET: CategoryTarget = { kind: 'remote', nodeNum: 0 };
const LOCAL: CategoryTarget = { kind: 'local' };

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
  // A key that names no repeater or room server here stays in the URL: the frame says so (HJ).
  const fix = contact && asked !== contact.publicKey ? `${pathname}?node=${contact.publicKey}${hash}` : null;

  // The settings list (sidebar) reads the target from the store.
  useEffect(() => {
    if (pending || entry.node?.nodeId === (contact?.publicKey ?? undefined)) return;
    updateRemote(sourceId, { node: contact ? asRemoteNode(contact) : null });
  }, [pending, sourceId, contact, entry.node?.nodeId]);
  // Closing the device's settings forgets the target.
  useEffect(() => () => clearRemote(sourceId), [sourceId]);

  return { pending, contact, targets, fix, asked };
}

/**
 * The device's role and the list's summaries (8-22: Radio's preset, Channels
 * "3 of 8", Contacts, Connection), for the settings list and search, which
 * sit outside this screen. Read from what the screen already holds, plus
 * today's channel list (the sidebar's cached request).
 */
function useDeviceFacts(sourceId: string) {
  const { t } = useTranslation();
  const { meshCore } = useMeshCoreRuntime();
  const status = meshCore.status;
  const local = status?.localNode;
  const connected = status?.connected ?? false;
  const channels = useQuery({ ...channelsQuery(sourceId, connected), enabled: !!status });
  const used = channels.data?.filter((c) => !c.virtual).length;
  const preset = local ? RADIO_PRESETS.find((p) => p.id === findPresetId(local.radioFreq ?? 0, local.radioBw ?? 0, local.radioSf ?? 0, local.radioCr ?? 0)) : undefined;
  const contacts = meshCore.contacts.filter((c) => !c.isLocal).length;
  const kind = status?.config?.connectionType;
  const summaries: Record<string, string> = {
    ...(preset ? { radio: preset.label } : {}),
    ...(used !== undefined ? { channels: t('workspace.meshcore.settings.slots_used', { used, total: local?.maxChannels ?? MESHCORE_DEFAULT_MAX_CHANNELS }) } : {}),
    ...(meshCore.hasLoadedOnce ? { contacts: String(contacts) } : {}),
    console: t('workspace.meshcore.settings.serial_cli'),
    ...(kind ? { connection: kind.toUpperCase() } : {}),
  };
  const key = JSON.stringify([status?.deviceType, local?.advType, summaries]);
  useEffect(() => {
    const [deviceType, advType, s] = JSON.parse(key) as [number | undefined, number | undefined, Record<string, string>];
    updateRemote(sourceId, { device: status ? { deviceType: deviceType ?? undefined, advType: advType ?? undefined, summaries: s } : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 the key holds every value; status only says whether it is read yet
  }, [sourceId, key, !!status]);
  return status ? { deviceType: status.deviceType, advType: local?.advType } : undefined;
}

export default function MeshCoreSettingsFrame({ path }: { path: string }) {
  const { t } = useTranslation();
  const { sourceId, deviceName, meshCore } = useMeshCoreRuntime();
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  // Today's remote console: remote_admin:write on this source.
  const allowed = hasPermission('remote_admin', 'write', { sourceId });
  const pick = useTargetFromUrl(sourceId, allowed);
  const facts = useDeviceFacts(sourceId);
  const { ready, categories } = useVisibleCategories(sourceId, 'meshcore', !!pick.contact, facts);
  // This radio's pages wait for its role: they follow today's sections by role.
  if (!ready || pick.pending || (!pick.contact && !facts && !meshCore.hasLoadedOnce)) return <RouteLoading />;

  const base = `/source/${encodeURIComponent(sourceId)}/settings`;
  // `maintenance` reads as Meshtastic's group name; on a MeshCore device it is the page.
  const { categoryId, group, sub } = resolveSettingsPath(path);
  const def = categories.find((c) => c.id === (categoryId ?? group));
  let page: ReactNode;
  if (pick.asked && !pick.contact) {
    // Without today's remote_admin:write, or with a key that is no repeater or room server in this
    // radio's contacts: a note, and the node page (what the old Node Details link showed), not a redirect.
    page = (
      <section className={styles.page}>
        <StateView
          kind={allowed ? 'notFound' : 'noPermission'}
          detail={allowed ? t('workspace.meshcore.remote.not_a_target') : t('workspace.node_menu.needs', { permission: 'remote_admin:write' })}
        />
        <Link className={styles.button} to={`/source/${encodeURIComponent(sourceId)}/node/${encodeURIComponent(pick.asked)}`}>
          {t('workspace.meshcore.remote.open_node_page')}
        </Link>
      </section>
    );
  } else if (!path && isPhone) {
    page = <SettingsList sourceId={sourceId} sourceName={deviceName} sourceType="meshcore" variant="page" />;
  } else if (def) {
    page = (
      <CategoryPage
        key={def.id}
        def={def}
        sub={sub}
        categories={categories}
        sourceId={sourceId}
        target={pick.contact ? TARGET : LOCAL}
        readOnly={pick.contact ? !allowed : readOnlyFor(def, hasPermission, sourceId)}
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
        // A local repeater's settings, read once while its settings stay open (Ruling HL).
        <LocalRepeaterProvider>{page}</LocalRepeaterProvider>
      )}
      {allowed && <MeshCoreTargetPicker sourceId={sourceId} targets={pick.targets} deviceName={deviceName} />}
    </Redirect>
  );
}
