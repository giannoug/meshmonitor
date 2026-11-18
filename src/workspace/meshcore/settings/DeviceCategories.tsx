/**
 * A MeshCore radio's Name, Location, TX power and Telemetry (Task 7.4, note
 * s8n4: not drawn), on the row kit. Each is today's Device Configuration
 * section: the same fields and limits, saved through today's `actions.*`
 * setter, once per press, from the page's own dock (as Radio on 8-08). Saving
 * writes to the radio over its connection and sends nothing on the mesh.
 * Opening a page sends nothing.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TelemetryMode } from '../../../components/MeshCore/hooks/useMeshCore';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { useNumberInputScope } from '../../../components/common/numberInputScopeContext';
import { LocationPinPicker } from '../../../components/map/LocationPinPicker';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingNumber from '../../settings/kit/SettingNumber';
import SettingRow from '../../settings/kit/SettingRow';
import SettingSelect from '../../settings/kit/SettingSelect';
import SettingText from '../../settings/kit/SettingText';
import SettingToggle from '../../settings/kit/SettingToggle';
import { Warn } from '../../settings/categories/RowParts';
import { DeviceNotes, McDock, McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

const NAME_MAX = 32;

/** A field's draft: null until edited, so a fresh read from the radio shows through. */
function useDraft<T>() {
  return useState<T | null>(null);
}

export function NameCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const saved = d.local?.name ?? '';
  const [draft, setDraft] = useDraft<string>();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = draft ?? saved;
  const changed = draft !== null && draft !== saved;
  const label = t('meshcore.config.name_label');
  const save = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await d.actions.setDeviceName(name.trim());
    setSaving(false);
    if (ok) setDraft(null);
    else setFailed(true);
  };
  return (
    <McPage>
      <DeviceNotes />
      <SettingGroup>
        <SettingRow id="meshcore.name" label={label} help={t('meshcore.config.device_name_hint')} was={changed ? saved : undefined}>
          <SettingText value={name} maxLength={NAME_MAX} readOnly={!d.connected || !d.canWriteConfig || saving} onChange={setDraft} />
        </SettingRow>
      </SettingGroup>
      <McDock
        changes={changed ? [label] : []}
        page={label}
        sends={t('workspace.meshcore.settings.sends_name')}
        saveLabel={t('meshcore.config.save_name')}
        saving={saving}
        blocked={!d.connected || !d.canWriteConfig || !name.trim()}
        error={failed ? t('workspace.meshcore.settings.save_failed') : null}
        onSave={() => void save()}
        onDiscard={() => {
          setDraft(null);
          setFailed(false);
        }}
      />
    </McPage>
  );
}

