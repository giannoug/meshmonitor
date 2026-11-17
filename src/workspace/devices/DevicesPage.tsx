/**
 * Server › Devices (h4; ds6): every device, disabled ones too, in today's
 * order, which is the strip's. Admins only, as today's source list controls.
 *
 * Today's actions (DashboardPage / DashboardSidebar), with today's requests:
 * - Order: drag the handle (or focus it and use the arrow keys) or ↑ / ↓;
 *   `POST /api/sources/reorder` with the whole order, the list moved at once
 *   and re-read after, as today.
 * - Enable: the switch, `PUT /api/sources/:id {enabled}`. Turning a device
 *   off asks first (ConfirmSheet); its history stays.
 * - ⋯: Edit (the Add device flow on this device), Connect / Disconnect where
 *   today's card offers them, Resync (a connected Meshtastic node; it asks,
 *   with today's words on what it sends), Prune Outside ROI (a bridge with a
 *   geofence) and Delete (today's words; the server removes its data as today).
 * - Add device opens the flow (`?add=1`, also the rail's "+"); `?edit=<id>`
 *   opens it on that device (the Connection card's Edit connection).
 * - A row's status line opens the device's Connection card (ds6, Task 6.7).
 *
 * Statuses ride the shell's existing device poll; this page adds no timer.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { getStatusInfo } from '../../components/Dashboard/sourceStatusInfo';
import { useDashboardSources, type DashboardSource, type SourceStatus } from '../../hooks/useDashboardData';
import api, { ApiError } from '../../services/api';
import { logger } from '../../utils/logger';
import ConfirmSheet from '../patterns/ConfirmSheet';
import RowMenu, { type RowMenuItem } from '../patterns/RowMenu';
import SendsLine from '../patterns/SendsLine';
import RowSwitch from '../server/RowSwitch';
import ServerFrame from '../server/ServerFrame';
import { useServerSettings } from '../settings/useAutosaveSetting';
import { useIsPhone } from '../shell/useIsPhone';
import { useWorkspaceSources, type WorkspaceSource } from '../shell/useWorkspaceSources';
import AddDeviceFlow from './AddDeviceFlow';
import ConnectionCard from './ConnectionCard';
import { endpointOf, sourceControls } from './deviceInfo';
import { connectSourceAndWait, useConnectInFlight } from './useSourceForm';
import styles from './Devices.module.css';

type ConfirmKind = 'delete' | 'prune' | 'disable' | 'resync';

export default function DevicesPage() {
  const { t } = useTranslation();
  return (
    <ServerFrame
      categoryId="devices"
      title={t('workspace.server.nav.devices')}
      scope={t('workspace.server.scope_admins')}
      icon="radioSignal"
      gate="admin"
      actions={<AddLink />}
    >
      <DevicesBody />
    </ServerFrame>
  );
}

/** Add device: in the head on desktop; on phone (whose bar has no actions) above the list, at 44 px. */
function AddLink() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  return (
    <Link to="/server/devices?add=1" className={`${styles.button} ${styles.primary}`} data-phone={isPhone || undefined}>
      <UiIcon name="plus" size={16} />
      {t('workspace.shell.add_device')}
    </Link>
  );
}

/** Today's geofence check for Prune Outside ROI (DashboardSidebar). */
function hasGeoBounds(s: DashboardSource): boolean {
  const geo = (s.config as { downlinkFilters?: { geo?: Record<string, unknown> } } | undefined)?.downlinkFilters?.geo;
  return s.type === 'mqtt_bridge' && !!geo && [geo.minLat, geo.maxLat, geo.minLng, geo.maxLng].some((v) => typeof v === 'number');
}

