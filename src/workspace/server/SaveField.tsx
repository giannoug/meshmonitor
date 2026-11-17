/**
 * A key or connection field that keeps its own Save (s13n1): typing only
 * stages the value, Save writes it through useAutosaveSetting (one save
 * path), so a half-typed URL or key is never used. Stored trimmed, as
 * today's Save did. `extra` sits between the input and Save (Test).
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReadOnly } from '../settings/kit/useFieldRegistry';
import SettingRow from '../settings/kit/SettingRow';
import { SavedLine } from '../settings/categories/autosave';
import { useAutosaveSetting } from '../settings/useAutosaveSetting';
import pages from '../settings/categories/SettingsPages.module.css';
import styles from './Server.module.css';

export interface SaveFieldProps {
  k: string;
  id: string;
  label: string;
  help?: ReactNode;
  placeholder?: string;
  type?: 'url' | 'text';
  /** Before Save, given the value as typed. */
  extra?(value: string): ReactNode;
  /** Under the row (a test result). */
  below?: ReactNode;
}

export default function SaveField({ k, id, label, help, placeholder, type = 'text', extra, below }: SaveFieldProps) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const [value, set, status] = useAutosaveSetting<string>(k, {
    commit: 'blur',
    parse: (raw) => raw ?? '',
    serialize: (v) => v.trim(),
  });
  return (
    <>
      <SettingRow id={id} label={label} help={help} stacked>
        <div className={styles.fieldLine}>
          <input
            type={type}
            className={pages.keyInput}
            aria-label={label}
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            readOnly={readOnly}
            onChange={(e) => set(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && status.commit()}
          />
          {extra?.(value)}
          <button type="button" className={`${pages.button} ${pages.primary}`} disabled={readOnly} onClick={() => status.commit()}>
            {t('common.save')}
          </button>
        </div>
        <SavedLine status={status} />
      </SettingRow>
      {below}
    </>
  );
}
