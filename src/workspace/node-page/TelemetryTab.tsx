/**
 * The node page's Telemetry tab (board f5-telemetry): today's TelemetryGraphs
 * as it is, with its time range, the per-chart ⋯ menu (split / merge, Y
 * range, CSV, Clean outliers… for admins) and the dashboard star. A lazy
 * chunk, as in Classic's DM pane (the only recharts user here). Reads only.
 */
import { lazy, Suspense } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { appBasename } from '../../init';
import StateView from '../patterns/StateView';

const TelemetryGraphs = lazy(() => import('../../components/TelemetryGraphs'));

export default function TelemetryTab({ nodeId }: { nodeId: string }) {
  const { temperatureUnit, telemetryVisualizationHours } = useSettings();
  return (
    <Suspense fallback={<StateView kind="loading" />}>
      <TelemetryGraphs
        nodeId={nodeId}
        temperatureUnit={temperatureUnit}
        telemetryHours={telemetryVisualizationHours}
        baseUrl={appBasename}
        showTimeRangeSelector
      />
    </Suspense>
  );
}
