/**
 * NodeActionMenus (spec s10n0, boards 10-01 / 10-07): a node's actions in
 * three groups, Ask the node / Organise / Data, drawn as header menus
 * (`menus`), a phone sheet behind ⋯ (`sheet`), the same sheet behind one
 * button per group, opening on that group's tab (`buttons`, the phone map
 * peek, s15n5), or cards (`tiles`, the node page in section 15).
 *
 * - Every item calls today's request through `useMeshtasticNodeActions`, or
 *   opens its dialog sheet (`node-page/dialogs/`, one at a time, D9c), which
 *   sends today's request. Nothing retries, and nothing sends without a click.
 * - Each ask shows its Sends line. Exchange NodeInfo and Exchange Position go
 *   on the node's channel (today's server default, sent explicitly), never as
 *   a PKI DM (CLAUDE.md, key repair).
 * - Gates are today's (the server's): an item the viewer lacks stays listed,
 *   disabled, with the reason as its tooltip and as a line under it.
 * - MQTT mirrors have no Ask the node; Reticulum has no asks; MeshCore's asks
 *   are listed, off until MeshCore chat comes to the Workspace (Phase 7).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { UiIcon, type UiIconName } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useSource } from '../../contexts/SourceContext';
import { useUI } from '../../contexts/UIContext';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useMeshtasticNodeActions } from '../../hooks/useMeshtasticNodeActions';
import { useNodeIdentityChanges } from '../../hooks/useNodeIdentityChanges';
import { sourcePollQueryKey } from '../../hooks/pollQueryKey';
import { useChannels } from '../../hooks/useServerData';
import { useTxStatus } from '../../hooks/useTxStatus';
import { appBasename } from '../../init';
import type { DeviceInfo } from '../../types/device';
import type { ResourceType } from '../../types/permission';
import { AIRCRAFT_EXCLUDED_SOURCE_TYPES, aircraftMarkActions } from '../../utils/aircraftClassification';
import CopyNodeInfoSheet from '../node-page/dialogs/CopyNodeInfoSheet';
import MergeIdentitySheet from '../node-page/dialogs/MergeIdentitySheet';
import OverridePositionSheet from '../node-page/dialogs/OverridePositionSheet';
import PurgeDataSheet from '../node-page/dialogs/PurgeDataSheet';
import RequestTelemetrySheet from '../node-page/dialogs/RequestTelemetrySheet';
import { useIsPhone } from '../shell/useIsPhone';
import SendsLine from './SendsLine';
import Sheet from './Sheet';
import styles from './NodeActionMenus.module.css';

export type NodeProtocol = 'meshtastic' | 'meshcore' | 'reticulum' | 'mqtt';
export type NodeMenusVariant = 'menus' | 'tiles' | 'sheet' | 'buttons';
type GroupKey = 'ask' | 'organise' | 'data';

export interface NodeActionMenusProps {
  protocol: NodeProtocol;
  sourceId: string;
  node: DeviceInfo;
  variant: NodeMenusVariant;
  /** Sheet only: the title opens the node page. */
  onOpenNodePage?(): void;
  /** After Purge All Messages succeeds, so the open conversation can drop them (as App does). */
  onMessagesPurged?(): void;
}

interface ChannelPick {
  label: string;
  value: number | '';
  /** Traceroute: '' sends no channel and lets the server pick, as today's main button. */
  autoLabel?: string;
  onChange(v: number | ''): void;
}

interface Item {
  id: string;
  icon: UiIconName;
  label: string;
  hint?: string;
  sends?: string;
  reason?: string;
  busy?: boolean;
  danger?: boolean;
  channel?: ChannelPick;
  run(): void;
}

type Groups = Partial<Record<GroupKey, Item[]>>;

const GROUP_LABELS: Record<GroupKey, string> = {
  ask: 'workspace.node_menu.ask',
  organise: 'workspace.node_menu.organise',
  data: 'workspace.node_menu.data',
};

/** The `buttons` variant's icons (board g1-map). */
const GROUP_ICONS: Record<GroupKey, UiIconName> = { ask: 'activity', organise: 'favorite', data: 'more' };

/** Valid channel slot (0-7), as the server's isValidChannelIndex. */
const isSlot = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 7;

