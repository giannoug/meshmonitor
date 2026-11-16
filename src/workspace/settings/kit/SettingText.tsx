/** A text setting, named by its row. */
import { useReadOnly, useSettingRow } from './useFieldRegistry';
import styles from './kit.module.css';

export interface SettingTextProps {
  value: string;
  onChange(value: string): void;
  readOnly?: boolean;
  maxLength?: number;
  placeholder?: string;
  /** Monospace, for keys. */
  mono?: boolean;
}

export default function SettingText({ value, onChange, readOnly, maxLength, placeholder, mono }: SettingTextProps) {
  const row = useSettingRow();
  return (
    <input
      type="text"
      className={mono ? `${styles.input} ${styles.mono}` : styles.input}
      maxLength={maxLength}
      placeholder={placeholder}
      spellCheck={mono ? false : undefined}
      id={row?.inputId}
      aria-describedby={row?.helpId}
      value={value}
      disabled={useReadOnly(readOnly)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
