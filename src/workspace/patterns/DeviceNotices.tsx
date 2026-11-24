/**
 * DeviceNotices (boards 17-03 / 17-10): today's DeviceNotificationToaster
 * handler (`useDeviceNotificationToasts`: the connected node's
 * ClientNotification messages, 8 s each) on the device's socket, drawn by
 * ToastHost. Mounted once per device page, inside its per-source socket
 * (ChatProviders), as Classic mounts it inside App's. Shows; sends nothing.
 */
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { useDeviceNotificationToasts } from '../../hooks/useDeviceNotificationToasts';

/** The socket of the WebSocketProvider above, or none outside one (nothing to listen to). */
function useDeviceSocket() {
  try {
    return useWebSocketContext().state.socket;
  } catch {
    return null;
  }
}

export default function DeviceNotices(): null {
  useDeviceNotificationToasts(useDeviceSocket());
  return null;
}
