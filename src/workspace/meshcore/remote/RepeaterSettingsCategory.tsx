/**
 * Settings › Remote: <repeater or room server> › Settings (boards 8-07, 8-25):
 * today's remote settings (MeshCoreRemoteSettingsSection's
 * RepeaterSettingsForm in remote mode) and the access list.
 *
 * - It needs today's admin session and never logs in on its own: logged out,
 *   the page is the login card with today's words.
 * - Each group reads only when its Read is pressed (one request per value);
 *   Save repeater settings sends only the changed fields, one message each,
 *   once. The values read stay with the target across its pages.
 * - The access list (setperm) sits under the form; on the phone it opens from
 *   an Access list row in a sheet (note s8n6).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { RepeaterSettingsForm } from '../../../components/MeshCore/RepeaterSettingsForm';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import type { CategoryProps } from '../../settings/categories';
import AclManager from './AclManager';
import { useMeshCoreTarget } from './remoteTarget';
import RemoteLogin from './RemoteLogin';
import { useTargetHeader } from './useTargetHeader';
import styles from './McRemote.module.css';

export default function RepeaterSettingsCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const target = useMeshCoreTarget();
  useTargetHeader(target);
  const [aclOpen, setAclOpen] = useState(false);
  if (!target) return <StateView kind="noPermission" />;
  const { session, settings: s } = target;
  if (!session.loggedIn) {
    return (
      <div className={styles.page} data-phone={isPhone || undefined}>
        <p className={styles.note} role="note">{t('meshcore.repeater.remote_err_session')}</p>
        <RemoteLogin target={target} />
      </div>
    );
  }
  const off = !!target.blocked;
  const acl = <AclManager target={target} disabled={off} />;
  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {target.blocked && <p className={styles.note} role="note">{target.blocked}</p>}
      <SendsLine>{t('workspace.meshcore.remote.sends_read')}</SendsLine>
      {s.message && <p className={styles.error} role="alert">{s.message}</p>}
      <div className={styles.form}>
        <RepeaterSettingsForm
          mode="remote"
          deviceType={target.isRepeater ? 'repeater' : 'room'}
          values={s.values}
          guestPasswordSet={s.guestPasswordSet}
          firmwareVersion={s.firmware}
          radio={target.radio}
          canWrite={!off}
          disabled={off}
          loadedGroups={s.loadedGroups}
          readingGroup={s.readingGroup}
          onReadGroup={(g) => void s.readGroup(g)}
          pathHops={target.pathHops}
          onSave={s.save}
        />
        <SendsLine>{t('workspace.meshcore.remote.sends_save')}</SendsLine>
      </div>
      {isPhone ? (
        <>
          <button type="button" className={styles.row} onClick={() => setAclOpen(true)}>
            <UiIcon name="encrypted" size={20} />
            <span className={styles.rowLabel}>{t('workspace.meshcore.remote.access_list')}</span>
            <UiIcon name="chevronRight" size={20} />
          </button>
          <Sheet open={aclOpen} onClose={() => setAclOpen(false)} title={t('workspace.meshcore.remote.access_list')} side="bottom">
            <div className={styles.sheet} data-phone="">
              {acl}
            </div>
          </Sheet>
        </>
      ) : (
        acl
      )}
    </div>
  );
}
