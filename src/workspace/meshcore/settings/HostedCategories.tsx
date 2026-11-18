/**
 * The MeshCore pages the boards do not draw (note s8n4), each holding today's
 * section(s) as they are, so every control, gate, request and save stays
 * today's (Rule X; Ruling 7.4): Path hash & scope, Sender names, Contacts (the
 * device actions), Observer, a local repeater's Adverts & forwarding and
 * Clock, and in MeshMonitor Reactions, Required repeaters, Display, Filters
 * and Notifications. Sections that save through today's SaveBar get the
 * frame's SaveBarProvider (MeshCoreSettingsFrame).
 *
 * Purge all messages (Display) asks in a ConfirmSheet with today's words
 * instead of today's browser confirm; it is one request to MeshMonitor's
 * database and sends nothing on the mesh.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import AudioNotificationSettings from '../../../components/AudioNotificationSettings';
import TelemetryDataActions from '../../../components/settings/TelemetryDataActions';
import { MeshCoreContactSyncSection } from '../../../components/MeshCore/MeshCoreContactSyncSection';
import { MeshCoreDefaultScopeSection } from '../../../components/MeshCore/MeshCoreDefaultScopeSection';
import { MeshCoreDeviceActionsSection } from '../../../components/MeshCore/MeshCoreDeviceActionsSection';
import { MeshCoreIgnoredNodesSection } from '../../../components/MeshCore/MeshCoreIgnoredNodesSection';
import { MeshCoreMessageFiltersSection } from '../../../components/MeshCore/MeshCoreMessageFiltersSection';
import { MeshCoreNodeDisplaySection } from '../../../components/MeshCore/MeshCoreNodeDisplaySection';
import { MeshCoreObserverSection } from '../../../components/MeshCore/MeshCoreObserverSection';
import { MeshCorePathHashSection } from '../../../components/MeshCore/MeshCorePathHashSection';
import { MeshCoreReactionsSection } from '../../../components/MeshCore/MeshCoreReactionsSection';
import { MeshCoreRequiredRepeaterSection } from '../../../components/MeshCore/MeshCoreRequiredRepeaterSection';
import { MeshCoreSenderNamesSection } from '../../../components/MeshCore/MeshCoreSenderNamesSection';
import { MeshCoreTelemetrySettingsSection } from '../../../components/MeshCore/MeshCoreTelemetrySettingsSection';
import { RepeaterSettingsForm } from '../../../components/MeshCore/RepeaterSettingsForm';
import type { RepeaterSettingsSnapshot } from '../../../components/MeshCore/hooks/useMeshCore';
import { useAuth } from '../../../contexts/AuthContext';
import { useOptionalMuteSettings } from '../../../contexts/SettingsContext';
import { appBasename } from '../../../init';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import DangerZone from '../../patterns/DangerZone';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import { DeviceNotes, McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

/** Today's section(s), in the Workspace page. */
function Hosted({ children, notes }: { children: ReactNode; notes?: boolean }) {
  return (
    <McPage>
      {notes && <DeviceNotes />}
      <div className={styles.hosted}>{children}</div>
    </McPage>
  );
}

export function PathScopeCategory(_props: CategoryProps) {
  const d = useMcDevice();
  return (
    <Hosted notes>
      <MeshCorePathHashSection connected={d.connected} loading={d.loading} actions={d.actions} canWriteConfig={d.canWriteConfig} />
      <MeshCoreDefaultScopeSection
        connected={d.connected}
        loading={d.loading}
        actions={d.actions}
        receiveOnly={d.receiveOnly}
        canWriteConfig={d.canWriteConfig}
        canWriteNodes={d.canWriteNodes}
      />
    </Hosted>
  );
}

export function SenderNamesCategory(_props: CategoryProps) {
  const d = useMcDevice();
  return (
    <Hosted notes>
      <MeshCoreSenderNamesSection connected={d.connected} loading={d.loading} actions={d.actions} canWriteConfig={d.canWriteConfig} />
    </Hosted>
  );
}

