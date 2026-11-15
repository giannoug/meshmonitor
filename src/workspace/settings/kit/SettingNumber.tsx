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
}

export default function SettingNumber({ value, onChange, min, max, step = 1, readOnly }: SettingNumberProps) {
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
      disabled={off}
      onChange={onChange}
    />
  );
  if (!isPhone) return field;
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
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
