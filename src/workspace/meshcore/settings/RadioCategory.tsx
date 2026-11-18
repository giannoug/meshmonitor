/**
 * Settings › Radio (board 8-08): today's Radio parameters (preset, frequency,
 * bandwidth, spreading factor, coding rate) and, on a Companion, Multi-ACKs and
 * the Bluetooth PIN, on the row kit with "was …" badges and the page's dock:
 * "N changes in Radio · Save radio settings".
 *
 * Save sends only what changed, each through today's setter once:
 * `setRadioParams` (all four, as today's Save radio settings), `setMultiAcks`,
 * `setBlePin`. They write to the radio over its connection; nothing goes out
 * on the mesh, but nodes on the old radio settings stop hearing this one.
 * Multi-ACKs carries today's airtime warning. Opening the page reads the BLE
 * PIN as today's section does (configuration:write, connected); it sends
 * nothing on the mesh.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { COMPANION_CMD_FIRMWARE_MIN } from '../../../components/MeshCore/MeshCoreMultiAcksSection';
import { RADIO_PRESETS, findPresetId } from '../../../components/MeshCore/radioPresets';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { useNumberInputScope } from '../../../components/common/numberInputScopeContext';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingNumber from '../../settings/kit/SettingNumber';
import SettingRow from '../../settings/kit/SettingRow';
import SettingSegmented from '../../settings/kit/SettingSegmented';
import SettingSelect from '../../settings/kit/SettingSelect';
import SettingToggle from '../../settings/kit/SettingToggle';
import { useReadOnly, useSettingRow } from '../../settings/kit/useFieldRegistry';
import { Warn } from '../../settings/categories/RowParts';
import { useSettingsHeader } from '../../settings/settingsDock';
import { useIsPhone } from '../../shell/useIsPhone';
import { DeviceNotes, McDock, McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

type Radio = { freq: number; bw: number; sf: number; cr: number };
const BANDWIDTHS = [7.8, 10.4, 15.6, 20.8, 31.25, 41.7, 62.5, 125, 250, 500];
const PIN_RANGE = { min: 100000, max: 999999 } as const;

export default function RadioCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const local = d.local;
  useSettingsHeader({ scope: t('workspace.meshcore.settings.radio_scope', { device: d.deviceName }) });
  const numbers = useNumberInputScope();
  const saved: Radio = {
    freq: local?.radioFreq ?? 869.525,
    bw: local?.radioBw ?? 250,
    sf: local?.radioSf ?? 11,
    cr: local?.radioCr ?? 5,
  };
  const [radio, setRadio] = useState<Radio | null>(null);
  const r = radio ?? saved;
  const set = (patch: Partial<Radio>) => setRadio({ ...r, ...patch });
  const presetId = findPresetId(r.freq, r.bw, r.sf, r.cr);
  const savedPresetId = findPresetId(saved.freq, saved.bw, saved.sf, saved.cr);
  const presetLabel = (id: string) => RADIO_PRESETS.find((p) => p.id === id)?.label ?? t('meshcore.config.preset.custom', 'Custom');
  const presetNote = RADIO_PRESETS.find((p) => p.id === presetId)?.note;

  // Companion: Multi-ACKs and the BLE PIN, each saved only when changed.
  const savedMulti = local?.multiAcks === 1;
  const [multi, setMulti] = useState<boolean | null>(null);
  const multiOld = typeof local?.firmwareVer === 'number' && local.firmwareVer < COMPANION_CMD_FIRMWARE_MIN;
  const [savedPin, setSavedPin] = useState<number | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const { getBlePin } = d.actions;
  const readPin = d.isCompanion && d.connected && d.canWriteConfig;
  useEffect(() => {
    if (!readPin) return;
    let cancelled = false;
    void Promise.resolve(getBlePin?.()).then((v) => {
      if (!cancelled && typeof v === 'number') setSavedPin(v);
    });
    return () => {
      cancelled = true;
    };
  }, [readPin, getBlePin]);

  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const changedRadio = (['freq', 'bw', 'sf', 'cr'] as const).filter((k) => radio !== null && radio[k] !== saved[k]);
  const multiChanged = multi !== null && multi !== savedMulti;
  const pinChanged = pin !== null && savedPin !== null && pin !== savedPin;
  const label: Record<(typeof changedRadio)[number], string> = {
    freq: t('meshcore.config.frequency'),
    bw: t('meshcore.config.bandwidth'),
    sf: t('meshcore.config.sf'),
    cr: t('meshcore.config.cr'),
  };
  const changes = [
    ...changedRadio.map((k) => label[k]),
    ...(multiChanged ? [t('meshcore.multi_acks.title')] : []),
    ...(pinChanged ? [t('workspace.meshcore.settings.ble_pin')] : []),
  ];
  const pinValid = pin === null || pin === 0 || (pin >= PIN_RANGE.min && pin <= PIN_RANGE.max);
  const off = !d.connected || !d.canWriteConfig || saving;

  const discard = () => {
    setRadio(null);
    setMulti(null);
    setPin(null);
    setFailed(null);
    numbers.reset();
  };
  const save = async () => {
    // #5649: a blank or out-of-range frequency never reaches the radio.
    if (numbers.invalid || !pinValid) return;
    setSaving(true);
    setFailed(null);
    const failedNames: string[] = [];
    if (changedRadio.length > 0) {
      if (await d.actions.setRadioParams(r)) setRadio(null);
      else failedNames.push(t('meshcore.config.radio_params'));
    }
    if (multiChanged) {
      if (await d.actions.setMultiAcks(multi ? 1 : 0)) setMulti(null);
      else failedNames.push(t('meshcore.multi_acks.title'));
    }
    if (pinChanged) {
      if (await d.actions.setBlePin(pin)) {
        setSavedPin(pin);
        setPin(null);
      } else failedNames.push(t('workspace.meshcore.settings.ble_pin'));
    }
    setSaving(false);
    if (failedNames.length) setFailed(t('workspace.meshcore.settings.not_saved', { names: failedNames.join(', ') }));
  };

  const was = (k: keyof Radio, text = String(saved[k])) => (radio !== null && radio[k] !== saved[k] ? text : undefined);
  return (
    <McPage>
      <DeviceNotes />
      <NumberInputScope scope={numbers}>
        <SettingGroup title={t('meshcore.config.radio_params')}>
          <SettingRow
            id="meshcore.preset"
            label={t('meshcore.config.preset', 'Preset')}
            help={
              <>
                {t('workspace.meshcore.settings.preset_help')}
                {presetNote && <Warn tone="note">{presetNote}</Warn>}
              </>
            }
            was={presetId !== savedPresetId ? presetLabel(savedPresetId) : undefined}
          >
            <SettingSelect
              value={presetId}
              readOnly={off}
              options={[{ value: 'custom', label: t('meshcore.config.preset.custom', 'Custom') }, ...RADIO_PRESETS.map((p) => ({ value: p.id, label: p.label }))]}
              onChange={(id) => {
                const p = RADIO_PRESETS.find((x) => x.id === id);
                if (!p) return;
                // The preset may equal the saved frequency, which the field cannot see as a change.
                numbers.reset();
                set({ freq: p.freq, bw: p.bw, sf: p.sf, cr: p.cr });
              }}
            />
          </SettingRow>
          <SettingRow id="meshcore.freq" label={t('meshcore.config.frequency')} help={t('workspace.meshcore.settings.freq_help')} was={was('freq')}>
            <SettingNumber value={r.freq} min={137} max={1020} step={0.001} readOnly={off} onChange={(freq) => set({ freq })} />
          </SettingRow>
          <SettingRow id="meshcore.bw" label={t('meshcore.config.bandwidth')} was={was('bw')}>
            <SettingSelect value={String(r.bw)} readOnly={off} options={BANDWIDTHS.map((v) => ({ value: String(v), label: String(v) }))} onChange={(v) => set({ bw: parseFloat(v) })} />
          </SettingRow>
          <SettingRow id="meshcore.sf" label={t('meshcore.config.sf')} help={t('workspace.meshcore.settings.sf_help')} was={was('sf')}>
            <SettingNumber stepper value={r.sf} min={5} max={12} readOnly={off} onChange={(sf) => set({ sf })} />
          </SettingRow>
          <SettingRow id="meshcore.cr" label={t('meshcore.config.cr')} help={t('workspace.meshcore.settings.cr_help')} was={was('cr', `4/${saved.cr}`)}>
            <SettingNumber stepper value={r.cr} min={5} max={8} readOnly={off} onChange={(cr) => set({ cr })} />
          </SettingRow>
        </SettingGroup>
      </NumberInputScope>
      <p className={styles.lead}>
        <UiIcon name="info" size={16} />
        <span>{t('workspace.meshcore.settings.radio_note')}</span>
      </p>

      {d.isCompanion && (
        <SettingGroup title={t('workspace.meshcore.settings.companion')}>
          <SettingRow
            id="meshcore.multiAcks"
            label={t('meshcore.multi_acks.title')}
            help={
              <>
                {t('meshcore.multi_acks.hint')}
                {multiOld && <Warn>{t('meshcore.multi_acks.unsupported', { min: COMPANION_CMD_FIRMWARE_MIN })}</Warn>}
                <SendsLine>{t('meshcore.multi_acks.warning')}</SendsLine>
              </>
            }
            was={multiChanged ? t(savedMulti ? 'workspace.settings.tag_on' : 'workspace.settings.tag_off') : undefined}
          >
            <SettingToggle checked={multi ?? savedMulti} readOnly={off || multiOld} onChange={setMulti} />
          </SettingRow>
          <SettingRow
            id="meshcore.blePin"
            label={t('workspace.meshcore.settings.ble_pin')}
            help={t('workspace.meshcore.settings.ble_pin_help')}
            was={pinChanged ? pinText(t, savedPin) : undefined}
          >
            <BlePinValue value={pin ?? savedPin} off={off || savedPin === null} onChange={setPin} />
          </SettingRow>
        </SettingGroup>
      )}

      <McDock
        changes={changes}
        page={t('workspace.meshcore.settings.radio')}
        sends={t('workspace.meshcore.settings.sends_radio')}
        saveLabel={t('meshcore.config.save_radio')}
        saving={saving}
        blocked={off || numbers.invalid || !pinValid}
        error={failed}
        onSave={() => void save()}
        onDiscard={discard}
      />
    </McPage>
  );
}

function pinText(t: ReturnType<typeof useTranslation>['t'], pin: number | null): string {
  if (pin === null) return '—';
  return pin === 0 ? t('meshcore.ble_pin.mode_default') : t('workspace.meshcore.settings.ble_pin_set');
}

/** "Set · 6 digits ›": opens today's PIN choice (firmware default or a fixed six-digit PIN) in a sheet. */
function BlePinValue({ value, off, onChange }: { value: number | null; off: boolean; onChange(pin: number): void }) {
  const { t } = useTranslation();
  const row = useSettingRow();
  const readOnly = useReadOnly(off);
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const numbers = useNumberInputScope();
  const fixed = value !== null && value !== 0;
  const [typed, setTyped] = useState<number>(PIN_RANGE.min);
  const shown = useMemo(() => (fixed ? value! : typed), [fixed, value, typed]);
  return (
    <>
      <button type="button" className={styles.value} id={row?.inputId} aria-haspopup="dialog" disabled={readOnly} onClick={() => setOpen(true)}>
        <span>{pinText(t, value)}</span>
        <UiIcon name="chevronRight" size={18} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('meshcore.ble_pin.title')}>
        <div className={styles.sheet} data-phone={isPhone || undefined}>
          <p className={styles.lead}>{t('meshcore.ble_pin.hint')}</p>
          <SettingSegmented
            label={t('meshcore.ble_pin.title')}
            value={fixed ? 'fixed' : 'default'}
            options={[
              { value: 'default', label: t('meshcore.ble_pin.mode_default') },
              { value: 'fixed', label: t('workspace.meshcore.settings.ble_pin_fixed') },
            ]}
            onChange={(m) => onChange(m === 'default' ? 0 : typed)}
          />
          {fixed && (
            <NumberInputScope scope={numbers}>
              <label className={styles.field}>
                <span>{t('meshcore.ble_pin.fixed_description')}</span>
                <SettingNumber
                  value={shown}
                  min={PIN_RANGE.min}
                  max={PIN_RANGE.max}
                  onChange={(n) => {
                    setTyped(n);
                    onChange(n);
                  }}
                />
              </label>
            </NumberInputScope>
          )}
          <p className={styles.muted}>{t('meshcore.ble_pin.note')}</p>
          <button type="button" className={styles.button} disabled={numbers.invalid} onClick={() => setOpen(false)}>
            {t('common.done')}
          </button>
        </div>
      </Sheet>
    </>
  );
}
