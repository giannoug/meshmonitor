/**
 * The In MeshMonitor pages' parts (Task 5.8): rows that save as you go
 * (useAutosaveSetting), each with its Saved / error line, and the inline Save
 * group for the rows whose save re-arms a server timer (mesh checklist 3).
 *
 * Row ids are `<category>.<field>` for settings search. Numbers and text stage
 * while typed and save on blur or Enter (a stepper button saves at once);
 * an invalid number is never sent. Toggles and selects save on change.
 */
import { useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { UiIcon } from '../../../components/icons';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { NumberInputScopeContext, useNumberInputScope } from '../../../components/common/numberInputScopeContext';
import apiService from '../../../services/api';
import StateView from '../../patterns/StateView';
import SettingNumber, { type SettingNumberProps } from '../kit/SettingNumber';
import SettingRow from '../kit/SettingRow';
import SettingSegmented from '../kit/SettingSegmented';
import SettingSelect, { type SettingSelectOption } from '../kit/SettingSelect';
import SettingText from '../kit/SettingText';
import SettingToggle from '../kit/SettingToggle';
import { useReadOnly } from '../kit/useFieldRegistry';
import { useSettingsHeader } from '../settingsDock';
import { serverSettingsKey, useAutosaveSetting, useServerSettings, type AutosaveOptions, type AutosaveStatus, type ServerSettings } from '../useAutosaveSetting';
import { usePageSource } from './autosaveValues';
import pages from './SettingsPages.module.css';
import styles from './Autosave.module.css';

/**
 * An In MeshMonitor page: "saves as you go" after the scope line (or `scope`),
 * the source's settings read once before the rows show, and number fields
 * that answer to this page only (an invalid one never holds the radio Save).
 */
export function AutosavePage({ children, scope, needsSettings = true }: { children: ReactNode; scope?: string | null; needsSettings?: boolean }) {
  const { t } = useTranslation();
  useSettingsHeader(scope === null ? null : { scope: scope ?? t('workspace.settings.saves_as_you_go') });
  // A page with no settings rows (Notifications, Data, PKI DMs) reads nothing here.
  const { isLoading, isError, refetch } = useServerSettings(usePageSource(), needsSettings);
  let body = children;
  if (needsSettings && isLoading) body = <StateView kind="loading" />;
  else if (needsSettings && isError) body = <StateView kind="error" onRetry={() => void refetch()} />;
  return (
    <NumberInputScopeContext.Provider value={null}>
      <div className={styles.page}>{body}</div>
    </NumberInputScopeContext.Provider>
  );
}

/** "Saved", or the save error (today's words) with the row back at the stored value. */
export function SavedLine({ status }: { status: Pick<AutosaveStatus, 'saved' | 'error'> }) {
  const { t } = useTranslation();
  if (status.error) {
    return (
      <span className={styles.error} role="alert">
        <UiIcon name="alert" size={14} />
        {status.error}
      </span>
    );
  }
  if (!status.saved) return null;
  return (
    <span className={styles.saved} role="status">
      <UiIcon name="check" size={14} />
      {t('workspace.settings.saved')}
    </span>
  );
}

/** Saves a staged blur value on blur, Enter or a stepper button; an invalid field is never sent. */
export function CommitOnBlur({ status, children }: { status: AutosaveStatus; children: ReactNode }) {
  const commit = (el: Element) => {
    if (el.querySelector('[aria-invalid="true"]')) return;
    status.commit();
  };
  return (
    <span
      className={styles.commit}
      onBlur={(e: FocusEvent<HTMLSpanElement>) => {
        // Moving between the field and its stepper is not leaving the row.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit(e.currentTarget);
      }}
      onKeyDown={(e: KeyboardEvent<HTMLSpanElement>) => e.key === 'Enter' && commit(e.currentTarget)}
      onClick={(e: MouseEvent<HTMLSpanElement>) => (e.target as Element).closest('button') && commit(e.currentTarget)}
    >
      {children}
    </span>
  );
}

interface RowBase<T> {
  /** The settings key. */
  k: string;
  /** Search id, `<category>.<field>`. */
  id: string;
  label: string;
  help?: ReactNode;
  parse: AutosaveOptions<T>['parse'];
  serialize?: AutosaveOptions<T>['serialize'];
  scoped?: boolean;
  onSaved?(v: T): void;
  /** Off for a reason beyond the page's View only (today's dependent fields). */
  disabled?: boolean;
  /** Rows under it that depend on its value. */
  render?(value: T): ReactNode;
}

const off = (disabled?: boolean) => (disabled ? true : undefined);

export function AutoToggle({ k, id, label, help, disabled, render, ...opts }: RowBase<boolean>) {
  const [value, set, status] = useAutosaveSetting<boolean>(k, { ...opts, sourceId: usePageSource(), commit: 'change' });
  return (
    <>
      <SettingRow id={id} label={label} help={help}>
        <SavedLine status={status} />
        <SettingToggle checked={value} onChange={set} readOnly={off(disabled)} />
      </SettingRow>
      {render?.(value)}
    </>
  );
}

/** A choice saved on change: a select, or with `segmented` one row of buttons (Reliable PKI, 12-12); `stacked` puts a long one under its label (13-01). */
export function AutoSelect({ k, id, label, help, disabled, options, render, segmented, stacked, ...opts }: RowBase<string> & { options: SettingSelectOption[]; segmented?: boolean; stacked?: boolean }) {
  const [value, set, status] = useAutosaveSetting<string>(k, { ...opts, sourceId: usePageSource(), commit: 'change' });
  return (
    <>
      <SettingRow id={id} label={label} help={help} stacked={stacked}>
        <SavedLine status={status} />
        {segmented ? (
          <SettingSegmented value={value} options={options} onChange={set} readOnly={off(disabled)} />
        ) : (
          <SettingSelect value={value} options={options} onChange={set} readOnly={off(disabled)} />
        )}
      </SettingRow>
      {render?.(value)}
    </>
  );
}

export function AutoNumber({ k, id, label, help, disabled, min, max, step, zeroHint, render, ...opts }: RowBase<number> & Pick<SettingNumberProps, 'min' | 'max' | 'step' | 'zeroHint'>) {
  const [value, set, status] = useAutosaveSetting<number>(k, { ...opts, sourceId: usePageSource(), commit: 'blur' });
  return (
    <>
      <SettingRow id={id} label={label} help={help}>
        <SavedLine status={status} />
        <CommitOnBlur status={status}>
          <SettingNumber value={value} onChange={set} min={min} max={max} step={step} zeroHint={zeroHint} readOnly={off(disabled)} />
        </CommitOnBlur>
      </SettingRow>
      {render?.(value)}
    </>
  );
}

export function AutoText({ k, id, label, help, disabled, placeholder, ...opts }: RowBase<string> & { placeholder?: string }) {
  const [value, set, status] = useAutosaveSetting<string>(k, { ...opts, sourceId: usePageSource(), commit: 'blur' });
  return (
    <SettingRow id={id} label={label} help={help}>
      <SavedLine status={status} />
      <CommitOnBlur status={status}>
        <SettingText value={value} onChange={set} placeholder={placeholder} readOnly={off(disabled)} />
      </CommitOnBlur>
    </SettingRow>
  );
}

export interface InlineField {
  k: string;
  id: string;
  label: string;
  help?: ReactNode;
  min: number;
  max: number;
  parse(raw: string | undefined): number;
  onSaved?(v: number): void;
}

/**
 * Number rows that keep a Save of their own: saving them re-arms a server
 * scheduler (mesh checklist 3), so they are never written as you type or
 * leave the field. One POST for the group, through SettingsTab's split.
 */
export function InlineSaveRows({ fields, note }: { fields: InlineField[]; note: ReactNode }) {
  const { t } = useTranslation();
  const sourceId = usePageSource();
  const queryClient = useQueryClient();
  const { data } = useServerSettings(sourceId);
  const readOnly = useReadOnly();
  const numbers = useNumberInputScope();
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ saved: boolean; error?: string }>({ saved: false });
  const stored = (f: InlineField) => f.parse(data?.[f.k]);
  const changed = fields.filter((f) => f.k in draft && draft[f.k] !== stored(f));

  const save = async () => {
    setSaving(true);
    const body = Object.fromEntries(changed.map((f) => [f.k, String(draft[f.k])]));
    try {
      // Every field here is a per-source key (SETTINGS_TAB_PER_SOURCE_KEYS).
      await apiService.post(`/api/settings${sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : ''}`, body);
      queryClient.setQueryData<ServerSettings>(serverSettingsKey(sourceId), (prev) => ({ ...prev, ...body }));
      changed.forEach((f) => f.onSaved?.(draft[f.k]));
      setDraft({});
      setStatus({ saved: true });
    } catch {
      setStatus({ saved: false, error: t('settings.save_failed') });
    } finally {
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: serverSettingsKey(sourceId) });
    }
  };

  return (
    <NumberInputScope scope={numbers}>
      {fields.map((f) => (
        <SettingRow key={f.k} id={f.id} label={f.label} help={f.help}>
          <SettingNumber
            value={draft[f.k] ?? stored(f)}
            min={f.min}
            max={f.max}
            onChange={(v) => {
              setStatus({ saved: false });
              setDraft((d) => ({ ...d, [f.k]: v }));
            }}
          />
        </SettingRow>
      ))}
      <div className={pages.infoRow}>
        <span className={pages.infoText}>
          <span className={pages.infoHelp}>{note}</span>
        </span>
        <SavedLine status={status} />
        <button
          type="button"
          className={`${pages.button} ${pages.primary}`}
          disabled={readOnly || saving || changed.length === 0 || numbers.invalid}
          onClick={() => void save()}
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </NumberInputScope>
  );
}
