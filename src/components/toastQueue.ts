/**
 * The toast queue and its timeout, shared by ToastProvider (Classic) and the
 * Workspace's ToastHost (#6365): one queue, two drawings.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ToastProps } from './Toast';

export type QueuedToast = Omit<ToastProps, 'onClose'>;

export function useToastQueue() {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);

  const showToast = useCallback((message: string, type: ToastProps['type'], duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

/** Closes a toast after `duration` ms. */
export function useToastTimeout(id: string, duration: number, onClose: (id: string) => void) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);
}
