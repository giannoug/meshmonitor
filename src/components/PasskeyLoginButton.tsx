/**
 * "Sign in with a passkey" button for LoginPage and LoginModal (#5841).
 * Renders nothing without a secure context and WebAuthn (spec §5).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { passkeysSupported } from '../services/passkeyClient';
import { usePasskeySignIn } from './account/useSignIn';
import { UiIcon } from './icons';
import styles from './PasskeyLoginButton.module.css';

interface PasskeyLoginButtonProps {
  disabled?: boolean;
  /** Extra class for the button, e.g. the page's full-width login button class. */
  className?: string;
  /** Called with a message to show, or null to clear the current one. */
  onError: (message: string | null) => void;
}

const PasskeyLoginButton: React.FC<PasskeyLoginButtonProps> = ({ disabled, className, onError }) => {
  const { t } = useTranslation();
  const { busy, signIn: handleClick } = usePasskeySignIn(onError);

  if (!passkeysSupported()) return null;

  return (
    <button
      type="button"
      className={`button button-secondary ${styles.button} ${className ?? ''}`}
      onClick={handleClick}
      disabled={disabled || busy}
    >
      <UiIcon name="key" size={16} />
      <span>{busy ? t('passkey.signing_in') : t('passkey.sign_in')}</span>
    </button>
  );
};

export default PasskeyLoginButton;
