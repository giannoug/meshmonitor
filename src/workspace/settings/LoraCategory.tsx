/**
 * LoRa (boards b-set-d1 desktop, b-set-p2 phone, b-set-p3 the preset sheet):
 * today's LoRa section on the row kit. Every control, check and warning of
 * LoRaConfigSection is here with today's words (D9b): Radio (region, preset,
 * hop limit), Transmit, and Advanced for the custom parameters and rare
 * switches. Edits go to the frame's shared state and queue in the radio save
 * bar; an edited row shows what the node holds ("was …").
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import {
  FEM_LNA_MODE_OPTIONS,
  LORA_CUSTOM_RECIPES,
  MODEM_PRESET_OPTIONS,
  REGION_OPTIONS,
  UNKNOWN_MODEM_PRESET,
  getLegalPresetOptions,
  getPresetIllegalReason,
  getRecipeIllegalReason,
  isAmateurRadioRegion,
  type LoRaCustomRecipe,
} from '../../components/configuration/constants';
import { MODEM_PRESET_NAMES } from '../../utils/loraFrequency';
import ConfirmSheet from '../patterns/ConfirmSheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import AdvancedCard from './kit/AdvancedCard';
import SettingGroup from './kit/SettingGroup';
import SettingNumber from './kit/SettingNumber';
import SettingRow from './kit/SettingRow';
import SettingSelect from './kit/SettingSelect';
import SettingToggle from './kit/SettingToggle';
import { formatValue, sameValue } from './radioSections';
import { useSharedDeviceConfig } from './sharedDeviceConfig';
import { useRadioSaveQueue } from './useRadioSaveQueue';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import type { CategoryProps } from './categories';
import styles from './LoraCategory.module.css';

type Key = keyof DeviceConfigState;

export default function LoraCategory({ target }: CategoryProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const config = useSharedDeviceConfig();
  const queue = useRadioSaveQueue();
  const [txConfirm, setTxConfirm] = useState(false);
  const [recipe, setRecipe] = useState<LoRaCustomRecipe | null>(null);
  if (!config || config.state.loading) return <StateView kind="loading" />;
  const s = config.state;
  const firmware = s.localFirmwareVersion;
  const base = queue?.baseline('lora');
  /** "was …" while the value differs from what the node holds. */
  const was = (key: Key) => (base && !sameValue(base[key], s[key]) ? formatValue(t, key, base[key]) : undefined);
  const num = (set: (v: number) => void) => (v: string) => set(Number(v));

  // The preset picker: presets legal here, the current one kept (#3924, #5547).
  const presetUnknown = s.modemPreset === UNKNOWN_MODEM_PRESET;
  const presetName = presetUnknown
    ? t('lora_config.preset_unknown_name', { name: s.unknownModemPresetName ?? '?' })
    : MODEM_PRESET_OPTIONS.find((o) => o.value === s.modemPreset)?.name ??
      MODEM_PRESET_NAMES[s.modemPreset] ??
      t('lora_config.preset_unknown_name', { name: String(s.modemPreset) });
  const legal = getLegalPresetOptions(s.region, s.modemPreset, firmware);
  const presetIssue = presetUnknown ? null : getPresetIllegalReason(s.region, s.modemPreset, firmware);
  const presetOptions = [
    ...(presetUnknown ? [{ value: String(UNKNOWN_MODEM_PRESET), label: presetName, disabled: true }] : []),
    ...legal.map((o) => ({
      value: String(o.value),
      label: o.name,
      help: base && o.value === base.modemPreset && o.value !== s.modemPreset ? t('workspace.settings.lora.current_value') : o.description,
    })),
  ];
  const alert = (text: string) => (
    <span role="alert" className={styles.warning}>
      <UiIcon name="alert" size={16} />
      <span>{text}</span>
    </span>
  );

  const onTx = (on: boolean) => {
    // Today's danger confirm on turning transmit off (#4294); turning it on never asks.
    if (!on && s.txEnabled) setTxConfirm(true);
    else s.setTxEnabled(on);
  };
  const [txTitle, ...txBody] = t('lora_config.tx_disable_confirm').split('\n\n');

  const pickRecipe = (id: string) => {
    const r = LORA_CUSTOM_RECIPES.find((x) => x.id === id);
    setRecipe(r && !getRecipeIllegalReason(s.region, r, firmware) ? r : null);
  };
  const applyRecipe = () => {
    // Re-check: the region may have changed while the confirm was open.
    if (recipe && !getRecipeIllegalReason(s.region, recipe, firmware)) {
      s.setBandwidth(recipe.bandwidthKHz);
      s.setSpreadFactor(recipe.spreadFactor);
      s.setCodingRate(recipe.codingRate);
    }
    setRecipe(null);
  };

  const ignoreMqtt = (
    <SettingRow key="ignoreMqtt" id="lora.ignoreMqtt" label={t('lora_config.ignore_mqtt')} help={t('lora_config.ignore_mqtt_description')} was={was('ignoreMqtt')}>
      <SettingToggle checked={s.ignoreMqtt} onChange={s.setIgnoreMqtt} />
    </SettingRow>
  );

  const advanced: ReactNode[] = [
    ...(!s.usePreset
      ? [
          <SettingRow
            key="recipe"
            id="lora.recipe"
            label={t('lora_config.recipe')}
            help={
              <>
                {t('lora_config.recipe_description')}
                {LORA_CUSTOM_RECIPES.some((r) => getRecipeIllegalReason(s.region, r, firmware) !== null) && (
                  <span className={styles.block}>{t('lora_config.recipe_some_unavailable')}</span>
                )}
              </>
            }
          >
            <SettingSelect
              value=""
              onChange={pickRecipe}
              options={[
                { value: '', label: t('lora_config.recipe_placeholder'), disabled: true },
                ...LORA_CUSTOM_RECIPES.map((r) => {
                  const reason = getRecipeIllegalReason(s.region, r, firmware);
                  const label = `${r.name} (BW ${r.bandwidthKHz} kHz, SF ${r.spreadFactor}, CR 4/${r.codingRate})`;
                  return { value: r.id, label: reason ? `${label} - ${t(`lora_config.recipe_illegal_${reason}`)}` : label, disabled: reason !== null };
                }),
              ]}
            />
          </SettingRow>,
          <SettingRow key="bandwidth" id="lora.bandwidth" label={t('lora_config.bandwidth')} help={t('lora_config.bandwidth_description')} was={was('bandwidth')}>
            <SettingNumber value={s.bandwidth} min={1} max={500} onChange={s.setBandwidth} />
          </SettingRow>,
          <SettingRow key="spreadFactor" id="lora.spreadFactor" label={t('lora_config.spread_factor')} help={t('lora_config.spread_factor_description')} was={was('spreadFactor')}>
            <SettingNumber value={s.spreadFactor} min={7} max={12} onChange={s.setSpreadFactor} />
          </SettingRow>,
          <SettingRow key="codingRate" id="lora.codingRate" label={t('lora_config.coding_rate')} help={t('lora_config.coding_rate_description')} was={was('codingRate')}>
            <SettingNumber value={s.codingRate} min={5} max={8} onChange={s.setCodingRate} />
          </SettingRow>,
          <SettingRow key="frequencyOffset" id="lora.frequencyOffset" label={t('lora_config.frequency_offset')} help={t('lora_config.frequency_offset_description')} was={was('frequencyOffset')}>
            <SettingNumber value={s.frequencyOffset} step={0.001} onChange={s.setFrequencyOffset} />
          </SettingRow>,
        ]
      : []),
    // A remote node gets overrideFrequency only in a custom (no preset) set_lora_config, as today's Admin Commands.
    ...(target.kind === 'local' || !s.usePreset
      ? [
          <SettingRow key="overrideFrequency" id="lora.overrideFrequency" label={t('lora_config.override_frequency')} help={t('lora_config.override_frequency_description')} was={was('overrideFrequency')}>
            <SettingNumber value={s.overrideFrequency} step={0.001} onChange={s.setOverrideFrequency} />
          </SettingRow>,
        ]
      : []),
    <SettingRow key="channelNum" id="lora.channelNum" label={t('lora_config.channel_num')} help={t('lora_config.channel_num_description')} was={was('channelNum')}>
      <SettingNumber value={s.channelNum} min={0} max={255} onChange={s.setChannelNum} />
    </SettingRow>,
    <SettingRow key="femLnaMode" id="lora.femLnaMode" label={t('lora_config.fem_lna_mode')} help={t('lora_config.fem_lna_mode_description')} was={was('femLnaMode')}>
      <SettingSelect value={String(s.femLnaMode)} onChange={num(s.setFemLnaMode)} options={FEM_LNA_MODE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))} />
    </SettingRow>,
    <SettingRow key="rxBoostedGain" id="lora.rxBoostedGain" label={t('lora_config.rx_boosted_gain')} help={t('lora_config.rx_boosted_gain_description')} was={was('sx126xRxBoostedGain')}>
      <SettingToggle checked={s.sx126xRxBoostedGain} onChange={s.setSx126xRxBoostedGain} />
    </SettingRow>,
    <SettingRow
      key="overrideDutyCycle"
      id="lora.overrideDutyCycle"
      label={t('lora_config.override_duty_cycle')}
      help={<span className={styles.danger}>{t('lora_config.override_duty_cycle_description')}</span>}
      was={was('overrideDutyCycle')}
    >
      <SettingToggle checked={s.overrideDutyCycle} onChange={s.setOverrideDutyCycle} />
    </SettingRow>,
    <SettingRow key="paFanDisabled" id="lora.paFanDisabled" label={t('lora_config.pa_fan_disabled')} help={t('lora_config.pa_fan_disabled_description')} was={was('paFanDisabled')}>
      <SettingToggle checked={s.paFanDisabled} onChange={s.setPaFanDisabled} />
    </SettingRow>,
    // The phone board moves Ignore MQTT out of Transmit (b-set-p2).
    ...(isPhone ? [ignoreMqtt] : []),
  ];

  return (
    <>
      <SettingGroup title={t('workspace.settings.lora.radio')}>
        <SettingRow
          id="lora.region"
          label={t('lora_config.region')}
          help={
            <>
              {t('lora_config.region_description')}
              {isAmateurRadioRegion(s.region) && alert(t('lora_config.amateur_band_warning'))}
            </>
          }
          was={was('region')}
        >
          <SettingSelect value={String(s.region)} onChange={num(s.setRegion)} options={REGION_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))} />
        </SettingRow>
        <SettingRow id="lora.usePreset" label={t('lora_config.use_preset')} help={t('lora_config.use_preset_description')} was={was('usePreset')}>
          <SettingToggle checked={s.usePreset} onChange={s.setUsePreset} />
        </SettingRow>
        {s.usePreset && (
          <SettingRow
            id="lora.modemPreset"
            label={t('lora_config.modem_preset')}
            help={
              <>
                {t('lora_config.modem_preset_description')}
                {legal.length < MODEM_PRESET_OPTIONS.length && <span className={styles.block}>{t('lora_config.preset_filtered_note')}</span>}
                {presetUnknown && alert(t('lora_config.preset_unknown_warning', { name: s.unknownModemPresetName ?? '?' }))}
                {presetIssue && alert(t(`lora_config.preset_illegal_${presetIssue}`, { name: presetName }))}
              </>
            }
            was={was('modemPreset')}
          >
            <SettingSelect
              value={String(s.modemPreset)}
              onChange={num(s.setModemPreset)}
              options={presetOptions}
              note={t('workspace.settings.lora.preset_note')}
            />
          </SettingRow>
        )}
        <SettingRow id="lora.hopLimit" label={t('lora_config.hop_limit')} help={t('lora_config.hop_limit_description')} was={was('hopLimit')}>
          <SettingNumber value={s.hopLimit} min={1} max={7} alsoValid={[0]} zeroHint={t('zero_hint.hop_limit')} onChange={s.setHopLimit} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t('workspace.settings.lora.transmit')}>
        <SettingRow id="lora.txEnabled" label={t('lora_config.tx_enabled')} help={t('lora_config.tx_enabled_description')} was={was('txEnabled')}>
          <SettingToggle checked={s.txEnabled} onChange={onTx} />
        </SettingRow>
        <SettingRow id="lora.txPower" label={t('lora_config.tx_power')} help={t('lora_config.tx_power_description')} was={was('txPower')}>
          <SettingNumber value={s.txPower} onChange={s.setTxPower} />
        </SettingRow>
        {!isPhone && ignoreMqtt}
        <SettingRow id="lora.okToMqtt" label={t('lora_config.ok_to_mqtt')} help={t('lora_config.ok_to_mqtt_description')} was={was('configOkToMqtt')}>
          <SettingToggle checked={s.configOkToMqtt} onChange={s.setConfigOkToMqtt} />
        </SettingRow>
      </SettingGroup>

      <AdvancedCard count={advanced.length}>{advanced}</AdvancedCard>

      <ConfirmSheet
        submitOnEnter={false}
        open={txConfirm}
        title={txTitle}
        body={txBody.join('\n\n')}
        confirmLabel={t('common.ok')}
        danger
        onConfirm={() => {
          s.setTxEnabled(false);
          setTxConfirm(false);
        }}
        onCancel={() => setTxConfirm(false)}
      />
      <ConfirmSheet
        open={!!recipe}
        title={recipe ? t('lora_config.recipe_confirm_title', { name: recipe.name }) : ''}
        consequences={
          recipe
            ? [
                t('lora_config.recipe_confirm_params', { bandwidth: recipe.bandwidthKHz, spreadFactor: recipe.spreadFactor, codingRate: recipe.codingRate }),
                t('lora_config.recipe_confirm_mesh'),
                t('lora_config.recipe_confirm_not_official'),
                t('lora_config.recipe_confirm_slot'),
              ]
            : []
        }
        confirmLabel={t('lora_config.recipe_confirm_apply')}
        onConfirm={applyRecipe}
        onCancel={() => setRecipe(null)}
      />
    </>
  );
}
