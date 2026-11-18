/**
 * A device's settings, `/source/:id/settings[/<category>[/<sub>]]` (Task 5.2,
 * spec §6 P5), for the device types Classic serves with App. App is not
 * mounted here (Ruling AD), the remote target (`?node=`, Task 5.9) included:
 * an admin picks a node (TargetPicker) and the categories read and send that
 * node's values (RemoteTarget), each category's `target` set here.
 *
 * - Desktop: the shell's sidebar is SettingsList; this draws the open
 *   category, and `/settings` opens the first one.
 * - Phone: `/settings` is the list page; each category or group index is a page.
 * - A category this device lacks (after switching devices) or an unknown one
 *   opens the device's first category.
 *
 * Ruling DG: the device's configuration is loaded once here, for a viewer who
 * may open its radio categories (today's Configuration tab load), and shared
 * through `useSharedDeviceConfig()` (sharedDeviceConfig.ts); no category page loads its own.
 *
 * Task 5.3: radio edits queue in the frame's one save queue (useRadioSaveQueue)
 * and save from RadioSaveBar, with one reboot notice. Since Task 5.6 every
 * queued category is built on the row kit. MQTT keeps today's own save (radioSections.ts),
 * as do the In MeshMonitor categories. With edits queued, a link out of the
 * device's settings asks first (LeaveGuard).
 *
 * Task 5.5: Security saves through the queue, its confirms run by the frame
 * (securitySaveGuard.tsx) before the write. An over-long MeshBeacon message
 * holds Save as an invalid field does (Task 5.6). A page with a dock of its own
 * (Channels' reorder mode, a channel's edit page) claims the dock and the
 * radio bar yields; a channel's draft is listed by the leave guard (settingsDock.ts).
 */
import { lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { RebootModal } from '../../components/RebootModal';
import { SaveBar } from '../../components/SaveBar';
import { useAuth } from '../../contexts/AuthContext';
import { DataProvider } from '../../contexts/DataContext';
import { SaveBarProvider, useSaveBarContext } from '../../contexts/SaveBarContext';
import { NumberInputScope } from '../../components/common/NumberInputScope';
import { useNumberInputScope } from '../../components/common/numberInputScopeContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useDeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import { useDeviceConfigSaves } from '../../hooks/deviceConfig/useDeviceConfigSaves';
import { appBasename } from '../../init';
import StateView from '../patterns/StateView';
import { Redirect } from '../rehost/pages';
import { useIsPhone } from '../shell/useIsPhone';
import { readOnlyFor, resolveSettingsPath, type CategoryTarget } from './categories';
import CategoryPage from './CategoryPage';
import SettingsList from './SettingsList';
import { DeviceConfigContext } from './sharedDeviceConfig';
import { useVisibleCategories } from './useVisibleCategories';
import { RadioSaveQueueContext, useRadioSaveQueueState } from './useRadioSaveQueue';
import RadioSaveBar from './RadioSaveBar';
import LeaveGuard from './LeaveGuard';
import { useSecuritySaveGuard } from './securitySaveGuard';
import { meshBeaconTooLong } from './moduleChecks';
import { SettingsDockContext, type PendingEdit } from './settingsDock';
import { isQueued } from './radioSections';
import { useTargetNode } from './remote/useTargetNode';
import type { RemoteNode } from './remote/remoteTargetStore';
import RemoteTarget from './remote/RemoteTarget';
import TargetPickerSheet from './remote/TargetPicker';

const LOCAL: CategoryTarget = { kind: 'local' };

/** A MeshCore device's settings run in its screen's one useMeshCore (Task 7.3, Ruling AD). */
const MeshCoreScreen = lazy(() => import('../meshcore/MeshCoreScreen.tsx'));
/** A Reticulum device's LXMF identity and RNode radio (Task 7.6). */
const ReticulumSettingsFrame = lazy(() => import('../reticulum/settings/ReticulumSettingsFrame.tsx'));

export interface SettingsFrameProps {
  sourceId: string;
  source: DashboardSource;
  /** What follows `/settings/` in the URL (or in the URL a Classic link is being redirected to). */
  path: string;
}

export default function SettingsFrame({ sourceId, source, path }: SettingsFrameProps) {
  // A MeshCore device: its remote targets (Task 7.3), on the shared list, pages and categories.
  if (source.type === 'meshcore') return <MeshCoreScreen sourceId={sourceId} source={source} screen={{ kind: 'settings', path }} />;
  if (source.type === 'reticulum') return <ReticulumSettingsFrame sourceId={sourceId} source={source} path={path} />;
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
  const { hasPermission, authStatus } = useAuth();
  // Today's admin routes: an admin, on a Meshtastic radio.
  const remoteAllowed = authStatus?.user?.isAdmin === true && source.type === 'meshtastic_tcp';
  const pick = useTargetNode(sourceId, remoteAllowed);
  const { ready, categories } = useVisibleCategories(sourceId, source.type, !!pick.node);
  if (!ready || pick.pending) return <RouteLoading />;
  const target: CategoryTarget = pick.node ? { kind: 'remote', nodeNum: pick.node.nodeNum } : LOCAL;

  const base = `/source/${encodeURIComponent(sourceId)}/settings`;
  const { categoryId, group, sub } = resolveSettingsPath(rest);
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
        sub={sub}
        categories={categories}
        sourceId={sourceId}
        target={target}
        readOnly={readOnlyFor(def, hasPermission, sourceId)}
      />
    );
  } else if (categories.length > 0) {
    page = <Navigate replace to={`${base}/${categories[0].id}`} />;
  } else {
    page = <StateView kind="noPermission" />;
  }

  if (!radio) return page;
  return (
    <RadioConfig
      sourceId={sourceId}
      deviceName={source.name}
      base={base}
      compact={!rest && isPhone}
      remote={pick.node}
      nodes={pick.nodes}
      // The remote bar stays ("No changes yet") on a page that sends through it.
      remoteBar={isQueued(def?.saveSection) || def?.saveSection === 'mqtt'}
    >
      <Redirect to={pick.fix}>{page}</Redirect>
      {remoteAllowed && <TargetPickerSheet sourceId={sourceId} nodes={pick.nodes} local={pick.local} deviceName={source.name} />}
    </RadioConfig>
  );
}

