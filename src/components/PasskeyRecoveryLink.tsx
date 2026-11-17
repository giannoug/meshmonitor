/**
 * "Lost your passkey? Use a recovery code" on the login page and modal
 * (#5841, D2). Opens a small username + code form. On success the page
 * reloads signed in, and asks for a new password.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecoveryCodeSignIn } from './account/useSignIn';
import styles from './PasskeyRecoveryLink.module.css';

interface PasskeyRecoveryLinkProps {
  disabled?: boolean;
}

const PasskeyRecoveryLink: React.FC<PasskeyRecoveryLinkProps> = ({ disabled }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { username, setUsername, code, setCode, busy, error, submit: handleSubmit, cancel } = useRecoveryCodeSignIn();

  if (!open) {
    return (
      <button type="button" className={styles.link} onClick={() => setOpen(true)} disabled={disabled}>
        {t('passkey_only.lost_passkey')}
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label={t('passkey_only.recover_title')}>
      <p className={styles.intro}>{t('passkey_only.recover_intro')}</p>
      <div className="form-group">
        <label htmlFor="recovery-username">{t('auth.username')}</label>
        <input
          id="recovery-username"
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
          required
          autoFocus
        />
      </div>
      <div className="form-group">
        <label htmlFor="recovery-code">{t('passkey_only.recovery_code')}</label>
        <input
          id="recovery-code"
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          disabled={busy}
          required
        />
      </div>
      {error && <div className="error-message">{error}</div>}
      <div className={styles.actions}>
        <button type="submit" className="button button-primary" disabled={busy || !username || !code}>
          {busy ? t('auth.logging_in') : t('passkey_only.recover_submit')}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            setOpen(false);
            cancel();
          }}
          disabled={busy}
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
};

export default PasskeyRecoveryLink;
