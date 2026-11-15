/** A Map Analysis layer's lookback, as today's toolbar row draws it (ToolbarMenuItem). */
import styles from './LookbackSelect.module.css';

/** Today's lookback select (ToolbarMenuItem's): "Last" for none, else hours. */
export default function LookbackSelect({ label, value, options, disabled, onChange }: {
  label: string;
  value: number | null;
  options: Array<number | null>;
  disabled?: boolean;
  onChange(hours: number | null): void;
}) {
  return (
    <select
      className={styles.lookback}
      value={value === null ? 'last' : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === 'last' ? null : Number(e.target.value))}
      aria-label={`${label} lookback`}
    >
      {options.map((h) => (
        <option key={h ?? 'last'} value={h === null ? 'last' : String(h)}>
          {h === null ? 'Last' : `${h}h`}
        </option>
      ))}
    </select>
  );
}