export default function NodeActionMenus(props: NodeActionMenusProps) {
  return props.protocol === 'meshtastic' || props.protocol === 'mqtt' ? <MeshtasticMenus {...props} /> : <OtherMenus {...props} />;
}

/** MeshCore and Reticulum: no node hook in the Workspace yet; everything is listed, off, with the reason. */
function OtherMenus(props: NodeActionMenusProps) {
  const { t } = useTranslation();
  const later = t('workspace.node_menu.meshcore_later');
  const off = (id: string, icon: UiIconName, label: string, sends?: string): Item => ({ id, icon, label, sends, reason: later, run: () => {} });
  const groups: Groups = {
    ...(props.protocol === 'meshcore' && {
      ask: [
        off('ping', 'radioSignal', t('meshcore.contact_details.ping_zero_hop_button', 'Ping (0 hop)'), t('workspace.node_menu.sends_ping')),
        off('trace', 'route', t('meshcore.contact_details.trace_path_button', 'Trace Path'), t('workspace.node_menu.sends_trace_path')),
        off('discover', 'refresh', t('meshcore.contact_details.discover_path_button'), t('workspace.node_menu.sends_discover_path')),
      ],
    }),
    organise: [
      off('favorite', 'favoriteOff', t('nodes.add_favorite')),
      off('ignore', 'blocked', t('messages.ignore_node')),
      off('hide', 'visibilityOff', t('messages.hide_from_map', 'Hide from Map')),
    ],
    data: [off('override', 'location', t('messages.override_position')), off('purge', 'delete', t('messages.purge_data'))],
  };
  return <MenusView {...props} groups={groups} />;
}

