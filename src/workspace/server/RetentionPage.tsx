/**
 * Server › Backup & maintenance › Retention (board 13-24's Retention row; s13n7): on phone the
 * six retention periods are a page of their own, the rows 13-07 draws, saved as you go.
 */
import { useTranslation } from 'react-i18next';
import SettingGroup from '../settings/kit/SettingGroup';
import { RetentionRows } from './BackupMaintenancePage';
import ServerFrame from './ServerFrame';

export default function RetentionPage() {
  const { t } = useTranslation();
  return (
    <ServerFrame
      categoryId="backup"
      title={t('workspace.server.retention')}
      scope={t('workspace.server.backup_scope')}
      icon="server"
      gate="read"
      needsSettings={false}
      back={{ label: t('workspace.server.nav.backup'), to: '/server/backup' }}
    >
      <SettingGroup title={t('workspace.server.retention_days')}>
        <RetentionRows />
      </SettingGroup>
    </ServerFrame>
  );
}
