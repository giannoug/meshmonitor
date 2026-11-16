/**
 * Security (boards 12-04 desktop, 12-17 phone; the confirms 12-26, 18-07 /
 * 18-08 are the frame's, securitySaveGuard.tsx): today's Security section on
 * the row kit, with today's labels and checks.
 *
 * - Keys: the public key with Copy; the private key masked, where Show and
 *   Copy ask first (Copy with today's words); Set private key opens today's
 *   paste field, with its warning and format check.
 * - Admin: up to three admin keys, each checked as base64 as today.
 * - Access and protection: the four switches and Protection Level, off with
 *   today's reason below firmware 2.8.0 or while the node's level is unknown.
 *
 * Every edit queues in the radio save bar; the confirms run before the write.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { isValidBase64, isValidMeshtasticKey, normalizeMeshtasticKey } from '../../../utils/meshtasticKeyFormat';
import { parseFirmwareVersion } from '../../../utils/firmwareVersion';
import {
  PACKET_SIGNATURE_POLICIES,
  PACKET_SIGNATURE_POLICY_MIN_FIRMWARE_LABEL,
  PacketSignaturePolicy,
  isPacketSignaturePolicy,
  supportsPacketSignaturePolicy,
} from '../../../utils/packetSignaturePolicy';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import StateView from '../../patterns/StateView';
import SettingGroup from '../kit/SettingGroup';
import SettingRow from '../kit/SettingRow';
import SettingSelect from '../kit/SettingSelect';
import SettingText from '../kit/SettingText';
import SettingToggle from '../kit/SettingToggle';
import { useReadOnly } from '../kit/useFieldRegistry';
import { POLICY_OPTION_KEYS } from '../radioSections';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import { useRadioSaveQueue } from '../useRadioSaveQueue';
import type { CategoryProps } from '../categories';
import { useWas } from './useWas';
import styles from './SettingsPages.module.css';

const MAX_ADMIN_KEYS = 3;
const DESCRIPTION_KEYS: Record<number, string> = {
  [PacketSignaturePolicy.COMPATIBLE]: 'signature_policy.description_compatible',
  [PacketSignaturePolicy.BALANCED]: 'signature_policy.description_balanced',
  [PacketSignaturePolicy.STRICT]: 'signature_policy.description_strict',
};

export default function SecurityCategory({ sourceId, target }: CategoryProps) {
  const { t } = useTranslation();
  const config = useSharedDeviceConfig();
  const base = useRadioSaveQueue()?.baseline('security');
  const was = useWas('security');
  const readOnly = useReadOnly();
  const [ask, setAsk] = useState<'show' | 'copy' | null>(null);
  const [shown, setShown] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  if (!config || config.state.loading) return <StateView kind="loading" />;
  const s = config.state;
  const savedKey = String(base?.securityPrivateKey ?? s.securityPrivateKey);
  const copy = (text: string) => void navigator.clipboard?.writeText(text);

  // The paste field holds what was typed; the state takes it only once there is something, so an empty box is never a change.
  const typeKey = (value: string) => {
    setKeyDraft(value);
    s.setSecurityPrivateKey(value.trim() ? value : savedKey);
  };
  const stopEditingKey = () => {
    s.setSecurityPrivateKey(savedKey);
    setKeyDraft('');
    setEditingKey(false);
  };
  const typed = normalizeMeshtasticKey(keyDraft);
  const keyChanged = typed !== '' && typed !== normalizeMeshtasticKey(savedKey);
  // Saved (the saved key is now the typed one) or put back by Discard: the field closes.
  if (editingKey && typed !== '' && (!keyChanged || normalizeMeshtasticKey(s.securityPrivateKey) !== typed)) {
    setEditingKey(false);
    setKeyDraft('');
  }

  const setAdminKey = (index: number, value: string) => s.setSecurityAdminKeys(s.securityAdminKeys.map((k, i) => (i === index ? value : k)));

  // Protection Level: today's picker never guesses (PacketSignaturePolicyPicker).
  const firmware = s.localFirmwareVersion;
  let reason: string | null = null;
  if (parseFirmwareVersion(firmware) === null) {
    reason = t('signature_policy.reason_firmware_unknown', { version: PACKET_SIGNATURE_POLICY_MIN_FIRMWARE_LABEL });
  } else if (!supportsPacketSignaturePolicy(firmware)) {
    reason = t('signature_policy.reason_firmware_too_old', { version: PACKET_SIGNATURE_POLICY_MIN_FIRMWARE_LABEL, current: firmware });
  } else if (!isPacketSignaturePolicy(s.securityLoadedSignaturePolicy)) {
    reason = t('signature_policy.reason_policy_unknown');
  }
  const level = reason === null && isPacketSignaturePolicy(s.securitySignaturePolicy) ? s.securitySignaturePolicy : null;

  return (
    <>
      {/* A remote node's keypair never crosses the mesh: the server keeps the node's own (#4736), as Admin Commands. */}
      {target.kind === 'local' && (
        <SettingGroup title={t('workspace.settings.security.keys')}>
          <SettingRow id="security.publicKey" label={t('security_config.public_key')} help={t('security_config.public_key_description')}>
            <span className={styles.inline}>
              <code className={styles.keyBox}>{s.securityPublicKey || t('common.na')}</code>
              {s.securityPublicKey && (
                <button type="button" className={styles.button} onClick={() => copy(s.securityPublicKey)}>
                  <UiIcon name="copy" size={16} /> {t('common.copy')}
                </button>
            )}
          </span>
        </SettingRow>
        <SettingRow
          id="security.privateKey"
          label={t('security_config.private_key')}
          help={
            <>
              {t('security_config.private_key_description')}
              <span className={styles.warn}>
                <UiIcon name="alert" size={14} /> {editingKey ? t('security_config.set_private_key_warning') : t('security_config.private_key_warning')}
              </span>
              {editingKey && keyChanged && !isValidMeshtasticKey(keyDraft) && (
                <span className={styles.error} role="alert">{t('security_config.private_key_invalid')}</span>
              )}
            </>
          }
          was={was('securityPrivateKey')}
        >
          {editingKey ? (
            <span className={styles.inline}>
              <SettingText value={keyDraft} onChange={typeKey} placeholder={t('security_config.private_key_paste_placeholder')} mono />
              <button type="button" className={styles.button} onClick={stopEditingKey}>{t('common.cancel')}</button>
            </span>
          ) : (
            <span className={styles.inline}>
              <code className={styles.keyBox}>{s.securityPrivateKey ? (shown ? s.securityPrivateKey : '••••••••••••') : t('common.na')}</code>
              {s.securityPrivateKey && (
                <>
                  <button type="button" className={styles.button} disabled={readOnly} onClick={() => (shown ? setShown(false) : setAsk('show'))}>
                    <UiIcon name={shown ? 'visibilityOff' : 'visibility'} size={16} /> {t(shown ? 'channel_key.hide' : 'channel_key.show')}
                  </button>
                  <button type="button" className={styles.button} disabled={readOnly} onClick={() => setAsk('copy')}>
                    <UiIcon name="copy" size={16} /> {t('common.copy')}
                  </button>
                </>
              )}
            </span>
          )}
        </SettingRow>
        {!editingKey && (
          <div className={styles.infoRow}>
            <span className={styles.infoText}>
              <span className={styles.infoLabel}>{t('security_config.set_private_key')}</span>
              <span className={styles.infoHelp}>{t('workspace.settings.security.set_key_help')}</span>
            </span>
            <button type="button" className={styles.button} disabled={readOnly} onClick={() => { setShown(false); setEditingKey(true); }}>
              <UiIcon name="edit" size={16} /> {t('security_config.set_private_key')}
            </button>
          </div>
        )}
      </SettingGroup>
      )}

      <SettingGroup title={t('workspace.settings.security.admin')}>
        <div className={styles.infoRow}>
          <span className={styles.infoText}>
            <span className={styles.infoLabel}>{t('security_config.admin_keys')}</span>
            <span className={styles.infoHelp}>
              {t('security_config.admin_keys_description')} {t('security_config.admin_keys_note', { count: s.securityAdminKeys.length, max: MAX_ADMIN_KEYS })}
            </span>
            {was('securityAdminKeys') !== undefined && <span className={styles.wasTag}>{t('workspace.settings.was', { value: was('securityAdminKeys') })}</span>}
          </span>
          {s.securityAdminKeys.length < MAX_ADMIN_KEYS && (
            <button type="button" className={styles.button} disabled={readOnly} onClick={() => s.setSecurityAdminKeys([...s.securityAdminKeys, ''])}>
              <UiIcon name="plus" size={16} /> {t('security_config.add_admin_key')}
            </button>
          )}
        </div>
        {s.securityAdminKeys.map((key, i) => {
          const invalid = !!key.trim() && !isValidBase64(key);
          return (
            <div key={i} className={styles.keyRow}>
              <input
                className={styles.keyInput}
                value={key}
                onChange={(e) => setAdminKey(i, e.target.value)}
                placeholder={t('security_config.admin_key_placeholder')}
                aria-label={`${t('security_config.admin_keys')} ${i + 1}`}
                aria-invalid={invalid || undefined}
                disabled={readOnly}
                spellCheck={false}
              />
              {s.securityAdminKeys.length > 1 && (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`${t('common.remove')} ${i + 1}`}
                  disabled={readOnly}
                  onClick={() => s.setSecurityAdminKeys(s.securityAdminKeys.filter((_, j) => j !== i))}
                >
                  <UiIcon name="close" size={18} />
                </button>
              )}
              {invalid && <span className={styles.error} role="alert">{t('security_config.invalid_base64')}</span>}
            </div>
          );
        })}
      </SettingGroup>

      <SettingGroup title={t('workspace.settings.security.access')}>
        <SettingRow id="security.isManaged" label={t('security_config.is_managed')} help={t('security_config.is_managed_description')} was={was('securityIsManaged')}>
          <SettingToggle checked={s.securityIsManaged} onChange={s.setSecurityIsManaged} />
        </SettingRow>
        <SettingRow id="security.serialEnabled" label={t('security_config.serial_enabled')} help={t('security_config.serial_enabled_description')} was={was('securitySerialEnabled')}>
          <SettingToggle checked={s.securitySerialEnabled} onChange={s.setSecuritySerialEnabled} />
        </SettingRow>
        <SettingRow
          id="security.debugLogApi"
          label={t('security_config.debug_log_api_enabled')}
          help={t('security_config.debug_log_api_enabled_description')}
          was={was('securityDebugLogApiEnabled')}
        >
          <SettingToggle checked={s.securityDebugLogApiEnabled} onChange={s.setSecurityDebugLogApiEnabled} />
        </SettingRow>
        <SettingRow
          id="security.adminChannel"
          label={t('security_config.admin_channel_enabled')}
          help={t('security_config.admin_channel_enabled_description')}
          was={was('securityAdminChannelEnabled')}
        >
          <SettingToggle checked={s.securityAdminChannelEnabled} onChange={s.setSecurityAdminChannelEnabled} />
        </SettingRow>
        <SettingRow
          id="security.signaturePolicy"
          label={t('signature_policy.label')}
          help={
            <>
              {t('signature_policy.description')}
              <span className={styles.block}>{reason ?? (level !== null ? t(DESCRIPTION_KEYS[level]) : '')}</span>
              {level === PacketSignaturePolicy.BALANCED && <span className={styles.warn}><UiIcon name="alert" size={14} /> {t('signature_policy.balanced_warning')}</span>}
              {level === PacketSignaturePolicy.STRICT && (
                <span className={styles.danger} role="alert"><UiIcon name="securityAlert" size={14} /> {t('signature_policy.strict_warning_title')}</span>
              )}
              {reason === null && <span className={styles.block}>{t('signature_policy.reboot_note')}</span>}
            </>
          }
          was={was('securitySignaturePolicy')}
        >
          <SettingSelect
            value={level === null ? '' : String(level)}
            readOnly={reason !== null || readOnly}
            onChange={(v) => v !== '' && s.setSecuritySignaturePolicy(Number(v))}
            options={[
              ...(level === null ? [{ value: '', label: t('signature_policy.option_unknown'), disabled: true }] : []),
              ...PACKET_SIGNATURE_POLICIES.map((p) => ({ value: String(p), label: t(POLICY_OPTION_KEYS[p]) })),
            ]}
          />
        </SettingRow>
      </SettingGroup>

      <p className={styles.note}>
        <UiIcon name="info" size={16} />
        <span>
          {t('workspace.settings.security.pki_dm')}{' '}
          <Link to={`/source/${encodeURIComponent(sourceId)}/settings/pki-dm`} className={styles.link}>
            {t('workspace.settings.security.pki_dm_link')}
          </Link>
        </span>
      </p>

      <ConfirmSheet
        open={ask !== null}
        title={t(ask === 'copy' ? 'workspace.settings.security.copy_key_title' : 'workspace.settings.security.show_key_title')}
        body={ask === 'copy' ? t('security_config.copy_private_key_confirm') : t('security_config.private_key_warning')}
        confirmLabel={t(ask === 'copy' ? 'common.copy' : 'channel_key.show')}
        onConfirm={() => {
          if (ask === 'copy') copy(s.securityPrivateKey);
          else setShown(true);
          setAsk(null);
        }}
        onCancel={() => setAsk(null)}
      />
    </>
  );
}