function DevicesBody() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const { data: sources = [], isLoading } = useDashboardSources();
  const { sources: live } = useWorkspaceSources();
  const { data: settings } = useServerSettings();
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; source: DashboardSource } | null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState<ReadonlySet<string>>(new Set());
  const connects = useRef(new Set<AbortController>());
  useEffect(() => {
    const running = connects.current;
    return () => running.forEach((c) => c.abort());
  }, []);

  const adding = params.get('add') === '1';
  // `?edit=<id>`: the Connection card's Edit connection (Task 6.7).
  const editParam = params.get('edit');
  const editing = editId ?? (editParam && sources.some((s) => s.id === editParam) ? editParam : null);
  const byId = new Map(live.map((s) => [s.id, s]));
  // Today's default Meshtastic source (Server › General); "Automatic" is the first enabled node.
  const primaryId =
    (settings as Record<string, string> | undefined)?.defaultMeshtasticSourceId?.trim() ||
    sources.find((s) => s.enabled && s.type === 'meshtastic_tcp')?.id;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['dashboard', 'sources'] });
  const refetchStatus = (id: string) => void queryClient.refetchQueries({ queryKey: ['dashboard', 'status', id], type: 'active' });

  // Today's onReorderSources: move the cached list at once, POST, then re-read (which also undoes a failed move).
  const reorder = async (orderedIds: string[]) => {
    queryClient.setQueryData<DashboardSource[]>(['dashboard', 'sources'], (prev) => {
      if (!prev) return prev;
      const byKey = new Map(prev.map((s) => [s.id, s]));
      const reordered = orderedIds.map((id) => byKey.get(id)).filter((s): s is DashboardSource => s != null);
      const trailing = prev.filter((s) => !orderedIds.includes(s.id));
      return [...reordered, ...trailing];
    });
    try {
      await api.post('/api/sources/reorder', { order: orderedIds });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      logger.warn('Failed to reorder sources:', err.status);
    }
    refresh();
  };
  const ids = sources.map((s) => s.id);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    void reorder(arrayMove(ids, from, to));
  };

  const setEnabled = async (id: string, enabled: boolean) => {
    try {
      await api.put(`/api/sources/${id}`, { enabled });
    } catch (err) {
      if (err instanceof ApiError) return;
      throw err;
    }
    refresh();
  };

  const connect = async (id: string) => {
    const ctl = new AbortController();
    connects.current.add(ctl);
    setConnecting((prev) => new Set(prev).add(id));
    try {
      await connectSourceAndWait(queryClient, id, ctl.signal);
    } finally {
      connects.current.delete(ctl);
      if (!ctl.signal.aborted) {
        setConnecting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };

  // Today's onDisconnectSource.
  const disconnect = async (id: string) => {
    try {
      await api.post(`/api/sources/${id}/disconnect`);
    } catch (err) {
      if (err instanceof ApiError) return;
      throw err;
    }
    refresh();
    refetchStatus(id);
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const { kind, source } = confirm;
    if (kind === 'disable') {
      setConfirm(null);
      await setEnabled(source.id, false);
      return;
    }
    if (kind === 'delete') {
      // Today's confirmDelete: the sheet closes either way; the list is re-read on success.
      setBusy(true);
      let ok = true;
      try {
        await api.delete(`/api/sources/${source.id}`);
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        ok = false;
      } finally {
        setBusy(false);
      }
      setConfirm(null);
      if (ok) refresh();
      return;
    }
    if (kind === 'prune') {
      // Today's confirmPrune: an error stays in the sheet; the count is reported once done.
      setBusy(true);
      try {
        const body = await api.post<{ count?: number }>(`/api/sources/${source.id}/prune-outside-roi`);
        setConfirm(null);
        showToast(t('source.prune_outside_roi_result', { count: body.count ?? 0 }), 'success');
        refresh();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Request failed', { cause: err });
      } finally {
        setBusy(false);
      }
      return;
    }
    // Today's onResyncSource: the server holds the cooldown; a 409 is not an error to show.
    setConfirm(null);
    try {
      await api.post(`/api/sources/${source.id}/resync`);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        logger.error('Manual resync request errored', err);
        return;
      }
      if (err.status !== 409) logger.warn('Manual resync request failed', { status: err.status });
    }
    refetchStatus(source.id);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };

  const closeFlow = () => {
    setEditId(null);
    if (adding || editParam) void navigate('/server/devices', { replace: true });
  };

  const words: Record<ConfirmKind, { title: string; confirm: string; body: ReactNode; danger?: boolean }> | null = confirm && {
    delete: { title: t('source.delete'), confirm: t('source.kebab.delete'), body: <p className={styles.para}>{t('source.delete_confirm')}</p>, danger: true },
    prune: {
      title: t('source.kebab.prune_outside_roi'),
      confirm: busy ? t('source.prune_pending', 'Pruning…') : t('source.kebab.prune_outside_roi'),
      body: <p className={styles.para}>{t('source.prune_outside_roi_confirm')}</p>,
      danger: true,
    },
    disable: { title: t('source.kebab.disable'), confirm: t('source.kebab.disable'), body: <p className={styles.para}>{t('workspace.devices.disable_body', { name: confirm.source.name })}</p> },
    resync: {
      title: t('source.kebab.resync', 'Resync'),
      confirm: t('source.kebab.resync', 'Resync'),
      body: <SendsLine>{t('source.kebab.resync_help', 'Force a fresh config/NodeDB sync from the device. Respects a 30s cooldown.')}</SendsLine>,
    },
  };
  const shown = confirm && words?.[confirm.kind];

  return (
    <>
      {isPhone && <AddLink />}
      {!isLoading && sources.length === 0 ? (
        <p className={styles.para}>{t('workspace.devices.empty')}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className={styles.list} aria-label={t('workspace.server.nav.devices')}>
              {sources.map((s, i) => (
                <DeviceRow
                  key={s.id}
                  source={s}
                  shell={byId.get(s.id)}
                  primary={s.id === primaryId}
                  first={i === 0}
                  last={i === sources.length - 1}
                  connecting={connecting.has(s.id)}
                  onMove={(dir) => move(i, i + dir)}
                  onEnabled={(on) => (on ? void setEnabled(s.id, true) : setConfirm({ kind: 'disable', source: s }))}
                  onEdit={() => setEditId(s.id)}
                  onConnect={() => void connect(s.id)}
                  onDisconnect={() => void disconnect(s.id)}
                  onConfirm={(kind) => setConfirm({ kind, source: s })}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <p className={styles.note}>
        <UiIcon name="info" size={16} />
        <span>{t('workspace.devices.note')}</span>
      </p>
      <ConfirmSheet
        open={!!shown}
        title={shown?.title ?? ''}
        body={shown?.body}
        confirmLabel={shown?.confirm ?? ''}
        danger={shown?.danger}
        busy={busy}
        submitOnEnter={false}
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
      {(adding || editing) && <AddDeviceFlow key={editing ?? 'add'} sources={sources} editId={editing} onClose={closeFlow} />}
    </>
  );
}

interface RowProps {
  source: DashboardSource;
  shell: WorkspaceSource | undefined;
  primary: boolean;
  first: boolean;
  last: boolean;
  connecting: boolean;
  onMove(dir: -1 | 1): void;
  onEnabled(on: boolean): void;
  onEdit(): void;
  onConnect(): void;
  onDisconnect(): void;
  onConfirm(kind: ConfirmKind): void;
}

function DeviceRow({ source: s, shell, primary, first, last, connecting, onMove, onEnabled, onEdit, onConnect, onDisconnect, onConfirm }: RowProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const status: SourceStatus | null = shell?.live ?? null;
  const { dotClass, label } = getStatusInfo(s, status, t);
  const [cardOpen, setCardOpen] = useState(false);
  const { canConnect, gatewaysOnly, canDisconnect } = sourceControls(s, status);
  // One connect per source: the Connection card's Connect counts too.
  const busy = useConnectInFlight(s.id) || connecting;
  const endpoint = endpointOf(s.type, s.config, (port) => t('workspace.devices.port', { port }));
  const kind = t(`workspace.devices.type.${s.type}`, s.type);

  const items: RowMenuItem[] = [
    { key: 'edit', label: t('source.kebab.edit'), icon: 'edit', onSelect: onEdit },
    ...(canConnect
      ? [{ key: 'connect', label: busy ? t('source.connecting') : gatewaysOnly ? t('source.retry_gateways') : t('source.connect'), icon: 'power' as const, disabled: busy, onSelect: onConnect }]
      : []),
    ...(canDisconnect ? [{ key: 'disconnect', label: t('source.kebab.disconnect'), icon: 'power' as const, onSelect: onDisconnect }] : []),
    ...(s.type === 'meshtastic_tcp' && status?.connected === true
      ? [{ key: 'resync', label: t('source.kebab.resync', 'Resync'), icon: 'refresh' as const, onSelect: () => onConfirm('resync') }]
      : []),
    ...(hasGeoBounds(s) ? [{ key: 'prune', label: t('source.kebab.prune_outside_roi'), icon: 'filter' as const, onSelect: () => onConfirm('prune') }] : []),
    { key: 'delete', label: t('source.kebab.delete'), icon: 'delete', danger: true, onSelect: () => onConfirm('delete') },
  ];

  return (
    <li
      ref={setNodeRef}
      className={styles.row}
      data-phone={isPhone || undefined}
      data-off={!s.enabled || undefined}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="device-row"
    >
      <button type="button" className={styles.handle} aria-label={t('workspace.devices.drag', { name: s.name })} title={t('channel_database.drag_to_reorder')} {...attributes} {...listeners}>
        <UiIcon name="dragHandle" size={18} />
      </button>
      <span className={styles.square} style={{ background: s.enabled ? shell?.colorToken : undefined }} aria-hidden="true">
        {shell?.abbrev ?? s.name.slice(0, 2).toUpperCase()}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowName}>
          <span className={styles.ellipsis}>{s.name}</span>
          {primary && <span className={styles.chip}>{t('workspace.devices.primary')}</span>}
        </span>
        <span className={styles.rowSub}>{[kind, endpoint].filter(Boolean).join(' · ')}</span>
      </span>
      {/* ds6: the status line opens the device's Connection card. */}
      {shell ? (
        <button
          type="button"
          className={`${styles.status} ${styles.statusButton}`}
          data-tone={dotClass}
          aria-haspopup="dialog"
          aria-label={t('workspace.connection.status_line', { name: s.name, status: label })}
          title={status && !status.connected ? (status as { lastError?: string }).lastError ?? undefined : undefined}
          onClick={() => setCardOpen(true)}
        >
          <span className={styles.dot} aria-hidden="true" />
          {label}
        </button>
      ) : (
        <span className={styles.status} data-tone={dotClass} title={status && !status.connected ? (status as { lastError?: string }).lastError ?? undefined : undefined}>
          <span className={styles.dot} aria-hidden="true" />
          {label}
        </span>
      )}
      {shell && <ConnectionCard source={shell} open={cardOpen} onClose={() => setCardOpen(false)} />}
      <span className={styles.moves}>
        <button type="button" className={styles.iconButton} aria-label={t('workspace.devices.move_up', { name: s.name })} disabled={first} onClick={() => onMove(-1)}>
          <UiIcon name="chevronUp" size={18} />
        </button>
        <button type="button" className={styles.iconButton} aria-label={t('workspace.devices.move_down', { name: s.name })} disabled={last} onClick={() => onMove(1)}>
          <UiIcon name="chevronDown" size={18} />
        </button>
      </span>
      <RowSwitch label={t('workspace.devices.enabled', { name: s.name })} checked={s.enabled} onChange={onEnabled} />
      <RowMenu label={t('workspace.devices.actions', { name: s.name })} items={items} />
    </li>
  );
}
