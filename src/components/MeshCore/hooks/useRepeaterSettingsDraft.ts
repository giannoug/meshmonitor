/**
 * useRepeaterSettingsDraft: the Repeater settings form's draft, save,
 * warnings and import/export (#6255 P9, #6256 P10), moved as is out of
 * RepeaterSettingsForm so the Workspace's remote target (Task 7.3) keeps the
 * draft for the node across its pages and draws its own rows. Ranges, units,
 * Off, version gates and secret rules come from
 * `utils/meshcoreRepeaterSettings.ts`; a save sends only the changed fields,
 * in one request; secrets are write-only.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NumberInputScopeHandle } from '../../common/numberInputScopeContext';
import type {
  RemoteSettingsGroup,
  RepeaterSaveResponse,
  RepeaterSettingsPatch,
  RepeaterSettingsValues,
} from './useMeshCore';
import {
  getRepeaterGates,
  repeaterValuesEqual,
  settingsFor,
  validateRepeaterValue,
  type RepeaterDeviceType,
  type RepeaterMode,
  type RepeaterSettingKey,
  type RepeaterSettingValue,
} from '../../../utils/meshcoreRepeaterSettings';
import { buildExport, parseImport } from '../../../utils/meshcoreRepeaterSettingsExport';
import { estimateLoraAirtimeMs, type LoraParams } from '../../../utils/loraAirtime';

/** An advert is ~125 B on air: 2 header/path, 32 key, 4 time, 64 signature, app data. */
export const ADVERT_BYTES = 125;
/** Repeaters that hear a flood advert and repeat it (the spec's worked example). */
export const FLOOD_REPEATERS = 50;

export type DraftKey = Exclude<keyof RepeaterSettingsValues, 'radio'>;
export type Draft = Partial<Record<DraftKey, RepeaterSettingValue>>;

/** Local (P9) draft: lat/lon, name, TX power and radio live in other sections of the config view. */
const LOCAL_DRAFT_KEYS: DraftKey[] = [
  'advertInterval',
  'floodAdvertInterval',
  'floodMax',
  'repeat',
  'af',
  'rxDelay',
  'txDelay',
  'directTxDelay',
  'allowReadOnly',
];

