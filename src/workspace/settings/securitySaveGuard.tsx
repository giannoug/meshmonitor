/**
 * Security's checks and confirms before its write (Task 5.5, boards 12-04,
 * 12-26 Strict, 18-07 / 18-08 Balanced), run by the radio save queue for
 * every save of the Security section, wherever Save was pressed. They are
 * today's, in today's order (SecurityConfigSection's handleSaveInternal):
 *
 * 1. An admin key that is not base64: today's message, nothing is sent.
 * 2. A new private key: not a valid key → today's message; else today's
 *    confirm (window.confirm there, a ConfirmSheet here).
 * 3. A Protection Level change: Balanced asks plainly with today's body,
 *    Strict types the node's short name (usePolicyChangeConfirm).
 *
 * Declining any of them leaves Security queued and unsent. The guard lives in
 * the frame, so its sheets show over whichever page holds the save bar.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContainer';
import { usePolicyChangeConfirm } from '../../hooks/usePolicyChangeConfirm';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import { isValidBase64, isValidMeshtasticKey, normalizeMeshtasticKey } from '../../utils/meshtasticKeyFormat';
import { PacketSignaturePolicy, policyToSend } from '../../utils/packetSignaturePolicy';
import ConfirmSheet from '../patterns/ConfirmSheet';
import styles from './categories/SettingsPages.module.css';

export function useSecuritySaveGuard(state: DeviceConfigState): { guard: () => Promise<boolean>; sheets: ReactNode } {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { confirmPolicyChange, dialogProps } = usePolicyChangeConfirm();
  const [keyAsk, setKeyAsk] = useState(false);
  const settleKey = useRef<((ok: boolean) => void) | null>(null);

  const askKey = () =>
    new Promise<boolean>((resolve) => {
      settleKey.current = resolve;
      setKeyAsk(true);
    });
  // Leaving the device's settings while the confirm is open counts as a cancel.
  useEffect(() => () => settleKey.current?.(false), []);
  const answerKey = (ok: boolean) => {
    setKeyAsk(false);
    settleKey.current?.(ok);
    settleKey.current = null;
  };

  const guard = async (): Promise<boolean> => {
    if (state.securityAdminKeys.some((key) => key.trim() && !isValidBase64(key))) {
      showToast(t('security_config.fix_invalid_keys'), 'error');
      return false;
    }
    // The same test the save uses to decide whether it sends the key.
    const key = normalizeMeshtasticKey(state.securityPrivateKey);
    if (key.length > 0 && key !== normalizeMeshtasticKey(state.loadedSecurityPrivateKeyRef.current)) {
      if (!isValidMeshtasticKey(key)) {
        showToast(t('security_config.private_key_invalid'), 'error');
        return false;
      }
      if (!(await askKey())) return false;
    }
    if (policyToSend(state.securityLoadedSignaturePolicy, state.securitySignaturePolicy) !== undefined) {
      const label = state.longName || state.shortName;
      return confirmPolicyChange(state.securityLoadedSignaturePolicy, state.securitySignaturePolicy, {
        label,
        shortName: state.shortName,
        fallbackWord: label,
      });
    }
    return true;
  };

  const [keyTitle, ...keyBody] = t('security_config.set_private_key_confirm').split('\n\n');
  const pending = dialogProps.pending;
  const strict = pending?.to === PacketSignaturePolicy.STRICT;
  const node = pending?.nodeLabel ?? '';

  const sheets = (
    <>
      <ConfirmSheet
        open={keyAsk}
        title={keyTitle}
        body={keyBody.map((p) => <p key={p} className={styles.para}>{p}</p>)}
        confirmLabel={t('security_config.set_private_key')}
        danger
        submitOnEnter={false}
        onConfirm={() => answerKey(true)}
        onCancel={() => answerKey(false)}
      />
      <ConfirmSheet
        open={pending !== null}
        title={strict ? t('signature_policy.confirm_strict_title') : t('signature_policy.confirm_balanced_title')}
        body={
          strict ? (
            <>
              <p className={styles.para}>{t('signature_policy.confirm_strict_body', { node })}</p>
              <ul className={styles.list}>
                <li>{t('signature_policy.strict_drops_old_peers')}</li>
                <li>{t('signature_policy.strict_drops_unicasts')}</li>
                <li>{t('signature_policy.strict_drops_large_broadcasts')}</li>
              </ul>
              <p className={styles.para}>{t('signature_policy.confirm_strict_cutoff')}</p>
              <p className={styles.muted}>{t('signature_policy.reboot_note')}</p>
            </>
          ) : (
            <>
              <p className={styles.para}>{t('signature_policy.confirm_balanced_body', { node })}</p>
              <p className={styles.para}>{t('signature_policy.balanced_warning')}</p>
              <p className={styles.muted}>{t('signature_policy.reboot_note')}</p>
            </>
          )
        }
        confirmWord={strict ? pending?.confirmWord : undefined}
        confirmLabel={strict ? t('signature_policy.confirm_strict_button') : t('signature_policy.confirm_balanced_button')}
        danger={strict}
        submitOnEnter={false}
        onConfirm={dialogProps.onConfirm}
        onCancel={dialogProps.onCancel}
      />
    </>
  );
  return { guard, sheets };
}
