import { useCallback, useMemo, useState } from 'react';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import { useSource } from '../../../contexts/SourceContext';
import { logger } from '../../../utils/logger';
import { CHART_Y_RANGE_SETTING, withChartYRange, type ChartYRange } from '../../../utils/chartYRange';
import { type TelemetryData } from '../types';
import { type DashboardDataSource } from '../dataSources';

interface UseChartSettingsOptions {
  baseUrl: string;
  dataSource: DashboardDataSource;
  solarVisibility: Record<string, boolean>;
  setSolarVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  chartYRanges: Record<string, ChartYRange>;
  setChartYRanges: React.Dispatch<React.SetStateAction<Record<string, ChartYRange>>>;
}

/**
 * A chart's solar overlay and fixed Y-axis range (#6348), read and saved to the
 * source's install-wide settings as the Dashboard always has. Shared by the
 * Classic Dashboard and the Workspace board (Task 8.1).
 */
export function useChartSettings({
  baseUrl,
  dataSource,
  solarVisibility,
  setSolarVisibility,
  chartYRanges,
  setChartYRanges,
}: UseChartSettingsOptions) {
  const csrfFetch = useCsrfFetch();
  const { sourceId } = useSource();
  const sourceQuery = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';

  // Get solar visibility for a specific chart (uses type-based default if not set)
  const getSolarVisibility = useCallback((nodeId: string, telemetryType: string): boolean => {
    const key = `${nodeId}-${telemetryType}`;
    if (key in solarVisibility) {
      return solarVisibility[key];
    }
    // Default based on telemetry type (per-source — Meshtastic and MeshCore
    // each carry their own default-on type lists).
    return dataSource.solarDefaultTypes.has(telemetryType);
  }, [solarVisibility, dataSource]);

  // Toggle solar visibility for a specific chart and save to server
  const handleToggleSolar = useCallback(async (nodeId: string, telemetryType: string, show: boolean) => {
    const key = `${nodeId}-${telemetryType}`;
    const newSolarVisibility = {
      ...solarVisibility,
      [key]: show,
    };

    // Update local state immediately
    setSolarVisibility(newSolarVisibility);

    // Save to server
    try {
      await csrfFetch(`${baseUrl}/api/settings${sourceQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardSolarVisibility: JSON.stringify(newSolarVisibility) }),
      });
    } catch (err) {
      logger.error('Error saving solar visibility:', err);
    }
  }, [solarVisibility, setSolarVisibility, csrfFetch, baseUrl, sourceQuery]);

  // Fixed Y-axis range per chart widget (#6348), keyed like solar visibility.
  const getYRange = useCallback(
    (nodeId: string, telemetryType: string): ChartYRange | null =>
      chartYRanges[`${nodeId}-${telemetryType}`] ?? null,
    [chartYRanges],
  );

  const handleYRangeChange = useCallback(async (nodeId: string, telemetryType: string, range: ChartYRange | null) => {
    const next = withChartYRange(chartYRanges, `${nodeId}-${telemetryType}`, range);
    setChartYRanges(next);
    try {
      await csrfFetch(`${baseUrl}/api/settings${sourceQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [CHART_Y_RANGE_SETTING]: JSON.stringify(next) }),
      });
    } catch (err) {
      logger.error('Error saving chart Y-axis range:', err);
    }
  }, [chartYRanges, setChartYRanges, csrfFetch, baseUrl, sourceQuery]);

  return { getSolarVisibility, handleToggleSolar, getYRange, handleYRangeChange };
}

/** The time span every chart shares, from the data each chart reports (global time range). */
export function useGlobalTimeRange() {
  // Track telemetry data from charts for global time range calculation
  const [telemetryDataMap, setTelemetryDataMap] = useState<Map<string, TelemetryData[]>>(new Map());

  // Callback for charts to report their data (for global time range)
  const handleDataLoaded = useCallback((key: string, data: TelemetryData[]) => {
    setTelemetryDataMap(prev => {
      const next = new Map(prev);
      next.set(key, data);
      return next;
    });
  }, []);

  /** Forget a chart's data (it left the dashboard). */
  const forgetChart = useCallback((key: string) => {
    setTelemetryDataMap(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Calculate global time range across all telemetry data
  const globalTimeRange = useMemo((): [number, number] | null => {
    let minTime = Infinity;
    let maxTime = -Infinity;

    telemetryDataMap.forEach(data => {
      data.forEach(item => {
        if (item.timestamp < minTime) minTime = item.timestamp;
        if (item.timestamp > maxTime) maxTime = item.timestamp;
      });
    });

    if (minTime === Infinity || maxTime === -Infinity) {
      return null;
    }

    return [minTime, maxTime];
  }, [telemetryDataMap]);

  const globalMinTime = globalTimeRange ? globalTimeRange[0] : undefined;

  return { handleDataLoaded, forgetChart, globalTimeRange, globalMinTime };
}
