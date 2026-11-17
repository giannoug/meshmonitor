/**
 * In MeshMonitor › Notifications (board b-set-d5, Task 5.8): today's
 * Notifications tab (services, Web Push on this browser, Apprise URLs, what
 * to notify about, monitored nodes, keyword filters, message format, server
 * events) on the row kit, plus the Replies and Mentions toggles (cs2, D13).
 *
 * - Each preference saves as you go through today's `POST /api/push/preferences`
 *   (only the field sent is merged); text and numbers save on blur or Enter.
 *   The Apprise URLs keep an inline Save (bs2); the VAPID block is Server ›
 *   Notification services' (Task 6.4, s18n6).
 * - Web Push on this browser subscribes or unsubscribes this browser for this
 *   source (today's per-source rows, #5493); turning it on also turns on the
 *   Web Push service, which a subscription needs to deliver.
 * - Replies and Mentions (Meshtastic radios): the server's activity notifier
 *   (meshtasticActivityNotifier.ts) pushes them; both start off.
 * - Audio notifications (this browser) sit beside them for a viewer who may
 *   open the source's Settings, as today (canOpenSourceSettings).
 *
 * Nothing here sends on the mesh: these are pushes to the user's own browsers
 * and Apprise targets.
 */
import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import ChannelSoundPicker from '../../../components/ChannelSoundPicker';
import NotificationFormatSection from '../../../components/NotificationFormatSection';
import { canOpenSourceSettings } from '../../../components/nav/sourceSettingsAccess';
import { useAuth } from '../../../contexts/AuthContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useSource } from '../../../contexts/SourceContext';
import apiService from '../../../services/api';
import { notificationCapabilities, loadNotificationChannels } from '../../../utils/notificationCapabilities';
import type { NotificationPreferenceDefaults } from '../../../utils/notificationDefaults';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import Sheet from '../../patterns/Sheet';
import { useIsPhone } from '../../shell/useIsPhone';
import StateView from '../../patterns/StateView';
import AdvancedCard from '../kit/AdvancedCard';
import SettingGroup from '../kit/SettingGroup';
import SettingNumber from '../kit/SettingNumber';
import SettingRow from '../kit/SettingRow';
import SettingToggle from '../kit/SettingToggle';
import type { CategoryProps } from '../categories';
import { useAutosaveValue } from '../useAutosaveSetting';
import { notificationPrefsKey, useNotificationPrefs, usePrefField, type NotificationPrefs } from '../useNotificationPrefs';
import { pushSupported, subscribeHere, unsubscribeEverywhere, unsubscribeHere, usePushHere } from '../webPush';
import { Warn } from './RowParts';
import { AutosavePage, CommitOnBlur, SavedLine } from './autosave';
import pages from './SettingsPages.module.css';
import styles from './Autosave.module.css';

type Prefs = NotificationPreferenceDefaults;
type BoolField = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];

export default function NotificationsCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  return (
    <AutosavePage scope={t('workspace.settings.notifications.scope')} needsSettings={false}>
      <NotificationRows sourceId={sourceId} />
    </AutosavePage>
  );
}

