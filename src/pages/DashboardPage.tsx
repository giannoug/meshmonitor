/**
 * DashboardPage — MeshMonitor 4.0 landing page.
 *
 * Wraps the inner dashboard in a SettingsProvider so map tile preferences
 * are available, then wires together DashboardSidebar + DashboardMap with
 * per-source data fetched via the useDashboardData hooks.
 */

import { MqttRootFinder } from '../components/MQTT/MqttRootFinder';
import { applyRootToSubscriptions, defaultBridgeRegionRoot } from '../components/MQTT/mqttRootDefaults';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useShellEmbedded } from '../contexts/ShellContext';
import { MapProvider, useMapContext } from '../contexts/MapContext';
import { useUnreadBySource, useMarkAllDmsRead } from '../hooks/useUnreadBySource';
import {
  useDashboardSources,
  useSourceStatuses,
  useDashboardSourceData,
  useDashboardUnifiedData,
  useUnifiedStatus,
  UNIFIED_SOURCE_ID,
} from '../hooks/useDashboardData';
import { useMeshCoreNeighbors } from '../hooks/useMapAnalysisData';
import { useMaxNodeAgeHoursAcross, useMaxInfraNodeAgeHoursAcross } from '../hooks/useNodeDisplaySettings';
import type { DashboardSource, SourceStatus, DashboardDataOptions } from '../hooks/useDashboardData';
import { hasHiddenUrlParts, storedSecretWillBeDropped } from './DashboardPage.maskedFields';
import { DroppedSecretNote, HiddenUrlPartsNote } from '../components/Dashboard/StoredSecretNotes';
import DashboardSidebar from '../components/Dashboard/DashboardSidebar';
import { PasswordField } from '../components/shared/config/PasswordField';
import DashboardMap from '../components/Dashboard/DashboardMap';
import type { NodeSourceRef } from '../components/Dashboard/DashboardNodePopup';
import HopLimitPolicyFields from '../components/MQTT/HopLimitPolicyFields';
import { NumberInput } from '../components/common/NumberInput';
import { NumberInputScope } from '../components/common/NumberInputScope';
import { MqttDocsLinks } from '../components/MQTT/MqttDocsLinks';
import LoginModal from '../components/LoginModal';
import UserMenu from '../components/UserMenu';
import { NewsPopup } from '../components/NewsPopup';
import { ToastProvider } from '../components/ToastContainer';
import api, { ApiError } from '../services/api';
import { logger } from '../utils/logger';
import { appBasename } from '../init';
import { MESHCORE_DEFAULT_TCP_PORT } from '../constants';
import { useDefaultLandingRedirect } from '../hooks/useDefaultLandingRedirect';
import '../styles/dashboard.css';
import { UiIcon } from '../components/icons';
import { connectSourceAndWait, useSourceForm } from '../workspace/devices/useSourceForm';


// ---------------------------------------------------------------------------
// DashboardInner — rendered inside SettingsProvider
// ---------------------------------------------------------------------------

/** The bridge URL a Reticulum source uses when the field is left blank. */
const RETICULUM_DEFAULT_BRIDGE_URL = 'ws://127.0.0.1:8765';

/** Stable options object for the dashboard data hooks (see DashboardDataOptions). */
const DASHBOARD_DATA_OPTIONS: DashboardDataOptions = { ageWindow: true };