export function LocationCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const numbers = useNumberInputScope();
  const savedLat = d.local?.latitude ?? 0;
  const savedLon = d.local?.longitude ?? 0;
  const [lat, setLat] = useDraft<number>();
  const [lon, setLon] = useDraft<number>();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [advLoc, setAdvLoc] = useState<boolean | null>(null);
  const [savingAdvLoc, setSavingAdvLoc] = useState(false);
  const la = lat ?? savedLat;
  const lo = lon ?? savedLon;
  const off = !d.connected || !d.canWriteConfig || saving;
  const changes = [
    ...(lat !== null && lat !== savedLat ? [t('meshcore.config.latitude', 'Latitude')] : []),
    ...(lon !== null && lon !== savedLon ? [t('meshcore.config.longitude', 'Longitude')] : []),
  ];
  const discard = () => {
    setLat(null);
    setLon(null);
    setFailed(false);
    numbers.reset();
  };
  const save = async () => {
    if (!Number.isFinite(la) || !Number.isFinite(lo) || numbers.invalid) return;
    setSaving(true);
    setFailed(false);
    const ok = await d.actions.setCoords(la, lo);
    setSaving(false);
    if (ok) discard();
    else setFailed(true);
  };
  // Today's switch saves when flipped, and flips back when the radio refuses.
  const advLocOn = advLoc ?? d.local?.advLocPolicy === 1;
  const toggleAdvLoc = async (next: boolean) => {
    setSavingAdvLoc(true);
    setAdvLoc(next);
    const ok = await d.actions.setAdvertLocPolicy(next ? 1 : 0);
    setSavingAdvLoc(false);
    setAdvLoc(ok ? null : !next);
  };
  return (
    <McPage>
      <DeviceNotes />
      <NumberInputScope scope={numbers}>
        <SettingGroup>
          <SettingRow
            id="meshcore.lat"
            label={t('meshcore.config.latitude', 'Latitude')}
            help={t('meshcore.config.location_hint', 'GPS coordinates reported by the device. Latitude (-90 to 90), Longitude (-180 to 180).')}
            was={lat !== null && lat !== savedLat ? String(savedLat) : undefined}
          >
            <SettingNumber value={la} min={-90} max={90} step={0.000001} readOnly={off} onChange={setLat} />
          </SettingRow>
          <SettingRow id="meshcore.lon" label={t('meshcore.config.longitude', 'Longitude')} was={lon !== null && lon !== savedLon ? String(savedLon) : undefined}>
            <SettingNumber value={lo} min={-180} max={180} step={0.000001} readOnly={off} onChange={setLon} />
          </SettingRow>
          {!d.isRepeater && (
            <SettingRow id="meshcore.advLoc" label={t('meshcore.config.advert_loc_policy')} help={<SendsLine>{t('workspace.meshcore.settings.sends_adv_loc')}</SendsLine>}>
              <SettingToggle checked={advLocOn} readOnly={!d.connected || !d.canWriteConfig || savingAdvLoc} onChange={(v) => void toggleAdvLoc(v)} />
            </SettingRow>
          )}
        </SettingGroup>
      </NumberInputScope>
      <div className={styles.map}>
        <LocationPinPicker
          lat={la}
          lon={lo}
          onChange={(a, b) => {
            setLat(a);
            setLon(b);
          }}
          disabled={off}
          decimals={6}
          testId="meshcore-location-map"
        />
      </div>
      <McDock
        changes={changes}
        page={t('workspace.meshcore.settings.location')}
        sends={t('workspace.meshcore.settings.sends_location')}
        saveLabel={t('meshcore.config.save_location', 'Save location')}
        saving={saving}
        blocked={!d.connected || !d.canWriteConfig || numbers.invalid}
        error={failed ? t('workspace.meshcore.settings.save_failed') : null}
        onSave={() => void save()}
        onDiscard={discard}
      />
    </McPage>
  );
}

export function TxPowerCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const max = d.local?.maxTxPower ?? 22;
  const saved = d.local?.txPower ?? 0;
  const [draft, setDraft] = useDraft<number>();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const numbers = useNumberInputScope();
  const power = draft ?? saved;
  const changed = draft !== null && draft !== saved;
  const label = t('meshcore.config.tx_power_label', 'Power (dBm)');
  const save = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await d.actions.setTxPower(power);
    setSaving(false);
    if (ok) setDraft(null);
    else setFailed(true);
  };
  return (
    <McPage>
      <DeviceNotes />
      <NumberInputScope scope={numbers}>
        <SettingGroup>
          <SettingRow
            id="meshcore.txPower"
            label={label}
            help={t(
              'meshcore.config.tx_power_hint',
              `Transmit power in dBm (1–${max}). This controls the LoRa chip output only; boards with an external PA may amplify further.`,
            )}
            was={changed ? `${saved} dBm` : undefined}
          >
            <SettingNumber stepper value={power} min={1} max={max} readOnly={!d.connected || !d.canWriteConfig || saving} onChange={setDraft} />
          </SettingRow>
        </SettingGroup>
      </NumberInputScope>
      <McDock
        changes={changed ? [label] : []}
        page={t('workspace.meshcore.settings.tx_power')}
        sends={t('workspace.meshcore.settings.sends_tx_power')}
        saveLabel={t('meshcore.config.save_tx_power', 'Save TX power')}
        saving={saving}
        blocked={!d.connected || !d.canWriteConfig || numbers.invalid || power < 1 || power > max}
        error={failed ? t('workspace.meshcore.settings.save_failed') : null}
        onSave={() => void save()}
        onDiscard={() => {
          setDraft(null);
          setFailed(false);
          numbers.reset();
        }}
      />
    </McPage>
  );
}