type Reboot = 'always' | 'possible';
const stronger = (a: Reboot | null, b: Reboot): Reboot => (a === 'always' ? 'always' : b);

interface RadioConfigProps {
  sourceId: string;
  deviceName: string;
  base: string;
  compact: boolean;
  /** The remote node settings configure (Task 5.9), or null for this radio. */
  remote: RemoteNode | null;
  nodes: RemoteNode[];
  remoteBar: boolean;
  children: ReactNode;
}

/** The one useDeviceConfigState of this device (Ruling DG), its save queue and one reboot notice. */
function RadioConfig({ sourceId, deviceName, base, compact, remote, nodes, remoteBar, children }: RadioConfigProps) {
  const [refresh, setRefresh] = useState(0);
  const [reboot, setReboot] = useState<Reboot | null>(null);
  // While the queue saves, reboot signals collect here and open one modal at the end.
  const batch = useRef<{ e: Reboot | null } | null>(null);
  const state = useDeviceConfigState(sourceId, refresh);
  // App's handler: one modal while several saves land, keeping the stronger expectation.
  const saves = useDeviceConfigSaves(state, {
    onRebootExpected: (e) => {
      if (batch.current) batch.current.e = stronger(batch.current.e, e);
      else setReboot((prev) => stronger(prev, e));
    },
  });
  const runBatch = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    batch.current = { e: null };
    try {
      return await fn();
    } finally {
      const e = batch.current?.e;
      batch.current = null;
      if (e) setReboot((prev) => stronger(prev, e));
    }
  }, []);
  // Every number field on a radio page reports here, so an invalid one holds the queue's Save (#5649).
  const numbers = useNumberInputScope();
  const config = { state, saves };
  const security = useSecuritySaveGuard(state);
  const queue = useRadioSaveQueueState(config, {
    numberScope: numbers,
    runBatch,
    guards: { security: security.guard },
  });
  // Today's MeshBeacon section never saved an over-long message (the device drops the whole config
  // silently): while MeshBeacon is queued on firmware that has it, that holds Save on every page as
  // an invalid field does, with the same words, so nothing is skipped without a reason on screen.
  const beaconTooLong =
    !!state.supportedModules?.meshBeacon && queue.queue.some((e) => e.section === 'meshbeacon') && meshBeaconTooLong(state);
  const { report } = numbers.context;
  useEffect(() => report('meshbeacon.message', beaconTooLong), [report, beaconTooLong]);
  // Today's SaveBar, drawn for MQTT and the rest: one bar at a time.
  const classicDirty = [...useSaveBarContext().sections.values()].some((s) => s.hasChanges);
  // A page's own dock (reorder mode, a channel's edits) holds a claim; the radio bar yields to it.
  const [claims, setClaims] = useState(0);
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const dock = useMemo(
    () => ({
      claim: () => {
        setClaims((n) => n + 1);
        return () => setClaims((n) => n - 1);
      },
      setPending,
    }),
    [],
  );
  return (
    <DeviceConfigContext.Provider value={config}>
      <RadioSaveQueueContext.Provider value={queue}>
        <SettingsDockContext.Provider value={dock}>
          <NumberInputScope scope={numbers}>
            {remote ? (
              // This radio's values and queue stay as they are underneath (Ruling DG).
              <RemoteTarget
                key={remote.nodeNum}
                sourceId={sourceId}
                node={remote}
                nodes={nodes}
                showBar={remoteBar && !classicDirty && claims === 0}
                // Asks before a link leaves with the node's or this radio's edits queued (it reads both queues).
                guard={<LeaveGuard base={base} pending={pending} />}
              >
                {children}
              </RemoteTarget>
            ) : (
              children
            )}
          </NumberInputScope>
        </SettingsDockContext.Provider>
        {!remote && !classicDirty && claims === 0 && <RadioSaveBar deviceName={deviceName} compact={compact} />}
        {!remote && <LeaveGuard base={base} pending={pending} />}
        {security.sheets}
      </RadioSaveQueueContext.Provider>
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
