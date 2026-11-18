/**
 * A MeshCore radio's Dashboard (Task 8.1), native at today's `telemetry`
 * view: the shared DeviceDashboard over today's MeshCore data source, with
 * this radio's public key as the home node (as today's view passes it).
 */
import { meshcoreDashboardSource } from '../../components/Dashboard/dataSources';
import { DeviceDashboard } from '../dashboard/DeviceDashboard';
import { useMeshCoreRuntime } from './runtime';

export default function MeshCoreDashboard() {
  const { sourceId, deviceName, meshCore } = useMeshCoreRuntime();
  return (
    <DeviceDashboard
      sourceId={sourceId}
      deviceName={deviceName}
      dataSource={meshcoreDashboardSource}
      currentNodeId={meshCore.status?.localNode?.publicKey ?? null}
    />
  );
}