const MODES: TelemetryMode[] = ['always', 'device', 'never'];
type ModeKey = 'telemetryModeBase' | 'telemetryModeLoc' | 'telemetryModeEnv';
const ROWS: Array<{ key: ModeKey; id: string; labelKey: string }> = [
  { key: 'telemetryModeBase', id: 'meshcore.telBase', labelKey: 'meshcore.config.telemetry_base' },
  { key: 'telemetryModeLoc', id: 'meshcore.telLoc', labelKey: 'meshcore.config.telemetry_loc' },
  { key: 'telemetryModeEnv', id: 'meshcore.telEnv', labelKey: 'meshcore.config.telemetry_env' },
];

export function TelemetryCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const [draft, setDraft] = useState<Partial<Record<ModeKey, TelemetryMode>>>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Today: a repeater or room server takes no telemetry modes.
  const companionOnly = typeof d.local?.advType === 'number' && [2, 3].includes(d.local.advType);
  const off = !d.connected || companionOnly || !d.canWriteConfig || saving;
  const saved = (k: ModeKey): TelemetryMode => d.local?.[k] ?? 'always';
  const value = (k: ModeKey) => draft[k] ?? saved(k);
  const options = MODES.map((m) => ({ value: m, label: t(`meshcore.config.telemetry_mode.${m}`) }));
  const changed = ROWS.filter((r) => draft[r.key] !== undefined && draft[r.key] !== saved(r.key));
  const save = async () => {
    setSaving(true);
    setFailed(false);
    // One after the other, never together (#5773): each write rewrites all three modes from a fresh read.
    const okBase = await d.actions.setTelemetryModeBase(value('telemetryModeBase'));
    const okLoc = await d.actions.setTelemetryModeLoc(value('telemetryModeLoc'));
    const okEnv = await d.actions.setTelemetryModeEnv(value('telemetryModeEnv'));
    setSaving(false);
    if (okBase && okLoc && okEnv) setDraft({});
    else setFailed(true);
  };
  return (
    <McPage>
      <DeviceNotes />
      {d.connected && companionOnly && <Warn>{t('meshcore.config.telemetry_companion_only')}</Warn>}
      <p className={styles.lead}>{t('meshcore.config.telemetry_hint')}</p>
      <SettingGroup>
        {ROWS.map((r) => (
          <SettingRow
            key={r.key}
            id={r.id}
            label={t(r.labelKey)}
            was={draft[r.key] !== undefined && draft[r.key] !== saved(r.key) ? t(`meshcore.config.telemetry_mode.${saved(r.key)}`) : undefined}
          >
            <SettingSelect value={value(r.key)} options={options} readOnly={off} onChange={(v) => setDraft((p) => ({ ...p, [r.key]: v as TelemetryMode }))} />
          </SettingRow>
        ))}
      </SettingGroup>
      <McDock
        changes={changed.map((r) => t(r.labelKey))}
        page={t('meshcore.config.telemetry')}
        sends={t('workspace.meshcore.settings.sends_telemetry')}
        saveLabel={t('meshcore.config.save_telemetry')}
        saving={saving}
        blocked={off}
        error={failed ? t('workspace.meshcore.settings.save_failed') : null}
        onSave={() => void save()}
        onDiscard={() => {
          setDraft({});
          setFailed(false);
        }}
      />
    </McPage>
  );
}
