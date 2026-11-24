/**
 * DeviceNotices (boards 17-03 / 17-10): today's DeviceNotificationToaster
 * handler (`useDeviceNotificationToasts`: the connected node's
 * ClientNotification messages, 8 s each) on the device's socket, drawn by
 * ToastHost. Mounted once per device page, inside its per-source socket
 * (ChatProviders), as Classic mounts it inside App's. Shows; sends nothing.
 */
import { useOptionalSocket } from '../../contexts/WebSocketContext';
import { useDeviceNotificationToasts } from '../../hooks/useDeviceNotificationToasts';

/** Listens on the socket of the WebSocketProvider above; outside one there is nothing to listen to. */
export default function DeviceNotices(): null {
  useDeviceNotificationToasts(useOptionalSocket());
  return null;
}