function NotificationRows({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const { sourceType } = useSource();
  const { authStatus, hasPermission } = useAuth();
  const isAdmin = authStatus?.user?.isAdmin ?? false;
  const caps = notificationCapabilities(sourceType);
  const radio = sourceType === 'meshtastic_tcp';
  const { data: prefs, isLoading, isError, refetch } = useNotificationPrefs(sourceId);
  if (isLoading) return <StateView kind="loading" />;
  if (isError || !prefs) return <StateView kind="error" onRetry={() => void refetch()} />;

  const toggle = (field: BoolField, label: string, help?: ReactNode, below?: ReactNode) => (
    <PrefToggle key={field} sourceId={sourceId} field={field} label={label} help={help} below={below} />
  );

  return (
    <>
      {prefs.usingDefaults && (
        <p className={pages.note} role="status">
          <UiIcon name="info" size={16} />
          <span>{t('notifications.using_defaults_notice')}</span>
        </p>
      )}
      <SettingGroup title={t('workspace.settings.notifications.delivery')}>
        <WebPushRow sourceId={sourceId} prefs={prefs} />
        <AppriseRow sourceId={sourceId} prefs={prefs} />
        {canOpenSourceSettings(hasPermission, sourceType) && <AudioRow />}
      </SettingGroup>

      <SettingGroup title={t('workspace.settings.notifications.notify_about')}>
        {caps.dm && toggle('enableDirectMessages', t('notifications.direct_messages'))}
        {caps.channels && <ChannelsRow sourceId={sourceId} />}
        {radio && toggle('notifyOnReply', t('workspace.settings.notifications.replies'), t('workspace.settings.notifications.replies_help'))}
        {radio && toggle('notifyOnMention', t('notifications.notify_on_mention'), t('workspace.settings.notifications.mentions_help'))}
        {caps.emoji && toggle('notifyOnEmoji', t('notifications.emoji_reactions'))}
        {caps.mqtt && toggle('notifyOnMqtt', t('notifications.mqtt_messages'))}
        {caps.newNode === 'on' && toggle('notifyOnNewNode', t('notifications.new_nodes'))}
        {toggle(
          'notifyOnLowBattery',
          t('notifications.notify_on_low_battery'),
          t('notifications.low_battery_threshold_hint_percent'),
          prefs.notifyOnLowBattery && (
            <PrefNumber sourceId={sourceId} field="lowBatteryThreshold" label={t('notifications.low_battery_threshold_label')} min={0} max={100} />
          ),
        )}
        {caps.traceroute && toggle('notifyOnTraceroute', t('notifications.traceroutes'))}
        {caps.waypoint && toggle('notifyOnWaypoint', t('notifications.notify_on_waypoint', 'Waypoint arrivals'))}
        {toggle('notifyOnInactiveNode', t('notifications.notify_on_inactive_node'), t('workspace.settings.notifications.inactive_help'))}
      </SettingGroup>

      <AdvancedCard label={t('workspace.settings.notifications.advanced')}>
        {(prefs.notifyOnInactiveNode || prefs.notifyOnLowBattery) && <MonitoredNodesRow sourceId={sourceId} />}
        {caps.waypoint && prefs.notifyOnWaypoint && <WaypointRows sourceId={sourceId} />}
        {toggle(
          'notifyOnServerEvents',
          t('notifications.notify_on_server_events'),
          <>
            {t('notifications.server_events_description')}{' '}
            {[
              t('notifications.server_events_startup'),
              ...(caps.connectionEvents === 'radio' ? [t('notifications.server_events_disconnect'), t('notifications.server_events_reconnect')] : []),
              ...(caps.connectionEvents === 'broker'
                ? [t('notifications.server_events_disconnect_broker'), t('notifications.server_events_reconnect_broker')]
                : []),
            ].join(' · ')}
          </>,
        )}
        {toggle('prefixWithNodeName', t('notifications.prefix_with_node_name'), t('notifications.prefix_with_node_name_description'))}
        <FormatRows sourceId={sourceId} prefs={prefs} />
        <KeywordRow sourceId={sourceId} field="whitelist" label={t('notifications.whitelist_title')} />
        <KeywordRow sourceId={sourceId} field="blacklist" label={t('notifications.blacklist_title')} />
        <p className={pages.groupNote}>
          <strong>{t('notifications.filter_priority')}</strong> {t('notifications.filter_priority_order')}
        </p>
        <PushToolsRows sourceId={sourceId} isAdmin={isAdmin} />
      </AdvancedCard>
    </>
  );
}

function PrefToggle({ sourceId, field, label, help, below }: { sourceId: string; field: BoolField; label: string; help?: ReactNode; below?: ReactNode }) {
  const [value, set, status] = usePrefField(sourceId, field);
  return (
    <>
      <SettingRow id={`notifications.${field}`} label={label} help={help}>
        <SavedLine status={status} />
        <SettingToggle checked={value} onChange={set} />
      </SettingRow>
      {below}
    </>
  );
}

type NumberField = 'lowBatteryThreshold' | 'waypointRadiusKm';

function PrefNumber({ sourceId, field, label, min, max }: { sourceId: string; field: NumberField; label: string; min: number; max: number }) {
  const [value, set, status] = usePrefField(sourceId, field, 'blur');
  return (
    <SettingRow id={`notifications.${field}`} label={label}>
      <SavedLine status={status} />
      <CommitOnBlur status={status}>
        <SettingNumber value={value} onChange={set} min={min} max={max} step={field === 'waypointRadiusKm' ? 0.1 : 1} />
      </CommitOnBlur>
    </SettingRow>
  );
}

/** Web Push on this browser: this source's subscription for this browser (and the Web Push service). */
function WebPushRow({ sourceId, prefs }: { sourceId: string; prefs: NotificationPrefs }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const push = usePushHere(sourceId);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ saved: boolean; error?: string }>({ saved: false });
  const supported = pushSupported();
  const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const secure = window.isSecureContext || local;
  const permission = supported ? Notification.permission : 'default';
  const on = !!push.data?.subscribed && prefs.enableWebPush;

  const change = async (next: boolean) => {
    setBusy(true);
    setState({ saved: false });
    try {
      if (next) {
        const granted = Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted';
        if (!granted) {
          setState({ saved: false, error: t('notifications.permission_denied_text') });
          return;
        }
        await subscribeHere(sourceId);
        // A subscription delivers only with the Web Push service on; a failed write shows on this row.
        if (!prefs.enableWebPush) {
          try {
            await apiService.post('/api/push/preferences', { enableWebPush: true, sourceId });
          } catch {
            setState({ saved: false, error: t('notifications.alert_save_failed') });
            return;
          }
          queryClient.setQueryData<NotificationPrefs>(notificationPrefsKey(sourceId), (prev) => prev && { ...prev, enableWebPush: true });
        }
      } else {
        await unsubscribeHere(sourceId);
      }
      setState({ saved: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ saved: false, error: next ? t('notifications.alert_subscribe_failed', { error: message }) : t('notifications.alert_unsubscribe_failed') });
    } finally {
      setBusy(false);
      await push.reread();
    }
  };

  let help: ReactNode;
  if (!supported) help = t('notifications.alert_not_supported');
  else if (!secure) help = <Warn>{t('notifications.https_required_text')}</Warn>;
  else if (permission === 'denied') help = <Warn>{t('notifications.permission_denied_text')}</Warn>;
  else {
    const others = push.data?.otherSources ?? 0;
    help = (
      <>
        {push.data?.subscribed ? t('notifications.subscribed') : t('notifications.not_subscribed')}
        {others > 0 && ` · ${t('notifications.subscribed_other_sources', { count: others })}`}
      </>
    );
  }

  return (
    <SettingRow id="notifications.webPush" label={t('workspace.settings.notifications.web_push')} help={help}>
      <SavedLine status={state} />
      <SettingToggle checked={on} onChange={(v) => void change(v)} readOnly={!supported || !secure || busy || push.isLoading ? true : undefined} />
    </SettingRow>
  );
}