function DashboardInner() {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const queryClient = useQueryClient();
  const { mapTileset, customTilesets, defaultMapCenterLat, defaultMapCenterLon, defaultLandingPage } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Invalidate the source list cache after a mutation so the sidebar
   * reflects the new/edited/toggled/deleted source immediately instead of
   * waiting for the 15s poll interval. Same key as `useDashboardSources`.
   */
  const refreshSources = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'sources'] });
  };

  /**
   * Debounced variant for bursty mutations (rapid on/off/on source toggling).
   * Coalesces a flurry of toggles into a single cache invalidation so we fire
   * one refetch cycle instead of one per click — which, with the batched
   * dashboard endpoints, keeps toggling comfortably under the API rate limit
   * (#3735). The PUTs themselves still go through per click (each one changes
   * server state); only the follow-up refetch is coalesced.
   */
  const refreshSourcesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSourcesDebounced = () => {
    if (refreshSourcesTimer.current) clearTimeout(refreshSourcesTimer.current);
    refreshSourcesTimer.current = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'sources'] });
    }, 400);
  };

  /**
   * Unified map: clicking a "seen by" source row in a node popup jumps to that
   * source's Node Details view for the node. Meshtastic sources open the
   * Node Details (Messages) tab focused on the node's DM; MeshCore sources use
   * their own internal panes, so we just switch to that source.
   */
  // Stable so the map's memoized marker popups don't rebuild on every render.
  const handleNodeSourceSelect = useCallback((source: NodeSourceRef, nodeId: string | undefined) => {
    if (source.protocol === 'MeshCore') {
      void navigate(`/source/${source.sourceId}/`);
      return;
    }
    void navigate(`/source/${source.sourceId}/#messages`, {
      state: nodeId ? { focusDmNodeId: nodeId } : undefined,
    });
  }, [navigate]);

  const isAuthenticated = authStatus?.authenticated ?? false;
  const isAdmin = authStatus?.user?.isAdmin ?? false;

  const defaultCenter = {
    lat: defaultMapCenterLat ?? 30.0,
    lng: defaultMapCenterLon ?? -90.0,
  };

  // ----- state -----
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pruneConfirm, setPruneConfirm] = useState<string | null>(null);
  const [pruneResult, setPruneResult] = useState<{ sourceId: string; count: number } | null>(null);
  const [pruneError, setPruneError] = useState<string | null>(null);
  const [prunePending, setPrunePending] = useState(false);
  // Mobile drawer state — hamburger toggles; source selection auto-closes.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Inside the Workspace shell (#6365) the shell draws the topbar; the source
  // list (DashboardSidebar) is content and stays.
  const embedded = useShellEmbedded();

  // News popup state — auto-opens on unread news, can be reopened via sidebar footer button.
  const [showNewsPopup, setShowNewsPopup] = useState(false);
  const [forceShowAllNews, setForceShowAllNews] = useState(false);

  // Source IDs with an in-flight /connect request — drives the "Connecting..."
  // button label and status dot while the POST is outstanding (issue #2773).
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());

  // Source add/edit modal state
  const [showSourceModal, setShowSourceModal] = useState(false);

  // ----- data -----
  const { data: sources = [], isSuccess } = useDashboardSources();
  const sourceIds = sources.map((s) => s.id);
  // The add/edit form's state, checks and Save (Rule X, #6365: shared with the Workspace's Add device).
  const sourceForm = useSourceForm(sources);
  const { editingSourceId, editingSource, secretPlaceholder, formError, formSaving, numbers: sourceFormNumbers } = sourceForm;
  const {
    formAutoConnect, formBrokerBridgeRewrites, formHeartbeat, formHeartbeatTouched, formHost, formMcDeviceType,
    formMcMqttAutoConnect, formMcMqttBrokerUrl, formMcMqttPassword, formMcMqttRegion, formMcMqttRejectUnauthorized,
    formMcMqttUsername, formMcSerialPort, formMcTcpHost, formMcTcpPort, formMcTransport, formMqttBridgeBrokerId,
    formMqttBridgePassword, formMqttBridgeSubscriptions, formMqttBridgeUrl, formMqttBridgeUsername,
    formMqttHopPolicy, formMqttLegacyHopNotice, formMqttListenPort, formMqttPassword, formMqttRootTopic,
    formMqttUsername, formMtMqttLinkBrokerId, formName, formPassiveMode, formPassiveResyncStaleHours, formPort,
    formRnsAutoConnect, formRnsBridgeUrl, formRnsConfigDir, formRnsMode, formRnsPeerHost, formRnsPeerPort,
    formRnsToken, formType, formVnAllowAdmin, formVnAllowPkiExport, formVnAllowPkiImport, formVnEnabled, formVnPort,
    setFormAutoConnect, setFormBrokerBridgeRewrites, setFormHeartbeat, setFormHeartbeatTouched, setFormHost,
    setFormMcDeviceType, setFormMcMqttAutoConnect, setFormMcMqttBrokerUrl, setFormMcMqttPassword,
    setFormMcMqttRegion, setFormMcMqttRejectUnauthorized, setFormMcMqttUsername, setFormMcSerialPort,
    setFormMcTcpHost, setFormMcTcpPort, setFormMcTransport, setFormMqttBridgeBrokerId, setFormMqttBridgePassword,
    setFormMqttBridgeSubscriptions, setFormMqttBridgeUrl, setFormMqttBridgeUsername, setFormMqttHopPolicy,
    setFormMqttListenPort, setFormMqttPassword, setFormMqttRootTopic, setFormMqttUsername,
    setFormMtMqttLinkBrokerId, setFormName, setFormPassiveMode, setFormPassiveResyncStaleHours, setFormPort,
    setFormRnsAutoConnect, setFormRnsBridgeUrl, setFormRnsConfigDir, setFormRnsMode, setFormRnsPeerHost,
    setFormRnsPeerPort, setFormRnsToken, setFormType, setFormVnAllowAdmin, setFormVnAllowPkiExport,
    setFormVnAllowPkiImport, setFormVnEnabled, setFormVnPort,
  } = sourceForm;

  // DashboardPage renders outside any SourceProvider, so there is no single
  // "current source" to read maxNodeAgeHours from. Per D3 (#4412 Phase 3),
  // cross-source surfaces use the most-permissive rule — the max across every
  // source in view — so a source configured with a large window never has its
  // nodes hidden by a smaller window on another source. Without this, this
  // page would silently fall back to the hardcoded default (24h) since it
  // sits outside SettingsContext's per-source scoping.
  const maxNodeAgeHours = useMaxNodeAgeHoursAcross(sourceIds);
  // #4899: cross-source Infrastructure window so MeshCore repeaters/room
  // servers survive on the Dashboard map past the (shorter) companion window.
  const maxInfraNodeAgeHours = useMaxInfraNodeAgeHoursAcross(sourceIds);

  // Apply admin-configured default landing page (issues #2917, #3183) when
  // the user lands on `/`. The "Sources" button always passes
  // `location.state.showList=true` so users can return to the unified
  // dashboard even with a default configured.
  const skipDefaultLanding = (location.state as { showList?: boolean } | null)?.showList === true;
  useDefaultLandingRedirect({ skip: skipDefaultLanding, isSuccess, defaultLandingPage, sources });
  const statusMap = useSourceStatuses(sourceIds);
  const unifiedStatus = useUnifiedStatus();

  // Show a synthetic "Unified" entry in the sidebar only when the user has
  // configured 2+ sources — otherwise it would just duplicate the single
  // source's data and add UI noise.
  const showUnified = sources.length >= 2;
  const isUnifiedSelected = selectedSourceId === UNIFIED_SOURCE_ID;

  // Run both data hooks but disable whichever is not active so we don't fan
  // out N parallel fetches when the user is on a single-source view.
  // `ageWindow`: the server leaves out nodes this map hides by age.
  const singleSourceData = useDashboardSourceData(isUnifiedSelected ? null : selectedSourceId, DASHBOARD_DATA_OPTIONS);
  const unifiedSourceData = useDashboardUnifiedData(sources, isUnifiedSelected, DASHBOARD_DATA_OPTIONS);
  const sourceData = isUnifiedSelected ? unifiedSourceData : singleSourceData;

  // MeshCore neighbor links for the map. Fetched only when the "Show Neighbors"
  // toggle is on (DashboardInner sits inside MapProvider, so we can read it
  // here to gate the request). Unified pulls every source; single-source pulls
  // just the selected one. The hook itself drops non-MeshCore sources, whose
  // requests the server answers with 404.
  const { showNeighborInfo, unreadIndicatorEnabled, setUnreadIndicatorEnabled } = useMapContext();
  // #5124. `enabled: false` means the query never runs, so switching the badge
  // off stops the polling too rather than merely hiding the answer.
  const { data: unreadBySourceData } = useUnreadBySource({
    // The app can be served under a base path (BASE_URL=/meshmonitor in the
    // dev container), so the bare `/api/...` default would 404. Same
    // `appBasename` every other query hook is handed.
    baseUrl: appBasename,
    enabled: isAuthenticated && unreadIndicatorEnabled,
  });

  // #5197: same basename for the same reason as the query above.
  const markAllDmsRead = useMarkAllDmsRead({ baseUrl: appBasename });
  const neighborSourceIds = isUnifiedSelected
    ? sourceIds
    : (selectedSourceId && selectedSourceId !== UNIFIED_SOURCE_ID ? [selectedSourceId] : []);
  const meshcoreNeighborsQuery = useMeshCoreNeighbors({
    enabled: showNeighborInfo && neighborSourceIds.length > 0,
    sources: neighborSourceIds,
    lookbackHours: maxNodeAgeHours,
  });
  const meshcoreNeighbors = (meshcoreNeighborsQuery.data?.items as unknown[] | undefined) ?? [];

  // Synthetic Unified pseudo-source for the sidebar. Recognized by its sentinel ID
  // so DashboardSidebar can hide admin/open controls that don't apply.
  const unifiedSource: DashboardSource | null = showUnified
    ? {
        id: UNIFIED_SOURCE_ID,
        name: t('source.unified', 'Unified'),
        type: '__unified__',
        enabled: true,
      }
    : null;
  const sidebarSources: DashboardSource[] = unifiedSource ? [unifiedSource, ...sources] : sources;

  // Auto-select first enabled source when list loads. Default to Unified when
  // the user has multiple sources — that's the most useful at-a-glance view.
  useEffect(() => {
    if (!isSuccess || sources.length === 0 || selectedSourceId !== null) return;
    if (showUnified) {
      setSelectedSourceId(UNIFIED_SOURCE_ID);
      return;
    }
    const firstEnabled = sources.find((s) => s.enabled);
    setSelectedSourceId(firstEnabled?.id ?? sources[0].id);
  }, [isSuccess, sources, selectedSourceId, showUnified]);

  // Auto-show news popup when authenticated user has unread news.
  // Inside the Workspace shell (#6365) the shell does this once per load.
  useEffect(() => {
    if (!isAuthenticated || embedded) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await api.getUnreadNews();
        if (cancelled) return;
        if (response.items && response.items.length > 0) {
          setForceShowAllNews(false);
          setShowNewsPopup(true);
        }
      } catch (err) {
        logger.debug('Failed to fetch unread news:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, embedded]);

  // Build node-count map. Each source's count comes from its /status response
  // (added in sourceRoutes.ts), polled in parallel by useSourceStatuses. The
  // currently-selected source uses the live `sourceData.nodes.length` so the
  // counter updates immediately as new nodes arrive instead of waiting for the
  // next status poll. The Unified entry uses the deduped count from
  // /api/unified/status — a single source of truth that stays stable as the
  // user clicks between sources (issue #2805). Falls back to the live merged
  // count when Unified is selected and the polled value hasn't arrived yet.
  const nodeCounts = new Map<string, number>(
    sources.map((s) => {
      // nodeCount: the total before the server's age cut (ageWindow below).
      if (s.id === selectedSourceId) return [s.id, sourceData.nodeCount ?? sourceData.nodes.length];
      const status = statusMap.get(s.id);
      return [s.id, status?.nodeCount ?? 0];
    }),
  );
  if (unifiedSource) {
    const polled = unifiedStatus?.nodeCount;
    const fallback = isUnifiedSelected ? unifiedSourceData.nodes.length : 0;
    nodeCounts.set(UNIFIED_SOURCE_ID, polled ?? fallback);
  }

  // ----- admin actions -----
  const onAddSource = () => {
    sourceForm.startAdd();
    setShowSourceModal(true);
  };

  const onEditSource = (id: string) => {
    if (sourceForm.startEdit(id)) setShowSourceModal(true);
  };

  const onSaveSource = async () => {
    if ((await sourceForm.submit()) !== null) setShowSourceModal(false);
  };

  // Manually start the manager for a source whose autoConnect is disabled
  // (issue #2773). The /connect POST returns as soon as the manager is
  // registered, but the upstream TCP handshake happens asynchronously — so we
  // keep `connectingIds` set (and aggressively poll /status) until the status
  // endpoint reports connected=true, or a timeout elapses. Without this the
  // dashboard would sit on "Connecting…" for up to DASHBOARD_POLL_INTERVAL
  // (15s) before the next normal status poll fires.
  const onConnectSource = async (id: string) => {
    setConnectingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      await connectSourceAndWait(queryClient, id);
    } finally {
      setConnectingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Counterpart to onConnectSource — stops the manager without disabling the
  // source. Exposed in the kebab menu when the source has autoConnect=false
  // and is currently connected.
  const onDisconnectSource = async (id: string) => {
    try {
      await api.post(`/api/sources/${id}/disconnect`);
    } catch (err) {
      if (err instanceof ApiError) return;
      throw err;
    }
    refreshSources();
    // Force an immediate status refetch so the "Connected" dot flips to
    // "Idle" without waiting for the next 15s poll tick.
    void queryClient.refetchQueries({ queryKey: ['dashboard', 'status', id], type: 'active' });
  };

  const onToggleSource = async (id: string, enabled: boolean) => {
    try {
      await api.put(`/api/sources/${id}`, { enabled });
    } catch (err) {
      if (err instanceof ApiError) return;
      throw err;
    }
    refreshSourcesDebounced();
  };

  const onDeleteSource = (id: string) => {
    setDeleteConfirm(id);
  };

  // Persist a drag-reorder of the source list (issue #3338). Optimistically
  // reorders the cached `['dashboard','sources']` array so the sidebar updates
  // instantly, POSTs the new order, then invalidates to reconcile with the
  // server (which also reverts the optimistic move if the request failed).
  const onReorderSources = async (orderedIds: string[]) => {
    queryClient.setQueryData<DashboardSource[]>(['dashboard', 'sources'], (prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.map((s) => [s.id, s]));
      const reordered = orderedIds.map((id) => byId.get(id)).filter((s): s is DashboardSource => s != null);
      // Keep any sources the payload didn't mention (defensive) at the end.
      const trailing = prev.filter((s) => !orderedIds.includes(s.id));
      return [...reordered, ...trailing];
    });

    try {
      await api.post('/api/sources/reorder', { order: orderedIds });
      refreshSources();
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      refreshSources();
      logger.warn('Failed to reorder sources:', err.status);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    let ok = true;
    try {
      await api.delete(`/api/sources/${deleteConfirm}`);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      ok = false;
    }
    if (selectedSourceId === deleteConfirm) {
      setSelectedSourceId(null);
    }
    setDeleteConfirm(null);
    if (ok) refreshSources();
  };

  const onPruneOutsideRoi = (id: string) => {
    setPruneError(null);
    setPruneResult(null);
    setPruneConfirm(id);
  };

  // Manual Resync (#3122 follow-up). Operator-initiated full config refresh
  // for Meshtastic TCP sources — useful for Passive Mode sources where the
  // automatic reconnect skips the full NodeDB sync while the cache is fresh.
  // Cooldown / single-flight / watchdog all live on the server; the click
  // either succeeds (200) or is rejected (409) with state describing why.
  const onResyncSource = async (id: string) => {
    try {
      await api.post(`/api/sources/${id}/resync`);
      // Refresh source status either way — a successful resync changes the
      // connection state once configComplete arrives, and a rejected click
      // doesn't hurt to re-poll.
      void queryClient.refetchQueries({ queryKey: ['dashboard', 'status', id], type: 'active' });
    } catch (err) {
      if (err instanceof ApiError) {
        void queryClient.refetchQueries({ queryKey: ['dashboard', 'status', id], type: 'active' });
        if (err.status !== 409) {
          logger.warn('Manual resync request failed', { status: err.status });
        }
        return;
      }
      logger.error('Manual resync request errored', err);
    }
  };

  // Message Forwarding master switch from the sidebar FWD pill (#5537). The
  // server gates it on per-source `automation` write; the pill only offers it
  // when the status poll says the caller holds that grant. Re-poll the
  // source's status either way so the pill shows the stored state.
  const onToggleForwarding = async (id: string, enabled: boolean) => {
    // Flip the pill at once; the re-poll below settles it on the stored state,
    // which also reverts it if the PUT failed.
    queryClient.setQueriesData<SourceStatus | null>({ queryKey: ['dashboard', 'status', id] }, (prev) =>
      prev?.forwarding ? { ...prev, forwarding: { ...prev.forwarding, enabled } } : prev);
    try {
      await api.put(`/api/sources/${encodeURIComponent(id)}/forwarding/enabled`, { enabled });
    } catch (err) {
      logger.warn('Forwarding toggle failed', { status: err instanceof ApiError ? err.status : undefined });
    } finally {
      await queryClient.refetchQueries({ queryKey: ['dashboard', 'status', id], type: 'active' });
    }
  };

  const confirmPrune = async () => {
    if (!pruneConfirm || prunePending) return;
    setPrunePending(true);
    setPruneError(null);
    try {
      const body = await api.post<{ count?: number }>(`/api/sources/${pruneConfirm}/prune-outside-roi`);
      setPruneResult({ sourceId: pruneConfirm, count: body.count ?? 0 });
      setPruneConfirm(null);
      refreshSources();
    } catch (err) {
      setPruneError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setPrunePending(false);
    }
  };

  // ----- render -----
  return (
    <div className="dashboard-page">
      {/* Top bar */}
      {!embedded && (
      <header className="dashboard-topbar">
        <button
          className="dashboard-topbar-hamburger"
          aria-label={mobileSidebarOpen ? t('source.sidebar.close_sources') : t('source.sidebar.open_sources')}
          aria-expanded={mobileSidebarOpen}
          onClick={() => setMobileSidebarOpen((v) => !v)}
        >
          <UiIcon name={mobileSidebarOpen ? 'close' : 'menu'} size={20} />
        </button>
        <div className="dashboard-topbar-logo">
          <img src={`${appBasename}/logo.png`} alt={t('source.topbar.logo_alt')} className="dashboard-topbar-logo-img" />
          <span className="dashboard-topbar-title">MeshMonitor</span>
        </div>
        <div className="dashboard-topbar-actions">
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <button
              className="dashboard-signin-btn"
              onClick={() => setShowLogin(true)}
            >
              {t('source.topbar.sign_in')}
            </button>
          )}
        </div>
      </header>
      )}

      {/* Body */}
      <div className="dashboard-body">
        <DashboardSidebar
          sources={sidebarSources}
          statusMap={statusMap}
          unifiedStatus={unifiedStatus}
          nodeCounts={nodeCounts}
          selectedSourceId={selectedSourceId}
          onSelectSource={setSelectedSourceId}
          isAdmin={isAdmin}
          isAuthenticated={isAuthenticated}
          onAddSource={onAddSource}
          onEditSource={onEditSource}
          onToggleSource={onToggleSource}
          onReorderSources={onReorderSources}
          onDeleteSource={onDeleteSource}
          onConnectSource={onConnectSource}
          onDisconnectSource={onDisconnectSource}
          onPruneOutsideRoi={onPruneOutsideRoi}
          onResyncSource={onResyncSource}
          onToggleForwarding={onToggleForwarding}
          connectingIds={connectingIds}
          unreadBySource={unreadIndicatorEnabled ? unreadBySourceData?.sources : undefined}
          unreadIndicatorEnabled={unreadIndicatorEnabled}
          onToggleUnreadIndicator={setUnreadIndicatorEnabled}
          onMarkAllDmsRead={() => markAllDmsRead.mutate()}
          markAllDmsReadPending={markAllDmsRead.isPending}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          onNewsClick={() => {
            setForceShowAllNews(true);
            setShowNewsPopup(true);
          }}
        />

        <DashboardMap
          nodes={sourceData.nodes}
          traceroutes={sourceData.traceroutes}
          neighborInfo={sourceData.neighborInfo}
          meshcoreNeighbors={meshcoreNeighbors}
          channels={sourceData.channels}
          tilesetId={mapTileset}
          customTilesets={customTilesets}
          defaultCenter={defaultCenter}
          sourceId={selectedSourceId}
          maxNodeAgeHours={maxNodeAgeHours}
          maxInfraNodeAgeHours={maxInfraNodeAgeHours}
          onNodeSourceSelect={handleNodeSourceSelect}
          isLoading={sourceData.isLoading}
        />
      </div>

      {/* Login modal */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />

      {/* News popup — auto-opens on unread news, reopened via sidebar footer. */}
      <NewsPopup
        isOpen={showNewsPopup}
        onClose={() => {
          setShowNewsPopup(false);
          setForceShowAllNews(false);
        }}
        forceShowAll={forceShowAllNews}
        isAuthenticated={isAuthenticated}
      />

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="dashboard-confirm-overlay">
          <div className="dashboard-confirm-dialog">
            <h3>{t('source.delete')}</h3>
            <p>{t('source.delete_confirm')}</p>
            <div className="dashboard-confirm-actions">
              <button onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</button>
              <button onClick={confirmDelete}>{t('source.kebab.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Prune Outside ROI confirmation */}
      {pruneConfirm && (
        <div className="dashboard-confirm-overlay">
          <div className="dashboard-confirm-dialog">
            <h3>{t('source.kebab.prune_outside_roi')}</h3>
            <p>{t('source.prune_outside_roi_confirm')}</p>
            {pruneError && (
              <p style={{ color: 'var(--color-error)', fontSize: 13 }}>{pruneError}</p>
            )}
            <div className="dashboard-confirm-actions">
              <button onClick={() => setPruneConfirm(null)} disabled={prunePending}>
                {t('common.cancel')}
              </button>
              <button onClick={confirmPrune} disabled={prunePending}>
                {prunePending
                  ? t('source.prune_pending', 'Pruning…')
                  : t('source.kebab.prune_outside_roi')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prune result toast — simple modal, dismissed on click */}
      {pruneResult && (
        <div className="dashboard-confirm-overlay" onClick={() => setPruneResult(null)}>
          <div className="dashboard-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{t('source.kebab.prune_outside_roi')}</h3>
            <p>{t('source.prune_outside_roi_result', { count: pruneResult.count })}</p>
            <div className="dashboard-confirm-actions">
              <button onClick={() => setPruneResult(null)}>{t('common.ok')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit source modal */}
      {showSourceModal && (
        <div className="dashboard-confirm-overlay" onClick={() => setShowSourceModal(false)}>
          <div className="dashboard-confirm-dialog" style={{ maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <NumberInputScope scope={sourceFormNumbers}>
            <h3>{editingSourceId ? t('source.edit') : t('source.add')}</h3>

            {/* Type selector (slice 4): only meaningful when adding — type is
                immutable on edit because backend tables and managers are
                bound to the type that was chosen at creation time. */}
            {!editingSourceId && (
              <label className="dashboard-form-field">
                <span className="dashboard-form-label">{t('source.form.type', 'Type')}</span>
                <select
                  className="dashboard-form-input"
                  value={formType}
                  onChange={(e) =>
                    setFormType(
                      e.target.value as
                        | 'meshtastic_tcp'
                        | 'meshcore'
                        | 'meshcore_mqtt'
                        | 'mqtt_broker'
                        | 'mqtt_bridge'
                        | 'reticulum',
                    )
                  }
                >
                  <option value="meshtastic_tcp">{t('source.form.type_meshtastic', 'Meshtastic (TCP)')}</option>
                  <option value="meshcore">{t('source.form.type_meshcore', 'MeshCore')}</option>
                  <option value="meshcore_mqtt">{t('source.form.type_meshcore_mqtt', 'MeshCore MQTT ingest (read a region feed, no radio)')}</option>
                  <option value="mqtt_broker">{t('source.form.type_mqtt_broker', 'Embedded MQTT Broker (devices connect here)')}</option>
                  <option value="mqtt_bridge">{t('source.form.type_mqtt_bridge', 'MQTT Bridge (forward to/from an upstream broker)')}</option>
                  <option value="reticulum">{t('source.form.type_reticulum', 'Reticulum')}</option>
                </select>
              </label>
            )}
            {(formType === 'mqtt_broker' || formType === 'mqtt_bridge') && <MqttDocsLinks />}

            <label className="dashboard-form-field">
              <span className="dashboard-form-label">{t('source.form.name')}</span>
              <input
                className="dashboard-form-input"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('source.form.name_placeholder')}
                autoFocus
              />
            </label>

            {formType === 'mqtt_broker' ? (
              <>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mqtt_listen_port', 'Listen port')}</span>
                  <NumberInput
                    className="dashboard-form-input"
                    integer
                    min={1}
                    max={65535}
                    value={formMqttListenPort.trim() === '' ? null : Number(formMqttListenPort)}
                    onChange={(v) => setFormMqttListenPort(String(v))}
                    placeholder="1883"
                  />
                  <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                    {t('source.form.mqtt_listen_port_help', 'Devices configure their MQTT module to point at this port on the MeshMonitor host.')}
                  </p>
                </label>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mqtt_username', 'Username')}</span>
                  <input
                    className="dashboard-form-input"
                    type="text"
                    value={formMqttUsername}
                    onChange={(e) => setFormMqttUsername(e.target.value)}
                  />
                </label>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mqtt_password', 'Password')}</span>
                  <PasswordField
                    className="dashboard-form-input"
                    value={formMqttPassword}
                    onChange={(e) => setFormMqttPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={secretPlaceholder('auth.password')}
                  />
                </label>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mqtt_root_topic', 'Root topic')}</span>
                  <input
                    className="dashboard-form-input"
                    type="text"
                    value={formMqttRootTopic}
                    onChange={(e) => setFormMqttRootTopic(e.target.value)}
                    placeholder="msh"
                  />
                </label>
                <HopLimitPolicyFields
                  value={formMqttHopPolicy}
                  onChange={setFormMqttHopPolicy}
                  legacyNotice={formMqttLegacyHopNotice}
                />

                {/* Per-bridge topic rewrites. Only meaningful when editing
                    an existing broker — a brand-new broker has no bridges
                    attached yet, so we render nothing in that case. */}
                {editingSourceId && (() => {
                  const attachedBridges = sources.filter(
                    (s) => s.type === 'mqtt_bridge' && (s.config as any)?.brokerSourceId === editingSourceId,
                  );
                  if (attachedBridges.length === 0) return null;
                  return (
                    <div className="dashboard-form-field">
                      <span className="dashboard-form-label">
                        {t('source.form.bridge_topic_rewrites', 'Bridge topic rewrites')}
                      </span>
                      <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 8px' }}>
                        {t(
                          'source.form.bridge_topic_rewrites_help',
                          'For each bridge attached to this broker, replace a literal topic prefix on inbound (downlink) or outbound (uplink) messages. Leave both From and To empty to disable that direction.',
                        )}
                      </p>
                      {attachedBridges.map((bridge) => {
                        const rw = formBrokerBridgeRewrites[bridge.id] ?? {
                          downlinkFrom: '',
                          downlinkTo: '',
                          uplinkFrom: '',
                          uplinkTo: '',
                        };
                        const patch = (next: Partial<typeof rw>) => {
                          setFormBrokerBridgeRewrites((prev) => ({
                            ...prev,
                            [bridge.id]: { ...rw, ...next },
                          }));
                        };
                        const hasAny =
                          rw.downlinkFrom || rw.downlinkTo || rw.uplinkFrom || rw.uplinkTo;
                        return (
                          <details
                            key={bridge.id}
                            open={Boolean(hasAny)}
                            style={{
                              border: '1px solid var(--color-surface-hover)',
                              borderRadius: 4,
                              padding: '6px 10px',
                              marginBottom: 6,
                              background: 'var(--color-surface)',
                            }}
                          >
                            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
                              {bridge.name}
                              {hasAny && (
                                <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--color-accent)' }}>
                                  • {t('source.form.bridge_topic_rewrites_active', 'configured')}
                                </span>
                              )}
                            </summary>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                              <div>
                                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-subtle)' }}>
                                  {t('source.form.bridge_topic_rewrites_downlink', 'Downlink (to local broker)')}
                                </span>
                                <input
                                  type="text"
                                  className="dashboard-form-input"
                                  placeholder={t('source.form.bridge_topic_rewrites_from', 'From prefix') as string}
                                  value={rw.downlinkFrom}
                                  onChange={(e) => patch({ downlinkFrom: e.target.value })}
                                  style={{ marginTop: 4 }}
                                />
                                <input
                                  type="text"
                                  className="dashboard-form-input"
                                  placeholder={t('source.form.bridge_topic_rewrites_to', 'To prefix') as string}
                                  value={rw.downlinkTo}
                                  onChange={(e) => patch({ downlinkTo: e.target.value })}
                                  style={{ marginTop: 4 }}
                                />
                              </div>
                              <div>
                                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-subtle)' }}>
                                  {t('source.form.bridge_topic_rewrites_uplink', 'Uplink (to upstream)')}
                                </span>
                                <input
                                  type="text"
                                  className="dashboard-form-input"
                                  placeholder={t('source.form.bridge_topic_rewrites_from', 'From prefix') as string}
                                  value={rw.uplinkFrom}
                                  onChange={(e) => patch({ uplinkFrom: e.target.value })}
                                  style={{ marginTop: 4 }}
                                />
                                <input
                                  type="text"
                                  className="dashboard-form-input"
                                  placeholder={t('source.form.bridge_topic_rewrites_to', 'To prefix') as string}
                                  value={rw.uplinkTo}
                                  onChange={(e) => patch({ uplinkTo: e.target.value })}
                                  style={{ marginTop: 4 }}
                                />
                              </div>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            ) : formType === 'mqtt_bridge' ? (
              <>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mqtt_bridge_broker', 'Parent broker (optional)')}</span>
                  <select
                    className="dashboard-form-input"
                    value={formMqttBridgeBrokerId}
                    onChange={(e) => setFormMqttBridgeBrokerId(e.target.value)}
                  >
                    <option value="">{t('source.form.mqtt_bridge_broker_none', 'None — standalone client proxy')}</option>
                    {sources
                      .filter((s) => s.type === 'mqtt_broker')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                  <span style={{ fontSize: 11, color: 'var(--color-text-subtle)', marginTop: 4 }}>
                    {t(
                      'source.form.mqtt_bridge_broker_help',
                      'With a parent broker, the bridge also republishes upstream traffic to local devices and forwards their packets upstream. Without one, it runs as a pure MQTT client — useful for monitoring or as a client-proxy target for a Meshtastic source.',
                    )}
                  </span>
                </label>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mqtt_upstream_url', 'Upstream URL')}</span>
                  <input
                    className="dashboard-form-input"
                    type="text"
                    value={formMqttBridgeUrl}
                    onChange={(e) => setFormMqttBridgeUrl(e.target.value)}
                    placeholder="mqtt://mqtt.meshtastic.org:1883"
                  />
                  <HiddenUrlPartsNote hidden={hasHiddenUrlParts(editingSource, 'upstream.url')} />
                </label>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mqtt_username', 'Username')}</span>
                  <input
                    className="dashboard-form-input"
                    type="text"
                    value={formMqttBridgeUsername}
                    onChange={(e) => setFormMqttBridgeUsername(e.target.value)}
                  />
                </label>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mqtt_password', 'Password')}</span>
                  <PasswordField
                    className="dashboard-form-input"
                    value={formMqttBridgePassword}
                    onChange={(e) => setFormMqttBridgePassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={secretPlaceholder('upstream.password')}
                  />
                  <DroppedSecretNote
                    dropped={storedSecretWillBeDropped(
                      editingSource,
                      'upstream.password',
                      formMqttBridgePassword,
                      String((editingSource?.config as { upstream?: { url?: unknown } } | undefined)?.upstream?.url ?? ''),
                      formMqttBridgeUrl,
                    )}
                  />
                </label>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mqtt_subscriptions', 'Upstream topics (one per line)')}</span>
                  <textarea
                    className="dashboard-form-input"
                    rows={3}
                    value={formMqttBridgeSubscriptions}
                    onChange={(e) => setFormMqttBridgeSubscriptions(e.target.value)}
                  />
                </label>
                <MqttRootFinder
                  context="bridge"
                  sourceId={editingSource?.id ?? null}
                  currentRoot={formMqttBridgeSubscriptions.split('\n')[0]?.trim() ?? ''}
                  defaultRegionRoot={defaultBridgeRegionRoot(formMqttBridgeSubscriptions)}
                  getTarget={() =>
                    formMqttBridgeUrl.trim()
                      ? { broker: { url: formMqttBridgeUrl }, username: formMqttBridgeUsername, password: formMqttBridgePassword }
                      : null
                  }
                  onPickRoot={(root) =>
                    setFormMqttBridgeSubscriptions(applyRootToSubscriptions(formMqttBridgeSubscriptions, root))
                  }
                />
                {/* Advanced bridge settings (mode, forwarding, ok_to_mqtt,
                    publish channel/topic filters, geofence, topic rewrites)
                    live on the bridge's Configuration page so they're
                    maintained in one place — not duplicated here. When editing
                    an existing source we can deep-link straight to it. */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-subtle)', flex: 1 }}>
                    {t(
                      'source.form.mqtt_bridge_advanced_hint',
                      'Mode, forwarding, publish/subscribe filters, geofence, and topic rewrites are on the bridge’s Configuration page.',
                    )}
                  </span>
                  {editingSourceId && (
                    <button
                      type="button"
                      style={{
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        fontSize: 11,
                        padding: '4px 8px',
                        background: 'transparent',
                        color: 'var(--color-accent)',
                        border: '1px solid var(--color-accent)',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                      title={t('source.form.mqtt_bridge_open_settings_title', "Open the bridge section of this source's Settings page")}
                      onClick={() => {
                        setShowSourceModal(false);
                        void navigate(`/source/${editingSourceId}/settings#settings-mqtt-bridge`);
                      }}
                    >
                      {t('source.form.mqtt_bridge_open_settings', 'Bridge settings')} <UiIcon name="forward" size={14} />
                    </button>
                  )}
                </div>
              </>
            ) : formType === 'meshcore' ? (
              <>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('meshcore.form.transport', 'Transport')}</span>
                  <select
                    className="dashboard-form-input"
                    value={formMcTransport}
                    onChange={(e) => setFormMcTransport(e.target.value as 'usb' | 'tcp')}
                  >
                    <option value="usb">{t('meshcore.form.transport_usb', 'USB / Serial')}</option>
                    <option value="tcp">{t('meshcore.form.transport_tcp', 'TCP')}</option>
                  </select>
                </label>

                {formMcTransport === 'tcp' ? (
                  <>
                    <label className="dashboard-form-field">
                      <span className="dashboard-form-label">{t('source.form.host')}</span>
                      <input
                        className="dashboard-form-input"
                        type="text"
                        value={formMcTcpHost}
                        onChange={(e) => setFormMcTcpHost(e.target.value)}
                        placeholder={t('source.form.host_placeholder')}
                      />
                      <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                        {t('meshcore.form.tcp_host_help', 'Hostname or IP of the MeshCore companion reachable over TCP (e.g. esp-link, ser2net, or native TCP firmware).')}
                      </p>
                    </label>

                    <label className="dashboard-form-field">
                      <span className="dashboard-form-label">{t('source.form.tcp_port')}</span>
                      <NumberInput
                        className="dashboard-form-input"
                        integer
                        min={1}
                        max={65535}
                        value={formMcTcpPort.trim() === '' ? null : Number(formMcTcpPort)}
                        onChange={(v) => setFormMcTcpPort(String(v))}
                        placeholder={MESHCORE_DEFAULT_TCP_PORT}
                      />
                    </label>
                  </>
                ) : (
                  <label className="dashboard-form-field">
                    <span className="dashboard-form-label">{t('meshcore.form.serial_port', 'Serial Port')}</span>
                    <input
                      className="dashboard-form-input"
                      type="text"
                      value={formMcSerialPort}
                      onChange={(e) => setFormMcSerialPort(e.target.value)}
                      placeholder="/dev/ttyACM0"
                    />
                    <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                      {t('meshcore.form.serial_port_help', 'OS path of the USB-connected MeshCore companion (e.g. /dev/ttyACM0, COM3).')}
                    </p>
                  </label>
                )}

                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('meshcore.form.device_type', 'Device Type')}</span>
                  <select
                    className="dashboard-form-input"
                    value={formMcDeviceType}
                    onChange={(e) => {
                      const next = e.target.value as 'companion' | 'repeater';
                      setFormMcDeviceType(next);
                      // New source, field untouched: the Repeater probe stays
                      // off until the user sets it (#5563).
                      if (!editingSourceId && !formHeartbeatTouched) {
                        setFormHeartbeat(next === 'repeater' ? '0' : '30');
                      }
                    }}
                  >
                    <option value="companion">{t('meshcore.device_type.companion', 'Companion')}</option>
                    <option value="repeater">{t('meshcore.device_type.repeater', 'Repeater')}</option>
                  </select>
                </label>

                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.heartbeat')}</span>
                  <NumberInput
                    className="dashboard-form-input"
                    integer
                    min={0}
                    max={3600}
                    value={formHeartbeat.trim() === '' ? null : Number(formHeartbeat)}
                    onChange={(v) => { setFormHeartbeat(String(v)); setFormHeartbeatTouched(true); }}
                    placeholder="0"
                  />
                  <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                    {t('meshcore.form.heartbeat_help', 'Seconds between health probes (0 = disabled). After three failed probes the source reconnects on its own, with backoff. Works for Companion and Repeater devices. The probe stays on the local link and sends nothing over the radio.')}
                  </p>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0 4px' }}>
                  <input
                    type="checkbox"
                    checked={formAutoConnect}
                    onChange={(e) => setFormAutoConnect(e.target.checked)}
                  />
                  {t('source.form.auto_connect')}
                </label>
                <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '0 0 8px 24px' }}>
                  {t('source.form.auto_connect_help')}
                </p>

                <fieldset style={{ border: '1px solid var(--color-surface-hover)', borderRadius: 6, padding: '8px 12px 12px', margin: '8px 0' }}>
                  <legend style={{ fontSize: 12, padding: '0 6px', color: 'var(--color-text-subtle)' }}>{t('source.form.virtual_node')}</legend>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={formVnEnabled}
                      onChange={(e) => setFormVnEnabled(e.target.checked)}
                    />
                    {t('meshcore.form.enable_virtual_node', 'Expose this node to the MeshCore app over WiFi')}
                  </label>
                  {formVnEnabled && (
                    <>
                      <label className="dashboard-form-field" style={{ marginTop: 8 }}>
                        <span className="dashboard-form-label">{t('source.form.virtual_node_port')}</span>
                        <NumberInput
                          className="dashboard-form-input"
                          integer
                          min={1}
                          max={65535}
                          value={formVnPort.trim() === '' ? null : Number(formVnPort)}
                          onChange={(v) => setFormVnPort(String(v))}
                          placeholder="5000"
                        />
                        <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                          {t('meshcore.form.virtual_node_help', 'TCP port the MeshCore mobile app connects to. Point the app at this host and port over WiFi.')}
                        </p>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={formVnAllowAdmin}
                          onChange={(e) => setFormVnAllowAdmin(e.target.checked)}
                        />
                        {t('meshcore.form.allow_admin_commands', 'Allow admin commands')}
                      </label>
                      <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                        {t('meshcore.form.allow_admin_help', 'Third-party clients connected to the virtual node can send config/admin commands to your MeshCore node. Leave off unless you trust the clients.')}
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={formVnAllowPkiExport}
                          onChange={(e) => setFormVnAllowPkiExport(e.target.checked)}
                        />
                        {t('meshcore.form.allow_pki_export', 'Allow PKI export')}
                      </label>
                      <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                        {t('meshcore.form.allow_pki_export_help', 'Let connected clients read your node\'s private key. Some tools (e.g. Remote-Terminal\'s community MQTT) require it to authenticate as your node. The virtual node port has no client authentication, so anyone who can reach it can copy your node identity. Leave off unless you need it. Requires node firmware built with ENABLE_PRIVATE_KEY_EXPORT.')}
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={formVnAllowPkiImport}
                          onChange={(e) => setFormVnAllowPkiImport(e.target.checked)}
                        />
                        {t('meshcore.form.allow_pki_import', 'Allow PKI import')}
                      </label>
                      <p style={{ fontSize: 11, color: 'var(--color-warning)', margin: '4px 0 0' }}>
                        {t('meshcore.form.allow_pki_import_help', 'Danger: lets any connected client permanently replace your node\'s identity with a key it chooses. The virtual node port has no client authentication, so anyone who can reach it could take over your node\'s identity, and the old identity is lost unless you exported it first. Leave off unless you are restoring a backed-up key right now, then turn it off again. Requires node firmware built with ENABLE_PRIVATE_KEY_IMPORT.')}
                      </p>
                    </>
                  )}
                </fieldset>

                <fieldset style={{ border: '1px solid var(--color-surface-hover)', borderRadius: 6, padding: '8px 12px 12px', margin: '8px 0' }} data-testid="observer-moved-note">
                  <legend style={{ fontSize: 12, padding: '0 6px', color: 'var(--color-text-subtle)' }}>{t('meshcore.form.observer', 'Analyzer Observer')}</legend>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-subtle)', flex: 1 }}>
                      {formMcDeviceType === 'repeater'
                        ? t('meshcore.form.observer_repeater_note', 'The Analyzer Observer requires a Companion device — a repeater cannot export the signing key it needs.')
                        : editingSourceId
                          ? t('meshcore.form.observer_moved', "Turn the Analyzer Observer on, choose its brokers and set their logins on this source's MeshCore → Configuration page.")
                          : t('meshcore.form.observer_moved_new', "Save the source first. Then turn the Analyzer Observer on and choose its brokers on its MeshCore → Configuration page.")}
                    </span>
                    {editingSourceId && formMcDeviceType !== 'repeater' && (
                      <button
                        type="button"
                        style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: 11, padding: '4px 8px', background: 'transparent', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 4, cursor: 'pointer' }}
                        title={t('meshcore.form.observer_open_config', 'Open Configuration page')}
                        onClick={() => { setShowSourceModal(false); void navigate(`/source/${editingSourceId}/#configuration`); }}
                      >
                        {t('meshcore.form.observer_open_config', 'Configuration')} <UiIcon name="forward" size={14} />
                      </button>
                    )}
                  </div>
                </fieldset>
              </>
            ) : formType === 'meshcore_mqtt' ? (
              <>
                <div className="dashboard-form-help" style={{ marginBottom: '0.75rem' }}>
                  {t(
                    'source.form.mc_mqtt_intro',
                    'Reads a MeshCore Analyzer region feed over MQTT. This source has no radio: it can never transmit, and shows no device, contacts, or remote-admin pages.',
                  )}
                </div>

                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mc_mqtt_broker_url', 'Broker URL')}</span>
                  <input
                    className="dashboard-form-input"
                    type="text"
                    value={formMcMqttBrokerUrl}
                    onChange={(e) => setFormMcMqttBrokerUrl(e.target.value)}
                    placeholder="wss://mqtt.meshmapper.net:443"
                  />
                  <HiddenUrlPartsNote hidden={hasHiddenUrlParts(editingSource, 'brokerUrl')} />
                  <span className="dashboard-form-help">
                    {t('source.form.mc_mqtt_broker_url_help', 'One broker per source. Accepts ws://, wss://, mqtt://, mqtts://, or host:port. Add a second source for a second broker.')}
                  </span>
                </label>

                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mc_mqtt_region', 'Region (IATA)')}</span>
                  <input
                    className="dashboard-form-input"
                    type="text"
                    value={formMcMqttRegion}
                    onChange={(e) => setFormMcMqttRegion(e.target.value)}
                    placeholder="MCO"
                  />
                  <span className="dashboard-form-help">
                    {t('source.form.mc_mqtt_region_help', "The region segment of the topic this source subscribes to. Uppercased on save.")}
                  </span>
                </label>
                <MqttRootFinder
                  protocol="meshcore"
                  context="meshcore_mqtt"
                  sourceId={editingSource?.id ?? null}
                  currentRoot={formMcMqttRegion.trim().toUpperCase()}
                  defaultRegionRoot=""
                  getTarget={() =>
                    formMcMqttBrokerUrl.trim()
                      ? {
                          broker: { url: formMcMqttBrokerUrl.trim() },
                          username: formMcMqttUsername,
                          password: formMcMqttPassword,
                          rejectUnauthorized: formMcMqttRejectUnauthorized,
                        }
                      : null
                  }
                  onPickRoot={(code) => setFormMcMqttRegion(code.toUpperCase())}
                />

                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mc_mqtt_username', 'Username (optional)')}</span>
                  <input
                    className="dashboard-form-input"
                    type="text"
                    value={formMcMqttUsername}
                    onChange={(e) => setFormMcMqttUsername(e.target.value)}
                    autoComplete="off"
                  />
                </label>

                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('source.form.mc_mqtt_password', 'Password (optional)')}</span>
                  <PasswordField
                    className="dashboard-form-input"
                    value={formMcMqttPassword}
                    onChange={(e) => setFormMcMqttPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={secretPlaceholder('password')}
                  />
                  <DroppedSecretNote
                    dropped={storedSecretWillBeDropped(
                      editingSource,
                      'password',
                      formMcMqttPassword,
                      String(editingSource?.config?.brokerUrl ?? ''),
                      formMcMqttBrokerUrl,
                    )}
                  />
                  <span className="dashboard-form-help">
                    {t('source.form.mc_mqtt_password_help', 'Only for brokers using fixed MQTT credentials. Leave both blank for an open broker.')}
                  </span>
                </label>

                <label className="dashboard-form-checkbox">
                  <input
                    type="checkbox"
                    checked={formMcMqttRejectUnauthorized}
                    onChange={(e) => setFormMcMqttRejectUnauthorized(e.target.checked)}
                  />
                  <span>{t('source.form.mc_mqtt_reject_unauthorized', 'Verify TLS certificate')}</span>
                </label>

                <label className="dashboard-form-checkbox">
                  <input
                    type="checkbox"
                    checked={formMcMqttAutoConnect}
                    onChange={(e) => setFormMcMqttAutoConnect(e.target.checked)}
                  />
                  <span>{t('source.form.auto_connect', 'Connect automatically on startup')}</span>
                </label>
              </>
            ) : formType === 'reticulum' ? (
              <>
                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('reticulum.form.mode', 'Mode')}</span>
                  <select
                    className="dashboard-form-input"
                    // Explicit: the wrapping <label> also contains the help
                    // <p>, so the implicit accessible name would be label +
                    // help text concatenated.
                    aria-label={t('reticulum.form.mode', 'Mode')}
                    value={formRnsMode}
                    onChange={(e) => setFormRnsMode(e.target.value as 'attach' | 'tcp_peer')}
                  >
                    <option value="attach">{t('reticulum.form.mode_attach', 'Attach to shared rnsd')}</option>
                    <option value="tcp_peer">{t('reticulum.form.mode_tcp_peer', 'TCP peer')}</option>
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                    {formRnsMode === 'attach'
                      ? t('reticulum.form.mode_attach_help', 'The bridge sidecar joins a shared rnsd instance by reading its RNS config directory.')
                      : t('reticulum.form.mode_tcp_peer_help', "The bridge sidecar runs its own RNS instance and dials out to a single TCPClientInterface peer — no local rnsd or config directory needed.")}
                  </p>
                </label>

                {formRnsMode === 'attach' ? (
                  <label className="dashboard-form-field">
                    <span className="dashboard-form-label">{t('reticulum.form.config_dir', 'Config directory')}</span>
                    <input
                      className="dashboard-form-input"
                      type="text"
                      value={formRnsConfigDir}
                      onChange={(e) => setFormRnsConfigDir(e.target.value)}
                      placeholder="/rns"
                    />
                    <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                      {t('reticulum.form.config_dir_help', "Directory of the shared rnsd instance's RNS config, as seen by the bridge sidecar's container/host.")}
                    </p>
                  </label>
                ) : (
                  <>
                    <label className="dashboard-form-field">
                      <span className="dashboard-form-label">{t('source.form.host')}</span>
                      <input
                        className="dashboard-form-input"
                        type="text"
                        value={formRnsPeerHost}
                        onChange={(e) => setFormRnsPeerHost(e.target.value)}
                        placeholder="amsterdam.connect.reticulum.network"
                      />
                    </label>
                    <label className="dashboard-form-field">
                      <span className="dashboard-form-label">{t('source.form.tcp_port')}</span>
                      <NumberInput
                        className="dashboard-form-input"
                        integer
                        min={1}
                        max={65535}
                        value={formRnsPeerPort.trim() === '' ? null : Number(formRnsPeerPort)}
                        onChange={(v) => setFormRnsPeerPort(String(v))}
                        placeholder="4965"
                      />
                    </label>
                  </>
                )}

                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('reticulum.form.bridge_url', 'Bridge URL')}</span>
                  <input
                    className="dashboard-form-input"
                    type="text"
                    value={formRnsBridgeUrl}
                    onChange={(e) => setFormRnsBridgeUrl(e.target.value)}
                    placeholder="ws://127.0.0.1:8765"
                  />
                  <HiddenUrlPartsNote hidden={hasHiddenUrlParts(editingSource, 'bridgeUrl')} />
                  <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                    {t('reticulum.form.bridge_url_help', 'WebSocket URL of the meshmonitor-rns-bridge sidecar. Defaults to ws://127.0.0.1:8765 when left blank.')}
                  </p>
                </label>

                <label className="dashboard-form-field">
                  <span className="dashboard-form-label">{t('reticulum.form.token', 'Bridge token')}</span>
                  <PasswordField
                    className="dashboard-form-input"
                    // Explicit: the wrapping <label> also contains the help
                    // <p>, so the implicit accessible name would be label +
                    // help text concatenated.
                    aria-label={t('reticulum.form.token', 'Bridge token')}
                    value={formRnsToken}
                    onChange={(e) => setFormRnsToken(e.target.value)}
                    autoComplete="new-password"
                    placeholder={secretPlaceholder('token')}
                  />
                  <DroppedSecretNote
                    dropped={storedSecretWillBeDropped(
                      editingSource,
                      'token',
                      formRnsToken,
                      String(editingSource?.config?.bridgeUrl ?? '') || RETICULUM_DEFAULT_BRIDGE_URL,
                      formRnsBridgeUrl.trim() || RETICULUM_DEFAULT_BRIDGE_URL,
                    )}
                  />
                  <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                    {t('reticulum.form.token_help', "Shared secret for the bridge's hello handshake — must match the bridge sidecar's BRIDGE_TOKEN.")}
                  </p>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0 4px' }}>
                  <input
                    type="checkbox"
                    checked={formRnsAutoConnect}
                    onChange={(e) => setFormRnsAutoConnect(e.target.checked)}
                  />
                  {t('source.form.auto_connect')}
                </label>
                <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '0 0 8px 24px' }}>
                  {t('source.form.auto_connect_help')}
                </p>
              </>
            ) : (
            <>
            <label className="dashboard-form-field">
              <span className="dashboard-form-label">{t('source.form.host')}</span>
              <input
                className="dashboard-form-input"
                type="text"
                value={formHost}
                onChange={(e) => setFormHost(e.target.value)}
                placeholder={t('source.form.host_placeholder')}
              />
            </label>

            <label className="dashboard-form-field">
              <span className="dashboard-form-label">{t('source.form.tcp_port')}</span>
              <NumberInput
                className="dashboard-form-input"
                integer
                min={1}
                max={65535}
                value={formPort.trim() === '' ? null : Number(formPort)}
                onChange={(v) => setFormPort(String(v))}
                placeholder="4403"
              />
            </label>

            <label className="dashboard-form-field">
              <span className="dashboard-form-label">{t('source.form.heartbeat')}</span>
              <NumberInput
                className="dashboard-form-input"
                integer
                min={0}
                max={3600}
                value={formHeartbeat.trim() === '' ? null : Number(formHeartbeat)}
                onChange={(v) => { setFormHeartbeat(String(v)); setFormHeartbeatTouched(true); }}
                placeholder="0"
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                {t('source.form.heartbeat_help')}
              </p>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0 4px' }}>
              <input
                type="checkbox"
                checked={formAutoConnect}
                onChange={(e) => setFormAutoConnect(e.target.checked)}
              />
              {t('source.form.auto_connect')}
            </label>
            <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '0 0 8px 24px' }}>
              {t('source.form.auto_connect_help')}
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0 4px' }}>
              <input
                type="checkbox"
                checked={formPassiveMode}
                onChange={(e) => setFormPassiveMode(e.target.checked)}
              />
              {t('source.form.passive_mode', 'Passive Mode')}
            </label>
            <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '0 0 8px 24px' }}>
              {t(
                'source.form.passive_mode_help',
                'Reduces outbound requests to large or fragile TCP nodes. Preserves cached config across reconnects and skips post-config device requests. Recommended for router-class nodes with large NodeDBs.'
              )}
            </p>

            {formPassiveMode && (
              <label className="dashboard-form-field" style={{ marginLeft: 24, marginBottom: 8 }}>
                <span className="dashboard-form-label">
                  {t('source.form.passive_resync_stale_hours', 'Resync staleness window (hours)')}
                </span>
                <NumberInput
                  className="dashboard-form-input"
                  allowEmpty
                  min={0.0167}
                  max={168}
                  step={0.5}
                  value={formPassiveResyncStaleHours.trim() === '' ? null : Number(formPassiveResyncStaleHours)}
                  onChange={(v) => setFormPassiveResyncStaleHours(v === null ? '' : String(v))}
                  placeholder={t('source.form.passive_resync_stale_default', '4 (default)')}
                />
                <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                  {t(
                    'source.form.passive_resync_stale_help',
                    'How long the cached config stays valid after a disconnect before the next reconnect forces a full sync. Leave blank for 4 hours (default). Range: 1 minute – 7 days.'
                  )}
                </p>
              </label>
            )}

            <fieldset style={{ border: '1px solid var(--color-surface-hover)', borderRadius: 6, padding: '8px 12px 12px', margin: '8px 0' }}>
              <legend style={{ fontSize: 12, padding: '0 6px', color: 'var(--color-text-subtle)' }}>{t('source.form.virtual_node')}</legend>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={formVnEnabled}
                  onChange={(e) => setFormVnEnabled(e.target.checked)}
                />
                {t('source.form.enable_virtual_node')}
              </label>
              {formVnEnabled && (
                <>
                  <label className="dashboard-form-field" style={{ marginTop: 8 }}>
                    <span className="dashboard-form-label">{t('source.form.virtual_node_port')}</span>
                    <NumberInput
                      className="dashboard-form-input"
                      integer
                      min={1}
                      max={65535}
                      value={formVnPort.trim() === '' ? null : Number(formVnPort)}
                      onChange={(v) => setFormVnPort(String(v))}
                      placeholder="4403"
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={formVnAllowAdmin}
                      onChange={(e) => setFormVnAllowAdmin(e.target.checked)}
                    />
                    {t('source.form.allow_admin_commands')}
                  </label>
                  <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                    {t('source.form.allow_admin_help')}
                  </p>
                </>
              )}
            </fieldset>

            {sources.some((s) => s.type === 'mqtt_broker') && (
              <label className="dashboard-form-field">
                <span className="dashboard-form-label">
                  {t('source.form.mqtt_proxy_link', 'Bridge MQTT proxy to')}
                </span>
                <select
                  className="dashboard-form-input"
                  value={formMtMqttLinkBrokerId}
                  onChange={(e) => setFormMtMqttLinkBrokerId(e.target.value)}
                >
                  <option value="">{t('source.form.mqtt_proxy_none', 'None — device handles MQTT directly')}</option>
                  {sources
                    .filter((s) => s.type === 'mqtt_broker')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', margin: '4px 0 0' }}>
                  {t(
                    'source.form.mqtt_proxy_link_help',
                    'When set, MeshMonitor relays the device’s MQTT traffic to the selected embedded broker and feeds broker traffic back to it. Requires Proxy to Client on in the device’s MQTT module. To link the device straight to a bridge instead, use Quick configure on its Device Configuration → MQTT Module page.',
                  )}
                </p>
              </label>
            )}
            </>
            )}

            {formError && (
              <p style={{ color: 'var(--color-error)', fontSize: 12, margin: '8px 0 0' }}>{formError}</p>
            )}

            <div className="dashboard-confirm-actions" style={{ marginTop: 16 }}>
              <button onClick={() => setShowSourceModal(false)}>{t('common.cancel')}</button>
              <button onClick={onSaveSource} disabled={formSaving || sourceFormNumbers.invalid} style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}>
                {formSaving ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                  </NumberInputScope>
                </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage — public export; wraps in SettingsProvider
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <MapProvider>
          <DashboardInner />
        </MapProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
