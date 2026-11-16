/**
 * A short choice drawn as one row of buttons (a radio group): Firmware's
 * release channel (12-09) and Reliable PKI's mode (12-12). Named by its row,
 * or by `label` outside one. On phone each segment is at least 44 px and the
 * group takes the row's width.
 */
import { useReadOnly, useSettingRow } from './useFieldRegistry';
import { useIsPhone } from '../../shell/useIsPhone';
import styles from './kit.module.css';

export interface SettingSegmentedProps {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange(value: string): void;
  readOnly?: boolean;
  /** The group's name where no row names it. */
  label?: string;
}

export default function SettingSegmented({ value, options, onChange, readOnly, label }: SettingSegmentedProps) {
  const row = useSettingRow();
  const off = useReadOnly(readOnly);
  const isPhone = useIsPhone();
  return (
    <span
      className={styles.segmented}
      role="radiogroup"
      aria-label={label ?? row?.label}
      aria-describedby={row?.helpId}
      data-phone={isPhone || undefined}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={styles.segment}
          disabled={off}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
