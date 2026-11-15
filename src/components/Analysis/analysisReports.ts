/**
 * The analysis report registry: one entry per report, in the order the
 * Reports grid lists them. Classic's AnalysisTab draws its cards from it and
 * the Workspace Reports list (#6365) its rows, so a new report added here
 * appears in both. `slug` is the report's Workspace URL segment
 * (`/reports/<slug>`).
 */
import type { UiIconName } from '../icons';

export type AnalysisReportId =
  | 'solar-monitoring'
  | 'nodeinfo-enrichment'
  | 'mqtt-oktomqtt-violations'
  | 'mesh-issues'
  | 'coverage'
  | 'traceroute-explorer';

export interface AnalysisReportDef {
  id: AnalysisReportId;
  slug: string;
  icon: UiIconName;
  titleKey: string;
  title: string;
  descriptionKey: string;
  description: string;
}

export const ANALYSIS_REPORTS: readonly AnalysisReportDef[] = [
  {
    id: 'solar-monitoring',
    slug: 'solar',
    icon: 'sun',
    titleKey: 'analysis.solar_monitoring.title',
    title: 'Solar Monitoring Analysis',
    descriptionKey: 'analysis.solar_monitoring.description',
    description:
      'Identify solar-powered nodes by analyzing battery and voltage patterns that show daytime charging and nighttime discharge.',
  },
  {
    id: 'nodeinfo-enrichment',
    slug: 'nodeinfo-enrichment',
    icon: 'identity',
    titleKey: 'analysis.enrichment.title',
    title: 'NodeInfo Enrichment',
    descriptionKey: 'analysis.enrichment.description',
    description:
      'Fill blank NodeInfo fields (name, hardware, role, …) for nodes seen on multiple sources by copying from a source that already has the data.',
  },
  {
    id: 'mqtt-oktomqtt-violations',
    slug: 'mqtt-violations',
    icon: 'securityAlert',
    titleKey: 'analysis.mqtt_violations.title',
    title: 'ok_to_mqtt Violations',
    descriptionKey: 'analysis.mqtt_violations.description',
    description:
      "Find MQTT gateways that uplinked other nodes' packets even though the sender did not opt in to MQTT (ok_to_mqtt = 0).",
  },
  {
    id: 'mesh-issues',
    slug: 'mesh-issues',
    icon: 'alert',
    titleKey: 'analysis.mesh_issues.title',
    title: 'Mesh Issues',
    descriptionKey: 'analysis.mesh_issues.description',
    description:
      'Flag wrongly-roled or poorly placed routers, airtime abusers, and infrastructure nodes on failing power — from passively collected data only.',
  },
  {
    id: 'coverage',
    slug: 'coverage',
    icon: 'radioSignal',
    titleKey: 'analysis.coverage.title',
    title: 'Coverage Report',
    descriptionKey: 'analysis.coverage.description',
    description:
      'Map RF receptions of position packets — how far your mesh actually reaches, and how well each receiver hears it. Built from a survey node driving your coverage area, not sent by MeshMonitor.',
  },
  {
    id: 'traceroute-explorer',
    slug: 'traceroute-explorer',
    icon: 'route',
    titleKey: 'analysis.traceroute_explorer.title',
    title: 'Traceroute Explorer',
    descriptionKey: 'analysis.traceroute_explorer.description',
    description:
      'Browse every stored traceroute across your sources on a linked map and table: paths, SNR per hop, answer rates, and route changes.',
  },
];
