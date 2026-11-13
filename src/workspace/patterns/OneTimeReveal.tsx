/**
 * OneTimeReveal: secrets shown exactly once (recovery codes, tokens). Copy is
 * today's `RecoveryCodesDialog` copy (`passkey_only.*`). With `mustAck`, Done
 * stays disabled until "I saved these codes" is ticked.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './OneTimeReveal.module.css';

export interface OneTimeRevealProps {
  secrets: string[];
  mustAck?: boolean;
  onDownload?(): void;
  onDone(): void;
}

export default function OneTimeReveal({ secrets, mustAck, onDownload, onDone }: OneTimeRevealProps) {
  const { t } = useTranslation();
  const [acked, setAcked] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secrets.join('\n'));
      setCopied(true);
    } catch { /* clipboard unavailable: the codes stay on screen to copy by hand */ }
  };

  return (
    <div className={styles.reveal}>
      <p className={styles.once}>{t('workspace.reveal.shown_once')}</p>
      <p className={styles.intro}>{t('passkey_only.codes_intro')}</p>
      <ol className={styles.secrets} aria-label={t('passkey_only.codes_title')}>
        {secrets.map((s) => <li key={s}><code>{s}</code></li>)}
      </ol>
      <div className={styles.row}>
        <button type="button" className={styles.btn} onClick={copy}>
          {copied ? t('passkey_only.copied') : t('passkey_only.copy')}
        </button>
        {onDownload && <button type="button" className={styles.btn} onClick={onDownload}>{t('passkey_only.download')}</button>}
      </div>
      {mustAck && (
        <label className={styles.ack}>
          <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
          {t('passkey_only.codes_saved')}
        </label>
      )}
      <button type="button" className={`${styles.btn} ${styles.done}`} onClick={onDone} disabled={!!mustAck && !acked}>
        {t('common.done')}
      </button>
    </div>
  );
}
