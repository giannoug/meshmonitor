import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { SolarOverrideEntry, SolarPickerNode } from './SolarOverridesPanel';

export interface SolarPattern {
  date: string;
  sunrise: { time: string; value: number };
  peak: { time: string; value: number };
  sunset: { time: string; value: number };
  rise: number | null;
  fall: number | null;
  charge_rate_per_hour: number | null;
  discharge_rate_per_hour: number | null;
}

interface SolarChartPoint {
  timestamp: number;
  value: number;
}

export interface SolarProductionPoint {
  timestamp: number;
  wattHours: number;
}

export interface SolarNode {
  node_num: number;
  node_name: string;
  solar_score: number;
  days_analyzed: number;
  days_with_pattern: number;
  recent_patterns: SolarPattern[];
  metric_type: string;
  metrics_detected: string[];
  chart_data: SolarChartPoint[];
  avg_charge_rate_per_hour: number | null;
  avg_discharge_rate_per_hour: number | null;
  insufficient_solar: boolean | null;
  /** True when the operator marked this node as solar (#3195). */
  manual_override?: boolean;
}

export interface SolarNodesAnalysis {
  lookback_days: number;
  total_nodes_analyzed: number;
  solar_nodes_count: number;
  solar_nodes: SolarNode[];
  solar_production: SolarProductionPoint[];
  avg_charging_hours_per_day: number | null;
  avg_discharge_hours_per_day: number | null;
  analyzed_nodes?: SolarPickerNode[];
  manual_overrides?: SolarOverrideEntry[];
}

export interface ForecastDay {
  date: string;
  forecast_wh: number;
  avg_historical_wh: number;
  pct_of_average: number;
  is_low: boolean;
}

interface ForecastSimulationPoint {
  timestamp: string;
  simulated_battery: number;
  phase: 'sunrise' | 'peak' | 'sunset';
  forecast_factor: number;
}

interface NodeSimulation {
  node_num: number;
  node_name: string;
  metric_type: string;
  current_battery: number | null;
  min_simulated_battery: number;
  simulation: ForecastSimulationPoint[];
}

export interface SolarForecastAnalysis {
  lookback_days: number;
  historical_days_analyzed: number;
  avg_historical_daily_wh: number;
  low_output_warning: boolean;
  forecast_days: ForecastDay[];
  nodes_at_risk_count: number;
  nodes_at_risk: NodeSimulation[];
  solar_simulations: NodeSimulation[];
}

/**
 * Solar Monitoring's data and actions (shared with the Workspace SolarPage,
 * #6365): the lookback, Run analysis / Run forecast (reads of stored
 * telemetry and forecast.solar estimates), and the manual solar
 * classification (`settings:write`, a database write). Nothing here sends on
 * the mesh.
 */
export function useSolarMonitoringReport() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canWriteOverrides = hasPermission('settings', 'write');
  const queryClient = useQueryClient();
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [run, setRun] = useState(false);
  const [runForecast, setRunForecast] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<SolarNodesAnalysis>({
    queryKey: ['solar-nodes-analysis', lookbackDays],
    queryFn: () =>
      apiService.get<SolarNodesAnalysis>(
        `/api/analysis/solar-nodes?lookback_days=${lookbackDays}`,
      ),
    enabled: run,
  });

  const {
    data: forecast,
    isLoading: forecastLoading,
    error: forecastError,
    refetch: refetchForecast,
  } = useQuery<SolarForecastAnalysis>({
    queryKey: ['solar-forecast-analysis', lookbackDays],
    queryFn: () =>
      apiService.get<SolarForecastAnalysis>(
        `/api/analysis/solar-forecast?lookback_days=${lookbackDays}`,
      ),
    enabled: runForecast,
  });

  // #3195: set (true/false) or clear (null) a node's manual solar classification,
  // then re-run whichever analyses are showing so the report reflects it.
  const setSolarOverride = async (nodeNum: number, isSolar: boolean | null) => {
    setOverrideBusy(true);
    setOverrideError(null);
    try {
      await apiService.put(`/api/analysis/solar-overrides/${nodeNum}`, { isSolar });
      await queryClient.invalidateQueries({ queryKey: ['solar-nodes-analysis'] });
      await queryClient.invalidateQueries({ queryKey: ['solar-forecast-analysis'] });
    } catch (err) {
      setOverrideError(
        `${t('analysis.solar_monitoring.override_failed', 'Could not save the classification:')} ${(err as Error).message}`,
      );
    } finally {
      setOverrideBusy(false);
    }
  };


  const onRunAnalysis = () => {
    if (run) {
      void refetch();
    } else {
      setRun(true);
    }
  };
  const onRunForecast = () => {
    if (runForecast) {
      void refetchForecast();
    } else {
      setRunForecast(true);
    }
  };

  return {
    canWriteOverrides, overrideBusy, overrideError, lookbackDays, setLookbackDays, run, runForecast,
    data, isLoading, error, forecast, forecastLoading, forecastError, setSolarOverride, onRunAnalysis, onRunForecast,
  };
}