/** Today's device actions (refresh contacts, adverts, discover); the radio contact list too for a viewer without configuration:read, as today's Settings tab. */
export function ContactsCategory({ sourceId }: CategoryProps) {
  const d = useMcDevice();
  return (
    <Hosted>
      {!d.canReadConfig && d.isCompanion && (
        <MeshCoreContactSyncSection baseUrl={appBasename} sourceId={sourceId} connected={d.connected} canEditConfig={d.canWriteConfig} canEditNodes={d.canWriteNodes} />
      )}
      <MeshCoreDeviceActionsSection
        connected={d.connected}
        loading={d.loading}
        isCompanion={d.isCompanion}
        actions={d.actions}
        receiveOnly={d.receiveOnly}
        canWriteNodes={d.canWriteNodes}
        canWriteConnection={d.canWriteConnection}
      />
    </Hosted>
  );
}

export function ObserverCategory({ sourceId }: CategoryProps) {
  const d = useMcDevice();
  return (
    <Hosted>
      <MeshCoreObserverSection sourceId={sourceId} connected={d.connected} deviceType={d.local?.advType} />
    </Hosted>
  );
}

/** A local repeater's settings, read over its serial CLI on open as today (#6255 P9); today's one form holds Adverts & forwarding and Access. */
export function RepeaterAdvertsCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const [snapshot, setSnapshot] = useState<RepeaterSettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminPasswordChanged, setAdminPasswordChanged] = useState(false);
  const actionsRef = useRef(d.actions);
  actionsRef.current = d.actions;
  const active = d.connected && d.isRepeater && d.canReadConfig;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot((await actionsRef.current.getRepeaterSettings?.()) ?? null);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (active) void load();
  }, [active, load]);
  return (
    <Hosted notes>
      {snapshot ? (
        <RepeaterSettingsForm
          values={snapshot.values}
          guestPasswordSet={snapshot.guestPasswordSet}
          firmwareVersion={snapshot.firmware?.version ?? d.local?.ver}
          radio={{ sf: d.local?.radioSf, bw: d.local?.radioBw, cr: d.local?.radioCr }}
          canWrite={d.canWriteConfig}
          onSave={d.actions.saveRepeaterSettings}
          onSaved={(patch, response) => {
            if (patch.adminPassword !== undefined && response.results.adminPassword?.ok) setAdminPasswordChanged(true);
            void load();
          }}
        />
      ) : (
        active && (
          <p className={styles.note} role="status">
            {loading ? t('meshcore.repeater.loading', 'Reading repeater settings…') : t('meshcore.repeater.load_failed', 'Could not read the repeater settings.')}{' '}
            {!loading && (
              <button type="button" className={styles.button} onClick={() => void load()}>
                {t('meshcore.repeater.retry', 'Retry')}
              </button>
            )}
          </p>
        )
      )}
      {adminPasswordChanged && (
        <p className={styles.warn} role="status">
          {t('meshcore.repeater.stale_credentials', 'The admin password changed. Saved remote-admin credentials for this repeater are now stale: update them in the remote admin login.')}
        </p>
      )}
    </Hosted>
  );
}

/** Today's repeater Clock: Sync clock sets it to this server's time over the serial link. */
export function RepeaterClockCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<'ok' | 'failed' | null>(null);
  const sync = async () => {
    setSyncing(true);
    setResult(null);
    const ok = await d.actions.syncDeviceTime();
    setSyncing(false);
    setResult(ok ? 'ok' : 'failed');
  };
  return (
    <McPage>
      <DeviceNotes />
      <div className={styles.card}>
        <span className={styles.muted}>
          {t('meshcore.repeater.clock_hint', "Sets the repeater clock to this server's time. A repeater clock only moves forward, so a clock that runs ahead cannot be set back.")}
        </span>
        <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
        <span className={styles.inline}>
          <button type="button" className={styles.button} disabled={!d.connected || syncing || !d.canWriteConfig} onClick={() => void sync()}>
            {syncing ? t('meshcore.repeater.clock_syncing', 'Syncing…') : t('meshcore.repeater.sync_clock')}
          </button>
          {result === 'ok' && (
            <span className={styles.ok} role="status">
              <UiIcon name="check" size={14} /> {t('meshcore.repeater.clock_synced', 'Clock synced')}
            </span>
          )}
          {result === 'failed' && <span className={styles.error} role="alert">{t('meshcore.repeater.clock_failed', 'Clock not synced')}</span>}
        </span>
      </div>
    </McPage>
  );
}

