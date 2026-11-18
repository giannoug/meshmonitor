/** A MeshCore radio as its settings pages see it (Task 7.4): the screen's one useMeshCore and today's grants on this source. */
import { useAuth } from '../../../contexts/AuthContext';
import { useMeshCoreRuntime } from '../runtime';

// MeshCore device types (MeshCoreConfigurationView): Companion 1, Repeater 2, Room server 3.
const COMPANION = 1;
const REPEATER = 2;

export function useMcDevice() {
  const { sourceId, deviceName, meshCore, receiveOnly } = useMeshCoreRuntime();
  const { hasPermission, authStatus } = useAuth();
  const scope = { sourceId };
  const status = meshCore.status;
  const local = status?.localNode ?? undefined;
  return {
    sourceId,
    deviceName,
    meshCore,
    status,
    local,
    actions: meshCore.actions,
    receiveOnly,
    loading: meshCore.loading,
    connected: status?.connected ?? false,
    isCompanion: status?.deviceType === COMPANION,
    isRepeater: status?.deviceType === REPEATER || local?.advType === REPEATER,
    isAdmin: authStatus?.user?.isAdmin === true,
    canWriteConfig: hasPermission('configuration', 'write', scope),
    canReadConfig: hasPermission('configuration', 'read', scope),
    canWriteNodes: hasPermission('nodes', 'write', scope),
    canWriteConnection: hasPermission('connection', 'write', scope),
    canWriteSettings: hasPermission('settings', 'write', scope),
  };
}
