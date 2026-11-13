/**
 * ConfirmSheet (spec §5.7): the one destructive-action confirm. A `Sheet`
 * (right-docked on desktop, bottom on phone). With `confirmWord` the confirm
 * stays disabled until it is typed, case-sensitive and trimmed, as
 * `TypedConfirmDialog` (`typed_confirm.prompt` is its label).
 */
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Sheet from './Sheet';
import styles from './ConfirmSheet.module.css';

export interface ConfirmSheetProps {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  consequences?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  confirmWord?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm(): void | Promise<void>;
  onCancel(): void;
}

export default function ConfirmSheet(props: ConfirmSheetProps) {
  return props.open ? <OpenConfirm {...props} /> : null;
}

/** Mounted only while open, so the typed word starts empty on every open. */
function OpenConfirm({ title, body, consequences, confirmLabel, cancelLabel, confirmWord, danger, busy, onConfirm, onCancel }: ConfirmSheetProps) {
  const { t } = useTranslation();
  const id = useId();
  const [typed, setTyped] = useState('');
  const needsWord = !!confirmWord?.trim();
  const canConfirm = !busy && (!needsWord || typed.trim() === confirmWord!.trim());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canConfirm) void onConfirm();
  };

  return (
    <Sheet
      open
      onClose={onCancel}
      title={title}
      footer={
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="submit"
            form={id}
            className={danger ? `${styles.confirm} ${styles.danger}` : styles.confirm}
            disabled={!canConfirm}
          >
            {busy && <span className={styles.spinner} data-testid="confirm-spinner" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <form id={id} className={styles.form} onSubmit={submit}>
        {body && <div className={styles.text}>{body}</div>}
        {consequences && consequences.length > 0 && (
          <ul className={styles.consequences}>
            {consequences.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
        {needsWord && (
          <div className={styles.field}>
            <label htmlFor={`${id}-word`} className={styles.label}>{t('typed_confirm.prompt', { word: confirmWord })}</label>
            <input
              id={`${id}-word`}
              className={styles.input}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}
      </form>
    </Sheet>
  );
}
