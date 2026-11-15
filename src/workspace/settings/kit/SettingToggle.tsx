/** An on/off setting: a switch named by its row. */
import { useReadOnly, useSettingRow } from './useFieldRegistry';
import styles from './kit.module.css';

export interface SettingToggleProps {
  checked: boolean;
  onChange(checked: boolean): void;
  readOnly?: boolean;
}

export default function SettingToggle({ checked, onChange, readOnly }: SettingToggleProps) {
  const row = useSettingRow();
  const off = useReadOnly(readOnly);
  return (
    <input
      type="checkbox"
      role="switch"
      className={styles.switch}
      id={row?.inputId}
      aria-describedby={row?.helpId}
      checked={checked}
      disabled={off}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
