/**
 * Maintenance › Backup (boards 12-08 / 12-18 / 12-27, Task 5.7): Reload from
 * radio and the device backups, also drawn on the Maintenance page.
 *
 * - Reload from radio: today's reload (`saves.reload()`, Ruling DE), only on a
 *   click; it asks the local node for its config. What changed shows in
 *   today's table.
 * - Backups: today's requests through useBackupManagement (the schedule saves
 *   from today's SaveBar); the list is read once on open and after a create or
 *   a delete. Restore shows the server's summary in a ConfirmSheet with
 *   today's words; Delete asks with today's question.
 * - Import / Export: today's two dialogs are Channels › Share and import.
 */
import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { BackupRestoreSummary } from '../../../components/configuration/BackupRestoreConfirmDialog';
import { formatBackupSize, formatBackupTimestamp, useBackupManagement } from '../../../components/configuration/useBackupManagement';
import { useAuth } from '../../../contexts/AuthContext';
import { useSource } from '../../../contexts/SourceContext';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import StateView from '../../patterns/StateView';
import SettingGroup from '../kit/SettingGroup';
import SettingNumber from '../kit/SettingNumber';
import SettingRow from '../kit/SettingRow';
import SettingToggle from '../kit/SettingToggle';
import { useReadOnly, useSettingRow } from '../kit/useFieldRegistry';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import type { CategoryProps } from '../categories';
import { ActionRow, MaintenancePage } from './maintenanceShared';
import pages from './SettingsPages.module.css';
import kit from '../kit/kit.module.css';
import styles from './Maintenance.module.css';

export default function BackupCategory({ sourceId, readOnly }: CategoryProps) {
  return (
    <MaintenancePage child={{ sourceId }}>
      <BackupBody sourceId={sourceId} readOnly={readOnly} />
    </MaintenancePage>
  );
}

/** Today's labels end in a colon ("Maximum Backups to Keep:"); a row label does not. */
const label = (text: string) => text.replace(/:\s*$/, '');

