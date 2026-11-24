/**
 * Settings › RNode radio (boards 9-07, 9-15; notes s9n1, s9n4), own mode
 * only, on the row kit with "was …" badges and the page's dock, from today's
 * ReticulumConfigurationView (`useReticulumRadioConfig`): frequency,
 * bandwidth, spreading factor (5–12), coding rate (5–8), TX power (0–22 dBm),
 * the short and long airtime locks (0–100 %) and Radio on, with today's
 * ranges; Device info beside it.
 *
 * Apply is today's one PUT with every field the radio reported, then a read
 * again. It changes the radio over its serial link at once and sends nothing
 * on the network; peers left on the old settings stop hearing it. A value
 * out of range holds Apply (#5649). A field the radio did not report shows
 * "—". Without today's `configuration:write` every input is off.
 */
import { useTranslation } from 'react-i18next';
import { useIsPhone } from '../../shell/useIsPhone';
import { useAuth } from '../../../contexts/AuthContext';
import { UiIcon } from '../../../components/icons';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { useNumberInputScope } from '../../../components/common/numberInputScopeContext';
import { useReticulumRadioConfig, type RadioConfig } from '../../../components/Reticulum/hooks/useReticulumRadioConfig';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingNumber from '../../settings/kit/SettingNumber';
import SettingRow from '../../settings/kit/SettingRow';
import SettingToggle from '../../settings/kit/SettingToggle';
import { useSettingsHeader } from '../../settings/settingsDock';
import { McDock, McPage } from '../../meshcore/settings/mcShared';
import { useDraft } from '../../meshcore/settings/useDraft';
import mc from '../../meshcore/settings/McSettings.module.css';
import styles from '../Reticulum.module.css';
import StateView from '../../patterns/StateView';

type NumberKey = Exclude<keyof RadioConfig, 'radioState'>;

/** Today's fields, labels and ranges (ReticulumConfigurationView). */
const FIELDS: Array<{ key: NumberKey; id: string; labelKey: string; fallback: string; min?: number; max?: number; stepper?: boolean; helpKey?: string }> = [
  { key: 'frequency', id: 'reticulum.frequency', labelKey: 'reticulum.config.frequency', fallback: 'Frequency (Hz)' },
  { key: 'bandwidth', id: 'reticulum.bandwidth', labelKey: 'reticulum.config.bandwidth', fallback: 'Bandwidth (Hz)' },
  { key: 'spreadingFactor', id: 'reticulum.spreadingFactor', labelKey: 'reticulum.config.sf', fallback: 'Spreading Factor', min: 5, max: 12, stepper: true },
  { key: 'codingRate', id: 'reticulum.codingRate', labelKey: 'reticulum.config.cr', fallback: 'Coding Rate', min: 5, max: 8, stepper: true },
  { key: 'txPower', id: 'reticulum.txPower', labelKey: 'reticulum.config.txPower', fallback: 'TX Power (dBm)', min: 0, max: 22 },
  { key: 'stAlock', id: 'reticulum.stAlock', labelKey: 'reticulum.config.stAlock', fallback: 'Short Airtime Lock (%)', min: 0, max: 100, helpKey: 'workspace.reticulum.settings.st_alock_help' },
  { key: 'ltAlock', id: 'reticulum.ltAlock', labelKey: 'reticulum.config.ltAlock', fallback: 'Long Airtime Lock (%)', min: 0, max: 100, helpKey: 'workspace.reticulum.settings.lt_alock_help' },
];