/** Apprise: the service switch, and its URLs in a sheet with today's Save and Test. */
function AppriseRow({ sourceId, prefs }: { sourceId: string; prefs: NotificationPrefs }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const queryClient = useQueryClient();
  const [service, setService, status] = usePrefField(sourceId, 'enableApprise');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);
  const urls = prefs.appriseUrls ?? [];

  const save = async () => {
    setSaving(true);
    const next = text.split('\n').map((u) => u.trim()).filter((u) => u.length > 0);
    try {
      await apiService.post('/api/push/preferences', { appriseUrls: next, sourceId });
      queryClient.setQueryData<NotificationPrefs>(notificationPrefsKey(sourceId), (prev) => prev && { ...prev, appriseUrls: next });
      setResult({ tone: 'ok', message: t('notifications.config_saved') });
    } catch {
      setResult({ tone: 'error', message: t('notifications.config_save_failed') });
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    setResult(null);
    try {
      const r = await apiService.post<{ success: boolean; message: string }>('/api/apprise/test', { sourceId });
      setResult({ tone: r.success ? 'ok' : 'error', message: r.message });
    } catch {
      setResult({ tone: 'error', message: t('notifications.connection_test_failed') });
    }
  };

  return (
    <>
      <SettingRow id="notifications.enableApprise" label={t('notifications.apprise_title')} help={t('notifications.apprise_description')}>
        <SavedLine status={status} />
        <button
          type="button"
          className={pages.button}
          onClick={() => {
            setText(urls.join('\n'));
            setResult(null);
            setOpen(true);
          }}
        >
          {t('workspace.settings.notifications.apprise_urls', { count: urls.length })}
          <UiIcon name="chevronRight" size={16} />
        </button>
        <SettingToggle checked={service} onChange={setService} />
      </SettingRow>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('notifications.apprise_config_title')}
        footer={
          <div className={pages.inline} data-phone={isPhone || undefined}>
            <button type="button" className={pages.button} onClick={() => void test()} disabled={saving}>
              {t('notifications.send_test')}
            </button>
            <button type="button" className={`${pages.button} ${pages.primary}`} onClick={() => void save()} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        }
      >
        <div className={pages.field} data-phone={isPhone || undefined}>
          <label htmlFor="workspace-apprise-urls">{t('notifications.apprise_urls_label')}</label>
          <p className={pages.muted}>{t('notifications.apprise_about_text')}</p>
          <textarea id="workspace-apprise-urls" className={styles.textarea} rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          {result && (
            <p className={result.tone === 'ok' ? styles.saved : styles.error} role={result.tone === 'ok' ? 'status' : 'alert'}>
              {result.message}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}

/** Audio notifications in this browser (SettingsContext, stored locally), and today's per-channel sounds. */
function AudioRow() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <>
      <SettingRow id="notifications.audio" label={t('settings.enable_audio_notifications')} help={t('settings.enable_audio_notifications_description')}>
        <SettingToggle checked={s.enableAudioNotifications} onChange={s.setEnableAudioNotifications} />
      </SettingRow>
      {s.enableAudioNotifications && (
        <div className={pages.embedded}>
          <p className={pages.muted}>{t('settings.channel_sounds_description')}</p>
          <ChannelSoundPicker />
        </div>
      )}
    </>
  );
}

