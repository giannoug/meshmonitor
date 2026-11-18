import { useCallback } from 'react';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import { useSource } from '../../../contexts/SourceContext';
import { logger } from '../../../utils/logger';
import { type CustomWidget } from '../types';
import { type WidgetType } from '../../AddWidgetModal';
import { NODE_ACTIVITY_DEFAULT_WINDOW } from '../../../utils/nodeActivity';

interface UseCustomWidgetsOptions {
  baseUrl: string;
  customWidgets: CustomWidget[];
  setCustomWidgets: React.Dispatch<React.SetStateAction<CustomWidget[]>>;
  /** Where a changed list is saved; default: today's install-wide `dashboardWidgets` (the Workspace board saves per user). */
  saveWidgets?: (widgets: CustomWidget[]) => void | Promise<void>;
}

interface UseCustomWidgetsResult {
  addWidget: (type: WidgetType) => void;
  removeWidget: (widgetId: string) => void;
  addNodeToWidget: (widgetId: string, nodeId: string) => void;
  removeNodeFromWidget: (widgetId: string, nodeId: string) => void;
  selectTracerouteNode: (widgetId: string, nodeId: string) => void;
  updateWidgetConfig: (widgetId: string, updates: Record<string, unknown>) => void;
}

/** A new widget of `type` with today's defaults. */
export function createWidget(type: WidgetType): CustomWidget {
  const id = `widget-${Date.now()}`;
  if (type === 'nodeStatus') return { id, type: 'nodeStatus', nodeIds: [] };
  if (type === 'traceroute') return { id, type: 'traceroute', targetNodeId: null };
  if (type === 'hopDistribution') return { id, type: 'hopDistribution' };
  if (type === 'distanceDistribution') return { id, type: 'distanceDistribution', bucketSize: 5 };
  if (type === 'liveMeshActivity') return { id, type: 'liveMeshActivity', windowMinutes: NODE_ACTIVITY_DEFAULT_WINDOW };
  return { id, type: 'hopDistanceHeatmap', bucketSize: 5 };
}

/**
 * Hook for managing custom dashboard widgets (NodeStatus, Traceroute)
 */
export function useCustomWidgets({
  baseUrl,
  customWidgets,
  setCustomWidgets,
  saveWidgets: saveOverride,
}: UseCustomWidgetsOptions): UseCustomWidgetsResult {
  const csrfFetch = useCsrfFetch();
  const { sourceId } = useSource();
  const sourceQuery = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';

  // Save widgets to server
  const saveWidgets = useCallback(async (widgets: CustomWidget[]) => {
    if (saveOverride) return saveOverride(widgets);
    try {
      await csrfFetch(`${baseUrl}/api/settings${sourceQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardWidgets: JSON.stringify(widgets) }),
      });
    } catch (error) {
      logger.error('Error saving widgets:', error);
    }
  }, [baseUrl, csrfFetch, sourceQuery, saveOverride]);

  // Add a new widget
  const addWidget = useCallback((type: WidgetType) => {
    const newWidget = createWidget(type);

    const newWidgets = [...customWidgets, newWidget];
    setCustomWidgets(newWidgets);
    void saveWidgets(newWidgets);
  }, [customWidgets, setCustomWidgets, saveWidgets]);

  // Remove a widget
  const removeWidget = useCallback((widgetId: string) => {
    const newWidgets = customWidgets.filter(w => w.id !== widgetId);
    setCustomWidgets(newWidgets);
    void saveWidgets(newWidgets);
  }, [customWidgets, setCustomWidgets, saveWidgets]);

  // Add node to NodeStatus widget
  const addNodeToWidget = useCallback((widgetId: string, nodeId: string) => {
    const newWidgets = customWidgets.map(w => {
      if (w.id === widgetId && w.type === 'nodeStatus') {
        return { ...w, nodeIds: [...w.nodeIds, nodeId] };
      }
      return w;
    });
    setCustomWidgets(newWidgets);
    void saveWidgets(newWidgets);
  }, [customWidgets, setCustomWidgets, saveWidgets]);

  // Remove node from NodeStatus widget
  const removeNodeFromWidget = useCallback((widgetId: string, nodeId: string) => {
    const newWidgets = customWidgets.map(w => {
      if (w.id === widgetId && w.type === 'nodeStatus') {
        return { ...w, nodeIds: w.nodeIds.filter(id => id !== nodeId) };
      }
      return w;
    });
    setCustomWidgets(newWidgets);
    void saveWidgets(newWidgets);
  }, [customWidgets, setCustomWidgets, saveWidgets]);

  // Set target node for Traceroute widget
  const selectTracerouteNode = useCallback((widgetId: string, nodeId: string) => {
    const newWidgets = customWidgets.map(w => {
      if (w.id === widgetId && w.type === 'traceroute') {
        return { ...w, targetNodeId: nodeId };
      }
      return w;
    });
    setCustomWidgets(newWidgets);
    void saveWidgets(newWidgets);
  }, [customWidgets, setCustomWidgets, saveWidgets]);

  // Update widget configuration (e.g., bucket size for distance distribution)
  const updateWidgetConfig = useCallback((widgetId: string, updates: Record<string, unknown>) => {
    const newWidgets = customWidgets.map(w => {
      if (w.id === widgetId) {
        return { ...w, ...updates } as CustomWidget;
      }
      return w;
    });
    setCustomWidgets(newWidgets);
    void saveWidgets(newWidgets);
  }, [customWidgets, setCustomWidgets, saveWidgets]);

  return {
    addWidget,
    removeWidget,
    addNodeToWidget,
    removeNodeFromWidget,
    selectTracerouteNode,
    updateWidgetConfig,
  };
}