export function BackupBody({ sourceId, readOnly }: { sourceId: string; readOnly: boolean }) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const isAdmin = authStatus?.user?.isAdmin === true;
  const b = useBackupManagement({ protocol: 'meshtastic', sourceId });
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [legacyAck, setLegacyAck] = useState(false);
  const { loadBackups } = b;

  // The saved list, once on open (today's page read it on "Show Saved Backups").
  useEffect(() => {
    void loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 read once per source; loadBackups is recreated every render
  }, [sourceId]);

  const pending = b.pendingRestore;
  const closeRestore = () => {
    setLegacyAck(false);
    b.cancelRestore();
  };

  return (
    <>
      <ReloadGroup />

      <NumberInputScope scope={b.numberScope}>
        <SettingGroup title={t('workspace.settings.maintenance.backups_heading_count', { count: b.backupList.length })}>
          <SettingRow
            id="maintenance.backup.enabled"
            label={t('backup_management.enable_auto')}
            help={
              <>
                {t('backup_management.auto_description')}
                {(b.lastAuto.at || b.lastAuto.error) && (
                  <span className={pages.block}>
                    {b.lastAuto.error
                      ? t('backup_management.last_auto_failed', {
                          when: formatBackupTimestamp(b.lastAuto.at ?? ''),
                          reason: t(`backup_management.auto_error_${b.lastAuto.error}`, b.lastAuto.error),
                        })
                      : t('backup_management.last_auto_ok', { when: formatBackupTimestamp(b.lastAuto.at ?? '') })}
                  </span>
                )}
              </>
            }
          >
            <SettingToggle checked={b.autoBackupEnabled} onChange={b.setAutoBackupEnabled} />
          </SettingRow>
          <SettingRow id="maintenance.backup.maxBackups" label={label(t('backup_management.max_backups'))} help={t('backup_management.max_backups_hint')}>
            <SettingNumber value={b.maxBackups} onChange={b.setMaxBackups} min={1} max={365} readOnly={readOnly || !b.autoBackupEnabled} />
          </SettingRow>
          <SettingRow id="maintenance.backup.time" label={label(t('backup_management.backup_time'))} help={t('backup_management.backup_time_hint')}>
            <BackupTime value={b.backupTime} onChange={b.setBackupTime} off={readOnly || !b.autoBackupEnabled} />
          </SettingRow>
          <ActionRow id="maintenance.backup.create" label={t('backup_management.manual_title')} help={t('backup_management.manual_description')}>
            <button
              type="button"
              className={pages.button}
              disabled={readOnly}
              onClick={async () => {
                await b.handleManualBackup();
                void loadBackups();
              }}
            >
              <UiIcon name="download" size={16} /> {t('backup_management.create_button')}
            </button>
          </ActionRow>
          {b.backupList.length === 0 ? (
            <p className={styles.empty}>{b.isLoadingBackups ? t('backup_management.loading') : t('backup_management.no_backups')}</p>
          ) : (
            <ul className={styles.backups} aria-label={t('backup_management.modal_title')}>
              {b.backupList.map((file) => (
                <li key={file.filename} className={styles.backup}>
                  <span className={styles.backupText}>
                    <span>
                      {t('workspace.settings.maintenance.backup_row', {
                        date: formatBackupTimestamp(file.timestamp),
                        type: t(file.type === 'automatic' ? 'backup_management.type_auto' : 'backup_management.type_manual'),
                      })}
                      {file.legacy && isAdmin && ` · ${t('backup_management.legacy_badge')}`}
                    </span>
                    <span className={styles.file}>
                      {t('workspace.settings.maintenance.backup_file', { file: file.filename, size: formatBackupSize(file.size) })}
                    </span>
                  </span>
                  <span className={styles.actions}>
                    <button type="button" className={pages.button} disabled={readOnly} onClick={() => void b.handleDownloadBackup(file.filename)}>
                      {t('backup_management.download')}
                    </button>
                    <button
                      type="button"
                      className={pages.button}
                      disabled={b.restoringFilename !== null || readOnly}
                      onClick={() => void b.handleRestoreBackup(file.filename)}
                    >
                      {b.restoringFilename === file.filename ? t('backup_management.restoring') : t('backup_management.restore')}
                    </button>
                    <button
                      type="button"
                      className={`${pages.button} ${pages.dangerButton}`}
                      disabled={b.restoringFilename !== null || readOnly}
                      onClick={() => setToDelete(file.filename)}
                    >
                      {t('backup_management.delete')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* Restore writes the backup to this node over its connection. */}
          <div className={styles.footnote}>
            <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
          </div>
        </SettingGroup>
      </NumberInputScope>

      <SettingGroup>
        <ActionRow id="maintenance.backup.importExport" label={t('config.import_export_title')} help={t('config.import_export_description')}>
          <Link to={`/source/${encodeURIComponent(sourceId)}/settings/channels/share`} className={pages.button}>
            {t('workspace.settings.maintenance.share_link')}
          </Link>
        </ActionRow>
      </SettingGroup>

      <ConfirmSheet
        open={pending !== null}
        title={t('backup_management.restore_dialog_title')}
        body={
          pending && (
            <>
              <p className={pages.para}>{t('backup_management.confirm_restore_meshtastic', { filename: pending.filename })}</p>
              <BackupRestoreSummary protocol="meshtastic" summary={pending.summary} legacyAck={legacyAck} onLegacyAck={setLegacyAck} />
              <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
            </>
          )
        }
        confirmLabel={t('backup_management.restore')}
        confirmDisabled={!!pending?.summary.legacy && !legacyAck}
        submitOnEnter={false}
        onConfirm={() => {
          setLegacyAck(false);
          void b.confirmRestore();
        }}
        onCancel={closeRestore}
      />
      <ConfirmSheet
        open={toDelete !== null}
        title={t('backup_management.confirm_delete', { filename: toDelete ?? '' })}
        confirmLabel={t('backup_management.delete')}
        danger
        onConfirm={() => {
          const file = toDelete!;
          setToDelete(null);
          void b.deleteBackup(file);
        }}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

/** Today's daily backup time: a time field named by its row. */
function BackupTime({ value, onChange, off }: { value: string; onChange(v: string): void; off: boolean }) {
  const row = useSettingRow();
  const readOnly = useReadOnly(off || undefined);
  return (
    <input
      type="time"
      className={kit.input}
      id={row?.inputId}
      aria-describedby={row?.helpId}
      value={value}
      disabled={readOnly}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}

/** Reload from radio: today's reload and its changes table. */
function ReloadGroup() {
  const { t } = useTranslation();
  const { sourceName } = useSource();
  const config = useSharedDeviceConfig();
  if (!config || config.state.loading) return <StateView kind="loading" />;
  const { state, saves } = config;
  const changes = state.configChanges;
  return (
    <SettingGroup title={t('workspace.settings.maintenance.reload_heading')}>
      <ActionRow
        id="maintenance.backup.reload"
        label={t('workspace.settings.maintenance.reload_title')}
        help={t('workspace.settings.maintenance.reload_help', { device: sourceName })}
        sends={<SendsLine>{t('workspace.settings.maintenance.sends_reload')}</SendsLine>}
      >
        <button type="button" className={pages.button} onClick={() => void saves.reload()} disabled={state.isReloading}>
          <UiIcon name="refresh" size={16} /> {t(state.isReloading ? 'config.reloading' : 'config.reload_config')}
        </button>
      </ActionRow>
      {changes.length > 0 && (
        <div className={styles.changes}>
          <button type="button" className={styles.changesToggle} aria-expanded={state.showChanges} onClick={() => state.setShowChanges(!state.showChanges)}>
            <UiIcon name={state.showChanges ? 'chevronDown' : 'chevronRight'} size={16} />
            {t('config.changes_detected', { count: changes.length })}
          </button>
          {state.showChanges && (
            <div className={pages.tableWrap}>
              <table className={pages.table}>
                <thead>
                  <tr>
                    <th>{t('config.field')}</th>
                    <th>{t('config.old_value')}</th>
                    <th>{t('config.new_value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.field}>
                      <td>{c.field}</td>
                      <td className={styles.old}>{c.oldValue}</td>
                      <td className={styles.new}>{c.newValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </SettingGroup>
  );
}
