/**
 * One setting (board b-set-d1's row pattern): label and help on the left, the
 * control on the right; stacked on phone, at least 52 px tall. The row names
 * its control (`useSettingRow`) and registers with the field registry so
 * settings search (Task 5.4) can find it and scroll to `data-setting-id`.
 * Opened from a search result (`#setting-<id>`), the row scrolls into view and
 * pulses once; each new visit to that URL pulses again.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsPhone } from '../../shell/useIsPhone';
import { SettingRowContext, settingAnchor, useRegisterField, useSettingsCategory } from './useFieldRegistry';
import styles from './kit.module.css';

export interface SettingRowProps {
  id: string;
  label: string;
  help?: ReactNode;
  children: ReactNode;
  keywords?: string[];
  /** The saved value while this one is an unsaved edit: "was Medium Fast" (b-set-d1). */
  was?: string;
}

const NO_KEYWORDS: string[] = [];

export default function SettingRow({ id, label, help, children, keywords = NO_KEYWORDS, was }: SettingRowProps) {
  const { t } = useTranslation();
  const category = useSettingsCategory();
  const isPhone = useIsPhone();
  const inputId = useId();
  const helpId = help ? `${inputId}-help` : undefined;
  useRegisterField({ id, label, keywords, categoryId: category?.categoryId ?? '' });
  const { hash, key } = useLocation();
  const hit = hash === `#${settingAnchor(id)}`;
  const ref = useRef<HTMLDivElement>(null);
  // The visit whose pulse has run (the CSS animation ended), so a re-render does not replay it.
  const [pulsed, setPulsed] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!hit || !el) return;
    el.scrollIntoView?.({ block: 'center' });
    // A native listener: React maps onAnimationEnd to a prefixed event where AnimationEvent is missing.
    const done = (e: Event) => e.target === el && setPulsed(key);
    el.addEventListener('animationend', done);
    return () => el.removeEventListener('animationend', done);
  }, [hit, key]);
  return (
    <SettingRowContext.Provider value={{ inputId, label, helpId }}>
      <div
        ref={ref}
        className={styles.row}
        data-setting-id={id}
        data-phone={isPhone || undefined}
        data-pulse={(hit && pulsed !== key) || undefined}
      >
        <div className={styles.text}>
          <label className={styles.label} htmlFor={inputId}>{label}</label>
          {was !== undefined && isPhone && <p className={styles.wasLine}>{t('workspace.settings.was', { value: was })}</p>}
          {help && <div className={styles.help} id={helpId}>{help}</div>}
        </div>
        <div className={styles.control}>
          {was !== undefined && !isPhone && <span className={styles.was}>{t('workspace.settings.was', { value: was })}</span>}
          {children}
        </div>
      </div>
    </SettingRowContext.Provider>
  );
}
