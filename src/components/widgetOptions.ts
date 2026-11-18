/**
 * The custom widget types today's Add Widget modal offers, in its order, with
 * their copy and icon. Shared with the Workspace board's Add widget sheet (Task 8.1).
 */
import type { UiIconName } from './icons';

export type WidgetType = 'nodeStatus' | 'traceroute' | 'hopDistribution' | 'distanceDistribution' | 'hopDistanceHeatmap' | 'liveMeshActivity';

export interface WidgetOption {
  type: WidgetType;
  titleKey: string;
  descriptionKey: string;
  icon: UiIconName;
}

/** Every widget type the modal can offer, in its order (shared with the Workspace board's Add widget sheet). */
export const WIDGET_OPTIONS: WidgetOption[] = [
  {
    type: 'nodeStatus',
    titleKey: 'dashboard.widget.node_status.title',
    descriptionKey: 'dashboard.widget.node_status.description',
    icon: 'telemetry',
  },
  {
    type: 'traceroute',
    titleKey: 'dashboard.widget.traceroute.title',
    descriptionKey: 'dashboard.widget.traceroute.description',
    icon: 'route',
  },
  {
    type: 'hopDistribution',
    titleKey: 'dashboard.widget.hop_distribution.title',
    descriptionKey: 'dashboard.widget.hop_distribution.description',
    icon: 'wifi',
  },
  {
    type: 'distanceDistribution',
    titleKey: 'dashboard.widget.distance_distribution.title',
    descriptionKey: 'dashboard.widget.distance_distribution.description',
    icon: 'ruler',
  },
  {
    type: 'hopDistanceHeatmap',
    titleKey: 'dashboard.widget.hop_distance_heatmap.title',
    descriptionKey: 'dashboard.widget.hop_distance_heatmap.description',
    icon: 'map',
  },
  {
    type: 'liveMeshActivity',
    titleKey: 'dashboard.widget.live_mesh_activity.title',
    descriptionKey: 'dashboard.widget.live_mesh_activity.description',
    icon: 'activity',
  },
];
