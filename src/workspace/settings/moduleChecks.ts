/** Checks today's module sections make before saving, shared by a module's page and the frame's save guard. */
import { MESH_BEACON_MESSAGE_MAX_BYTES } from '../../components/admin-commands/useAdminCommandsState';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';

/** The device rejects the whole MeshBeacon config, silently, when the message is over the limit (MeshBeaconConfigSection). */
export const meshBeaconTooLong = (s: Pick<DeviceConfigState, 'meshBeaconBroadcastMessage'>): boolean =>
  new TextEncoder().encode(s.meshBeaconBroadcastMessage).length > MESH_BEACON_MESSAGE_MAX_BYTES;
