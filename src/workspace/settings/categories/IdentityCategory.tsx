/**
 * Identity (boards 12-05 desktop, 12-21 phone): today's Node Identity section
 * on the row kit, with today's labels and limits (long name 39, short name 4).
 * Edits queue in the radio save bar as the `owner` section ("Save (may
 * restart)" on 2.7.x); an edited row shows what the node holds. Below the
 * names: the node's ID, and its role, which is set on Device › Device.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { ROLE_OPTIONS } from '../../../components/configuration/constants';
import { usePoll } from '../../../hooks/usePoll';
import StateView from '../../patterns/StateView';
import SettingGroup from '../kit/SettingGroup';
import SettingRow from '../kit/SettingRow';
import SettingText from '../kit/SettingText';
import SettingToggle from '../kit/SettingToggle';
import { useWas } from './useWas';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import type { CategoryProps } from '../categories';
import styles from './SettingsPages.module.css';

export default function IdentityCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const config = useSharedDeviceConfig();
  const was = useWas('owner');
  // The node's ID, as the device page and today's header read it.
  const nodeId = usePoll().data?.deviceConfig?.basic?.nodeId;
  if (!config || config.state.loading) return <StateView kind="loading" />;
  const s = config.state;
  const role = ROLE_OPTIONS.find((o) => o.value === s.role)?.name ?? String(s.role);

  return (
    <>
      <SettingGroup title={t('workspace.settings.identity.names')}>
        <SettingRow id="identity.longName" label={t('node_identity.long_name')} help={t('node_identity.long_name_description')} was={was('longName')}>
          <SettingText value={s.longName} onChange={s.setLongName} maxLength={39} placeholder={t('node_identity.long_name_placeholder')} />
        </SettingRow>
        <SettingRow id="identity.shortName" label={t('node_identity.short_name')} help={t('node_identity.short_name_description')} was={was('shortName')}>
          <span className={styles.inline}>
            <SettingText value={s.shortName} onChange={s.setShortName} maxLength={4} placeholder={t('node_identity.short_name_placeholder')} />
            <span className={styles.counter}>{t('workspace.settings.identity.characters', { count: s.shortName.length, max: 4 })}</span>
          </span>
        </SettingRow>
        <SettingRow id="identity.unmessagable" label={t('node_identity.unmessageable')} help={t('node_identity.unmessageable_description')} was={was('isUnmessagable')}>
          <SettingToggle checked={s.isUnmessagable} onChange={s.setIsUnmessagable} />
        </SettingRow>
        <SettingRow id="identity.licensed" label={t('node_identity.is_licensed')} help={t('node_identity.is_licensed_description')} was={was('isLicensed')}>
          <SettingToggle checked={s.isLicensed} onChange={s.setIsLicensed} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t('workspace.settings.identity.node')}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>{t('workspace.settings.identity.node_id')}</span>
          <code className={styles.code}>{nodeId ?? '—'}</code>
        </div>
        <Link to={`/source/${encodeURIComponent(sourceId)}/settings/device/device`} className={styles.linkRow}>
          <span className={styles.infoText}>
            <span className={styles.infoLabel}>{t('device_config.device_role')}</span>
            <span className={styles.infoHelp}>{t('workspace.settings.identity.role_where')}</span>
          </span>
          <span className={styles.infoValue}>{role}</span>
          <UiIcon name="chevronRight" size={18} />
        </Link>
      </SettingGroup>
    </>
  );
}
