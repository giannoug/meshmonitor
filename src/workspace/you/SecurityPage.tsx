/**
 * You › Sign-in & security (boards r1-you-security, s4-security; s11n2–n4).
 * Today's user-menu Change Password, Two-Factor Auth and Passkeys, redrawn on
 * the kit over the same hooks Classic uses (Rule X), so every request,
 * step-up and message is today's:
 *
 * - Password: Change Password (`/you/password`; hidden for password-locked
 *   and passkey-only accounts, as the user menu) and the passkey-only switch
 *   (PasskeyOnlyFlow).
 * - Two-Factor Authentication: set up (TwoFactorSetup, in place of the page)
 *   or turn off with a code or a backup code.
 * - Passkeys (PasskeysPage).
 * - API Token: the one-token summary with Revoke or Generate.
 *
 * An OIDC account sees only the API Token: password, two-factor and passkeys
 * are local-account features (the user menu's `authProvider === 'local'`).
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMfa } from '../../components/account/useMfa';
import { usePasskeys } from '../../components/account/usePasskeys';
import { passkeysSupported } from '../../services/passkeyClient';
import ConfirmSheet from '../patterns/ConfirmSheet';
import { useIsPhone } from '../shell/useIsPhone';
import TwoLineRow from '../patterns/TwoLineRow';
import { UiIcon } from '../../components/icons';
import YouPageFrame, { Section } from './YouPageFrame';
import TwoFactorSetup from './TwoFactorSetup';
import PasskeysPage from './PasskeysPage';
import PasskeyOnlyFlow from './PasskeyOnlyFlow';
import { ApiTokenSection, ApiTokenView } from './ApiTokenPage';
import { useApiToken } from '../../components/account/useApiToken';
import styles from './YouAccount.module.css';

export default function SecurityPage() {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const user = authStatus?.authenticated ? authStatus.user : null;
  const isLocal = user?.authProvider === 'local';
  const title = t('workspace.you.sign_in_security');

  if (!user || !isLocal) {
    return (
      <YouPageFrame title={title} scope={t('workspace.you.security.scope')} back={{ label: t('workspace.tabs.you'), to: '/you' }}>
        {user && (
          <Section title={t('api_token.title')}>
            <ApiTokenSection compact />
          </Section>
        )}
      </YouPageFrame>
    );
  }
  return <LocalSecurity canChangePassword={!user.passwordLocked && !user.passwordLoginDisabled} />;
}

function LocalSecurity({ canChangePassword }: { canChangePassword: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const mfa = useMfa();
  const passkeys = usePasskeys();
  // Here, not in the section: two-factor setup replaces the page, and a token not yet copied must survive it.
  const apiToken = useApiToken();
  const supported = passkeysSupported();
  const title = t('workspace.you.sign_in_security');

  if (mfa.state === 'setup' && mfa.setupData) return <TwoFactorSetup mfa={mfa} />;

  const mfaOn = mfa.state === 'enabled';
  const closeDisable = () => {
    mfa.setShowDisableConfirm(false);
    mfa.setDisableCode('');
  };

  return (
    <YouPageFrame title={title} scope={t('workspace.you.security.scope')} back={{ label: t('workspace.tabs.you'), to: '/you' }}>
      <Section title={t('workspace.you.security.password')}>
        <div className={styles.card}>
          {canChangePassword &&
            (isPhone ? (
              <TwoLineRow
                to="/you/password"
                leading={<span className={styles.tile}><UiIcon name="unlock" size={20} /></span>}
                title={t('user_menu.change_password')}
                trailing={<UiIcon name="chevronRight" size={18} />}
              />
            ) : (
              <div className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t('workspace.you.security.password')}</span>
                </span>
                <span className={styles.actions}>
                  <Link className={styles.btn} to="/you/password">{t('user_menu.change_password')}</Link>
                </span>
              </div>
            ))}
          {passkeys.passkeys !== null && <PasskeyOnlyFlow passkeyCount={passkeys.passkeys.length} supported={supported} />}
        </div>
      </Section>

      <Section title={t('mfa.title')}>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>
                {t('workspace.you.security.authenticator_app')}
                {mfaOn && <span className={styles.badge}>{t('workspace.you.notifications.on')}</span>}
              </span>
              <span className={styles.rowSub}>
                {mfa.state === 'loading' ? t('common.loading') : mfaOn ? t('mfa.status_enabled') : t('mfa.not_enabled')}
              </span>
            </span>
            {mfa.state !== 'loading' && (
              <span className={styles.actions}>
                {mfaOn ? (
                  <button type="button" className={styles.btn} onClick={() => mfa.setShowDisableConfirm(true)}>
                    {t('mfa.disable')}
                  </button>
                ) : (
                  <button type="button" className={styles.btn} data-variant="primary" onClick={() => void mfa.startSetup()} disabled={mfa.loading}>
                    {mfa.loading ? t('common.loading') : t('mfa.enable')}
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
      </Section>

      <Section title={t('passkey.title')}>
        <PasskeysPage passkeys={passkeys} supported={supported} />
      </Section>

      <Section title={t('api_token.title')}>
        <ApiTokenView api={apiToken} compact />
      </Section>

      <ConfirmSheet
        open={mfa.showDisableConfirm}
        title={t('mfa.disable')}
        body={
          <>
            <p className={styles.sheetText}>{t('mfa.disable_confirm')}</p>
            <label className={styles.field}>
              <span className={styles.label}>{mfa.useBackupCodeForDisable ? t('mfa.backup_code_label') : t('mfa.verify_code')}</span>
              <input
                className={styles.input}
                type="text"
                value={mfa.disableCode}
                onChange={(e) => mfa.setDisableCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode={mfa.useBackupCodeForDisable ? 'text' : 'numeric'}
                pattern={mfa.useBackupCodeForDisable ? undefined : '[0-9]*'}
                maxLength={mfa.useBackupCodeForDisable ? 8 : 6}
                disabled={mfa.loading}
                required
              />
            </label>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                mfa.setUseBackupCodeForDisable(!mfa.useBackupCodeForDisable);
                mfa.setDisableCode('');
              }}
            >
              {mfa.useBackupCodeForDisable ? t('mfa.use_totp_code') : t('mfa.use_backup_code')}
            </button>
          </>
        }
        confirmLabel={mfa.loading ? t('common.loading') : t('mfa.disable')}
        danger
        busy={mfa.loading}
        confirmDisabled={!mfa.disableCode}
        submitOnEnter={false}
        onConfirm={() => mfa.disable()}
        onCancel={closeDisable}
      />
    </YouPageFrame>
  );
}
