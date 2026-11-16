/**
 * Change Password Modal Component
 *
 * Allows users with local authentication to change their password
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useChangePassword } from './account/useChangePassword';
import Modal from './common/Modal';
import { PasswordField } from './shared/config/PasswordField';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * The user signed in with a passkey recovery code (#5841) and must choose a
   * new password: no current-password field, and no way to dismiss it.
   */
  forced?: boolean;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, forced = false }) => {
  const { t } = useTranslation();
  const {
    currentPassword, setCurrentPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword,
    error, success, loading, submit: handleSubmit, close: handleClose, canSubmit,
  } = useChangePassword(forced, onClose);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={forced ? t('change_password.forced_title') : t('change_password.title')}
      closeOnOverlayClick={!forced}
      closeOnEsc={!forced}
      showCloseButton={!forced}
    >
      <form onSubmit={handleSubmit}>
        {forced ? (
          <p className="form-hint">{t('change_password.forced_intro')}</p>
        ) : (
          <div className="form-group">
            <label htmlFor="current-password">{t('change_password.current_password')}</label>
            <PasswordField
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading || success}
              required
              autoComplete="current-password"
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="new-password">{t('change_password.new_password')}</label>
          <PasswordField
            id="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading || success}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <small className="form-hint">{t('change_password.min_length_hint')}</small>
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">{t('change_password.confirm_password')}</label>
          <PasswordField
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading || success}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {t('change_password.success')}
          </div>
        )}

        <div className="modal-actions">
          {!forced && (
            <button
              type="button"
              className="button button-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            type="submit"
            className="button button-primary"
            disabled={!canSubmit}
          >
            {loading ? t('change_password.changing') : t('change_password.title')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
