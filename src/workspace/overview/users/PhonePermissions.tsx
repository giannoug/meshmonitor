/**
 * q4-permissions (ds13): one user's permissions on the phone. Pick a device
 * chip, then None / Read / Write per resource on that device (today's rows for
 * it, View on Map beside the rows that have it); today's install-wide
 * resources open under "Across this MeshMonitor"; today's virtual channel
 * permissions follow. The same model and requests as the desktop matrix.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { PERMISSION_KEYS, GLOBAL_PERMISSION_RESOURCES, isSourceRowShown, type AdminUser, type PermissionSource } from '../../../components/users/userPermissionModel';
import { useShellDevices } from '../../shell/shellDevices';
import StateView from '../../patterns/StateView';
import { hasViewOnMap, levelOf, type PermissionMatrixModel } from './usePermissionMatrix';
import { ChannelDbCard, GlobalRows, LevelSegments, MapToggle, MqttHint } from './PermissionMatrix';
import { resourceLabel, resourceTooltip } from './resourceLabels';
import styles from './PhonePermissions.module.css';

export default function PhonePermissions({ user, sources, model, onBack }: {
  user: AdminUser; sources: PermissionSource[]; model: PermissionMatrixModel; onBack(): void;
}) {
  const { t } = useTranslation();
  const shell = useShellDevices().sources;
  const [deviceId, setDeviceId] = useState(sources[0]?.id ?? null);
  const [acrossOpen, setAcrossOpen] = useState(false);
  const source = sources.find((s) => s.id === deviceId);
  const device = source && model.devices?.[source.id];
  const rules = GLOBAL_PERMISSION_RESOURCES.filter((r) => levelOf(model.globals[r]) !== 'none').length;

  return (
    <div className={styles.page}>
      <header className={styles.phoneHead}>
        <button type="button" className={styles.back} onClick={onBack}>
          <UiIcon name="back" size={20} />
          {t('nav.users')}
        </button>
        <h1 className={styles.phoneTitle}>{user.displayName || user.username}</h1>
        <span />
      </header>
      <div className={styles.chips}>
        {sources.map((s) => (
          <button key={s.id} type="button" className={styles.chip} aria-pressed={s.id === deviceId} aria-label={s.name} onClick={() => setDeviceId(s.id)}>
            {shell.find((d) => d.id === s.id)?.abbrev ?? s.name}
          </button>
        ))}
      </div>
      {model.failed ? (
        <StateView kind="error" title={t('users.failed_load_permissions')} />
      ) : !model.devices ? (
        <StateView kind="loading" />
      ) : (
        <>
          {source && device && (
            <>
              <h2 className={styles.on}>{t('workspace.users.on_device', { name: source.name })}</h2>
              <div className={styles.card}>
                {PERMISSION_KEYS.filter((r) => isSourceRowShown(r, source.type, device.channelIds)).map((r) => (
                  <div key={r} className={styles.row}>
                    <span className={styles.label} title={resourceTooltip(r)}>{resourceLabel(t, r)}</span>
                    <span className={styles.controls}>
                      {hasViewOnMap(r, source) && <MapToggle model={model} source={source} resource={r} className={styles.map} />}
                      <LevelSegments
                        label={resourceLabel(t, r)}
                        resource={r}
                        level={levelOf(device.perms[r])}
                        saving={model.saving}
                        onPick={(l) => void model.setLevel(source.id, r, l)}
                        className={styles.segments}
                      />
                    </span>
                  </div>
                ))}
              </div>
              <MqttHint sources={[source]} />
            </>
          )}
          <button type="button" className={styles.across} aria-expanded={acrossOpen} onClick={() => setAcrossOpen((o) => !o)}>
            <span className={styles.label}>{t('workspace.users.across')}</span>
            <span className={styles.count}>{t('workspace.users.rules', { count: rules })}</span>
            <UiIcon name={acrossOpen ? 'chevronDown' : 'chevronRight'} size={18} />
          </button>
          {acrossOpen && (
            <div className={styles.card}>
              <GlobalRows model={model} scope={deviceId} rowClassName={styles.row} segmentsClassName={styles.segments} />
            </div>
          )}
          <ChannelDbCard model={model} className={styles.card} />
        </>
      )}
    </div>
  );
}
