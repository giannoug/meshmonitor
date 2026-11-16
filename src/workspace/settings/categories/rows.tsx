/**
 * The row kit bound to one queued section (Task 5.6): each helper draws a
 * setting row for a shared-state value, with today's label key, its
 * `_description` help where en.json has one, and the row's "was …". Row ids
 * are `<prefix>.<state key>`, stable for settings search.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigSaveSection } from '../../../hooks/deviceConfig/useDeviceConfigSaves';
import type { DeviceConfigState } from '../../../hooks/deviceConfig/useDeviceConfigState';
import SettingNumber, { type SettingNumberProps } from '../kit/SettingNumber';
import SettingRow from '../kit/SettingRow';
import SettingSelect from '../kit/SettingSelect';
import SettingText, { type SettingTextProps } from '../kit/SettingText';
import SettingToggle from '../kit/SettingToggle';
import { setterOf } from '../radioSections';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import { useWas } from './useWas';

export type Key = keyof DeviceConfigState;
export type Option = { value: number | string; label: string };
/** An en.json key, or a key with today's inline default where en.json has none. */
export type Label = string | readonly [string, string];

interface RowOpts {
  /** Replaces the `_description` help. */
  help?: ReactNode;
  /** Shown after the help: today's warning or note beside the input. */
  extra?: ReactNode;
  /** The row id's suffix when two rows edit one value; else the state key. */
  id?: string;
}

/** Today's duration hint after a seconds field's help, "(15 minutes)"; `days: false` stops at hours (Display). */
export function useDuration() {
  const { t } = useTranslation();
  return (seconds: number, days = true): string => {
    if (seconds <= 0) return '';
    let text: string;
    if (seconds < 60) text = `${seconds} ${t('common.seconds')}`;
    else if (seconds < 3600) text = `${Math.floor(seconds / 60)} ${t('common.minutes')}`;
    else if (seconds < 86400 || !days) text = `${Math.floor(seconds / 3600)} ${t('common.hours')}`;
    else text = `${Math.floor(seconds / 86400)} ${t('common.days')}`;
    return ` (${text})`;
  };
}

export function useRows(section: ConfigSaveSection, prefix: string) {
  const { t, i18n } = useTranslation();
  const config = useSharedDeviceConfig();
  const was = useWas(section);
  if (!config || config.state.loading) return null;
  const s = config.state;
  const set = (key: Key) => setterOf(s, key) as (v: unknown) => void;
  const tr = (l: Label) => (typeof l === 'string' ? t(l) : t(l[0], l[1]));
  const helpOf = (l: Label, o: RowOpts) => {
    const key = `${typeof l === 'string' ? l : l[0]}_description`;
    const base = o.help !== undefined ? o.help : i18n.exists(key) ? t(key) : undefined;
    return o.extra ? <>{base}{o.extra}</> : base;
  };
  const row = (key: Key, label: Label, control: ReactNode, o: RowOpts) => (
    <SettingRow key={o.id ?? key} id={`${prefix}.${o.id ?? key}`} label={tr(label)} help={helpOf(label, o)} was={was(key)}>
      {control}
    </SettingRow>
  );

  return {
    s,
    t,
    toggle: (key: Key, label: Label, o: RowOpts & { checked?: boolean; onChange?(v: boolean): void } = {}) =>
      row(key, label, <SettingToggle checked={o.checked ?? Boolean(s[key])} onChange={o.onChange ?? set(key)} />, o),
    number: (key: Key, label: Label, o: RowOpts & Omit<SettingNumberProps, 'value' | 'onChange'> = {}) =>
      row(
        key,
        label,
        <SettingNumber value={s[key] as number} onChange={set(key)} min={o.min} max={o.max} step={o.step} alsoValid={o.alsoValid} zeroHint={o.zeroHint} />,
        o,
      ),
    text: (key: Key, label: Label, o: RowOpts & Omit<SettingTextProps, 'value' | 'onChange'> & { onChange?(v: string): void } = {}) =>
      row(
        key,
        label,
        <SettingText value={String(s[key] ?? '')} onChange={o.onChange ?? set(key)} maxLength={o.maxLength} placeholder={o.placeholder} mono={o.mono} />,
        o,
      ),
    /** The picked value keeps the state value's type: text stays text, a number is parsed. */
    select: <K extends Key>(key: K, label: Label, options: readonly Option[], o: RowOpts & { onChange?(v: DeviceConfigState[K]): void } = {}) =>
      row(
        key,
        label,
        <SettingSelect
          value={String(s[key])}
          options={options.map((x) => ({ value: String(x.value), label: x.label }))}
          onChange={(v) => (o.onChange ?? set(key))((typeof s[key] === 'string' ? v : Number(v)) as DeviceConfigState[K])}
        />,
        o,
      ),
  };
}

export type Rows = NonNullable<ReturnType<typeof useRows>>;

/** "NAME - description", as today's selects word their options. */
export const named = (list: ReadonlyArray<{ value: number; name: string; description?: string }>): Option[] =>
  list.map((o) => ({ value: o.value, label: o.description ? `${o.name} - ${o.description}` : o.name }));

export const labelled = (list: ReadonlyArray<{ value: number; label: string }>): Option[] => list.map((o) => ({ value: o.value, label: o.label }));