/** Channels: the enabled channels' names, a sheet of checkboxes that each save at once. */
function ChannelsRow({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const { sourceType } = useSource();
  const [open, setOpen] = useState(false);
  const [enabled, set, status] = usePrefField(sourceId, 'enabledChannels');
  const { data: channels = [] } = useQuery({
    queryKey: ['workspace', 'notificationChannels', sourceId],
    queryFn: () => loadNotificationChannels(sourceId, sourceType),
    staleTime: Infinity,
  });
  const name = (id: number) => channels.find((c) => c.id === id)?.name || t('notifications.channel_number', { id });
  const shown = enabled.length ? enabled.map(name).join(', ') : t('notifications.no_channels');
  return (
    <>
      <SettingRow id="notifications.enabledChannels" label={t('notifications.channels')}>
        <SavedLine status={status} />
        <button type="button" className={pages.button} onClick={() => setOpen(true)}>
          {shown}
          <UiIcon name="chevronRight" size={16} />
        </button>
      </SettingRow>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('notifications.channels')}>
        {channels.length === 0 ? (
          <p className={pages.muted}>{t('notifications.no_channels')}</p>
        ) : (
          <ul className={pages.checkList}>
            {channels.map((c) => (
              <li key={c.id}>
                <label className={pages.check}>
                  <input
                    type="checkbox"
                    checked={enabled.includes(c.id)}
                    onChange={(e) => set(e.target.checked ? [...enabled, c.id] : enabled.filter((id) => id !== c.id))}
                  />
                  <span className={pages.checkText}>{c.name || t('notifications.channel_number', { id: c.id })}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <SavedLine status={status} />
      </Sheet>
    </>
  );
}

interface NodeRow {
  nodeId?: string;
  longName?: string;
  shortName?: string;
  user?: { id?: string; longName?: string; shortName?: string };
}

/** Monitored nodes for inactive-node and low-battery alerts: a searchable sheet, each tick saved at once. */
function MonitoredNodesRow({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, set, status] = usePrefField(sourceId, 'monitoredNodes');
  // Read when the sheet opens, as today's tab read on open.
  const { data: nodes = [] } = useQuery({
    queryKey: ['workspace', 'notificationNodes', sourceId],
    queryFn: async () => {
      const list = await apiService.get<NodeRow[]>(`/api/nodes?sourceId=${encodeURIComponent(sourceId)}&includeAllMeshcore=true`);
      return Array.isArray(list) ? list : [];
    },
    enabled: open,
    staleTime: Infinity,
  });
  const idOf = (n: NodeRow) => n.user?.id || n.nodeId || '';
  const nameOf = (n: NodeRow) => n.user?.longName || n.longName || idOf(n);
  const q = search.trim().toLowerCase();
  const shown = nodes.filter((n) => idOf(n) && (!q || [nameOf(n), n.user?.shortName || n.shortName || '', idOf(n)].some((s) => s.toLowerCase().includes(q))));
  return (
    <>
      <SettingRow id="notifications.monitoredNodes" label={t('workspace.settings.notifications.monitored_nodes')} help={t('notifications.monitored_nodes_description')}>
        <SavedLine status={status} />
        <button type="button" className={pages.button} onClick={() => setOpen(true)}>
          {t('notifications.monitored_nodes_count', { count: selected.length })}
          <UiIcon name="chevronRight" size={16} />
        </button>
      </SettingRow>
      {selected.length === 0 && <p className={pages.groupNote}><Warn>{t('notifications.no_nodes_selected_warning')}</Warn></p>}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('workspace.settings.notifications.monitored_nodes')}>
        {/* The sheet portals out of the page's <main data-phone>, so it says phone itself (D8). */}
        <div className={pages.field} data-phone={isPhone || undefined}>
          <input
            type="search"
            className={pages.keyInput}
            placeholder={t('notifications.search_nodes')}
            aria-label={t('notifications.search_nodes')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {shown.length === 0 ? (
          <p className={pages.muted}>{q ? t('notifications.no_nodes_match') : t('notifications.no_nodes_available')}</p>
        ) : (
          <ul className={pages.checkList}>
            {shown.map((n) => {
              const id = idOf(n);
              return (
                <li key={id}>
                  <label className={pages.check}>
                    <input
                      type="checkbox"
                      checked={selected.includes(id)}
                      onChange={(e) => set(e.target.checked ? [...selected, id] : selected.filter((x) => x !== id))}
                    />
                    <span className={pages.checkText}>{nameOf(n)}</span>
                    <span className={pages.checkMeta}>{id}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </>
  );
}

/** Waypoint arrivals: radius (km) and an optional centre, blank for this source's own node. */
function WaypointRows({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  return (
    <>
      <PrefNumber sourceId={sourceId} field="waypointRadiusKm" label={`${t('notifications.waypoint_radius_label', 'Alert within')} (km)`} min={1} max={20037} />
      <CoordRow sourceId={sourceId} field="waypointCenterLat" label={t('notifications.waypoint_center_lat_placeholder', 'latitude')} />
      <CoordRow
        sourceId={sourceId}
        field="waypointCenterLon"
        label={t('notifications.waypoint_center_lon_placeholder', 'longitude')}
        help={t('notifications.waypoint_hint')}
      />
    </>
  );
}

/** A coordinate that may be blank (null); a non-number is never sent. */
function CoordRow({ sourceId, field, label, help }: { sourceId: string; field: 'waypointCenterLat' | 'waypointCenterLon'; label: string; help?: string }) {
  const [value, set, status] = usePrefField(sourceId, field, 'blur');
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null ? '' : String(value));
  const parsed = shown.trim() === '' ? null : Number(shown);
  const bad = parsed !== null && !Number.isFinite(parsed);
  return (
    <SettingRow id={`notifications.${field}`} label={label} help={help}>
      <SavedLine status={status} />
      <CommitOnBlur status={status}>
        <input
          type="text"
          inputMode="decimal"
          className={pages.keyInput}
          aria-invalid={bad || undefined}
          aria-label={label}
          value={shown}
          onChange={(e) => {
            setText(e.target.value);
            const v = e.target.value.trim() === '' ? null : Number(e.target.value);
            if (v === null || Number.isFinite(v)) set(v);
          }}
        />
      </CommitOnBlur>
    </SettingRow>
  );
}

/** Today's keyword cleaning: trimmed, 100 characters, HTML escaped, at most 100 lines. */
const ENTITIES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
const keywords = (text: string) =>
  text
    .split('\n')
    .map((w) => w.trim().slice(0, 100).replace(/[<>&"']/g, (c) => ENTITIES[c]))
    .filter((w) => w.length > 0)
    .slice(0, 100);

function KeywordRow({ sourceId, field, label }: { sourceId: string; field: 'whitelist' | 'blacklist'; label: string }) {
  const [value, set, status] = usePrefField(sourceId, field, 'blur');
  const [text, setText] = useState<string | null>(null);
  return (
    <SettingRow id={`notifications.${field}`} label={label}>
      <SavedLine status={status} />
      <CommitOnBlur status={status}>
        <textarea
          className={styles.textarea}
          rows={3}
          aria-label={label}
          value={text ?? value.join('\n')}
          onChange={(e) => {
            setText(e.target.value);
            set(keywords(e.target.value));
          }}
        />
      </CommitOnBlur>
    </SettingRow>
  );
}

type Format = Pick<Prefs, 'messageTitleTemplate' | 'messageBodyTemplate' | 'messageTextMaxPush' | 'messageTextMaxApprise'>;

/** Today's message format section; saved when focus leaves it (a template the server rejects shows why). */
function FormatRows({ sourceId, prefs }: { sourceId: string; prefs: NotificationPrefs }) {
  const { sourceName } = useSource();
  const queryClient = useQueryClient();
  const current: Format = {
    messageTitleTemplate: prefs.messageTitleTemplate,
    messageBodyTemplate: prefs.messageBodyTemplate,
    messageTextMaxPush: prefs.messageTextMaxPush,
    messageTextMaxApprise: prefs.messageTextMaxApprise,
  };
  const [value, set, status] = useAutosaveValue<Format>(current, {
    commit: 'blur',
    same: (v) => JSON.stringify(v) === JSON.stringify(current),
    errorText: (e) => (e instanceof Error ? e.message : undefined),
    write: async (v) => {
      await apiService.post('/api/push/preferences', { ...v, sourceId });
      queryClient.setQueryData<NotificationPrefs>(notificationPrefsKey(sourceId), (prev) => prev && { ...prev, ...v });
    },
    settled: () => void queryClient.invalidateQueries({ queryKey: notificationPrefsKey(sourceId) }),
  });
  return (
    <div className={pages.embedded}>
      <CommitOnBlur status={status}>
        <NotificationFormatSection
          titleTemplate={value.messageTitleTemplate}
          bodyTemplate={value.messageBodyTemplate}
          sourceName={sourceName}
          prefixWithNodeName={prefs.prefixWithNodeName}
          textMaxPush={value.messageTextMaxPush}
          textMaxApprise={value.messageTextMaxApprise}
          showApprise={prefs.enableApprise}
          onChange={(next) => set({ ...value, ...next })}
          onTextMaxChange={(next) => {
            set({ ...value, ...next });
            status.commit();
          }}
        />
      </CommitOnBlur>
      <SavedLine status={status} />
    </div>
  );
}

/** Test notification (admins, subscribed) and leave every source, as today. The VAPID block moved to Server › Notification services (Task 6.4, s18n6). */
function PushToolsRows({ sourceId, isAdmin }: { sourceId: string; isAdmin: boolean }) {
  const { t } = useTranslation();
  const push = usePushHere(sourceId);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  return (
    <>
      {isAdmin && push.data?.subscribed && (
        <SettingRow id="notifications.test" label={t('notifications.test_title')} help={testResult ?? t('notifications.test_description')}>
          <button
            type="button"
            className={pages.button}
            onClick={async () => {
              try {
                const r = await apiService.post<{ sent: number; failed: number }>('/api/push/test', {});
                setTestResult(t('notifications.test_sent', { sent: r.sent, failed: r.failed }));
              } catch {
                setTestResult(t('notifications.test_failed'));
              }
            }}
          >
            {t('notifications.send_test')}
          </button>
        </SettingRow>
      )}
      {push.data?.browser && (
        <SettingRow id="notifications.unsubscribeAll" label={t('notifications.unsubscribe_all_button')}>
          <button type="button" className={pages.button} onClick={() => setAsking(true)}>
            {t('notifications.unsubscribe_all_button')}
          </button>
        </SettingRow>
      )}
      <ConfirmSheet
        open={asking}
        title={t('notifications.unsubscribe_all_button')}
        body={<p className={pages.para}>{t('notifications.unsubscribe_all_confirm')}</p>}
        confirmLabel={t('notifications.unsubscribe_all_button')}
        danger
        onConfirm={async () => {
          await unsubscribeEverywhere();
          setAsking(false);
          await push.rereadAll();
        }}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
