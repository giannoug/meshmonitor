/**
 * A MeshCore node's page (boards 8-05, 8-20 companion; g6-meshcore repeater;
 * notes s8n0, s8n3, s8n6): `/source/:id/node/:key[/<tab>]`. The node page's
 * frame (NodeHeader, Facts) with MeshCore's tabs and today's Node Details
 * controls (MeshCoreContactDetailPanel and what the DM view mounts under it).
 *
 * - Header: Message (a repeater: Log in, which opens today's console), then
 *   Ask the node (Ping, Trace path, Discover path), Organise (favourite, Show
 *   on Map, ignore / block) and Data (location override, Share, Export,
 *   Remove). Tabs: Overview, Telemetry, then Links / Position / Admin, or for
 *   a repeater Neighbours / Admin; a repeater or room server adds Console, a
 *   link to `settings/console?node=<key>`.
 * - Every transmitting control is one request per press through today's
 *   `useMeshCore` action, with its Sends line and no retry. Reset path, Share,
 *   Remove and Block ask first in a ConfirmSheet with today's words; the others
 *   ask nothing, as today. Gates are today's: write needs the permission on
 *   this source and a connected Companion; receive-only turns the sends off.
 * - Opening the page and re-rendering it send nothing on the mesh: its reads
 *   are server reads (stored neighbours, trace history, the admin session).
 */
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import { MeshCoreNeighboursFetchProgress } from '../../components/MeshCore/MeshCoreNeighboursFetchProgress';
import { MeshCoreNotOnDeviceNotice } from '../../components/MeshCore/MeshCoreNotOnDeviceNotice';
import { MeshCoreCompanionRemoteConsole } from '../../components/MeshCore/MeshCoreCompanionRemoteConsole';
import { MeshCoreNodeNeighboursConfig } from '../../components/MeshCore/MeshCoreNodeNeighboursConfig';
import { MeshCoreNodeTelemetryConfig } from '../../components/MeshCore/MeshCoreNodeTelemetryConfig';
import { MeshCoreNodeTimeSyncConfig } from '../../components/MeshCore/MeshCoreNodeTimeSyncConfig';
import { MeshCoreTracePathMap } from '../../components/MeshCore/MeshCoreTracePathMap';
import { MeshCoreTraceSnrCard } from '../../components/MeshCore/MeshCoreTraceSnrCard';
import { MeshCoreTraceSnrCharts } from '../../components/MeshCore/MeshCoreTraceSnrCharts';
import { useMeshCoreNeighboursFetch } from '../../components/MeshCore/hooks/useMeshCoreNeighboursFetch';
import { meshcoreRoleLabel, meshcoreRoleLabelKey } from '../../components/MeshCore/meshcoreRole';
import NodeNameHistory from '../../components/NodeNameHistory';
import { SignFlipNotice } from '../../components/SignFlipNotice';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import {
  useMeshCoreIgnoredNodes,
  useRemoveMeshCoreIgnoredNode,
  useSetMeshCoreIgnoredNode,
} from '../../hooks/useMeshCoreFilters';
import { appBasename } from '../../init';
import api from '../../services/api';
import type { DeviceInfo } from '../../types/device';
import type { ResourceType } from '../../types/permission';
import { formatRelativeTime } from '../../utils/datetime';
import { meshcoreLastHeardMs } from '../../utils/meshcoreAge';
import { isHiddenByPositionlessAdvert, readHidePositionlessAdverts } from '../../utils/meshcoreAdvertPosition';
import { companionHasNativeCli } from '../../utils/meshcoreCompanionCli';
import type { MeshCoreContact } from '../../utils/meshcoreHelpers';
import { indexNodeFields, mergeNodeFields } from '../../utils/meshcoreNodeFieldMerge';
import { parsePathHops, repeaterHopOptions, resolveHop, pathHashBytesOf } from '../../utils/meshcorePath';
import { shouldDiscardPosition } from '../../utils/nullIsland';
import { getDiscardInvalidPositions } from '../../utils/positionDisplayConfig';
import { formatCompactSpan, isClockNotSet } from '../../utils/securityClock';
import { Fact, FactCard, Facts } from '../node-page/Facts';
import NodeHeader from '../node-page/NodeHeader';
import headerStyles from '../node-page/NodeHeader.module.css';
import pageStyles from '../node-page/NodePage.module.css';
import OverridePositionSheet from '../node-page/dialogs/OverridePositionSheet';
import ConfirmSheet from '../patterns/ConfirmSheet';
import NodeActionMenus, { type NodeMenuGroups } from '../patterns/NodeActionMenus';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import PathEditor from './PathEditor';
import { shortMark } from './meshcoreLabels';
import { useMeshCoreRuntime } from './runtime';
import { useContactActions, type ContactActions } from './useContactActions';
import styles from './ContactPage.module.css';

const TelemetryGraphs = lazy(() => import('../../components/TelemetryGraphs'));
const SignalTrendBadge = lazy(() => import('../../components/SignalTrendBadge'));
const SmartHopsGraphs = lazy(() => import('../../components/SmartHopsGraphs'));
const LinkQualityGraph = lazy(() => import('../../components/LinkQualityGraph'));

/** ContactInfo.flags bit: this contact may run CLI commands on us (#5867). */
const CONTACT_FLAG_REMOTE_CLI = 0x10;
const REPEATER = 2;
const ROOM_SERVER = 3;

type Dialog = 'reset' | 'share' | 'remove' | 'block' | 'override' | 'path' | null;

