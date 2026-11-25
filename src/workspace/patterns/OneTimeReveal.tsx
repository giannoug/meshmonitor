/**
 * OneTimeReveal (s11n1, call 9): secrets shown exactly once (recovery codes,
 * backup codes, the API token, the two-factor key). The default copy is
 * today's `RecoveryCodesDialog` copy (`passkey_only.*`). With `mustAck`, Done
 * stays disabled until "I saved these codes" is ticked. Without `onDone` the
 * card has no Done (two-factor backup codes stay until Verify). `onCopy`
 * replaces the plain clipboard write with the caller's (today's) helper.
 * The card keeps no copy of the secrets: the caller drops them on close.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './OneTimeReveal.module.css';

export interface OneTimeRevealProps {
  secrets: string[];
  mustAck?: boolean;
  /** Heading beside "Shown once". */
  title?: ReactNode;
  /** Replaces the recovery-codes intro. */
  intro?: ReactNode;
  /** The list's accessible name; default the recovery-codes title. */
  label?: string;
  onCopy?(text: string): void;
  copied?: boolean;
  /** Default "Copy". */
  copyLabel?: string;
  onDownload?(): void;
  onDone?(): void;
  /** Default "Done". */
  doneLabel?: string;
}

export default function OneTimeReveal({ secrets, mustAck, title, intro, label, onCopy, copied: copiedProp, copyLabel, onDownload, onDone, doneLabel }: OneTimeRevealProps) {
  const { t } = useTranslation();
  const [acked, setAcked] = useState(false);
  const [copiedHere, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copied = copiedProp ?? copiedHere;

  const copy = async () => {
    const text = secrets.join('\n');
    if (onCopy) return onCopy(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true); // the codes stay on screen to copy by hand
    }
  };

  return (
    <div className={styles.reveal} data-one-time-reveal="">
      <div className={styles.head}>
        {title && <h3 className={styles.title}>{title}</h3>}
        <p className={styles.once}>{t('workspace.reveal.shown_once')}</p>
      </div>
      <p className={styles.intro}>{intro ?? t('passkey_only.codes_intro')}</p>
      <ol className={styles.secrets} data-single={secrets.length === 1 || undefined} aria-label={label ?? t('passkey_only.codes_title')}>
        {secrets.map((s, i) => <li key={i}><code>{s}</code></li>)}
      </ol>
      <div className={styles.row}>
        <button type="button" className={styles.btn} onClick={copy}>
          {copied ? t('passkey_only.copied') : copyLabel ?? t('passkey_only.copy')}
        </button>
        {onDownload && <button type="button" className={styles.btn} onClick={onDownload}>{t('passkey_only.download')}</button>}
      </div>
      {copyFailed && <p role="alert">{t('workspace.patterns.copy_failed')}</p>}
      {mustAck && (
        <label className={styles.ack}>
          <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
          {t('passkey_only.codes_saved')}
        </label>
      )}
      {onDone && (
        <button type="button" className={`${styles.btn} ${styles.done}`} onClick={onDone} disabled={!!mustAck && !acked}>
          {doneLabel ?? t('common.done')}
        </button>
      )}
    </div>
  );
}