function MeshtasticMenus(props: NodeActionMenusProps) {
  const { protocol, sourceId, node, onMessagesPurged } = props;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission, authStatus } = useAuth();
  const { sourceType } = useSource();
  const { connectionStatus } = useData();
  const { tracerouteLoading } = useUI();
  const { channels } = useChannels();
  const { isTxDisabled } = useTxStatus({ baseUrl: appBasename, sourceId });
  const csrfFetch = useCsrfFetch();
  const queryClient = useQueryClient();
  const refetchPoll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: sourcePollQueryKey(sourceId) }),
    [queryClient, sourceId],
  );
  // csrfFetch for every request (Ruling AG); the scan needs it too (no 10 s client timeout).
  const authFetch = useCallback((url: string, options?: RequestInit) => csrfFetch(url, options), [csrfFetch]);
  const actions = useMeshtasticNodeActions({ baseUrl: appBasename, authFetch, refetchPoll, csrfFetch: authFetch });

  const scope = { sourceId };
  const can = (resource: ResourceType, action: 'read' | 'write' = 'write') => hasPermission(resource, action, scope);
  const needs = (resource: ResourceType, action: 'read' | 'write' = 'write') =>
    can(resource, action) ? undefined : t('workspace.node_menu.needs', { permission: `${resource}:${action}` });
  const isAdmin = authStatus?.user?.isAdmin === true;
  const nodeId = node.user?.id ?? '';
  const name = node.user?.longName || node.user?.shortName || nodeId;

  const slots = useMemo(() => channels.filter((c) => isSlot(c.id)), [channels]);
  const channelName = (id: number) => {
    const c = slots.find((ch) => ch.id === id);
    return c?.displayName || c?.name || (id === 0 ? t('channels.primary') : t('channels.channel_fallback', { channelNum: id }));
  };
  // The node's channel: what the server falls back to (resolveDestinationChannel), sent explicitly.
  const nodeChannel = isSlot(node.channel) ? node.channel : 0;
  const [traceChannel, setTraceChannel] = useState<number | ''>('');
  const [infoChannel, setInfoChannel] = useState<number | ''>(nodeChannel);
  const [positionChannel, setPositionChannel] = useState<number | ''>(nodeChannel);
  const [scanning, setScanning] = useState(false);
  const gatesId = useId();
  // One dialog sheet at a time (D9c).
  const [dialog, setDialog] = useState<'telemetry' | 'override' | 'copy' | 'merge' | 'purge' | null>(null);
  const [allSources, setAllSources] = useState(false);

  // Asks: permission, then TX disabled (today's tooltip), then the link.
  const askReason = (resource: ResourceType) =>
    needs(resource) ??
    (isTxDisabled ? t('tx_disabled.control_tooltip') : connectionStatus !== 'connected' ? t('source.status_disconnected') : undefined);
  const withChannel = (v: number | '') => (v === '' ? undefined : v);

  const ask: Item[] = [
    {
      id: 'traceroute',
      icon: 'route',
      label: t('messages.traceroute_button'),
      hint: t('workspace.node_menu.traceroute_hint'),
      sends: t('workspace.node_menu.sends_traceroute'),
      reason: askReason('traceroute'),
      busy: tracerouteLoading === nodeId,
      channel: { label: t('messages.traceroute_channel'), value: traceChannel, autoLabel: t('workspace.node_menu.channel_auto'), onChange: setTraceChannel },
      run: () => void actions.traceroute(node.nodeNum, withChannel(traceChannel)),
    },
    {
      id: 'nodeinfo',
      icon: 'key',
      label: t('messages.exchange_node_info'),
      hint: t('workspace.node_menu.nodeinfo_hint'),
      sends: t('workspace.node_menu.sends_nodeinfo', { channel: channelName(infoChannel === '' ? nodeChannel : infoChannel) }),
      reason: askReason('messages'),
      busy: actions.loading.nodeInfo === nodeId,
      channel: { label: t('messages.exchange_node_info_channel'), value: infoChannel, onChange: setInfoChannel },
      run: () => void actions.exchangeNodeInfo(node.nodeNum, withChannel(infoChannel)),
    },
    {
      id: 'position',
      icon: 'location',
      label: t('messages.exchange_position'),
      sends: t('workspace.node_menu.sends_position', { channel: channelName(positionChannel === '' ? nodeChannel : positionChannel) }),
      reason: askReason('messages'),
      busy: actions.loading.position === nodeId,
      channel: { label: t('messages.exchange_position_channel'), value: positionChannel, onChange: setPositionChannel },
      run: () => void actions.exchangePosition(node.nodeNum, withChannel(positionChannel)),
    },
    {
      id: 'telemetry',
      icon: 'telemetry',
      label: t('messages.request_telemetry'),
      hint: t('workspace.node_menu.telemetry_hint'),
      sends: t('workspace.node_menu.sends_telemetry'),
      reason: askReason('messages'),
      busy: actions.loading.telemetry === nodeId,
      run: () => setDialog('telemetry'),
    },
    {
      id: 'neighbors',
      icon: 'network',
      label: t('messages.request_neighbor_info'),
      hint: t('messages.request_neighbor_info_title'),
      sends: t('workspace.node_menu.sends_neighbors'),
      reason: askReason('traceroute'),
      busy: actions.loading.neighborInfo === nodeId,
      run: () => void actions.requestNeighborInfo(node.nodeNum),
    },
    {
      id: 'scan',
      icon: 'search',
      label: t('messages.scan_for_admin'),
      hint: t('workspace.node_menu.scan_hint'),
      sends: t('workspace.node_menu.sends_scan'),
      reason: askReason('settings'),
      busy: scanning,
      run: () => {
        setScanning(true);
        void actions.scanForAdmin(node.nodeNum).finally(() => setScanning(false));
      },
    },
  ];

  const nodesWrite = needs('nodes');
  const aircraftOffered = !(sourceType && AIRCRAFT_EXCLUDED_SOURCE_TYPES.has(sourceType));
  const aircraft = aircraftMarkActions(node);
  const markAircraft = (mark: 'aircraft' | 'not' | 'clear') => async () => {
    try {
      await actions.markAircraft(node.nodeNum, mark, allSources);
      showToast(
        t(mark === 'not' ? 'aircraft_mark.toast_not_aircraft' : mark === 'aircraft' ? 'aircraft_mark.toast_aircraft' : 'aircraft_mark.toast_cleared'),
        'success',
      );
    } catch (err) {
      const code = (err as { code?: string })?.code;
      showToast(
        t(code === 'AIRCRAFT_NO_POSITION' ? 'aircraft_mark.error_no_position' : code === 'AIRCRAFT_DETECTION_DISABLED'
          ? 'aircraft_mark.error_detection_disabled' : 'aircraft_mark.error_generic'),
        'error',
      );
    }
  };
  const organise: Item[] = [
    // Today's Center on Map (shown when the node has a position, no gate): the device map, on this node (Ruling AJ).
    ...(node.position?.latitude != null && node.position?.longitude != null
      ? [{ id: 'center', icon: 'target' as const, label: t('messages.center_on_map', 'Center on Map'),
          run: () => void navigate(`/source/${encodeURIComponent(sourceId)}/map`, { state: { focusNodeId: nodeId } }) }]
      : []),
    { id: 'favorite', icon: node.isFavorite ? 'favorite' : 'favoriteOff', label: t(node.isFavorite ? 'nodes.remove_favorite' : 'nodes.add_favorite'),
      reason: nodesWrite, run: () => void actions.toggleFavorite(node) },
    { id: 'lock', icon: node.favoriteLocked ? 'unlock' : 'encrypted',
      label: node.favoriteLocked ? t('nodes.unlock_favorite', 'Remove Favorite Lock') : t('nodes.lock_favorite', 'Set Favorite Lock'),
      reason: nodesWrite, run: () => void actions.toggleFavoriteLock(node) },
    { id: 'ignore', icon: node.isIgnored ? 'unencrypted' : 'blocked', label: t(node.isIgnored ? 'messages.unignore_node' : 'messages.ignore_node'),
      reason: nodesWrite, run: () => void actions.toggleIgnored(node) },
    { id: 'hide', icon: node.hideFromMap ? 'map' : 'visibilityOff',
      label: node.hideFromMap ? t('messages.unhide_from_map', 'Show on Map') : t('messages.hide_from_map', 'Hide from Map'),
      reason: nodesWrite, run: () => void actions.toggleHideFromMap(node) },
    ...(aircraftOffered
      ? ([
          aircraft.notAircraft && { id: 'not-aircraft', icon: 'aircraft', label: t('aircraft_mark.mark_not_aircraft', 'Mark as not aircraft'),
            reason: nodesWrite, run: () => void markAircraft('not')() },
          aircraft.aircraft && { id: 'aircraft', icon: 'aircraft', label: t('aircraft_mark.mark_aircraft', 'Mark as aircraft'),
            reason: nodesWrite, run: () => void markAircraft('aircraft')() },
          aircraft.clear && { id: 'clear-aircraft', icon: 'aircraft', label: t('aircraft_mark.clear', 'Clear aircraft override'),
            reason: nodesWrite, run: () => void markAircraft('clear')() },
        ].filter(Boolean) as Item[])
      : []),
  ];
  const showAllSources = aircraftOffered && (aircraft.notAircraft || aircraft.aircraft || aircraft.clear);

  // Merge needs a detected renumbering; read only for whoever could merge (a full node scan).
  const canMerge = isAdmin && can('nodes');
  const { bySuccessorNodeNum, byPredecessorNodeNum } = useNodeIdentityChanges(canMerge ? sourceId : null);
  const asSuccessor = bySuccessorNodeNum.get(node.nodeNum);
  const detection = asSuccessor ?? byPredecessorNodeNum.get(node.nodeNum);
  const data: Item[] = [
    { id: 'override', icon: 'location', label: t('messages.override_position'), hint: t('workspace.node_menu.override_hint'),
      reason: nodesWrite, run: () => setDialog('override') },
    { id: 'copy', icon: 'copy', label: t('nodes.copy_nodeinfo_title'), hint: t('workspace.node_menu.copy_hint'),
      reason: nodesWrite ?? needs('nodes', 'read'), run: () => setDialog('copy') },
    { id: 'merge', icon: 'identity', label: t('nodes.identity_change_merge_button'), hint: t('workspace.node_menu.merge_hint'),
      reason: !canMerge ? t('workspace.node_menu.admins_only') : !detection ? t('workspace.node_menu.no_merge_pair') : undefined,
      run: () => setDialog('merge') },
    { id: 'purge', icon: 'delete', label: t('messages.purge_data'), hint: t('workspace.node_menu.purge_hint'),
      reason: needs('messages'), danger: true, run: () => setDialog('purge') },
  ];

  const groups: Groups = { ...(protocol !== 'mqtt' && { ask }), organise, data };
  // Board 15-01: today's gates in words, under Data in the desktop menu.
  const gates: Array<[string, string]> = [
    ['traceroute:write', [t('messages.traceroute_button'), t('messages.request_neighbor_info')].join(', ')],
    ['messages:write', [t('messages.exchange_node_info'), t('messages.exchange_position'), t('messages.request_telemetry'), t('messages.purge_data')].join(', ')],
    ['settings:write', t('messages.scan_for_admin')],
    ['nodes:write', t('workspace.node_menu.gates_nodes', {
      organise: t('workspace.node_menu.organise'), override: t('messages.override_position'), copy: t('nodes.copy_nodeinfo_title'),
    })],
    [t('workspace.node_menu.gates_admins'), t('nodes.identity_change_merge_button')],
  ];
  const gatesCard = props.variant === 'menus' && protocol !== 'mqtt' ? (
    <section className={styles.gates} role="note" aria-labelledby={gatesId}>
      <h3 id={gatesId} className={styles.gatesTitle}>{t('workspace.node_menu.gates_title')}</h3>
      <p className={styles.hint}>{t('workspace.node_menu.gates_intro')}</p>
      <ul className={styles.gatesList}>
        {gates.map(([perm, what]) => (
          <li key={perm}><code>{perm}</code> · {what}</li>
        ))}
      </ul>
    </section>
  ) : null;
  const extra = showAllSources ? (
    <label className={styles.check}>
      <input type="checkbox" checked={allSources} disabled={!!nodesWrite} onChange={(e) => setAllSources(e.target.checked)} />
      {t('aircraft_mark.apply_all_sources', 'Apply to all sources')}
    </label>
  ) : null;

  return (
    <>
      <MenusView {...props} groups={groups} extras={{ organise: extra, data: gatesCard }} />
      <RequestTelemetrySheet
        open={dialog === 'telemetry'}
        nodeName={name}
        busy={actions.loading.telemetry === nodeId}
        onClose={() => setDialog(null)}
        onPick={(type) => {
          setDialog(null);
          void actions.requestTelemetry(node.nodeNum, type);
        }}
      />
      <OverridePositionSheet open={dialog === 'override'} node={node} nodeName={name} onClose={() => setDialog(null)} onSave={actions.overridePosition} />
      <CopyNodeInfoSheet open={dialog === 'copy'} sourceId={sourceId} node={node} onClose={() => setDialog(null)} />
      {dialog === 'merge' && detection && (
        <MergeIdentitySheet
          sourceId={sourceId}
          fromNodeNum={detection.predecessor.nodeNum}
          toNodeNum={detection.successor.nodeNum}
          fromLabel={detection.predecessor.longName || detection.predecessor.shortName || detection.predecessor.nodeId}
          toLabel={detection.successor.longName || detection.successor.shortName || detection.successor.nodeId}
          onClose={() => setDialog(null)}
        />
      )}
      <PurgeDataSheet
        open={dialog === 'purge'}
        sourceId={sourceId}
        node={node}
        onClose={() => setDialog(null)}
        purgeNodeData={actions.purgeNodeData}
        refetchPoll={refetchPoll}
        onMessagesPurged={onMessagesPurged}
      />
    </>
  );
}

