/**
 * Key and connection fields that keep their own Save and Test (s13n1, Task
 * 6.5): typing only stages the values, so a half-typed key is never used.
 * Save writes the changed fields, trimmed as today's Save did, in one
 * `POST /api/settings` body; Test (when given) gets the values as typed. A key
 * goes in a request body only, never in a URL. After a save the install's
 * settings are read again, as today's Save invalidated every `settings` query.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { ApiError } from '../../services/api';
import { useReadOnly } from '../settings/kit/useFieldRegistry';
import { useServerSettings } from '../settings/useAutosaveSetting';
import { useSaveSettings } from './settingsWrites';
import pages from '../settings/categories/SettingsPages.module.css';
import styles from './Server.module.css';

export interface KeyField {
  k: string;
  label: string;
  help?: ReactNode;
  placeholder?: string;
  /** A password field, as today's. */
  secret?: boolean;
  /** Today's " *" after the label. */
  required?: boolean;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export default function KeyForm({
  name,
  fields,
  disabled,
  test,
  testLabel,
  result,
  onValues,
}: {
  /** The group's accessible name. */
  name: string;
  fields: KeyField[];
  disabled?: boolean;
  /** Test with the values as typed. */
  test?(values: Record<string, string>): void | Promise<void>;
  testLabel?: string;
  result?: TestResult | null;
  /** The values as typed, on every change (a Test that lives outside the form). */
  onValues?(values: Record<string, string>): void;
}) {
  const { t } = useTranslation();
  const readOnly = useReadOnly(disabled || undefined);
  const { data = {} } = useServerSettings();
  const save = useSaveSettings();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [status, setStatus] = useState<{ saved: boolean; error?: string }>({ saved: false });
  const value = (k: string) => drafts[k] ?? data[k] ?? '';
  const changed = fields.filter((f) => f.k in drafts && drafts[f.k].trim() !== (data[f.k] ?? ''));

  const onSave = async () => {
    setBusy('save');
    try {
      await save(Object.fromEntries(changed.map((f) => [f.k, drafts[f.k].trim()])));
      setDrafts({});
      setStatus({ saved: true });
    } catch (error) {
      setStatus({ saved: false, error: error instanceof ApiError && error.message ? error.message : t('settings.save_failed') });
    } finally {
      setBusy(null);
    }
  };

  const onTest = async () => {
    if (!test) return;
    setBusy('test');
    try {
      await test(Object.fromEntries(fields.map((f) => [f.k, value(f.k)])));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div role="group" aria-label={name} className={styles.form}>
      {fields.map((f) => (
        <label key={f.k} className={styles.field}>
          <span className={pages.infoLabel}>
            {f.label}
            {f.required && <span aria-hidden="true"> *</span>}
          </span>
          {f.help && <span className={pages.infoHelp}>{f.help}</span>}
          <input
            type={f.secret ? 'password' : 'text'}
            className={pages.keyInput}
            aria-label={f.label}
            value={value(f.k)}
            placeholder={f.placeholder}
            autoComplete="off"
            spellCheck={false}
            disabled={readOnly}
            onChange={(e) => {
              setStatus({ saved: false });
              const next = { ...drafts, [f.k]: e.target.value };
              setDrafts(next);
              onValues?.(Object.fromEntries(fields.map((x) => [x.k, next[x.k] ?? data[x.k] ?? ''])));
            }}
          />
        </label>
      ))}
      <div className={styles.formActions}>
        {status.error && (
          <span className={pages.error} role="alert">
            <UiIcon name="alert" size={14} />
            {status.error}
          </span>
        )}
        {status.saved && (
          <span className={pages.infoHelp} role="status">
            {t('workspace.settings.saved')}
          </span>
        )}
        {test && (
          <button type="button" className={pages.button} disabled={busy !== null} onClick={() => void onTest()}>
            {testLabel ?? t('settings.elevation_test', 'Test')}
          </button>
        )}
        <button type="button" className={`${pages.button} ${pages.primary}`} disabled={readOnly || busy !== null || changed.length === 0} onClick={() => void onSave()}>
          {busy === 'save' ? t('common.saving') : t('common.save')}
        </button>
      </div>
      {result && (
        <p className={styles.result} data-ok={result.ok || undefined} role="status">
          <UiIcon name={result.ok ? 'check' : 'error'} size={14} />
          {result.message}
        </p>
      )}
    </div>
  );
}