export default function RNodeCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('configuration', 'write', { sourceId });
  const isPhone = useIsPhone();
  const radio = useReticulumRadioConfig(sourceId, true);
  const draft = useDraft<RadioConfig & Record<string, unknown>>(radio.saved as RadioConfig & Record<string, unknown>);
  const numbers = useNumberInputScope();
  // Desktop only: on the phone the long line squeezed "On this node" into a column (9-15 draws none).
  useSettingsHeader(isPhone ? null : { scope: t('workspace.reticulum.settings.rnode_scope') });
  const off = !canWrite || radio.saving;

  // The first read only: a read again after Apply keeps the page.
  if (radio.loading && radio.saved.frequency === null && !radio.error) return <StateView kind="loading" page />;

  const label = (k: keyof RadioConfig) =>
    k === 'radioState' ? t('reticulum.config.radioOn', 'Radio on') : (() => {
      const f = FIELDS.find((x) => x.key === k)!;
      return t(f.labelKey, f.fallback);
    })();
  const changes = draft.changed.map((k) => label(k as keyof RadioConfig));
  const was = (k: keyof RadioConfig) => {
    if (!draft.isChanged(k)) return undefined;
    const v = radio.saved[k];
    if (k === 'radioState') return t(v ? 'workspace.settings.tag_on' : 'workspace.settings.tag_off');
    return v === null ? '—' : String(v);
  };
  const apply = async () => {
    if (numbers.invalid) return;
    const values = Object.fromEntries((Object.keys(radio.saved) as Array<keyof RadioConfig>).map((k) => [k, draft.value(k)])) as unknown as RadioConfig;
    if (await radio.apply(values)) draft.discard();
  };
  const info = radio.deviceInfo;

  return (
    <McPage>
      {!canWrite && (
        <p className={styles.readOnly} role="status">
          <UiIcon name="encrypted" size={16} />
          {t('reticulum.config.readOnlyAll', 'You have read-only access — this configuration cannot be changed.')}
        </p>
      )}
      {radio.status && <p className={mc.lead} role="status">{radio.status}</p>}
      <div className={styles.rnodeGrid} data-phone={isPhone || undefined}>
        <div>
          <NumberInputScope scope={numbers}>
            <SettingGroup title={t('workspace.reticulum.settings.radio_group')}>
              {FIELDS.map((f) => {
                const value = draft.value(f.key);
                return (
                  <SettingRow key={f.id} id={f.id} label={t(f.labelKey, f.fallback)} help={f.helpKey ? t(f.helpKey) : undefined} was={was(f.key)}>
                    {value === null ? (
                      <span className={mc.muted}>—</span>
                    ) : (
                      <SettingNumber value={value} min={f.min} max={f.max} stepper={f.stepper} readOnly={off} onChange={(v) => draft.set(f.key, v)} />
                    )}
                  </SettingRow>
                );
              })}
              <SettingRow id="reticulum.radioState" label={t('reticulum.config.radioOn', 'Radio on')} was={was('radioState')}>
                <SettingToggle checked={draft.value('radioState') === true} readOnly={off} onChange={(v) => draft.set('radioState', v)} />
              </SettingRow>
            </SettingGroup>
          </NumberInputScope>
          <p className={mc.lead}>
            <UiIcon name="info" size={16} />
            <span>{t('workspace.reticulum.settings.radio_note')}</span>
          </p>
        </div>
        <SettingGroup title={t('workspace.reticulum.settings.device_info')}>
          {info ? (
            <>
              {info.firmwareVersion && <Fact label={t('reticulum.config.firmware', 'Firmware')} value={info.firmwareVersion} />}
              {info.platform && <Fact label={t('reticulum.config.platform', 'Platform')} value={info.platform} />}
              {info.mcu && <Fact label={t('reticulum.config.mcu', 'MCU')} value={info.mcu} />}
              {typeof info.chipTemp === 'number' && <Fact label={t('reticulum.config.chipTemp', 'Chip temp')} value={`${info.chipTemp} °C`} />}
            </>
          ) : (
            <p className={mc.muted}>{t('reticulum.config.noDevice', 'Device info unavailable.')}</p>
          )}
        </SettingGroup>
      </div>
      <McDock
        sourceId={sourceId}
        changes={changes}
        page={t('workspace.reticulum.settings.rnode')}
        sends={t('workspace.reticulum.settings.sends_apply')}
        saveLabel={t('reticulum.config.apply', 'Apply')}
        saving={radio.saving}
        blocked={off || numbers.invalid}
        error={radio.error}
        onSave={() => void apply()}
        onDiscard={() => {
          draft.discard();
          numbers.reset();
        }}
      />
    </McPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
