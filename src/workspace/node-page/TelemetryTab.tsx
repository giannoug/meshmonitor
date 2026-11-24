/**
 * The node page's Telemetry tab (board f5-telemetry): Classic's DM pane charts
 * as they are, in its order and under its conditions (MessagesTab): today's
 * TelemetryGraphs (time range, the per-chart ⋯ menu with split / merge, Y
 * range, CSV and Clean outliers… for admins, which opens the Workspace's
 * outlier sheet, 17-07, for this node and metric; the dashboard star), Smart Hops,
 * Link Quality and, when packet logging is on and the node sent anything in
 * the last 24 h, its packet-type distribution. Lazy chunks, as in Classic (the
 * only recharts users here).
 *
 * Reads only. The distribution is read once on opening, with no refresh timer
 * (Ruling N; Classic re-reads it every 60 s), scoped to this device.
 */
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toChartEntries } from '../../components/packetStatsChartData';
import { useSettings } from '../../contexts/SettingsContext';
import { appBasename } from '../../init';
import { getPacketDistributionStats } from '../../services/packetApi';
import type { DeviceInfo } from '../../types/device';
import { nodeIdOf } from '../nodes/nodeColumns';
import OutlierCleanupPage from '../misc/OutlierCleanupPage';
import StateView from '../patterns/StateView';

const TelemetryGraphs = lazy(() => import('../../components/TelemetryGraphs'));
const SmartHopsGraphs = lazy(() => import('../../components/SmartHopsGraphs'));
const LinkQualityGraph = lazy(() => import('../../components/LinkQualityGraph'));
const PacketStatsChart = lazy(() => import('../../components/PacketStatsChart'));

export default function TelemetryTab({ sourceId, node }: { sourceId: string; node: DeviceInfo }) {
  const { t } = useTranslation();
  const { temperatureUnit, telemetryVisualizationHours } = useSettings();
  const nodeId = nodeIdOf(node);
  // MessagesTab's fetchNodePacketDistribution: the last 24 h from this node.
  const { data: distribution } = useQuery({
    queryKey: ['workspace', 'node-packet-distribution', sourceId, node.nodeNum],
    queryFn: () => getPacketDistributionStats(Math.floor(Date.now() / 1000) - 86400, node.nodeNum, undefined, sourceId),
  });
  const typeData = distribution?.byType
    ? toChartEntries(distribution.byType, (p) => p.portnum_name.replace(/_APP$/, '').replace(/_/g, ' '), (p) => p.count)
    : [];
  const shared = { nodeId, telemetryHours: telemetryVisualizationHours, baseUrl: appBasename };

  return (
    <Suspense fallback={<StateView kind="loading" />}>
      <TelemetryGraphs {...shared} temperatureUnit={temperatureUnit} showTimeRangeSelector OutlierDialog={OutlierCleanupPage} />
      <SmartHopsGraphs {...shared} />
      <LinkQualityGraph {...shared} />
      {distribution?.enabled && typeData.length > 0 && (
        <PacketStatsChart
          title={t('messages.packet_type_distribution')}
          data={typeData}
          total={distribution.total}
          chartId="node-packet-type"
        />
      )}
    </Suspense>
  );
}
