/** The kit's switch with its own name, for a list row with no SettingRow around it (Task 6.4). */
import kit from '../settings/kit/kit.module.css';
import styles from './Server.module.css';

export default function RowSwitch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange(v: boolean): void; disabled?: boolean }) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={`${kit.switch} ${styles.rowSwitch}`}
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
