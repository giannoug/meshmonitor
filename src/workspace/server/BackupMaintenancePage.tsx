/**
 * Server › Backup & maintenance (boards 13-07 desktop, 13-24 phone). Every
 * viewer with settings access sees it (s13n2); each action keeps today's
 * server gate, and the controls follow it:
 *
 * - System backups (today's SystemBackupSection): Create (admins, as the
 *   route), the saved backups read once on open and after a create or a
 *   delete (admins; today's "View Saved Backups" list, drawn inline), each
 *   with today's download and delete (asks with today's words). Automatic
 *   backups: today's toggle, time and count, saved as you go through today's
 *   `POST /api/system/backup/settings` (configuration:write). Restore has no
 *   button: today's RESTORE_FROM_BACKUP note (s13n4).
 * - Database maintenance (today's DatabaseMaintenanceSection): size and last
 *   run, read once on open and after Run now (no poll, Ruling N); Run now as
 *   today (no confirm today); automatic maintenance, its time and the six
 *   retention periods (7–365 days) saved as you go through `POST
 *   /api/settings` (settings:write). The schedulers read these each minute
 *   and keep their last run in the database, so a save never re-arms them.
 * - Danger zone (today's SystemRestartSection, admins only): Restart in
 *   Docker, else Shut down; one `POST /api/system/restart` after today's
 *   confirm, then today's toast and, in Docker, today's reload after 5 s.
 *
 * Mesh impact: none. This is the MeshMonitor server and its database.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { useAuth } from '../../contexts/AuthContext';
import apiService, { ApiError } from '../../services/api';
import { logger } from '../../utils/logger';
import ConfirmSheet from '../patterns/ConfirmSheet';
import DangerZone from '../patterns/DangerZone';
import StateView from '../patterns/StateView';
import SettingGroup from '../settings/kit/SettingGroup';
import SettingNumber from '../settings/kit/SettingNumber';
import SettingRow from '../settings/kit/SettingRow';
import SettingToggle from '../settings/kit/SettingToggle';
import { CommitOnBlur, SavedLine } from '../settings/categories/autosave';
import { useAutosaveValue } from '../settings/useAutosaveSetting';
import { useIsPhone } from '../shell/useIsPhone';
import ServerFrame from './ServerFrame';
import { useServerAccess } from './serverEntries';
import pages from '../settings/categories/SettingsPages.module.css';
import prefs from '../you/preferences/Preferences.module.css';
import styles from './Server.module.css';

interface SystemBackupFile {
  dirname: string;
  timestamp: string;
  type: 'manual' | 'automatic';
  size: number;
  tableCount: number;
  meshmonitorVersion: string;
}

interface BackupSettings {
  enabled: boolean;
  maxBackups: number;
  backupTime: string;
}

interface MaintenanceStats {
  messagesDeleted: number;
  traceroutesDeleted: number;
  routeSegmentsDeleted: number;
  neighborInfoDeleted: number;
  auditLogDeleted?: number;
  meshcoreCliHistoryDeleted?: number;
  sizeBefore: number;
  sizeAfter: number;
  timestamp: string;
}

interface MaintenanceStatus {
  maintenanceInProgress: boolean;
  enabled: boolean;
  maintenanceTime: string;
  lastRunStats: MaintenanceStats | null;
  nextScheduledRun: string | null;
  settings: Record<string, number | undefined>;
}

const BACKUP_SETTINGS = ['workspace', 'systemBackup', 'settings'];
const BACKUP_LIST = ['workspace', 'systemBackup', 'list'];
const MAINT_STATUS = ['workspace', 'maintenance', 'status'];
const MAINT_SIZE = ['workspace', 'maintenance', 'size'];
const ONCE = { staleTime: Infinity, refetchOnWindowFocus: false, retry: false } as const;

/** Today's sizes (SystemBackupSection, DatabaseMaintenanceSection). */
const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`;
};
const when = (timestamp: string) => {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
};
const totalDeleted = (s: MaintenanceStats) =>
  s.messagesDeleted + s.traceroutesDeleted + s.routeSegmentsDeleted + s.neighborInfoDeleted + (s.auditLogDeleted ?? 0) + (s.meshcoreCliHistoryDeleted ?? 0);
const message = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

export default function BackupMaintenancePage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  return (
    <ServerFrame categoryId="backup" title={t('workspace.server.nav.backup')} scope={t('workspace.server.backup_scope')} icon="server" gate="read" needsSettings={false}>
      <div className={prefs.columns} data-phone={isPhone || undefined}>
        <div className={prefs.column}>
          <BackupGroups />
        </div>
        <div className={prefs.column}>
          <MaintenanceGroups />
          <RestartZone />
        </div>
      </div>
    </ServerFrame>
  );
}

function BackupGroups() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useServerAccess();
  const { hasPermission } = useAuth();
  const canSchedule = isAdmin || hasPermission('configuration', 'write', { anySource: true });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The list route is admins only: nobody else asks for it.
  const list = useQuery({ queryKey: BACKUP_LIST, queryFn: () => apiService.get<SystemBackupFile[]>('/api/system/backup/list'), enabled: isAdmin, ...ONCE });
  const settings = useQuery({ queryKey: BACKUP_SETTINGS, queryFn: () => apiService.get<Partial<BackupSettings>>('/api/system/backup/settings'), ...ONCE });
  // Today's defaults for a missing answer.
  const stored: BackupSettings = {
    enabled: settings.data?.enabled || false,
    maxBackups: settings.data?.maxBackups || 7,
    backupTime: settings.data?.backupTime || '03:00',
  };
  // Today's write: the whole schedule in one request.
  const writeSchedule = async (next: BackupSettings) => {
    await apiService.post('/api/system/backup/settings', next);
    queryClient.setQueryData(BACKUP_SETTINGS, next);
  };
  const [enabled, setEnabled, enabledStatus] = useAutosaveValue<boolean>(stored.enabled, {
    commit: 'change',
    same: (v) => v === stored.enabled,
    write: (v) => writeSchedule({ ...stored, enabled: v }),
    settled: () => void queryClient.invalidateQueries({ queryKey: BACKUP_SETTINGS }),
    errorText: (e) => t('system_backup.toast_settings_failed', { error: message(e) }),
  });
  const [time, setTime, timeStatus] = useAutosaveValue<string>(stored.backupTime, {
    commit: 'change',
    same: (v) => v === stored.backupTime,
    write: (v) => writeSchedule({ ...stored, backupTime: v }),
    settled: () => void queryClient.invalidateQueries({ queryKey: BACKUP_SETTINGS }),
    errorText: (e) => t('system_backup.toast_settings_failed', { error: message(e) }),
  });
  const [keep, setKeep, keepStatus] = useAutosaveValue<number>(stored.maxBackups, {
    commit: 'blur',
    same: (v) => v === stored.maxBackups,
    write: (v) => writeSchedule({ ...stored, maxBackups: v }),
    settled: () => void queryClient.invalidateQueries({ queryKey: BACKUP_SETTINGS }),
    errorText: (e) => t('system_backup.toast_settings_failed', { error: message(e) }),
  });

  const create = async () => {
    setCreating(true);
    showToast(t('system_backup.toast_creating'), 'info');
    try {
      const result = await apiService.post<{ dirname: string }>('/api/system/backup');
      showToast(t('system_backup.toast_backup_created', { dirname: result.dirname }), 'success');
      void list.refetch();
    } catch (error) {
      logger.error('Error creating system backup:', error);
      // Today's preference: the route's `details`, else the message.
      const body = error instanceof ApiError ? (error.body as { details?: unknown } | undefined) : undefined;
      showToast(t('system_backup.toast_backup_failed', { error: typeof body?.details === 'string' ? body.details : message(error) }), 'error');
    } finally {
      setCreating(false);
    }
  };

  const download = async (dirname: string) => {
    try {
      showToast(t('system_backup.toast_downloading'), 'info');
      await apiService.download(`/api/system/backup/download/${encodeURIComponent(dirname)}`, { filename: `${dirname}.tar.gz` });
      showToast(t('system_backup.toast_downloaded'), 'success');
    } catch (error) {
      logger.error('Error downloading system backup:', error);
      showToast(t('system_backup.toast_download_failed', { error: message(error) }), 'error');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiService.delete(`/api/system/backup/delete/${encodeURIComponent(deleting)}`);
      showToast(t('system_backup.toast_deleted'), 'success');
      setDeleting(null);
      void list.refetch();
    } catch (error) {
      logger.error('Error deleting system backup:', error);
      showToast(t('system_backup.toast_delete_failed', { error: message(error) }), 'error');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const backups = list.data ?? [];
  return (
    <>
      <SettingGroup title={t('workspace.server.system_backups')}>
        <ActionLine
          label={t('system_backup.manual_title')}
          help={isAdmin ? t('system_backup.manual_description') : t('workspace.server.backup_admin_only')}
        >
          <button type="button" className={`${pages.button} ${pages.primary}`} disabled={!isAdmin || creating} onClick={() => void create()}>
            <UiIcon name="download" size={16} />
            {creating ? t('system_backup.creating') : t('system_backup.create_button')}
          </button>
        </ActionLine>
        {isAdmin &&
          (list.isError ? (
            <p className={styles.cardPara}>{t('system_backup.toast_list_failed', { error: message(list.error) })}</p>
          ) : list.data && backups.length === 0 ? (
            <p className={styles.cardPara}>{t('system_backup.no_backups')}</p>
          ) : (
            backups.map((b) => (
              <div key={b.dirname} className={pages.infoRow} data-testid="system-backup">
                <div className={pages.infoText}>
                  <span className={pages.infoLabel}>{when(b.timestamp)}</span>
                  <span className={pages.infoHelp}>
                    {[b.type === 'automatic' ? t('backup_management.type_auto') : t('backup_management.type_manual'), fileSize(b.size), `v${b.meshmonitorVersion}`, `${t('system_backup.table_tables')} ${b.tableCount}`].join(' · ')}
                  </span>
                  <code className={styles.code}>{b.dirname}</code>
                </div>
                <button type="button" className={pages.iconButton} aria-label={`${t('backup_management.download')} ${b.dirname}`} title={t('backup_management.download')} onClick={() => void download(b.dirname)}>
                  <UiIcon name="download" size={18} />
                </button>
                <button type="button" className={pages.iconButton} aria-label={`${t('backup_management.delete')} ${b.dirname}`} title={t('backup_management.delete')} onClick={() => setDeleting(b.dirname)}>
                  <UiIcon name="delete" size={18} />
                </button>
              </div>
            ))
          ))}
        <SettingRow id="backup.autoBackupEnabled" label={t('system_backup.enable_auto')} help={t('system_backup.auto_description')}>
          <SavedLine status={enabledStatus} />
          <SettingToggle checked={enabled} onChange={setEnabled} readOnly={!canSchedule || !settings.data} />
        </SettingRow>
        {enabled && (
          <>
            <SettingRow id="backup.backupTime" label={t('system_backup.backup_time')}>
              <SavedLine status={timeStatus} />
              <input type="time" className={pages.keyInput} aria-label={t('system_backup.backup_time')} value={time} disabled={!canSchedule} onChange={(e) => e.target.value && setTime(e.target.value)} />
            </SettingRow>
            <SettingRow id="backup.maxBackups" label={t('system_backup.max_backups')} help={t('system_backup.max_backups_hint')}>
              <SavedLine status={keepStatus} />
              <CommitOnBlur status={keepStatus}>
                <SettingNumber value={keep} onChange={setKeep} min={1} max={365} readOnly={!canSchedule} />
              </CommitOnBlur>
            </SettingRow>
          </>
        )}
      </SettingGroup>
      <p className={styles.restore}>
        <UiIcon name="info" size={16} />
        <span>
          <strong>{t('system_backup.restore_warning_title')}</strong> {t('system_backup.restore_warning_description')}
        </span>
      </p>
      <ConfirmSheet
        open={deleting !== null}
        title={t('backup_management.delete')}
        body={<p className={pages.para}>{t('system_backup.confirm_delete', { dirname: deleting ?? '' })}</p>}
        confirmLabel={t('backup_management.delete')}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function MaintenanceGroups() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { canWrite } = useServerAccess();
  const [running, setRunning] = useState(false);
  // Today's reads swallow an HTTP refusal; the rows stay empty.
  const status = useQuery({ queryKey: MAINT_STATUS, queryFn: () => apiService.get<MaintenanceStatus>('/api/maintenance/status'), ...ONCE });
  const size = useQuery({ queryKey: MAINT_SIZE, queryFn: () => apiService.get<{ size: number }>('/api/maintenance/size'), ...ONCE });
  const s = status.data;

  const run = async () => {
    setRunning(true);
    showToast(t('maintenance.toast_running'), 'info');
    try {
      const result = await apiService.post<{ stats: MaintenanceStats }>('/api/maintenance/run');
      showToast(t('maintenance.toast_complete', { count: totalDeleted(result.stats), saved: formatBytes(result.stats.sizeBefore - result.stats.sizeAfter) }), 'success');
      void status.refetch();
      void size.refetch();
    } catch (error) {
      logger.error('Error running maintenance:', error);
      showToast(t('maintenance.toast_failed', { error: message(error) }), 'error');
    } finally {
      setRunning(false);
    }
  };

  const busy = running || s?.maintenanceInProgress;
  const lastRun = s?.lastRunStats;
  return (
    <SettingGroup title={t('maintenance.title')}>
      <ActionLine
        label={t('maintenance.database_size')}
        value={size.data ? formatBytes(size.data.size) : '...'}
        help={lastRun ? `${t('maintenance.last_run')}: ${when(lastRun.timestamp)} (${t('maintenance.deleted_records', { count: totalDeleted(lastRun) })})` : undefined}
      >
        <button type="button" className={pages.button} disabled={busy} onClick={() => void run()}>
          <UiIcon name="play" size={16} />
          {busy ? t('maintenance.running') : t('maintenance.run_now')}
        </button>
      </ActionLine>
      {s && (
        <MaintenanceRows
          status={s}
          readOnly={!canWrite}
          settled={() => void queryClient.invalidateQueries({ queryKey: MAINT_STATUS })}
          onWritten={(patch) => queryClient.setQueryData<MaintenanceStatus>(MAINT_STATUS, (prev) => (prev ? { ...prev, ...patch(prev) } : prev))}
        />
      )}
    </SettingGroup>
  );
}

/** Today's retention fields, in today's order, with today's fallbacks (#5870, #5892). */
const RETENTION: Array<{ key: string; status: string; labelKey: string; fallback?: string; def: number }> = [
  { key: 'messageRetentionDays', status: 'messageRetentionDays', labelKey: 'maintenance.message_retention', def: 30 },
  { key: 'tracerouteRetentionDays', status: 'tracerouteRetentionDays', labelKey: 'maintenance.traceroute_retention', def: 30 },
  { key: 'routeSegmentRetentionDays', status: 'routeSegmentRetentionDays', labelKey: 'maintenance.routesegment_retention', def: 30 },
  { key: 'neighborInfoRetentionDays', status: 'neighborInfoRetentionDays', labelKey: 'maintenance.neighborinfo_retention', def: 30 },
  { key: 'auditLogRetentionDays', status: 'auditLogRetentionDays', labelKey: 'maintenance.auditlog_retention', fallback: 'Audit Log Retention', def: 90 },
  { key: 'meshcoreCliHistoryRetentionDays', status: 'meshcoreCliHistoryRetentionDays', labelKey: 'maintenance.meshcore_cli_history_retention', fallback: 'MeshCore CLI History Retention', def: 90 },
];

interface RowsProps {
  status: MaintenanceStatus;
  readOnly: boolean;
  settled(): void;
  onWritten(patch: (prev: MaintenanceStatus) => Partial<MaintenanceStatus>): void;
}

/** One maintenance key, saved as you go: today's `POST /api/settings` with that key. */
function useMaintenanceKey<T>(key: string, current: T, commit: 'change' | 'blur', serialize: (v: T) => string, apply: (prev: MaintenanceStatus, v: T) => Partial<MaintenanceStatus>, props: RowsProps) {
  const { t } = useTranslation();
  return useAutosaveValue<T>(current, {
    commit,
    same: (v) => v === current,
    write: async (v) => {
      await apiService.post('/api/settings', { [key]: serialize(v) });
      props.onWritten((prev) => apply(prev, v));
    },
    settled: props.settled,
    errorText: (e) => t('maintenance.toast_settings_failed', { error: message(e) }),
  });
}

function MaintenanceRows(props: RowsProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { status: s, readOnly } = props;
  const [enabled, setEnabled, enabledStatus] = useMaintenanceKey('maintenanceEnabled', s.enabled, 'change', (v) => (v ? 'true' : 'false'), (_p, v) => ({ enabled: v }), props);
  const [time, setTime, timeStatus] = useMaintenanceKey('maintenanceTime', s.maintenanceTime, 'change', String, (_p, v) => ({ maintenanceTime: v }), props);
  return (
    <>
      <SettingRow id="backup.maintenanceEnabled" label={t('maintenance.enable_auto')} help={t('maintenance.auto_description')}>
        <SavedLine status={enabledStatus} />
        <SettingToggle checked={enabled} onChange={setEnabled} readOnly={readOnly} />
      </SettingRow>
      {enabled && (
        <>
          <SettingRow
            id="backup.maintenanceTime"
            label={t('maintenance.maintenance_time')}
            help={`${t('maintenance.next_run')}: ${s.nextScheduledRun ? new Date(s.nextScheduledRun).toLocaleString() : t('maintenance.not_scheduled')}`}
          >
            <SavedLine status={timeStatus} />
            <input type="time" className={pages.keyInput} aria-label={t('maintenance.maintenance_time')} value={time} disabled={readOnly} onChange={(e) => e.target.value && setTime(e.target.value)} />
          </SettingRow>
          {isPhone ? (
            // s13n7: on phone, Retention is a page of its own.
            <Link to="/server/backup/retention" className={pages.linkRow}>
              <span className={pages.infoText}>
                <span className={pages.infoLabel}>{t('workspace.server.retention')}</span>
              </span>
              <span className={pages.infoHelp}>
                {t('workspace.server.retention_value', { days: s.settings.messageRetentionDays ?? 30, count: RETENTION.length })}
              </span>
              <UiIcon name="chevronRight" size={18} />
            </Link>
          ) : (
            <>
              <h3 className={styles.subTitle}>{t('workspace.server.retention_days')}</h3>
              <RetentionFields {...props} />
            </>
          )}
        </>
      )}
    </>
  );
}

function RetentionFields(props: RowsProps) {
  const { t } = useTranslation();
  return (
    <>
      {RETENTION.map((r) => (
        <RetentionRow key={r.key} field={r} {...props} />
      ))}
      <p className={styles.cardPara}>{t('maintenance.retention_hint')}</p>
    </>
  );
}

/**
 * The six retention rows on their own page (phone, s13n7: `/server/backup/retention`), read from
 * the same maintenance status as the page above it (one read, shared).
 */
export function RetentionRows() {
  const queryClient = useQueryClient();
  const { canWrite } = useServerAccess();
  const status = useQuery({ queryKey: MAINT_STATUS, queryFn: () => apiService.get<MaintenanceStatus>('/api/maintenance/status'), ...ONCE });
  if (status.isError) return <StateView kind="error" onRetry={() => void status.refetch()} />;
  if (!status.data) return <StateView kind="loading" />;
  return (
    <RetentionFields
      status={status.data}
      readOnly={!canWrite}
      settled={() => void queryClient.invalidateQueries({ queryKey: MAINT_STATUS })}
      onWritten={(patch) => queryClient.setQueryData<MaintenanceStatus>(MAINT_STATUS, (prev) => (prev ? { ...prev, ...patch(prev) } : prev))}
    />
  );
}

function RetentionRow({ field, ...props }: RowsProps & { field: (typeof RETENTION)[number] }) {
  const { t } = useTranslation();
  const current = props.status.settings[field.status] ?? field.def;
  const [value, set, status] = useMaintenanceKey<number>(field.key, current, 'blur', String, (prev, v) => ({ settings: { ...prev.settings, [field.status]: v } }), props);
  const label = t(field.labelKey, field.fallback ?? field.labelKey);
  return (
    <SettingRow id={`backup.${field.key}`} label={label}>
      <SavedLine status={status} />
      <CommitOnBlur status={status}>
        <SettingNumber value={value} onChange={set} min={7} max={365} readOnly={props.readOnly} />
      </CommitOnBlur>
      <span className={styles.unit}>{t('common.days')}</span>
    </SettingRow>
  );
}

function RestartZone() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isAdmin } = useServerAccess();
  const [asking, setAsking] = useState(false);
  const [restarting, setRestarting] = useState(false);
  // Today's read, admins only (SystemRestartSection is drawn for admins).
  const system = useQuery({ queryKey: ['workspace', 'systemStatus', 'isDocker'], queryFn: () => apiService.get<{ isDocker?: boolean }>('/api/system/status'), enabled: isAdmin, ...ONCE });

  if (!isAdmin) {
    return (
      <DangerZone title={t('workspace.server.danger_zone')}>
        <p className={styles.cardPara}>{t('settings.restart_admin_only')}</p>
      </DangerZone>
    );
  }
  if (!system.data) return null;
  const docker = !!system.data.isDocker;
  const action = docker ? t('settings.restart_action') : t('settings.shutdown_action');

  const restart = async () => {
    setRestarting(true);
    try {
      const result = await apiService.restartContainer();
      showToast(result.message, 'success');
      setAsking(false);
      // Today's: the container comes back by itself, so the page reloads once.
      if (docker) setTimeout(() => window.location.reload(), 5000);
    } catch (error) {
      logger.error(`Error ${action}ing:`, error);
      showToast(t('settings.restart_failed', { action }), 'error');
      setRestarting(false);
      setAsking(false);
    }
  };

  return (
    <DangerZone title={t('workspace.server.danger_zone')}>
      <ActionLine
        label={docker ? t('settings.restart_container_title') : t('settings.shutdown_title')}
        help={docker ? t('settings.restart_container_description') : t('settings.shutdown_description')}
      >
        <button type="button" className={`${pages.button} ${pages.dangerButton}`} disabled={restarting} onClick={() => setAsking(true)}>
          <UiIcon name={docker ? 'refresh' : 'power'} size={16} />
          {restarting ? (docker ? t('settings.restarting') : t('settings.shutting_down')) : docker ? t('settings.restart_button') : t('settings.shutdown_button')}
        </button>
      </ActionLine>
      <ConfirmSheet
        open={asking}
        title={t('settings.confirm_restart_title', { action })}
        body={<p className={pages.para}>{docker ? t('settings.confirm_restart_docker') : t('settings.confirm_restart_manual')}</p>}
        confirmLabel={docker ? t('settings.restart_button') : t('settings.shutdown_button')}
        danger
        busy={restarting}
        submitOnEnter={false}
        onConfirm={restart}
        onCancel={() => setAsking(false)}
      />
    </DangerZone>
  );
}

/** A row whose control is a button: its label, value and help, then the button. */
function ActionLine({ label, value, help, children }: { label: string; value?: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className={pages.infoRow}>
      <div className={pages.infoText}>
        <span className={pages.infoLabel}>{label}</span>
        {value && <span className={styles.bigValue}>{value}</span>}
        {help && <span className={pages.infoHelp}>{help}</span>}
      </div>
      {children}
    </div>
  );
}