interface MenusViewProps extends NodeActionMenusProps {
  groups: Groups;
  /** Shown after a group's items. */
  extras?: Partial<Record<GroupKey, ReactNode>>;
}

/** The three groups in the requested shape. */
function MenusView({ variant, node, groups, extras, onOpenNodePage }: MenusViewProps) {
  const { t } = useTranslation();
  const keys = (Object.keys(GROUP_LABELS) as GroupKey[]).filter((k) => groups[k]);
  const list = (key: GroupKey, done?: () => void) => (
    <ItemList label={t(GROUP_LABELS[key])} items={groups[key]!} extra={extras?.[key]} onDone={done} />
  );

  if (variant === 'tiles') {
    return (
      <div className={styles.tiles}>
        {keys.map((k) => (
          <section key={k} className={styles.tile}>
            <h3 className={styles.tileTitle}>{t(GROUP_LABELS[k])}</h3>
            {list(k)}
          </section>
        ))}
      </div>
    );
  }
  if (variant === 'sheet' || variant === 'buttons') {
    return <NodeSheet node={node} keys={keys} list={list} onOpenNodePage={onOpenNodePage} perGroup={variant === 'buttons'} />;
  }
  return (
    <div className={styles.menus}>
      {keys.map((k) => (
        <HeaderMenu key={k} label={t(GROUP_LABELS[k])}>
          {(close) => list(k, close)}
        </HeaderMenu>
      ))}
    </div>
  );
}

