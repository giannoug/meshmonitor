/** A text setting, named by its row. */
import { useReadOnly, useSettingRow } from './useFieldRegistry';
import styles from './kit.module.css';

export interface SettingTextProps {
  value: string;
  onChange(value: string): void;
  readOnly?: boolean;
}

export default function SettingText({ value, onChange, readOnly }: SettingTextProps) {
  const row = useSettingRow();
  return (
    <input
      type="text"
      className={styles.input}
      id={row?.inputId}
      aria-describedby={row?.helpId}
      value={value}
      disabled={useReadOnly(readOnly)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
