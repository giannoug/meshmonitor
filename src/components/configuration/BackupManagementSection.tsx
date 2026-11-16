import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberInput } from '../common/NumberInput';
import { NumberInputScope } from '../common/NumberInputScope';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/BackupManagement.css';
import { ConfigSection } from '../shared/config/ConfigSection';
import BackupRestoreConfirmDialog, { type BackupProtocol } from './BackupRestoreConfirmDialog';
import { formatBackupSize as formatFileSize, formatBackupTimestamp as formatTimestamp, useBackupManagement } from './useBackupManagement';

interface BackupManagementSectionProps {
  onBackupCreated?: () => void;
  /** Which device type this section backs up. Default `meshtastic`. */
  protocol?: BackupProtocol;
  /** The source to act on. Default: the surrounding SourceContext. */
  sourceId?: string | null;
  /** False while the radio is offline: create and restore are disabled (list, download and delete still work). */
  connected?: boolean;
  /** False when the viewer lacks configuration:write: create, download, restore, delete and the schedule are disabled. */
  canWrite?: boolean;
}

const BackupManagementSection: React.FC<BackupManagementSectionProps> = ({
  onBackupCreated,
  protocol = 'meshtastic',
  sourceId,
  connected = true,
  canWrite = true,
}) => {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const isAdmin = authStatus?.user?.isAdmin === true;
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const {
    numberScope, lastAuto, autoBackupEnabled, setAutoBackupEnabled, maxBackups, setMaxBackups, backupTime, setBackupTime,
    backupList, isLoadingBackups, restoringFilename, pendingRestore, cancelRestore,
    handleManualBackup, loadBackups, handleDownloadBackup, handleRestoreBackup, confirmRestore, deleteBackup,
  } = useBackupManagement({ onBackupCreated, protocol, sourceId });

  const handleShowBackups = async () => {
    if (await loadBackups()) setIsBackupModalOpen(true);
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(t('backup_management.confirm_delete', { filename }))) {
      return;
    }
    await deleteBackup(filename);
  };

  return (
    <NumberInputScope scope={numberScope}>
    <ConfigSection title={t('backup_management.title')}>

      <div style={{
        backgroundColor: 'var(--color-surface)',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '1.5rem'
      }}>
        <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{t('backup_management.about_title')}</h4>
        <p style={{ color: 'var(--color-text-subtle)', margin: 0, fontSize: '0.9rem', lineHeight: '1.6' }}>
          {t(protocol === 'meshcore' ? 'backup_management.about_description_meshcore' : 'backup_management.about_description')}
        </p>
      </div>

      {/* Manual Backup */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>{t('backup_management.manual_title')}</h4>
        <p style={{ color: 'var(--color-text-subtle)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {t('backup_management.manual_description')}
        </p>
        <button
          onClick={handleManualBackup}
          disabled={!connected || !canWrite}
          title={!connected ? t('backup_management.offline_hint') : undefined}
          style={{
            opacity: connected && canWrite ? 1 : 0.6,
            backgroundColor: 'var(--color-accent-alt)',
            color: '#fff',
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '4px',
            cursor: connected && canWrite ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: 'bold',
            marginRight: '1rem'
          }}
        >
          {t('backup_management.create_button')}
        </button>
        <button
          onClick={handleShowBackups}
          disabled={isLoadingBackups}
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoadingBackups ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            opacity: isLoadingBackups ? 0.6 : 1
          }}
        >
          {isLoadingBackups ? t('backup_management.loading') : t('backup_management.show_backups')}
        </button>
      </div>

      {/* Automated Backup Settings */}
      <div>
        <h4 style={{ marginBottom: '0.5rem' }}>{t('backup_management.auto_title')}</h4>
        <p style={{ color: 'var(--color-text-subtle)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {t('backup_management.auto_description')}
        </p>

        {(lastAuto.at || lastAuto.error) && (
          <p style={{ color: 'var(--color-text-subtle)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {lastAuto.error
              ? t('backup_management.last_auto_failed', { when: formatTimestamp(lastAuto.at ?? ''), reason: t(`backup_management.auto_error_${lastAuto.error}`, lastAuto.error) })
              : t('backup_management.last_auto_ok', { when: formatTimestamp(lastAuto.at ?? '') })}
          </p>
        )}

        {/* No bottom margin: this is the last block on the Configuration page,
            and a margin here collapses through the section and adds 16px
            below the list (the stack spaces sections itself). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Enable Automatic Backups */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              disabled={!canWrite}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 'bold' }}>{t('backup_management.enable_auto')}</span>
          </label>

          {/* Max Backups to Keep */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              {t('backup_management.max_backups')}
            </label>
            <NumberInput
              min={1}
              max={365}
              integer
              value={maxBackups}
              onChange={setMaxBackups}
              disabled={!autoBackupEnabled || !canWrite}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--color-surface-active)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                width: '100px',
                opacity: autoBackupEnabled ? 1 : 0.5
              }}
            />
            <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
              {t('backup_management.max_backups_hint')}
            </span>
          </div>

          {/* Backup Time */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              {t('backup_management.backup_time')}
            </label>
            <input
              type="time"
              value={backupTime}
              onChange={(e) => setBackupTime(e.target.value)}
              disabled={!autoBackupEnabled || !canWrite}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--color-surface-active)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                width: '150px',
                opacity: autoBackupEnabled ? 1 : 0.5
              }}
            />
            <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-subtle)', fontSize: '0.9rem' }}>
              {t('backup_management.backup_time_hint')}
            </span>
          </div>
        </div>
      </div>

      {/* Backup List Modal */}
      {isBackupModalOpen && (
        <div
          className="backup-modal-overlay"
          onClick={() => setIsBackupModalOpen(false)}
        >
          <div
            className="backup-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{t('backup_management.modal_title')}</h3>

            {backupList.length === 0 ? (
              <p style={{ color: 'var(--color-text-subtle)' }}>
                {t('backup_management.no_backups')}
              </p>
            ) : (
              <div>
                <table className="backup-table">
                  <thead>
                    <tr>
                      <th>{t('backup_management.table_filename')}</th>
                      <th>{t('backup_management.table_date')}</th>
                      <th>{t('backup_management.table_type')}</th>
                      <th>{t('backup_management.table_size')}</th>
                      <th>{t('backup_management.table_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupList.map((backup) => (
                      <tr key={backup.filename}>
                        <td data-label={`${t('backup_management.table_filename')}:`} className="backup-filename">
                          {backup.filename}
                          {backup.legacy && isAdmin && (
                            <span className="backup-type-badge manual" style={{ marginLeft: '0.5rem' }}>
                              {t('backup_management.legacy_badge')}
                            </span>
                          )}
                        </td>
                        <td data-label={`${t('backup_management.table_date')}:`} className="backup-date">
                          {formatTimestamp(backup.timestamp)}
                        </td>
                        <td data-label={`${t('backup_management.table_type')}:`}>
                          <span className={`backup-type-badge ${backup.type === 'automatic' ? 'automatic' : 'manual'}`}>
                            {backup.type === 'automatic' ? t('backup_management.type_auto') : t('backup_management.type_manual')}
                          </span>
                        </td>
                        <td data-label={`${t('backup_management.table_size')}:`} className="backup-size">
                          {formatFileSize(backup.size)}
                        </td>
                        <td>
                          <div className="backup-actions">
                            <button
                              onClick={() => handleDownloadBackup(backup.filename)}
                              disabled={!canWrite}
                              className="backup-btn download"
                            >
                              {t('backup_management.download')}
                            </button>
                            <button
                              onClick={() => handleRestoreBackup(backup.filename)}
                              disabled={restoringFilename !== null || !connected || !canWrite}
                              title={!connected ? t('backup_management.offline_hint') : undefined}
                              className="backup-btn restore"
                              style={restoringFilename !== null || !connected || !canWrite ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                            >
                              {restoringFilename === backup.filename
                                ? t('backup_management.restoring')
                                : t('backup_management.restore')}
                            </button>
                            <button
                              onClick={() => handleDeleteBackup(backup.filename)}
                              disabled={restoringFilename !== null || !canWrite}
                              className="backup-btn delete"
                            >
                              {t('backup_management.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="backup-modal-footer">
              <button
                onClick={() => setIsBackupModalOpen(false)}
                className="backup-close-btn"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingRestore && (
        <BackupRestoreConfirmDialog
          filename={pendingRestore.filename}
          protocol={protocol}
          summary={pendingRestore.summary}
          onConfirm={() => { void confirmRestore(); }}
          onCancel={cancelRestore}
        />
      )}
    </ConfigSection>
    </NumberInputScope>
  );
};

export default BackupManagementSection;