function HeaderMenu({ label, children }: { label: string; children(close: () => void): ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);
  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button type="button" className={styles.trigger} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} <UiIcon name="chevronDown" size={14} />
      </button>
      {open && <div className={styles.popover}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

function NodeSheet({
  node,
  keys,
  list,
  onOpenNodePage,
  perGroup,
}: {
  node: DeviceInfo;
  keys: GroupKey[];
  list(key: GroupKey, done?: () => void): ReactNode;
  onOpenNodePage?(): void;
  /** One button per group, opening the sheet on its tab, instead of ⋯; the host lays them out. */
  perGroup?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<GroupKey>(keys[0]);
  const name = node.user?.longName || node.user?.shortName || node.user?.id || '';
  const label = t('workspace.node_menu.title');
  const openOn = (k: GroupKey) => {
    setTab(k);
    setOpen(true);
  };
  return (
    <>
      {perGroup ? (
        keys.map((k) => (
          <button key={k} type="button" onClick={() => openOn(k)}>
            <UiIcon name={GROUP_ICONS[k]} size={22} />
            {t(GROUP_LABELS[k])}
          </button>
        ))
      ) : (
        <button type="button" className={styles.more} aria-label={label} title={label} onClick={() => setOpen(true)}>
          <UiIcon name="more" size={22} />
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={
          <span className={styles.sheetTitle}>
            {onOpenNodePage ? (
              <button type="button" className={styles.nodeLink} onClick={onOpenNodePage}>{name}</button>
            ) : (
              name
            )}
            <span className={styles.sheetSub}>{label}</span>
          </span>
        }
      >
        <div className={styles.tabs} role="tablist" aria-label={label}>
          {keys.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={styles.tab} onClick={() => setTab(k)}>
              {t(GROUP_LABELS[k])}
            </button>
          ))}
        </div>
        <div role="tabpanel">{list(tab, () => setOpen(false))}</div>
      </Sheet>
    </>
  );
}

function ItemList({ label, items, extra, onDone }: { label: string; items: Item[]; extra?: ReactNode; onDone?(): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  return (
    <div className={styles.list} role="group" aria-label={label} data-phone={isPhone || undefined}>
      {items.map((item) => (
        <div key={item.id} className={styles.item} data-item={item.id} data-danger={item.danger || undefined}>
          <button
            type="button"
            className={styles.itemButton}
            disabled={!!item.reason || item.busy}
            title={item.reason}
            aria-busy={item.busy || undefined}
            onClick={() => {
              item.run();
              onDone?.();
            }}
          >
            <UiIcon name={item.icon} size={18} />
            <span className={styles.itemText}>
              <span className={styles.itemLabel}>{item.label}</span>
              {item.hint && <span className={styles.hint}>{item.hint}</span>}
            </span>
            {item.busy && <span className={styles.spinner} aria-hidden="true" />}
          </button>
          {item.channel && (
            <select
              className={styles.select}
              aria-label={item.channel.label}
              value={String(item.channel.value)}
              disabled={!!item.reason}
              onChange={(e) => item.channel!.onChange(e.target.value === '' ? '' : Number(e.target.value))}
            >
              {item.channel.autoLabel !== undefined && <option value="">{item.channel.autoLabel}</option>}
              <ChannelOptions />
            </select>
          )}
          {item.reason && <p className={styles.reason}>{item.reason}</p>}
          {item.sends && <SendsLine>{item.sends}</SendsLine>}
        </div>
      ))}
      {extra}
      {items.length === 0 && <p className={styles.reason}>{t('workspace.state.empty')}</p>}
    </div>
  );
}

/** Today's channel picker entries: the radio's slots, Primary marked. */
function ChannelOptions() {
  const { t } = useTranslation();
  const { channels } = useChannels();
  return (
    <>
      {channels.filter((c) => isSlot(c.id)).map((c) => (
        <option key={c.id} value={c.id}>
          # {c.displayName || c.name || t('channels.channel_fallback', { channelNum: c.id })}
          {c.id === 0 ? ` (${t('channels.primary')})` : ''}
        </option>
      ))}
    </>
  );
}
