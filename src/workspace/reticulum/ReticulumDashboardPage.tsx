/**
 * The device's Dashboard (board 9-01's sidebar row, note s9n3), native at
 * `/source/:id/dashboard`: the shared DeviceDashboard (Task 8.1) over today's
 * Reticulum data source (interfaces' rate history, peers sharing telemetry).
 * It reads; nothing here sends.
 */
import { reticulumDashboardSource } from '../../components/Dashboard/dataSources';
import { DeviceDashboard } from '../dashboard/DeviceDashboard';
import { useRnsRuntime } from './runtime';

export default function ReticulumDashboardPage() {
  const { sourceId, deviceName } = useRnsRuntime();
  return <DeviceDashboard sourceId={sourceId} deviceName={deviceName} dataSource={reticulumDashboardSource} currentNodeId={null} contained />;
}