export default function ContactPage({ publicKey, tab }: { publicKey: string; tab: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { timeFormat, dateFormat } = useSettings();
  const { sourceId, meshCore, receiveOnly } = useMeshCoreRuntime();
  const { contacts, nodes, status, actions, hasLoadedOnce } = meshCore;
  const key = publicKey.toLowerCase();
  const nodeRow = nodes.find((n) => n.publicKey.toLowerCase() === key);
  const raw = contacts.find((c) => c.publicKey.toLowerCase() === key);
  const fieldIndex = useMemo(() => indexNodeFields(nodes), [nodes]);
  // As the DM view: the node rows' advert position, signature and clock offset; a node that is no contact still has a page.
  const contact: MeshCoreContact | null = raw
    ? mergeNodeFields(raw, fieldIndex, ['advertPosition', 'advertSignatureVerified', 'clockOffset'])
    : nodeRow
      ? ({ publicKey: nodeRow.publicKey, advName: nodeRow.name, advType: nodeRow.advType, latitude: nodeRow.latitude, longitude: nodeRow.longitude,
          rssi: nodeRow.rssi, snr: nodeRow.snr, lastSeen: nodeRow.lastHeard } as MeshCoreContact)
      : null;
  const a = useContactActions(raw?.publicKey ?? publicKey, contact, actions, nodeRow?.isFavorite ?? false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const ignored = useMeshCoreIgnoredNodes(sourceId);
  const setIgnored = useSetMeshCoreIgnoredNode(sourceId);
  const removeIgnored = useRemoveMeshCoreIgnoredNode(sourceId);

  if (!contact) return <div className={pageStyles.page}><StateView kind={hasLoadedOnce ? 'notFound' : 'loading'} /></div>;

  const pk = contact.publicKey;
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const name = contact.advName || contact.name || `${pk.substring(0, 8)}…`;
  const advType = contact.advType;
  const connected = status?.connected ?? false;
  const isCompanion = (status?.deviceType ?? 0) === 1;
  const scope = { sourceId };
  const can = (resource: ResourceType) => hasPermission(resource, 'write', scope);
  const needs = (resource: ResourceType) => (can(resource) ? undefined : t('workspace.node_menu.needs', { permission: `${resource}:write` }));
  // Today's gates for what reaches the radio: the permission, a connected Companion, receive-only off.
  const sendReason = (resource: ResourceType) =>
    needs(resource) ??
    (!connected ? t('source.status_disconnected') : !isCompanion ? t('workspace.meshcore.companion_only') : receiveOnly
      ? t('meshcore.receive_only.control_tooltip', 'Receive-only mode is on for this MeshCore source. Turn it off in MeshCore Settings to use this.')
      : undefined);
  // Writes to the radio's contact record (not the mesh): no receive-only check, as today.
  const radioReason = (resource: ResourceType) =>
    needs(resource) ?? (!connected ? t('source.status_disconnected') : !isCompanion ? t('workspace.meshcore.companion_only') : undefined);
  const pathLen = contact.pathLen;
  const pathKnown = typeof pathLen === 'number' && pathLen >= 0;
  // A direct neighbour is traced through its own hash (#5914): only a repeater or room server forwards it.
  const traceable = pathKnown && (pathLen! > 0 || advType === REPEATER || advType === ROOM_SERVER);
  const traceReason = sendReason('traceroute') ?? (traceable ? undefined : t('workspace.meshcore.path_unknown'));
  const isFavorite = a.isFavorite;
  const ignoreMode = ignored.data?.find((e) => e.publicKey.toLowerCase() === key)?.mode ?? null;
  const hasPosition = typeof contact.latitude === 'number' && typeof contact.longitude === 'number';
  // #5964: Show on Map only for a node the MeshCore map draws (and not one on the ignore list, #5408).
  const canShowOnMap = hasPosition && !ignoreMode
    && !shouldDiscardPosition(contact.latitude!, contact.longitude!, undefined, getDiscardInvalidPositions())
    && (contact.isLocal === true || !isHiddenByPositionlessAdvert(contact, readHidePositionlessAdverts()));
  const heardMs = meshcoreLastHeardMs(contact);
  const ago = (ms: number | null | undefined) => (typeof ms === 'number' ? formatRelativeTime(ms, timeFormat, dateFormat, false) : null);
  const isRepeater = advType === REPEATER;
  const hasConsole = advType === REPEATER || advType === ROOM_SERVER;
  const consoleUrl = `${base}/settings/console?node=${encodeURIComponent(pk)}`;
  const page = `${base}/node/${encodeURIComponent(pk)}`;
  const tabKeys = isRepeater ? ['overview', 'telemetry', 'neighbours', 'admin'] : ['overview', 'telemetry', 'links', 'position', 'admin'];
  const shown = tabKeys.includes(tab) ? tab : 'overview';
  // A tab this node type lacks (Neighbours on a companion, Links on a repeater): Overview, and the URL follows.
  if (shown !== tab) return <Navigate to={page} replace />;
  const tabLabel = (k: string) => (k === 'neighbours' ? t('workspace.meshcore.tab_neighbours') : t(`workspace.node.tab_${k}`));

  const stub = {
    nodeNum: parseInt(pk.slice(0, 8), 16) || 0,
    user: { id: pk, longName: name, shortName: shortMark(name) },
    lastHeard: heardMs ? heardMs / 1000 : undefined,
    isFavorite,
  } as unknown as DeviceInfo;

  const groups: NodeMenuGroups = {
    ask: [
      { id: 'ping', icon: 'activity', label: t('workspace.meshcore.ping'), sends: t('workspace.meshcore.sends_ping'),
        reason: sendReason('nodes'), busy: a.pinging, run: () => void a.runPing() },
      { id: 'trace', icon: 'route', label: t('workspace.meshcore.trace_path'), sends: t(a.autoReturn ? 'workspace.meshcore.sends_trace_return' : 'workspace.meshcore.sends_trace'),
        reason: traceReason, busy: a.tracing, run: () => void a.runTrace() },
      { id: 'discover', icon: 'refresh', label: t('meshcore.contact_details.discover_path_button'), sends: t('workspace.meshcore.sends_discover_path'),
        reason: sendReason('nodes'), busy: a.discovering, run: () => void a.runDiscover() },
    ],
    organise: [
      { id: 'favorite', icon: isFavorite ? 'favorite' : 'favoriteOff',
        label: isFavorite ? t('meshcore.contact_details.favorite_remove', 'Remove from favorites') : t('meshcore.contact_details.favorite_add', 'Add to favorites'),
        reason: needs('nodes') ?? (!connected ? t('source.status_disconnected') : undefined), busy: a.favoriteBusy, run: () => void a.toggleFavorite() },
      ...(canShowOnMap
        ? [{ id: 'map', icon: 'map' as const, label: t('messages.show_on_map', 'Show on Map'), run: () => void navigate(`${base}/map?node=${encodeURIComponent(pk)}`) }]
        : []),
      ...(ignoreMode
        ? [{ id: 'unignore', icon: 'unmute' as const, label: t('meshcore.ignore.remove_button', 'Remove from ignore/block list'), reason: needs('nodes'),
            run: () => void removeIgnored.mutateAsync(pk) }]
        : [
            { id: 'ignore', icon: 'muted' as const, label: t('meshcore.ignore.ignore_button', 'Ignore'), reason: needs('nodes'),
              run: () => void setIgnored.mutateAsync({ publicKey: pk, mode: 'ignore', name }) },
            { id: 'block', icon: 'blocked' as const, label: t('meshcore.ignore.block_button', 'Block'), reason: needs('nodes'), danger: true, run: () => setDialog('block') },
          ]),
    ],
    data: [
      { id: 'override', icon: 'location', label: t('meshcore.contact_details.override_location', 'Override location'), hint: t('workspace.node_menu.override_hint'),
        reason: needs('nodes'), run: () => setDialog('override') },
      { id: 'share', icon: 'radioSignal', label: t('workspace.meshcore.share_contact'), sends: t('workspace.meshcore.sends_share'),
        reason: sendReason('nodes'), busy: a.sharing, run: () => setDialog('share') },
      { id: 'export', icon: 'copy', label: t('workspace.meshcore.export_contact'), hint: t('workspace.meshcore.export_hint'),
        reason: isCompanion ? undefined : t('workspace.meshcore.companion_only'), busy: a.exporting, run: () => void a.runExport() },
      { id: 'remove', icon: 'delete', label: t('workspace.meshcore.remove'), hint: t('workspace.meshcore.remove_hint'), danger: true,
        reason: radioReason('nodes'), busy: a.removing, run: () => setDialog('remove') },
    ],
  };

  // Console sits before Admin (board g6 draws Overview, Telemetry, Neighbours, Console).
  const tabs = [
    ...tabKeys.filter((k) => k !== 'admin').map((k) => ({ key: k, label: tabLabel(k), to: k === 'overview' ? page : `${page}/${k}` })),
    ...(hasConsole ? [{ key: 'console', label: t('workspace.meshcore.tab_console'), to: consoleUrl, external: true }] : []),
    { key: 'admin', label: tabLabel('admin'), to: `${page}/admin` },
  ];
  const remoteAdminReason = needs('remote_admin') ?? (!connected ? t('source.status_disconnected') : !isCompanion ? t('workspace.meshcore.companion_only') : undefined);
  // A repeater keeps Log in first: today's console (login, saved password, session) for this node.
  const primary = isRepeater ? (
    remoteAdminReason ? (
      <span className={headerStyles.message} aria-disabled="true" title={remoteAdminReason} data-off="">
        <UiIcon name="terminal" size={isPhone ? 22 : 18} />
        {t('workspace.meshcore.log_in')}
      </span>
    ) : (
      <Link className={headerStyles.message} to={consoleUrl} title={t('workspace.meshcore.log_in_title')}>
        <UiIcon name="terminal" size={isPhone ? 22 : 18} />
        {t('workspace.meshcore.log_in')}
      </Link>
    )
  ) : undefined;

  const pathCard = (
    <PathCard contact={contact} contacts={contacts} a={a} isPhone={isPhone} ago={ago}
      discoverReason={sendReason('nodes')} resetReason={sendReason('nodes')} editReason={radioReason('nodes')}
      onSave={(path, width) => actions.setContactOutPath(pk, path, width)} onReset={() => setDialog('reset')} onEdit={() => setDialog('path')} />
  );
  const notInRadio = isCompanion && contact.onDevice === false && (
    <div className={styles.card}>
      <MeshCoreNotOnDeviceNotice key={pk} publicKey={pk} onAddToDevice={actions.addContactToDevice} canAdd={!radioReason('nodes')} />
      <SendsLine>{t('workspace.meshcore.sends_add_to_radio')}</SendsLine>
    </div>
  );

  let body: ReactNode;
  if (shown === 'overview' && isRepeater) {
    body = (
      <div className={styles.stack}>
        {notInRadio}
        {pathCard}
        <RepeaterFacts publicKey={pk} sourceId={sourceId} nodeRow={nodeRow} canAsk={can('remote_admin')} />
      </div>
    );
  } else if (shown === 'overview') {
    const cliAllowed = ((contact.flags ?? 0) & CONTACT_FLAG_REMOTE_CLI) !== 0;
    const localNativeCli = isCompanion && companionHasNativeCli(status?.localNode?.firmwareVer);
    const cliReason = needs('configuration') ?? (!connected ? t('source.status_disconnected') : !localNativeCli
      ? t('meshcore.remote_cli.needs_firmware', 'Needs firmware 1.18.0 or later on this radio.')
      : contact.onDevice === false ? t('meshcore.not_on_device.control_tooltip') : undefined);
    const facts = (
      <Facts>
        {typeof advType === 'number' && <Fact label={t('meshcore.type', 'Type')}>{t(meshcoreRoleLabelKey(advType), meshcoreRoleLabel(advType))}</Fact>}
        <Fact label={t('meshcore.public_key', 'Public Key')}><code className={styles.key} title={pk}>{pk}</code></Fact>
        {typeof contact.snr === 'number' && <Fact label={t('node_details.signal_snr', 'Signal (SNR)')}>{`${contact.snr.toFixed(1)} dB`}</Fact>}
        {typeof contact.rssi === 'number' && <Fact label={t('node_details.signal_rssi', 'Signal (RSSI)')}>{`${contact.rssi} dBm`}</Fact>}
        {typeof contact.lastAdvert === 'number' && (
          <Fact label={t('meshcore.contact_details.last_advert', 'Last Advert')}>{ago(meshcoreLastHeardMs({ lastAdvert: contact.lastAdvert }))}</Fact>
        )}
        {typeof nodeRow?.firstHeard === 'number' && <Fact label={t('node_details.first_heard', 'First Heard')}>{ago(nodeRow.firstHeard)}</Fact>}
        {typeof contact.lastSeen === 'number' && <Fact label={t('node_details.last_heard', 'Last Heard')}>{ago(contact.lastSeen)}</Fact>}
        {hasPosition && <Fact label={t('meshcore.contact_details.position', 'Position')}>{`${contact.latitude!.toFixed(4)}, ${contact.longitude!.toFixed(4)}`}</Fact>}
        <Fact label={t('meshcore.advert_signature', 'Advert signature')}>
          {contact.advertSignatureVerified === true
            ? t('meshcore.advert_signature_verified', 'Verified')
            : contact.advertSignatureVerified === false
              ? t('meshcore.advert_signature_failed', 'Failed')
              : t('meshcore.advert_signature_unchecked', 'Not checked')}
        </Fact>
        {typeof contact.clockOffsetSeconds === 'number' && (
          <Fact label={t('meshcore.clock_offset', 'Clock offset')}>
            {isClockNotSet(contact.clockOffsetSeconds)
              ? t('security.clock_not_set', 'Clock not set')
              : `${formatCompactSpan(contact.clockOffsetSeconds)} ${contact.clockOffsetSeconds >= 0 ? t('meshcore.clock_offset_behind', 'behind') : t('meshcore.clock_offset_ahead', 'ahead')}`}
          </Fact>
        )}
      </Facts>
    );
    const cli = advType === 1 && isCompanion && (
      <div className={styles.card}>
        <label className={styles.switchRow}>
          <span>
            <span className={styles.cardTitle}>{t('workspace.meshcore.allow_cli')}</span>
            <span className={styles.muted}>{t('workspace.meshcore.allow_cli_sub')}</span>
          </span>
          <input type="checkbox" role="switch" className={styles.switch} checked={cliAllowed} disabled={!!cliReason || a.cliBusy}
            onChange={(e) => void a.setRemoteCli(e.target.checked)} title={cliReason} />
        </label>
        <p className={styles.muted}>
          {t('meshcore.remote_cli.warning', 'This contact could run any command on this radio, including reboot and radio settings, and every command makes this radio reply over the air.')}
        </p>
        {cliReason ? <p className={styles.reason}>{cliReason}</p> : <SendsLine>{t('workspace.meshcore.sends_add_to_radio')}</SendsLine>}
        {a.cliError && <p className={styles.error} role="alert">{a.cliError}</p>}
      </div>
    );
    const shareExport = (
      <div className={styles.buttons}>
        <button type="button" className={styles.button} disabled={!!sendReason('nodes') || a.sharing} title={sendReason('nodes')} onClick={() => setDialog('share')}>
          <UiIcon name="link" size={16} />
          {t('workspace.meshcore.share_contact')}
        </button>
        <button type="button" className={styles.button} disabled={!isCompanion || a.exporting} title={isCompanion ? undefined : t('workspace.meshcore.companion_only')}
          onClick={() => void a.runExport()}>
          <UiIcon name="download" size={16} />
          {t('workspace.meshcore.export_contact')}
        </button>
        {(sendReason('nodes') ?? (isCompanion ? undefined : t('workspace.meshcore.companion_only'))) && (
          <p className={styles.reason}>{sendReason('nodes') ?? t('workspace.meshcore.companion_only')}</p>
        )}
        {a.shareNote && <p className={a.shareNote.ok ? styles.ok : styles.error} role={a.shareNote.ok ? 'status' : 'alert'}>{a.shareNote.text}</p>}
        {a.exported && <p className={styles.ok} role="status">{t('meshcore.contact_details.export_contact_success', 'Copied to clipboard.')}</p>}
      </div>
    );
    const history = (
      <div className={styles.historyRow}>
        <LinkHistory sourceId={sourceId} publicKey={pk} />
        <MeshCoreTraceSnrCard sourceId={sourceId} publicKey={pk} contacts={contacts} localPublicKey={status?.localNode?.publicKey ?? null}
          canClear={can('traceroute')} />
      </div>
    );
    const ask = advType !== REPEATER && (
      <AskCard a={a} contacts={contacts} selfKey={status?.localNode?.publicKey} outPath={contact.outPath} pingReason={sendReason('nodes')} traceReason={traceReason} />
    );
    body = isPhone ? (
      <div className={styles.stack}>
        {notInRadio}
        {pathCard}
        {ask}
        <FactCard title={t('workspace.meshcore.details')}>{facts}</FactCard>
        {cli}
        {shareExport}
        {history}
        <NodeNameHistory nodeId={pk} currentName={contact.advName || contact.name || null} timeFormat={timeFormat} dateFormat={dateFormat} />
      </div>
    ) : (
      <div className={styles.columns}>
        <div className={styles.stack}>
          {pathCard}
          {ask}
          {history}
          <NodeNameHistory nodeId={pk} currentName={contact.advName || contact.name || null} timeFormat={timeFormat} dateFormat={dateFormat} />
        </div>
        <div className={styles.stack}>
          {facts}
          {notInRadio}
          {cli}
          {shareExport}
        </div>
      </div>
    );
  } else if (shown === 'telemetry') {
    body = <TelemetryPane publicKey={pk} />;
  } else if (shown === 'links') {
    body = (
      <div className={styles.stack}>
        {a.trace && <TraceTable a={a} outPath={contact.outPath} />}
        <MeshCoreTracePathMap sourceId={sourceId} contact={contact} contacts={contacts} traceResult={a.trace?.result ?? null} outPath={contact.outPath} />
        <MeshCoreTraceSnrCharts sourceId={sourceId} publicKey={pk} contacts={contacts} localPublicKey={status?.localNode?.publicKey ?? null} />
      </div>
    );
  } else if (shown === 'position') {
    body = (
      <div className={styles.stack}>
        <Facts>
          <Fact label={t('meshcore.contact_details.position', 'Position')}>
            {hasPosition ? `${contact.latitude!.toFixed(5)}, ${contact.longitude!.toFixed(5)}` : t('workspace.meshcore.no_position')}
          </Fact>
          {contact.positionIsOverride && (
            <Fact label={t('meshcore.contact_details.location_override', 'Location Override')}>
              {contact.positionOverrideIsPrivate
                ? t('meshcore.contact_details.position_override_private', 'Location override (private)')
                : t('meshcore.contact_details.position_override_active', 'Location override')}
            </Fact>
          )}
        </Facts>
        {contact.positionSignFlipCorrected && contact.reportedLatitude != null && contact.reportedLongitude != null && (
          <SignFlipNotice reportedLatitude={contact.reportedLatitude} reportedLongitude={contact.reportedLongitude} />
        )}
        <div className={styles.buttons}>
          {canShowOnMap && (
            <Link className={styles.button} to={`${base}/map?node=${encodeURIComponent(pk)}`}>
              <UiIcon name="map" size={16} />
              {t('messages.show_on_map', 'Show on Map')}
            </Link>
          )}
          <button type="button" className={styles.button} disabled={!!needs('nodes')} title={needs('nodes')} onClick={() => setDialog('override')}>
            <UiIcon name="location" size={16} />
            {t('meshcore.contact_details.override_location', 'Override location')}
          </button>
        </div>
      </div>
    );
  } else if (shown === 'neighbours') {
    body = <NeighboursPane publicKey={pk} sourceId={sourceId} reason={sendReason('nodes')} />;
  } else {
    const localNativeCli = isCompanion && companionHasNativeCli(status?.localNode?.firmwareVer);
    body = (
      <div className={styles.stack}>
        <MeshCoreNodeTelemetryConfig baseUrl={appBasename} sourceId={sourceId} publicKey={pk} receiveOnly={receiveOnly} />
        <MeshCoreNodeNeighboursConfig baseUrl={appBasename} sourceId={sourceId} publicKey={pk} receiveOnly={receiveOnly} />
        <MeshCoreNodeTimeSyncConfig baseUrl={appBasename} sourceId={sourceId} publicKey={pk} receiveOnly={receiveOnly} />
        {advType === 1 && localNativeCli && !remoteAdminReason && (
          <MeshCoreCompanionRemoteConsole publicKey={pk} contactName={name} actions={actions} receiveOnly={receiveOnly} notOnDevice={contact.onDevice === false} />
        )}
      </div>
    );
  }

  const close = () => setDialog(null);
  return (
    <div className={pageStyles.page} data-phone={isPhone || undefined}>
      <NodeHeader
        sourceId={sourceId}
        node={stub}
        tab={shown}
        parts={{
          role: typeof advType === 'number' ? t(meshcoreRoleLabelKey(advType), meshcoreRoleLabel(advType)) : null,
          id: `${pk.slice(0, 4)}…${pk.slice(-4)}`,
          tabs,
          primary,
          menus: (variant) => <NodeActionMenus protocol="meshcore" sourceId={sourceId} node={stub} variant={variant} groups={groups} />,
        }}
      />
      <div className={pageStyles.body}>
        {isRepeater && remoteAdminReason && <p className={styles.reason}>{t('workspace.meshcore.log_in_off', { reason: remoteAdminReason })}</p>}
        {a.favoriteError && <p className={styles.error} role="alert">{a.favoriteError}</p>}
        {a.removeError && <p className={styles.error} role="alert">{a.removeError}</p>}
        <div className={styles.stack} data-phone={isPhone || undefined}>{body}</div>
      </div>
      <ConfirmSheet
        open={dialog === 'reset'}
        title={t('workspace.meshcore.reset_path')}
        body={<>
          <p>{t('workspace.meshcore.reset_path_confirm', { name })}</p>
          <SendsLine>{t('workspace.meshcore.sends_reset_path')}</SendsLine>
        </>}
        confirmLabel={t('workspace.meshcore.reset_path')}
        busy={a.resetting}
        submitOnEnter={false}
        onCancel={close}
        onConfirm={async () => {
          await a.runReset();
          close();
        }}
      />
      <ConfirmSheet
        open={dialog === 'share'}
        title={t('workspace.meshcore.share_contact')}
        body={<>
          <p>{t('workspace.meshcore.share_confirm', { name })}</p>
          <SendsLine>{t('workspace.meshcore.sends_share')}</SendsLine>
        </>}
        confirmLabel={t('workspace.meshcore.share_contact')}
        busy={a.sharing}
        submitOnEnter={false}
        onCancel={close}
        onConfirm={async () => {
          await a.runShare();
          close();
        }}
      />
      <ConfirmSheet
        open={dialog === 'remove'}
        title={t('workspace.meshcore.remove')}
        body={<p>{t('workspace.meshcore.remove_confirm', { name })}</p>}
        confirmLabel={t('workspace.meshcore.remove')}
        danger
        busy={a.removing}
        submitOnEnter={false}
        onCancel={close}
        onConfirm={async () => {
          if (await a.runRemove()) {
            close();
            void navigate(`${base}/nodes`);
          } else close();
        }}
      />
      <ConfirmSheet
        open={dialog === 'block'}
        title={t('meshcore.ignore.block_button', 'Block')}
        body={<p>{t('meshcore.ignore.block_confirm')}</p>}
        confirmLabel={t('meshcore.ignore.block_button', 'Block')}
        danger
        busy={setIgnored.isPending}
        submitOnEnter={false}
        onCancel={close}
        onConfirm={async () => {
          await setIgnored.mutateAsync({ publicKey: pk, mode: 'block', name });
          close();
        }}
      />
      <OverridePositionSheet
        open={dialog === 'override'}
        node={stub}
        nodeName={name}
        protocol="meshcore"
        onClose={close}
        onSave={(_n, data) => actions.setNodePositionOverride(pk, data)}
      />
      <Sheet open={dialog === 'path'} onClose={close} title={t('workspace.meshcore.edit_path')}>
        <PathEditor outPath={contact.outPath} contacts={contacts} reason={radioReason('nodes')}
          onSave={(path, width) => actions.setContactOutPath(pk, path, width)} onSaved={close} />
      </Sheet>
    </div>
  );
}

/** Path (boards 8-05, 8-20, g6): the route, Discover path and Reset path, the editor inline on desktop. */
function PathCard({ contact, contacts, a, isPhone, ago, discoverReason, resetReason, editReason, onSave, onReset, onEdit }: {
  contact: MeshCoreContact;
  contacts: MeshCoreContact[];
  a: ContactActions;
  isPhone: boolean;
  ago(ms: number | null | undefined): string | null;
  discoverReason?: string;
  resetReason?: string;
  editReason?: string;
  onSave(path: string, width: 1 | 2 | 3): Promise<boolean>;
  onReset(): void;
  onEdit(): void;
}) {
  const { t } = useTranslation();
  const pathLen = contact.pathLen;
  const known = typeof pathLen === 'number' && pathLen >= 0;
  const mode = !known ? 'flood' : pathLen === 0 ? 'direct' : 'set';
  const hops = parsePathHops(contact.outPath);
  const options = repeaterHopOptions(contacts, pathHashBytesOf(hops));
  const line = [
    !known ? t('workspace.meshcore.path_unknown') : pathLen === 0 ? t('node_details.direct', 'Direct') : t('workspace.meshcore.hops', { count: pathLen }),
    contact.pathDiscoveredAt ? t('workspace.meshcore.path_found', { time: ago(contact.pathDiscoveredAt) }) : null,
  ].filter(Boolean).join(' · ');
  const d = a.discover;
  return (
    <section className={styles.card} aria-label={t('workspace.meshcore.path')}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{t('workspace.meshcore.path')}</h2>
        <span className={styles.segments} role="group" aria-label={t('workspace.meshcore.path_mode')}>
          {(['direct', 'flood', 'set'] as const).map((m) => (
            <span key={m} className={styles.segment} data-on={m === mode || undefined} aria-current={m === mode || undefined}>
              {t(m === 'direct' ? 'node_details.direct' : m === 'flood' ? 'workspace.meshcore.flood' : 'workspace.meshcore.set_path')}
            </span>
          ))}
        </span>
      </div>
      <p className={styles.muted}>{line}</p>
      {isPhone ? (
        <>
          {hops.length > 0 && (
            <ol className={styles.chips}>
              {hops.map((hop, i) => (
                <li key={`${hop}-${i}`} className={styles.chipItem}>
                  {i > 0 && <UiIcon name="forward" size={16} className={styles.arrow} />}
                  <span className={styles.chip}><code className={styles.hash}>{hop}</code>{resolveHop(hop, options).label}</span>
                </li>
              ))}
            </ol>
          )}
          <button type="button" className={styles.link} onClick={onEdit} disabled={!!editReason} title={editReason}>
            <UiIcon name="edit" size={18} />
            {t('workspace.meshcore.edit_path')}
          </button>
        </>
      ) : (
        <PathEditor key={contact.outPath ?? ''} outPath={contact.outPath} contacts={contacts} reason={editReason} onSave={onSave} />
      )}
      <div className={styles.pair}>
        <div className={styles.action}>
          <button type="button" className={styles.button} onClick={() => void a.runDiscover()} disabled={!!discoverReason || a.discovering} title={discoverReason}>
            <UiIcon name="route" size={16} />
            {d.phase === 'waiting'
              ? t('meshcore.contact_details.discover_path_countdown', 'Discovering… {{seconds}}s', { seconds: a.discoverSecondsLeft })
              : d.phase === 'sending'
                ? t('meshcore.contact_details.discover_path_running', 'Discovering…')
                : t('meshcore.contact_details.discover_path_button')}
          </button>
          {discoverReason ? <p className={styles.reason}>{discoverReason}</p> : <SendsLine>{t('workspace.meshcore.sends_discover_path')}</SendsLine>}
          {d.phase === 'success' && (
            <p className={styles.ok} role="status">
              {t('meshcore.contact_details.discover_path_success', 'Path updated — {{hops}}', {
                hops: d.hops === 0 ? t('node_details.direct', 'Direct') : t('workspace.meshcore.hops', { count: d.hops }),
              })}
            </p>
          )}
          {d.phase === 'timeout' && (
            <p className={styles.reason} role="status">
              {t('meshcore.contact_details.discover_path_no_response', 'No response from {{name}}', { name: contact.advName || contact.name || '' })}
            </p>
          )}
        </div>
        <div className={styles.action}>
          {/* Today hides Reset Path while the route is already unknown (a no-op). */}
          <button type="button" className={styles.button} data-quiet="" onClick={onReset} disabled={!known || !!resetReason || a.resetting} title={resetReason}>
            <UiIcon name="refresh" size={16} />
            {t('workspace.meshcore.reset_path')}
          </button>
          {resetReason ? <p className={styles.reason}>{resetReason}</p> : <SendsLine>{t('workspace.meshcore.sends_reset_path')}</SendsLine>}
          {a.resetError && <p className={styles.error} role="alert">{a.resetError}</p>}
        </div>
      </div>
    </section>
  );
}

/** Ping and Trace path (boards 8-05, 8-20) with their last results. */
function AskCard({ a, contacts, selfKey, outPath, pingReason, traceReason }: {
  a: ContactActions;
  contacts: MeshCoreContact[];
  selfKey?: string | null;
  outPath?: string | null;
  pingReason?: string;
  traceReason?: string;
}) {
  const { t } = useTranslation();
  const { timeFormat } = useSettings();
  const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12' });
  const ping = a.ping?.result;
  return (
    <section className={styles.card} aria-label={t('workspace.node_menu.ask')}>
      <div className={styles.askRow}>
        <button type="button" className={styles.button} onClick={() => void a.runPing()} disabled={!!pingReason || a.pinging} title={pingReason}>
          <UiIcon name="activity" size={16} />
          {a.pinging ? t('meshcore.contact_details.ping_zero_hop_running', 'Pinging…') : t('workspace.meshcore.ping')}
        </button>
        <div className={styles.askText}>
          {ping && a.ping && (ping.ok ? (
            <p role="status">
              {t('workspace.meshcore.rtt', { ms: ping.rttMs, time: clock(a.ping.at) })}
              {' · '}
              {t('meshcore.contact_details.ping_zero_hop_snr_in', 'SNR here')} {ping.snrFromTarget.toFixed(1)} dB
              {ping.snrToTarget !== null && <> · {t('meshcore.contact_details.ping_zero_hop_snr_out', 'SNR at node')} {ping.snrToTarget.toFixed(1)} dB</>}
            </p>
          ) : (
            <p className={styles.error} role="alert">{ping.error}</p>
          ))}
          {pingReason ? <p className={styles.reason}>{pingReason}</p> : <SendsLine>{t('workspace.meshcore.sends_ping')}</SendsLine>}
        </div>
      </div>
      <div className={styles.askRow}>
        <button type="button" className={styles.button} onClick={() => void a.runTrace()} disabled={!!traceReason || a.tracing} title={traceReason}>
          <UiIcon name="route" size={16} />
          {a.tracing ? t('meshcore.contact_details.trace_path_running', 'Tracing…') : t('workspace.meshcore.trace_path')}
        </button>
        <div className={styles.askText}>
          {a.trace && <p role="status">{t('workspace.meshcore.trace_done', { time: clock(a.trace.at) })}</p>}
          {a.traceError && <p className={styles.error} role="alert">{a.traceError}</p>}
          <label className={styles.check}
            title={t('meshcore.contact_details.trace_auto_return_hint', 'Bring the trace back along the same path, for SNR in both directions. Repeaters and room servers are traced through; for a companion the trace turns at the last repeater. Uses about twice the airtime.')}>
            <input type="checkbox" checked={a.autoReturn} disabled={a.tracing} onChange={(e) => a.setAutoReturn(e.target.checked)} />
            {t('meshcore.contact_details.trace_auto_return', 'Auto return path')}
          </label>
          {traceReason ? <p className={styles.reason}>{traceReason}</p> : <SendsLine>{t(a.autoReturn ? 'workspace.meshcore.sends_trace_return' : 'workspace.meshcore.sends_trace')}</SendsLine>}
        </div>
      </div>
      {a.trace && <TraceChain a={a} contacts={contacts} selfKey={selfKey} outPath={outPath} />}
    </section>
  );
}

/** You → each hop → the node, with the SNR each one heard (the board's chain). */
function TraceChain({ a, contacts, selfKey, outPath }: { a: ContactActions; contacts: MeshCoreContact[]; selfKey?: string | null; outPath?: string | null }) {
  const { t } = useTranslation();
  const r = a.trace!.result;
  const hashes = r.path ?? outPath?.split(',') ?? [];
  const options = repeaterHopOptions(contacts, pathHashBytesOf(hashes.filter(Boolean)));
  const self = contacts.find((c) => c.publicKey === selfKey);
  return (
    <ol className={styles.chain} aria-label={t('meshcore.contact_details.trace_path_results', 'Trace Path Results')}>
      <li className={styles.chipItem}><span className={styles.mark}>{shortMark(self?.advName || t('workspace.meshcore.trace_you'))}</span>{t('workspace.meshcore.trace_you')}</li>
      {r.hops.map((hop) => {
        const label = hashes[hop.index] ? resolveHop(hashes[hop.index], options).label : t('workspace.meshcore.hop_unknown');
        return (
          <li key={hop.index} className={styles.chipItem}>
            <UiIcon name="forward" size={16} className={styles.arrow} />
            <span className={styles.mark} title={label}>{shortMark(label)}</span>
            {`${hop.snr >= 0 ? '+' : ''}${hop.snr.toFixed(1)} dB`}
          </li>
        );
      })}
      <li className={styles.chipItem}>
        <UiIcon name="forward" size={16} className={styles.arrow} />
        {t('meshcore.contact_details.trace_destination', 'Destination')} {`${r.lastSnr.toFixed(1)} dB`}
      </li>
    </ol>
  );
}

/** Today's Trace Path Results table (Links tab). */
function TraceTable({ a, outPath }: { a: ContactActions; outPath?: string | null }) {
  const { t } = useTranslation();
  const r = a.trace!.result;
  const hashes = r.path ?? outPath?.split(',') ?? [];
  return (
    <FactCard title={t('meshcore.contact_details.trace_path_results', 'Trace Path Results')}>
      <Facts>
        {r.hops.map((hop) => (
          <Fact key={hop.index} label={`${hop.index + 1} · ${hashes[hop.index] ?? t('workspace.meshcore.hop_unknown')}`}>{`${hop.snr.toFixed(2)} dB`}</Fact>
        ))}
        <Fact label={t('meshcore.contact_details.trace_destination', 'Destination')}>{`${r.lastSnr.toFixed(2)} dB`}</Fact>
      </Facts>
    </FactCard>
  );
}

/** Today's Link history (#6262), lazy: the charts and their reads mount only when opened. */
function LinkHistory({ sourceId, publicKey }: { sourceId: string; publicKey: string }) {
  const { t } = useTranslation();
  const { telemetryVisualizationHours } = useSettings();
  const [open, setOpen] = useState(false);
  return (
    <section className={styles.card}>
      <button type="button" className={styles.disclosure} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <UiIcon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
        {t('meshcore.contact.link_history', 'Link history')}
      </button>
      {open && (
        <Suspense fallback={<StateView kind="loading" />}>
          <SignalTrendBadge nodeId={publicKey} sourceId={sourceId} />
          <SmartHopsGraphs nodeId={publicKey} sourceId={sourceId} allowFavorite={false} telemetryHours={telemetryVisualizationHours ?? 24} />
          <LinkQualityGraph nodeId={publicKey} sourceId={sourceId} allowFavorite={false} telemetryHours={telemetryVisualizationHours ?? 24} />
        </Suspense>
      )}
    </section>
  );
}

/** Telemetry tab: today's graphs for the node, as the DM view draws them. */
function TelemetryPane({ publicKey }: { publicKey: string }) {
  const { temperatureUnit, telemetryVisualizationHours } = useSettings();
  return (
    <Suspense fallback={<StateView kind="loading" />}>
      <TelemetryGraphs nodeId={publicKey} temperatureUnit={temperatureUnit} telemetryHours={telemetryVisualizationHours} baseUrl={appBasename} showTimeRangeSelector />
    </Suspense>
  );
}

/** A repeater's facts (g6): its admin login state (a server read, no airtime) and what its node row holds. */
function RepeaterFacts({ publicKey, sourceId, nodeRow, canAsk }: {
  publicKey: string;
  sourceId: string;
  nodeRow?: { batteryMv?: number; uptimeSecs?: number };
  canAsk: boolean;
}) {
  const { t } = useTranslation();
  const { meshCore } = useMeshCoreRuntime();
  const { data: session, isSuccess } = useQuery({
    queryKey: ['meshcore', 'admin-session', sourceId, publicKey],
    queryFn: () => meshCore.actions.getRemoteAdminSession(publicKey),
    enabled: canAsk,
  });
  return (
    <FactCard title={t('meshcore.device_type.repeater', 'Repeater')}>
      <Facts>
        {/* Only for whoever may log in (today's console is hidden from the rest), once the server answered. */}
        {canAsk && isSuccess && (
          <Fact label={t('workspace.meshcore.admin_login')}>
            <span className={session ? styles.ok : styles.warn}>
              {session ? t('meshcore.remoteConsole.session_saved', 'Saved session') : t('meshcore.rooms.not_logged_in', 'Not logged in')}
            </span>
          </Fact>
        )}
        {typeof nodeRow?.uptimeSecs === 'number' && nodeRow.uptimeSecs > 0 && (
          <Fact label={t('nodes.uptime')}>{formatCompactSpan(nodeRow.uptimeSecs)}</Fact>
        )}
        {typeof nodeRow?.batteryMv === 'number' && nodeRow.batteryMv > 0 && (
          <Fact label={t('nodes.battery')}>{`${(nodeRow.batteryMv / 1000).toFixed(2)} V`}</Fact>
        )}
      </Facts>
    </FactCard>
  );
}

interface StoredNeighbour {
  neighborPublicKey: string;
  neighborName: string | null;
  snr: number | null;
  lastHeardSecs: number | null;
  timestamp: number;
}

/** Neighbours tab (repeater): today's stored table (a server read) and the paged fetch with Cancel. */
function NeighboursPane({ publicKey, sourceId, reason }: { publicKey: string; sourceId: string; reason?: string }) {
  const { t } = useTranslation();
  const { timeFormat, dateFormat } = useSettings();
  const { meshCore } = useMeshCoreRuntime();
  const { actions } = meshCore;
  const fetcher = useMeshCoreNeighboursFetch({
    startNeighboursFetch: actions.startNeighboursFetch,
    getNeighboursFetchProgress: actions.getNeighboursFetchProgress,
    cancelNeighboursFetch: actions.cancelNeighboursFetch,
  });
  const { data: stored } = useQuery({
    queryKey: ['meshcore', 'stored-neighbours', sourceId, publicKey],
    queryFn: async () => {
      const resp = await api.get<{ success: boolean; data: { items: StoredNeighbour[] } }>(
        `/api/sources/${sourceId}/meshcore/neighbors?since=0&node=${encodeURIComponent(publicKey)}`,
      );
      return resp.success ? resp.data.items : [];
    },
  });
  const reset = fetcher.reset;
  useEffect(() => reset, [reset]);
  const live = fetcher.fetch && fetcher.fetch.publicKey.toLowerCase() === publicKey.toLowerCase() ? fetcher.fetch : null;
  const now = Date.now();
  const rows = live && (live.neighbours.length > 0 || live.outcome === 'complete')
    ? live.neighbours.map((n) => ({ key: n.publicKeyPrefix, name: n.name || n.publicKeyPrefix, snr: n.snr, ago: n.heardSecondsAgo }))
    : (stored ?? []).map((n) => ({
        key: n.neighborPublicKey.substring(0, 8),
        name: n.neighborName || n.neighborPublicKey.substring(0, 8),
        snr: n.snr ?? 0,
        ago: (n.lastHeardSecs ?? 0) + Math.max(0, Math.floor((now - n.timestamp) / 1000)),
      }));
  const agoText = (secs: number) => formatRelativeTime(now - secs * 1000, timeFormat, dateFormat, false);
  return (
    <div className={styles.stack}>
      <div className={styles.action}>
        <button type="button" className={styles.button} onClick={() => void fetcher.start(publicKey)} disabled={!!reason || fetcher.running} title={reason}>
          <UiIcon name="network" size={16} />
          {fetcher.running ? t('meshcore.contact_details.neighbours_loading', 'Loading…') : t('workspace.meshcore.fetch_neighbours')}
        </button>
        {reason ? <p className={styles.reason}>{reason}</p> : <SendsLine>{t('workspace.meshcore.sends_neighbours')}</SendsLine>}
      </div>
      {live && <MeshCoreNeighboursFetchProgress fetch={live} onCancel={() => void fetcher.cancel()} />}
      {fetcher.startError && (
        <p className={styles.error} role="alert">
          {fetcher.startError.txDisabled
            ? t('meshcore.receive_only.blocked_toast', 'Receive-only mode is on for this MeshCore source — nothing was sent.')
            : fetcher.startError.message}
        </p>
      )}
      {rows.length === 0 ? (
        <StateView kind="empty" title={t('meshcore.contact_details.neighbours_none', 'No neighbours reported.')} />
      ) : (
        <Facts>
          {rows.map((n) => (
            <Fact key={n.key} label={n.name}>{`${n.snr.toFixed(1)} dB · ${agoText(n.ago)}`}</Fact>
          ))}
        </Facts>
      )}
    </div>
  );
}
