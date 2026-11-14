/**
 * The banners above a DM (board 10-01; notes s10n3, s10n4), in today's order
 * and words:
 * - key mismatch: today's KeyMismatchWarning, with Clear (security:write);
 *   the low-entropy / duplicate-key warning takes the same slot;
 * - not in the device database: today's sentence (softer when MeshMonitor can
 *   restore the key), under the board's title;
 * - unmessageable: today's sentence and "Message anyway" (#4153), which the
 *   caller keeps per node. Once on, the banner stays with the button pressed
 *   (the board), where today it goes. Not shown on an MQTT mirror.
 * Clear changes MeshMonitor only; nothing here sends on the mesh.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import KeyMismatchWarning from '../../components/security/KeyMismatchWarning';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { useAuth } from '../../contexts/AuthContext';
import { setNodeFieldInCache, useDeviceNodes } from '../../hooks/useServerData';
import apiService from '../../services/api';
import type { DeviceInfo } from '../../types/device';
import { isDeviceDbWarningMitigatable } from '../../utils/deviceDbWarning';
import styles from './DmBanners.module.css';

export interface DmBannersProps {
  sourceId: string;
  node: DeviceInfo;
  /** Ours to this node, for the key-mismatch severity (today's isMyMessage count). */
  sentDirectMessageCount: number;
  /** null: no unmessageable banner (not flagged, or an MQTT mirror). */
  onMessageAnyway: (() => void) | null;
  /** "Message anyway" is on: the banner stays, its button pressed (board 10-01). */
  messageAnyway: boolean;
}

export default function DmBanners({ sourceId, node, sentDirectMessageCount, onMessageAnyway, messageAnyway }: DmBannersProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const deviceNodeNums = useDeviceNodes();
  const [clearing, setClearing] = useState(false);
  const canClear = hasPermission('security', 'write', { sourceId });

  // Same request and cache patch as MessagesTab's handleClearSecurityWarning.
  const clear = async () => {
    setClearing(true);
    try {
      await apiService.post(`/api/security/nodes/${node.nodeNum}/clear`, { sourceId });
      setNodeFieldInCache(queryClient, sourceId, node.nodeNum, {
        keyIsLowEntropy: false,
        duplicateKeyDetected: false,
        keyMismatchDetected: false,
        keySecurityIssueDetails: undefined,
      });
      showToast(t('messages.security_risk_cleared', 'Security warning cleared'), 'success');
    } catch {
      showToast(t('messages.security_risk_clear_failed', 'Failed to clear security warning'), 'error');
    } finally {
      setClearing(false);
    }
  };
  const clearButton = canClear && (
    <button
      type="button"
      className={styles.action}
      onClick={() => void clear()}
      disabled={clearing}
      title={t('messages.security_risk_clear_title', 'Clear this security warning')}
    >
      {clearing ? t('messages.security_risk_clearing', 'Clearing…') : t('messages.security_risk_clear', 'Clear')}
    </button>
  );

  const otherKeyIssue = !node.keyMismatchDetected && (node.keyIsLowEntropy || node.duplicateKeyDetected || node.keySecurityIssueDetails);
  const notOnDevice = deviceNodeNums.size > 0 && !deviceNodeNums.has(node.nodeNum);
  const mitigatable = isDeviceDbWarningMitigatable(node);

  return (
    <div className={styles.banners}>
      {node.keyMismatchDetected && (
        <KeyMismatchWarning sentDirectMessageCount={sentDirectMessageCount} details={node.keySecurityIssueDetails}>
          {clearButton}
        </KeyMismatchWarning>
      )}
      {otherKeyIssue && (
        <div className={styles.banner} data-tone="danger" role="alert">
          <UiIcon name="alert" size={18} />
          <p className={styles.text}>{t('messages.security_risk')}</p>
          {clearButton}
        </div>
      )}
      {notOnDevice && (
        <div className={styles.banner} data-tone={mitigatable ? 'info' : 'caution'} role="status">
          <UiIcon name="info" size={18} />
          <p className={styles.text}>
            <strong>{t('workspace.chat.not_in_device_db')}</strong>{' '}
            {mitigatable
              ? t('messages.not_in_device_db_key_known', "This node is not in the connected device's database. MeshMonitor will attempt to restore the saved key when you send a direct message.")
              : t('messages.not_in_device_db', 'This node is not in your radio\'s database. Direct messages will fail until the node exchanges keys with your radio. Use "Exchange Node Info" to request key exchange.')}
          </p>
        </div>
      )}
      {onMessageAnyway && (
        <div className={styles.banner} data-tone="warning" role="status">
          <UiIcon name="alert" size={18} />
          <p className={styles.text}>
            {t('messages.unmessageable_banner', 'This node reports itself as unmessageable (router/repeater/sensor) — it cannot receive direct messages.')}
          </p>
          <button
            type="button"
            className={styles.action}
            aria-pressed={messageAnyway}
            disabled={messageAnyway}
            onClick={onMessageAnyway}
            title={t('messages.unmessageable_override_title', 'This flag is self-reported and may be stale or wrong. Try messaging this node anyway.')}
          >
            <UiIcon name="check" size={16} /> {t('messages.unmessageable_override_button', 'Message anyway')}
          </button>
        </div>
      )}
    </div>
  );
}
