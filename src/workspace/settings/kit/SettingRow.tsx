/**
 * One setting (board b-set-d1's row pattern): label and help on the left, the
 * control on the right; stacked on phone, at least 52 px tall. The row names
 * its control (`useSettingRow`) and registers with the field registry so
 * settings search (Task 5.4) can find it and scroll to `data-setting-id`.
 */
import { useId, type ReactNode } from 'react';
import { useIsPhone } from '../../shell/useIsPhone';
import { SettingRowContext, useRegisterField, useSettingsCategory } from './useFieldRegistry';
import styles from './kit.module.css';

export interface SettingRowProps {
  id: string;
  label: string;
  help?: ReactNode;
  children: ReactNode;
  keywords?: string[];
}

const NO_KEYWORDS: string[] = [];

export default function SettingRow({ id, label, help, children, keywords = NO_KEYWORDS }: SettingRowProps) {
  const category = useSettingsCategory();
  const isPhone = useIsPhone();
  const inputId = useId();
  const helpId = help ? `${inputId}-help` : undefined;
  useRegisterField({ id, label, keywords, categoryId: category?.categoryId ?? '' });
  return (
    <SettingRowContext.Provider value={{ inputId, label, helpId }}>
      <div className={styles.row} data-setting-id={id} data-phone={isPhone || undefined}>
        <div className={styles.text}>
          <label className={styles.label} htmlFor={inputId}>{label}</label>
          {help && <p className={styles.help} id={helpId}>{help}</p>}
        </div>
        <div className={styles.control}>{children}</div>
      </div>
    </SettingRowContext.Provider>
  );
}