export function ReactionsCategory({ sourceId }: CategoryProps) {
  const d = useMcDevice();
  return (
    <Hosted>
      <MeshCoreReactionsSection baseUrl={appBasename} sourceId={sourceId} onOutboundChanged={() => void d.actions.refreshStatus()} />
    </Hosted>
  );
}

export function RequiredRepeatersCategory({ sourceId }: CategoryProps) {
  const d = useMcDevice();
  return (
    <Hosted>
      <MeshCoreRequiredRepeaterSection baseUrl={appBasename} sourceId={sourceId} contacts={d.meshCore.contacts} />
    </Hosted>
  );
}

/** Node display, telemetry windows and data (admins), and Purge all messages in its danger zone (s8n4). */
export function DisplayCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const canPurge = hasPermission('messages', 'write', { sourceId });
  const [confirm, setConfirm] = useState(false);
  const [purging, setPurging] = useState(false);
  const purge = async () => {
    setPurging(true);
    try {
      const ok = await d.actions.purgeAllMessages();
      showToast(
        ok
          ? t('meshcore.settings.purge_all_messages_done', 'All MeshCore messages purged')
          : t('meshcore.settings.purge_all_messages_failed', 'Failed to purge messages'),
        ok ? 'success' : 'error',
      );
    } finally {
      setPurging(false);
      setConfirm(false);
    }
  };
  return (
    <Hosted>
      <MeshCoreNodeDisplaySection baseUrl={appBasename} sourceId={sourceId} />
      <MeshCoreTelemetrySettingsSection baseUrl={appBasename} sourceId={sourceId} />
      {d.isAdmin && (
        <div className="form-section danger-zone">
          <h3>{t('meshcore.settings.telemetry_data', 'Telemetry data')}</h3>
          <TelemetryDataActions sourceId={sourceId} sources={[{ id: sourceId, name: d.deviceName }]} />
        </div>
      )}
      {canPurge && (
        <DangerZone
          title={
            <span className={styles.inline}>
              <UiIcon name="alert" size={16} /> {t('config.danger_zone')}
            </span>
          }
        >
          <div className={styles.dangerRow}>
            <span className={styles.dangerText}>
              <span className={styles.rowLabel}>{t('meshcore.settings.message_data', 'Message data')}</span>
              <span className={styles.muted}>
                {t('meshcore.settings.purge_all_messages_desc', 'Permanently delete every stored MeshCore message (all channels and direct messages) for this source.')}
              </span>
              <SendsLine>{t('workspace.meshcore.settings.sends_purge')}</SendsLine>
            </span>
            <button type="button" className={styles.danger} disabled={purging} onClick={() => setConfirm(true)}>
              {purging ? t('meshcore.settings.purging', 'Purging…') : t('meshcore.settings.purge_all_messages', 'Purge all messages')}
            </button>
          </div>
        </DangerZone>
      )}
      <ConfirmSheet
        open={confirm}
        title={t('meshcore.settings.purge_all_messages', 'Purge all messages')}
        body={
          <p className={styles.para}>
            {t('meshcore.settings.confirm_purge_all_messages', 'Delete ALL MeshCore messages (every channel and DM) for this source? This cannot be undone.')}
          </p>
        }
        confirmLabel={t('meshcore.settings.purge_all_messages', 'Purge all messages')}
        danger
        busy={purging}
        submitOnEnter={false}
        onConfirm={() => purge()}
        onCancel={() => setConfirm(false)}
      />
    </Hosted>
  );
}

export function FiltersCategory({ sourceId }: CategoryProps) {
  return (
    <Hosted>
      <MeshCoreIgnoredNodesSection sourceId={sourceId} />
      <MeshCoreMessageFiltersSection sourceId={sourceId} />
    </Hosted>
  );
}

/** Today's Audio notifications (the viewer's own setting). */
export function NotificationsCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const audio = useOptionalMuteSettings();
  return (
    <Hosted>
      {audio ? (
        <div className="form-section">
          <h3>{t('meshcore.settings.audio_notifications', 'Audio notifications')}</h3>
          <AudioNotificationSettings enabled={audio.enableAudioNotifications} onEnabledChange={audio.setEnableAudioNotifications} meshcoreDeviceType={d.status?.deviceType} />
        </div>
      ) : null}
    </Hosted>
  );
}
