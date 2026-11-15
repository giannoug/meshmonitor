/**
 * `/reports[/<report>]` and `/overview/reports[/<report>]` (Task 4.4): the
 * Reports list, or one report by its registry slug. `/reports?report=coverage&…`
 * (today's Coverage deep link, `parseCoverageDeepLink`) opens Coverage. Until
 * Task 4.5 rebuilds them, the other reports are today's components under the
 * Reports frame. An unknown slug goes back to the list.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ANALYSIS_REPORTS, type AnalysisReportId } from '../../components/Analysis/analysisReports';
import { parseCoverageDeepLink } from '../../utils/coverageDeepLink';
import ReportFrame from './ReportFrame';
import ReportsList from './ReportsList';
import MeshIssuesPage from './MeshIssuesPage';
import CoveragePage from './CoveragePage';
import { useReportsBase } from './reportsPaths';

/** Today's reports, re-hosted until Task 4.5 (same chunks as AnalysisTab's imports). */
const CLASSIC: Record<Exclude<AnalysisReportId, 'mesh-issues' | 'coverage'>, LazyExoticComponent<ComponentType>> = {
  'solar-monitoring': lazy(() => import('../../components/Analysis/SolarMonitoringReport.tsx')),
  'nodeinfo-enrichment': lazy(() => import('../../components/Analysis/NodeInfoEnrichmentReport.tsx')),
  'mqtt-oktomqtt-violations': lazy(() => import('../../components/Analysis/MqttViolationsReport.tsx')),
  'traceroute-explorer': lazy(() => import('../../components/Analysis/tracerouteExplorer/TracerouteExplorerReport.tsx')),
};

export default function ReportsRoute() {
  const { report } = useParams();
  const [searchParams] = useSearchParams();
  const base = useReportsBase();
  const slug = report ?? (parseCoverageDeepLink(searchParams) ? 'coverage' : undefined);
  const def = ANALYSIS_REPORTS.find((r) => r.slug === slug);

  if (!def) return report ? <Navigate replace to={base} /> : <ReportsList />;
  if (def.id === 'mesh-issues') return <MeshIssuesPage />;
  if (def.id === 'coverage') return <CoveragePage />;
  const Classic = CLASSIC[def.id];
  return (
    <ReportFrame back="reports">
      <Classic />
    </ReportFrame>
  );
}
