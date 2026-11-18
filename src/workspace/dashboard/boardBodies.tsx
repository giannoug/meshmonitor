/**
 * A board card's body: today's chart and widget renderers in their `bare`
 * form (Task 8.1), shared by a device's Dashboard and the Overview dashboard
 * (Task 8.2). Each renderer reads the device from the surrounding
 * SourceProvider, as under Classic's Dashboard.
 */
import type { ReactNode } from 'react';
import type { DashboardDataSource } from '../../components/Dashboard/dataSources';
import type { CustomWidget, FavoriteChart, NodeInfo } from '../../components/Dashboard/types';
import TelemetryChart from '../../components/TelemetryChart';
import TransportSeriesChart from '../../components/TransportSeriesChart';
import PacketRateChart, { isPacketRateType } from '../../components/PacketRateChart';
import SmartHopsChart, { isSmartHopsType } from '../../components/SmartHopsChart';
import LinkQualityChart, { isLinkQualityType } from '../../components/LinkQualityChart';
import NodeStatusWidget from '../../components/NodeStatusWidget';
import TracerouteWidget from '../../components/TracerouteWidget';
import HopDistributionWidget from '../../components/HopDistributionWidget';
import DistanceDistributionWidget from '../../components/DistanceDistributionWidget';
import HopDistanceHeatmapWidget from '../../components/HopDistanceHeatmapWidget';
import LiveMeshActivityWidget from '../../components/LiveMeshActivityWidget';
import type { TelemetryData } from '../../hooks/useTelemetry';
import { appBasename } from '../../init';
import type { ChartYRange } from '../../utils/chartYRange';
import type { DistanceUnit } from '../../contexts/SettingsContext';
import type { TemperatureUnit } from '../../utils/temperature';
import { isTransportSeriesType } from '../../utils/transportSeries';
import { chartKey } from './useUserBoard';

const noop = () => {};

export interface ChartEnv {
  nodes: Map<string, NodeInfo>;
  hours: number;
  temperatureUnit: TemperatureUnit;
  globalTimeRange: [number, number] | null;
  globalMinTime: number | undefined;
  onDataLoaded(key: string, data: TelemetryData[]): void;
  solarEstimates: Map<number, number>;
  solarMonitoringEnabled?: boolean;
  /** The device's chart display settings (install-wide); absent: none offered. */
  showSolar?(f: FavoriteChart): boolean;
  onToggleSolar?(nodeId: string, telemetryType: string, show: boolean): void;
  yRange?(f: FavoriteChart): ChartYRange | null;
  onYRangeChange?(nodeId: string, telemetryType: string, range: ChartYRange | null): void;
}

export function renderChart(f: FavoriteChart, env: ChartEnv): ReactNode {
  const p = {
    id: chartKey(f),
    favorite: f,
    node: env.nodes.get(f.nodeId),
    hours: env.hours,
    baseUrl: appBasename,
    globalTimeRange: env.globalTimeRange,
    onRemove: noop,
    bare: true,
  };
  if (isTransportSeriesType(f.telemetryType)) return <TransportSeriesChart {...p} />;
  if (isPacketRateType(f.telemetryType)) return <PacketRateChart {...p} />;
  if (isSmartHopsType(f.telemetryType)) return <SmartHopsChart {...p} />;
  if (isLinkQualityType(f.telemetryType)) return <LinkQualityChart {...p} />;
  return (
    <TelemetryChart
      {...p}
      temperatureUnit={env.temperatureUnit}
      globalMinTime={env.globalMinTime}
      solarEstimates={env.solarEstimates}
      onDataLoaded={env.onDataLoaded}
      showSolar={env.showSolar?.(f) ?? false}
      onToggleSolar={env.onToggleSolar}
      solarMonitoringEnabled={env.solarMonitoringEnabled}
      yRange={env.yRange?.(f)}
      onYRangeChange={env.onYRangeChange}
    />
  );
}

export interface WidgetOps {
  addNodeToWidget(widgetId: string, nodeId: string): void;
  removeNodeFromWidget(widgetId: string, nodeId: string): void;
  selectTracerouteNode(widgetId: string, nodeId: string): void;
  updateWidgetConfig(widgetId: string, updates: Record<string, unknown>): void;
}

export interface WidgetEnv {
  nodes: Map<string, NodeInfo>;
  /** The device's own node, where known. */
  localId: string | null;
  dataSource: DashboardDataSource;
  distanceUnit: DistanceUnit;
  /** A widget's settings save to the user's board: offered only where that save can happen. */
  canEdit: boolean;
  openNode?: (id: string) => void;
  ops: WidgetOps;
}

export function renderWidget(w: CustomWidget, env: WidgetEnv): ReactNode {
  const { ops } = env;
  const common = { id: w.id, nodes: env.nodes, onRemove: noop, canEdit: env.canEdit, bare: true };
  switch (w.type) {
    case 'nodeStatus':
      return (
        <NodeStatusWidget
          {...common}
          nodeIds={w.nodeIds}
          baseUrl={appBasename}
          onAddNode={(id) => ops.addNodeToWidget(w.id, id)}
          onRemoveNode={(id) => ops.removeNodeFromWidget(w.id, id)}
          onOpenNodeDetails={env.openNode}
          voltageFallback={env.dataSource.widgets.voltageFallback}
        />
      );
    case 'traceroute':
      return (
        <TracerouteWidget
          {...common}
          targetNodeId={w.targetNodeId}
          currentNodeId={env.localId}
          onSelectNode={(id) => ops.selectTracerouteNode(w.id, id)}
          sourceKind={env.dataSource.kind}
        />
      );
    case 'hopDistribution':
      return <HopDistributionWidget {...common} />;
    case 'distanceDistribution':
      return (
        <DistanceDistributionWidget
          {...common}
          bucketSize={w.bucketSize}
          currentNodeId={env.localId}
          distanceUnit={env.distanceUnit}
          onBucketSizeChange={(size) => ops.updateWidgetConfig(w.id, { bucketSize: size })}
        />
      );
    case 'hopDistanceHeatmap':
      return (
        <HopDistanceHeatmapWidget
          {...common}
          bucketSize={w.bucketSize}
          currentNodeId={env.localId}
          distanceUnit={env.distanceUnit}
          onBucketSizeChange={(size) => ops.updateWidgetConfig(w.id, { bucketSize: size })}
        />
      );
    case 'liveMeshActivity':
      return (
        <LiveMeshActivityWidget
          {...common}
          windowMinutes={w.windowMinutes}
          onWindowChange={(minutes) => ops.updateWidgetConfig(w.id, { windowMinutes: minutes })}
          onOpenNodeDetails={env.openNode}
        />
      );
  }
}
