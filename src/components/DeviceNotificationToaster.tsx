/**
 * DeviceNotificationToaster
 *
 * Bridges `client-notification` WebSocket events (forwarded from the connected
 * Meshtastic node's `FromRadio.ClientNotification`) to the toast UI. Rendered
 * inside ToastProvider so it can call `useToast()`; reads the shared socket from
 * WebSocketContext. Server-side policy (clientNotificationPolicy.ts) already
 * suppresses noisy/structured notifications and dedupes recurring ones, so this
 * component just maps level → severity and shows the toast.
 */

import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useDeviceNotificationToasts } from '../hooks/useDeviceNotificationToasts';

export default function DeviceNotificationToaster(): null {
  const { state } = useWebSocketContext();
  useDeviceNotificationToasts(state.socket);
  return null;
}
