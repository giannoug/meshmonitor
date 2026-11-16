/**
 * A number setting on today's NumberInput, so a blank or out-of-range value
 * never reaches the parent and marks the enclosing NumberInputScope invalid
 * (#5649). On phone it is a stepper: − field +, clamped to the range.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { NumberInput } from '../../../components/common/NumberInput';
import { useIsPhone } from '../../shell/useIsPhone';
import { useReadOnly, useSettingRow } from './useFieldRegistry';
import styles from './kit.module.css';

export interface SettingNumberProps {
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  /** Values outside min–max that are still valid (today's hop limit 0). */
  alsoValid?: readonly number[];
  zeroHint?: string;
}

export default function SettingNumber({ value, onChange, min, max, step = 1, readOnly, alsoValid, zeroHint }: SettingNumberProps) {
  const { t } = useTranslation();
  const row = useSettingRow();
  const off = useReadOnly(readOnly);
  const isPhone = useIsPhone();
  const field = (
    <NumberInput
      className={styles.number}
      id={row?.inputId}
      aria-describedby={row?.helpId}
      value={value}
      min={min}
      max={max}
      step={step}
      integer={Number.isInteger(step)}
      alsoValid={alsoValid}
      zeroHint={zeroHint}
      disabled={off}
      onChange={onChange}
    />
  );
  if (!isPhone) return field;
  // Rounded to the step's places, so 0.1 + 0.2 steps to 0.3, not 0.30000000000000004.
  const [mantissa, exponent] = step.toExponential().split('e');
  const places = Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Number(n.toFixed(places))));
  return (
    <span className={styles.stepper}>
      <button
        type="button"
        className={styles.step}
        aria-label={t('workspace.settings.decrease')}
        disabled={off || (min !== undefined && value <= min)}
        onClick={() => onChange(clamp(value - step))}
      >
        <UiIcon name="minus" size={18} />
      </button>
      {field}
      <button
        type="button"
        className={styles.step}
        aria-label={t('workspace.settings.increase')}
        disabled={off || (max !== undefined && value >= max)}
        onClick={() => onChange(clamp(value + step))}
      >
        <UiIcon name="plus" size={18} />
      </button>
    </span>
  );
}
