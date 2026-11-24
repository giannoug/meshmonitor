/**
 * ToastHost (boards 17-03 / 17-10): today's toast queue (`useToast`, the same
 * `useToastQueue` ToastProvider runs, with today's timeouts) drawn for the
 * Workspace: bottom right on desktop, above the tab bar on the phone, each
 * toast with its kind's colour bar and icon and a close button. It is the
 * Workspace's ToastProvider, so there is one queue, never two.
 */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { ToastContext } from '../../components/ToastContainer';
import { useToastQueue, useToastTimeout, type QueuedToast } from '../../components/toastQueue';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './ToastHost.module.css';

const ICONS: Record<QueuedToast['type'], UiIconName> = { success: 'check', error: 'alert', warning: 'alert', info: 'info' };

export default function ToastHost({ children }: { children: ReactNode }) {
  const { toasts, showToast, removeToast } = useToastQueue();
  const isPhone = useIsPhone();
  return (
    <ToastContext.Provider value={{ showToast, toasts }}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div className={styles.host} data-phone={isPhone || undefined}>
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: QueuedToast; onClose(id: string): void }) {
  const { t } = useTranslation();
  useToastTimeout(toast.id, toast.duration ?? 5000, onClose);
  return (
    <div className={styles.toast} data-type={toast.type} role={toast.type === 'error' ? 'alert' : 'status'}>
      <span className={styles.icon}>
        <UiIcon name={ICONS[toast.type]} size={18} />
      </span>
      <span className={styles.message}>{toast.message}</span>
      <button type="button" className={styles.close} onClick={() => onClose(toast.id)} aria-label={t('workspace.toast.close')}>
        <UiIcon name="close" size={16} />
      </button>
    </div>
  );
}
