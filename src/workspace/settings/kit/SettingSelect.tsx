/**
 * A choice setting. Desktop: a native select named by its row. Phone: the
 * value with a chevron, which opens a bottom sheet of the options titled with
 * the row (b-set-p3); a pick closes it.
 */
import { useState } from 'react';
import { UiIcon } from '../../../components/icons';
import Sheet from '../../patterns/Sheet';
import { useIsPhone } from '../../shell/useIsPhone';
import { useReadOnly, useSettingRow } from './useFieldRegistry';
import styles from './kit.module.css';

export interface SettingSelectOption {
  value: string;
  label: string;
  /** A second line under the option in the phone sheet (b-set-p3). */
  help?: string;
  disabled?: boolean;
}

export interface SettingSelectProps {
  value: string;
  options: SettingSelectOption[];
  onChange(value: string): void;
  readOnly?: boolean;
  /** A line above the options in the phone sheet (b-set-p3). */
  note?: string;
}

export default function SettingSelect({ value, options, onChange, readOnly, note }: SettingSelectProps) {
  const row = useSettingRow();
  const off = useReadOnly(readOnly);
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  if (!isPhone) {
    return (
      <select
        className={styles.select}
        id={row?.inputId}
        aria-describedby={row?.helpId}
        value={value}
        disabled={off}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <>
      <button
        type="button"
        className={styles.selectButton}
        id={row?.inputId}
        aria-describedby={row?.helpId}
        aria-haspopup="dialog"
        disabled={off}
        onClick={() => setOpen(true)}
      >
        <span className={styles.selectValue}>{current?.label ?? value}</span>
        <UiIcon name="chevronRight" size={18} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={row?.label ?? ''} side="bottom">
        {note && <p className={styles.sheetNote}>{note}</p>}
        <div role="radiogroup" aria-label={row?.label} className={styles.options}>
          {options.map((o) => (
            <label key={o.value} className={styles.option}>
              <input
                type="radio"
                className={styles.radio}
                name={row?.inputId}
                checked={o.value === value}
                disabled={o.disabled}
                onChange={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              />
              <span className={styles.optionText}>
                <span>{o.label}</span>
                {o.help && <span className={styles.optionHelp}>{o.help}</span>}
              </span>
            </label>
          ))}
        </div>
      </Sheet>
    </>
  );
}
