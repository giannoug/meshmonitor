/**
 * Device notification toasts, moved out of DeviceNotificationToaster (#6365,
 * Rule X) so the Workspace's DeviceNotices runs the same handler: each
 * `client-notification` from the connected node's socket becomes an 8 s toast,
 * its level mapped to a severity, the recognised unsigned-update notice in the
 * viewer's language. Server policy (clientNotificationPolicy.ts) already drops
 * noisy notices and dedupes recurring ones.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Socket } from 'socket.io-client';
import { useToast } from '../components/ToastContainer';

interface ClientNotificationEvent {
  level: number;
  message: string;
  replyId?: number;
  time?: number;
  /** Set by the server for a notice it recognised (#5944). */
  kind?: 'unsigned_update_ignored';
  nodeNum?: number;
  nodeName?: string | null;
  policy?: 'balanced' | 'strict';
}

// mesh.proto LogRecord.Level. Mirrors NOTIFICATION_LEVEL in the backend
// clientNotificationPolicy.ts — duplicated because the browser bundle can't
// import server code. Keep in sync if the firmware proto enum ever changes.
const LEVEL_WARNING = 30;
const LEVEL_ERROR = 40;

function toastTypeForLevel(level: number): 'error' | 'warning' | 'info' {
  if (level >= LEVEL_ERROR) return 'error';
  if (level >= LEVEL_WARNING) return 'warning';
  return 'info';
}

export function useDeviceNotificationToasts(socket: Socket | null | undefined): void {
  const { t } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    if (!socket) return;

    const handler = (data: ClientNotificationEvent) => {
      if (!data || typeof data.message !== 'string' || data.message.length === 0) return;
      showToast(describe(data), toastTypeForLevel(data.level), 8000);
    };

    // Explain a refused unsigned name/role change (firmware after 2.8.1, #5944)
    // in the viewer's language; anything else shows the firmware's own text.
    const describe = (data: ClientNotificationEvent): string => {
      if (data.kind !== 'unsigned_update_ignored' || typeof data.nodeNum !== 'number') return data.message;
      const id = `!${(data.nodeNum >>> 0).toString(16).padStart(8, '0')}`;
      return t('device_notification.unsigned_update_ignored', {
        node: data.nodeName ? `${data.nodeName} (${id})` : id,
        level: t(data.policy === 'strict' ? 'signature_policy.level_strict' : 'signature_policy.level_balanced'),
      });
    };

    socket.on('client-notification', handler);
    return () => {
      socket.off('client-notification', handler);
    };
  }, [socket, showToast, t]);
}
