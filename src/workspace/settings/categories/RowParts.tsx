/** The parts of a device or module page that are not a plain row (Task 5.6): a warning line, the firmware lock, a password field. */
import type { ReactNode } from 'react';
import { UiIcon } from '../../../components/icons';
import { PasswordField } from '../../../components/shared/config/PasswordField';
import { SettingsCategoryContext, useReadOnly, useSettingRow, useSettingsCategory } from '../kit/useFieldRegistry';
import styles from './SettingsPages.module.css';

/** A warning or note line inside a row's help. */
export function Warn({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'danger' | 'note' }) {
  return (
    <span className={tone === 'note' ? styles.block : styles[tone]} role={tone === 'note' ? undefined : 'note'}>
      {tone !== 'note' && <UiIcon name="alert" size={16} />}
      <span>{children}</span>
    </span>
  );
}

/**
 * Today's notice when the firmware cannot take a module's settings (left out
 * of the build, or too old): the rows stay on screen, view only.
 */
export function Locked({ locked, notice, children }: { locked: boolean; notice: ReactNode; children: ReactNode }) {
  const category = useSettingsCategory();
  if (!locked) return <>{children}</>;
  return (
    <>
      <p className={styles.note} role="status">
        <UiIcon name="alert" size={16} />
        <span>{notice}</span>
      </p>
      <SettingsCategoryContext.Provider value={{ categoryId: category?.categoryId ?? '', readOnly: true }}>{children}</SettingsCategoryContext.Provider>
    </>
  );
}

/** A secret text setting (Wi-Fi password): today's PasswordField with its show/hide toggle. */
export function SettingPassword({ value, onChange, maxLength }: { value: string; onChange(v: string): void; maxLength?: number }) {
  const row = useSettingRow();
  return (
    <PasswordField
      id={row?.inputId}
      aria-describedby={row?.helpId}
      className={styles.keyInput}
      value={value}
      maxLength={maxLength}
      placeholder="••••••••"
      disabled={useReadOnly()}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
