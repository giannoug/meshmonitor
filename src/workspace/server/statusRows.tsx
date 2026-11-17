/**
 * Rows for a setting whose stored value a job's status route reports (Task
 * 6.5: position estimation, auto-enrichment, mesh issues, MeshWars). The row
 * shows the status's value and saves as you go through today's
 * `POST /api/settings` with today's keys (`body`), then reads the status again
 * (Ruling DM). A rejected save shows the server's words. Saving writes only
 * settings keys: no run starts, and the schedulers keep their last run in the
 * database, so no timer re-arms.
 */
import type { ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import SettingNumber from '../settings/kit/SettingNumber';
import SettingRow from '../settings/kit/SettingRow';
import SettingSegmented from '../settings/kit/SettingSegmented';
import SettingSelect, { type SettingSelectOption } from '../settings/kit/SettingSelect';
import SettingText from '../settings/kit/SettingText';
import SettingToggle from '../settings/kit/SettingToggle';
import { CommitOnBlur, SavedLine } from '../settings/categories/autosave';
import { useStatusSetting } from './useStatusSetting';

export interface StatusRowProps<T> {
  /** Search id, `<category>.<field>`. */
  id: string;
  label: string;
  help?: ReactNode;
  value: T;
  /** Today's keys and stored strings for a new value. */
  body(value: T): Record<string, string>;
  /** The status query read again after a save. */
  queryKey: QueryKey;
  /** Off for a reason beyond the page's View only (today's dependent fields). */
  disabled?: boolean;
  /** Text in the row's name, after the label (a source badge). */
  tag?: ReactNode;
  /** Editable even on a View only page: a key today's server saves for this user too. */
  editable?: boolean;
}

const off = (disabled?: boolean, editable?: boolean) => (disabled ? true : editable ? false : undefined);

export function StatusToggle(props: StatusRowProps<boolean>) {
  const [value, set, status] = useStatusSetting(props, 'change');
  return (
    <SettingRow id={props.id} label={props.label} help={props.help}>
      <SavedLine status={status} />
      <SettingToggle checked={value} onChange={set} readOnly={off(props.disabled, props.editable)} />
    </SettingRow>
  );
}

export function StatusSelect(props: StatusRowProps<string> & { options: SettingSelectOption[]; segmented?: boolean }) {
  const [value, set, status] = useStatusSetting(props, 'change');
  return (
    <SettingRow id={props.id} label={props.label} help={props.help}>
      <SavedLine status={status} />
      {props.segmented ? (
        <SettingSegmented value={value} options={props.options} onChange={set} readOnly={off(props.disabled, props.editable)} />
      ) : (
        <SettingSelect value={value} options={props.options} onChange={set} readOnly={off(props.disabled, props.editable)} />
      )}
    </SettingRow>
  );
}

export function StatusNumber(props: StatusRowProps<number> & { min?: number; max?: number; step?: number }) {
  const [value, set, status] = useStatusSetting(props, 'blur');
  return (
    <SettingRow id={props.id} label={props.label} help={props.help}>
      {props.tag}
      <SavedLine status={status} />
      <CommitOnBlur status={status}>
        <SettingNumber value={value} onChange={set} min={props.min} max={props.max} step={props.step} readOnly={off(props.disabled, props.editable)} />
      </CommitOnBlur>
    </SettingRow>
  );
}

export function StatusText(props: StatusRowProps<string> & { placeholder?: string }) {
  const [value, set, status] = useStatusSetting(props, 'blur');
  return (
    <SettingRow id={props.id} label={props.label} help={props.help}>
      <SavedLine status={status} />
      <CommitOnBlur status={status}>
        <SettingText value={value} onChange={set} placeholder={props.placeholder} mono readOnly={off(props.disabled, props.editable)} />
      </CommitOnBlur>
    </SettingRow>
  );
}