export function fmtSeconds(ms: number): string {
  const s = ms / 1000;
  return s >= 100 ? String(Math.round(s)) : s.toFixed(s >= 10 ? 0 : 1);
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export interface RepeaterSettingsDraftOptions {
  values: RepeaterSettingsValues;
  firmwareVersion?: string | null;
  radio?: Partial<LoraParams> | null;
  canWrite: boolean;
  disabled?: boolean;
  onSave: (patch: RepeaterSettingsPatch) => Promise<RepeaterSaveResponse | null>;
  onSaved?: (patch: RepeaterSettingsPatch, response: RepeaterSaveResponse) => void;
  mode?: RepeaterMode;
  deviceType?: RepeaterDeviceType;
  loadedGroups?: ReadonlySet<RemoteSettingsGroup>;
  /** The number fields' scope: an invalid one holds Save; Discard resets it. */
  numbers: NumberInputScopeHandle;
}

export function useRepeaterSettingsDraft({
  values,
  firmwareVersion,
  radio,
  canWrite,
  disabled = false,
  onSave,
  onSaved,
  mode = 'local',
  deviceType = 'repeater',
  loadedGroups,
  numbers,
}: RepeaterSettingsDraftOptions) {
  const { t } = useTranslation();
  const gates = useMemo(() => getRepeaterGates(firmwareVersion), [firmwareVersion]);
  const remote = mode === 'remote';
  const offered = useMemo(
    () => new Set<RepeaterSettingKey>(settingsFor({ mode, deviceType }).map((d) => d.key)),
    [mode, deviceType],
  );
  const shows = (key: RepeaterSettingKey) => offered.has(key);
  const draftKeys = useMemo<DraftKey[]>(
    () => remote
      ? settingsFor({ mode: 'remote', deviceType })
          .filter((d) => d.remote === 'rw' && !d.secret)
          .map((d) => d.key as DraftKey)
      : LOCAL_DRAFT_KEYS,
    [remote, deviceType],
  );
  const groupRead = (g: RemoteSettingsGroup) => !remote || (loadedGroups?.has(g) ?? false);

  const baseline = useMemo<Draft>(() => {
    const d: Draft = {};
    for (const k of draftKeys) {
      const v = values[k];
      if (v !== undefined) d[k] = v;
    }
    return d;
    // The parent re-reads after a save; key on the content, not the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6255 content key
  }, [JSON.stringify(values), draftKeys]);

  const [draft, setDraft] = useState<Draft>(baseline);
  const [adminPassword, setAdminPassword] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [clearGuest, setClearGuest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<RepeaterSaveResponse['results'] | null>(null);
  const [drifted, setDrifted] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const [includeIdentity, setIncludeIdentity] = useState(false);
  const [importNotes, setImportNotes] = useState<{ key: string; reason: string }[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(baseline);
  }, [baseline]);

  const setField = (key: DraftKey, value: RepeaterSettingValue) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const radioParams: LoraParams | null =
    radio && typeof radio.sf === 'number' && typeof radio.bw === 'number' && typeof radio.cr === 'number'
      ? { sf: radio.sf, bw: radio.bw, cr: radio.cr }
      : null;
  const advertMs = radioParams ? estimateLoraAirtimeMs(ADVERT_BYTES, radioParams) : NaN;
  const advertKnown = Number.isFinite(advertMs);

  // What differs from the repeater now. Secrets join below.
  const changed: RepeaterSettingsPatch = {};
  for (const k of draftKeys) {
    const now = draft[k];
    const was = baseline[k];
    if (now === undefined || was === undefined) continue;
    if (!repeaterValuesEqual(k, now, was)) (changed as Record<string, RepeaterSettingValue>)[k] = now;
  }
  const adminCheck = adminPassword === '' || !shows('adminPassword') ? null : validateRepeaterValue('adminPassword', adminPassword, gates);
  const guestValue = clearGuest ? '' : guestPassword;
  const guestCheck = (guestValue === '' && !clearGuest) || !groupRead('access') ? null : validateRepeaterValue('guestPassword', guestValue, gates);
  if (adminCheck?.ok) changed.adminPassword = adminPassword;
  if (guestCheck?.ok) changed.guestPassword = guestValue;
  const nameCheck = remote && typeof draft.name === 'string' && baseline.name !== undefined && draft.name !== baseline.name
    ? validateRepeaterValue('name', draft.name, gates)
    : null;
  const secretInvalid = adminCheck?.ok === false || guestCheck?.ok === false || nameCheck?.ok === false;
  const changedCount = Object.keys(changed).length;
  const locked = disabled || !canWrite || saving;

  const handleSave = async () => {
    if (changedCount === 0 || numbers.invalid || secretInvalid) return;
    // Normalise (odd advert minutes floor to even) before sending, as the server does.
    const patch: RepeaterSettingsPatch = {};
    for (const [k, v] of Object.entries(changed)) {
      const r = validateRepeaterValue(k as RepeaterSettingKey, v, gates);
      if (r.ok) (patch as Record<string, RepeaterSettingValue>)[k] = r.value;
    }
    setSaving(true);
    setResults(null);
    setDrifted(false);
    setRequestFailed(false);
    try {
      const response = await onSave(patch);
      if (!response) {
        setRequestFailed(true);
        return;
      }
      setResults(response.results);
      setDrifted(response.drifted === true);
      const allOk = Object.values(response.results).every((r) => r.ok);
      if (allOk) {
        setAdminPassword('');
        setGuestPassword('');
        setClearGuest(false);
      }
      onSaved?.(patch, response);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft(baseline);
    setAdminPassword('');
    setGuestPassword('');
    setClearGuest(false);
    setResults(null);
    setDrifted(false);
    numbers.reset();
  };

  const advertValue = draft.advertInterval;
  const floodValue = draft.floodAdvertInterval;
  const floodMaxValue = draft.floodMax;
  const afValue = draft.af;

  const airtimeText = (ms: number) =>
    advertKnown
      ? t('meshcore.repeater.airtime_each', '{{bytes}} B, about {{seconds}} s on air with this radio', {
          bytes: ADVERT_BYTES,
          seconds: fmtSeconds(ms),
        })
      : t('meshcore.repeater.airtime_unknown', '{{bytes}} B', { bytes: ADVERT_BYTES });

  const advertWarning = (() => {
    if (typeof advertValue !== 'number') return null;
    if (advertValue === 0) {
      return t('meshcore.repeater.warn_advert_off', 'Zero-hop adverts are off. Nearby nodes learn this repeater only from its flood adverts.');
    }
    const perDay = 1440 / advertValue;
    return advertKnown
      ? t('meshcore.repeater.warn_advert', {
          each: airtimeText(advertMs),
          perDay: Math.round(perDay),
          secondsPerDay: fmtSeconds(perDay * advertMs),
          defaultValue: 'Each zero-hop advert is {{each}}. It reaches direct neighbours only, about {{perDay}} a day, {{secondsPerDay}} s of airtime a day.',
        })
      : t('meshcore.repeater.warn_advert_plain', {
          perDay: Math.round(perDay),
          defaultValue: 'Each zero-hop advert reaches direct neighbours only, about {{perDay}} a day.',
        });
  })();

  const floodWarning = (() => {
    if (typeof floodValue !== 'number') return null;
    if (floodValue === 0) {
      return t('meshcore.repeater.warn_flood_off', "Flood adverts are off. Nodes beyond direct range won't learn this repeater until they hear it directly.");
    }
    const hops = typeof floodMaxValue === 'number' ? Math.min(floodMaxValue, 8) : 8;
    const txPerDay = Math.round((24 / floodValue) * (FLOOD_REPEATERS + 1));
    return advertKnown
      ? t('meshcore.repeater.warn_flood', {
          each: airtimeText(advertMs),
          hops,
          hours: floodValue,
          repeaters: FLOOD_REPEATERS,
          txPerDay,
          defaultValue: 'Each flood advert is {{each}} and every repeater that hears it repeats it, up to {{hops}} hops. At {{hours}} h on a mesh with {{repeaters}} repeaters that is about {{txPerDay}} transmissions a day.',
        })
      : t('meshcore.repeater.warn_flood_plain', {
          hops,
          hours: floodValue,
          repeaters: FLOOD_REPEATERS,
          txPerDay,
          defaultValue: 'Every repeater that hears a flood advert repeats it, up to {{hops}} hops. At {{hours}} h on a mesh with {{repeaters}} repeaters that is about {{txPerDay}} transmissions a day.',
        });
  })();

  const txPowerChanged = typeof draft.txPower === 'number' && baseline.txPower !== undefined && draft.txPower !== baseline.txPower;

  // ---- Export / import (from values already read; secrets never included) ----
  const exportable = Object.keys(baseline).length > 0;
  const handleExport = () => {
    const doc = buildExport(values as Partial<Record<RepeaterSettingKey, RepeaterSettingValue>>, {
      deviceType,
      firmware: firmwareVersion ?? null,
      includeIdentity,
    });
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meshcore-${deviceType}-settings.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleImportFile = async (file: File) => {
    const text = await readFileText(file);
    const parsed = parseImport(text, { deviceType, gates, mode, includeIdentity });
    if (!parsed.ok) {
      setImportError(parsed.error ?? t('meshcore.repeater.import_bad', 'That file is not a settings export.'));
      setImportNotes(null);
      return;
    }
    setImportError(null);
    setDraft((d) => {
      const next: Draft = { ...d };
      for (const [k, v] of Object.entries(parsed.draft)) {
        if ((draftKeys as string[]).includes(k) && v !== undefined) next[k as DraftKey] = v;
      }
      return next;
    });
    setImportNotes(parsed.notes);
  };

  const repeatOff = draft.repeat === false;
  const afLow = typeof afValue === 'number' && afValue < 1;
  const floodMaxLow = typeof floodMaxValue === 'number' && floodMaxValue <= 2;
  const adminHasError = adminCheck?.ok === false;
  const guestHasError = guestCheck?.ok === false;

  return {
    gates,
    remote,
    offered,
    shows,
    draftKeys,
    groupRead,
    baseline,
    draft,
    setDraft,
    adminPassword,
    setAdminPassword,
    guestPassword,
    setGuestPassword,
    clearGuest,
    setClearGuest,
    saving,
    results,
    drifted,
    requestFailed,
    includeIdentity,
    setIncludeIdentity,
    importNotes,
    importError,
    fileInput,
    setField,
    radioParams,
    advertMs,
    advertKnown,
    changed,
    adminCheck,
    guestCheck,
    nameCheck,
    secretInvalid,
    changedCount,
    locked,
    handleSave,
    handleDiscard,
    advertWarning,
    floodWarning,
    txPowerChanged,
    exportable,
    handleExport,
    handleImportFile,
    repeatOff,
    afLow,
    floodMaxLow,
    adminHasError,
    guestHasError,
  };
}
