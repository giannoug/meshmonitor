/**
 * Set up two-factor (boards 11-03, 11-10; s11n1), in place of Sign-in &
 * security while `useMfa` is in its setup state: today's three steps.
 *
 * 1. Scan the QR code, or enter the key by hand (a one-time reveal).
 * 2. Save the backup codes: a one-time reveal with today's copy (and its
 *    toast), no Done; the codes stay on screen until Verify.
 * 3. The 6-digit code: Verify turns two-factor on; Cancel drops the setup.
 *
 * The key, QR and codes are in the hook's state only. Verify, Cancel, the
 * back control and leaving the page all drop them.
 */
import { useTranslation } from 'react-i18next';
import type { useMfa } from '../../components/account/useMfa';
import OneTimeReveal from '../patterns/OneTimeReveal';
import YouPageFrame from './YouPageFrame';
import styles from './YouAccount.module.css';

export default function TwoFactorSetup({ mfa }: { mfa: ReturnType<typeof useMfa> }) {
  const { t } = useTranslation();
  const data = mfa.setupData;
  if (!data) return null;
  const back = t('workspace.you.sign_in_security');

  return (
    <YouPageFrame
      title={t('workspace.you.security.setup_title')}
      scope={t('workspace.you.security.setup_scope')}
      crumb={`${back} ›`}
      back={{ label: back, onClick: mfa.cancelSetup }}
    >
      <div className={styles.steps}>
        <section className={styles.step}>
          <h2 className={styles.sectionTitle}>{t('mfa.setup_step1')}</h2>
          <div className={styles.card} data-pad="">
            <p className={styles.sheetText}>{t('mfa.setup_description')}</p>
            <img src={data.qrCodeDataUrl} alt={t('mfa.qr_code')} className={styles.qr} />
            <OneTimeReveal secrets={[data.secret]} intro={t('mfa.manual_entry')} label={t('mfa.manual_entry')} />
          </div>
        </section>

        <section className={styles.step}>
          <h2 className={styles.sectionTitle}>{t('mfa.setup_step2')}</h2>
          <div className={styles.card} data-pad="" data-tone="reveal">
            <OneTimeReveal
              title={t('mfa.backup_codes')}
              intro={t('mfa.backup_codes_warning')}
              label={t('mfa.backup_codes')}
              secrets={data.backupCodes}
              onCopy={mfa.copyBackupCodes}
              copied={mfa.backupCodesCopied}
              copyLabel={t('mfa.backup_codes_copy')}
            />
          </div>
        </section>

        <section className={styles.step}>
          <h2 className={styles.sectionTitle}>{t('mfa.setup_step3')}</h2>
          <form className={`${styles.card} ${styles.form}`} data-pad="" onSubmit={mfa.verifySetup}>
            <p className={styles.sheetText}>{t('mfa.login_prompt')}</p>
            <label className={styles.field}>
              <span className={styles.label}>{t('mfa.verify_code')}</span>
              <input
                className={`${styles.input} ${styles.codeInput}`}
                type="text"
                value={mfa.verifyCode}
                onChange={(e) => mfa.setVerifyCode(e.target.value)}
                placeholder={t('mfa.verify_placeholder')}
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                disabled={mfa.loading}
                required
              />
            </label>
            <span className={styles.actions}>
              <button type="button" className={styles.btn} onClick={mfa.cancelSetup} disabled={mfa.loading}>
                {t('common.cancel')}
              </button>
              <button type="submit" className={styles.btn} data-variant="primary" disabled={mfa.loading || mfa.verifyCode.length < 6}>
                {mfa.loading ? t('common.loading') : t('mfa.verify_button')}
              </button>
            </span>
          </form>
        </section>
      </div>
    </YouPageFrame>
  );
}
