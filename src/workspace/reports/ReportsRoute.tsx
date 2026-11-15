/**
 * `/reports[/<report>]` and `/overview/reports[/<report>]` (Task 4.4): the
 * Reports list, or one report by its registry slug. `/reports?report=coverage&…`
 * (today's Coverage deep link, `parseCoverageDeepLink`) opens Coverage. The
 * Traceroute Explorer, Solar, ok_to_mqtt and NodeInfo Enrichment pages (Task
 * 4.5) load as their own chunks. An unknown slug goes back to the list.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ANALYSIS_REPORTS, type AnalysisReportId } from '../../components/Analysis/analysisReports';
import { parseCoverageDeepLink } from '../../utils/coverageDeepLink';
import ReportsList from './ReportsList';
import MeshIssuesPage from './MeshIssuesPage';
import CoveragePage from './CoveragePage';
import { useReportsBase } from './reportsPaths';

/** The other reports, one chunk each (recharts and Leaflet stay out of the list's chunk). */
const PAGES: Record<Exclude<AnalysisReportId, 'mesh-issues' | 'coverage'>, LazyExoticComponent<ComponentType>> = {
  'solar-monitoring': lazy(() => import('./SolarPage.tsx')),
  'nodeinfo-enrichment': lazy(() => import('./EnrichmentPage.tsx')),
  'mqtt-oktomqtt-violations': lazy(() => import('./MqttViolationsPage.tsx')),
  'traceroute-explorer': lazy(() => import('./TracerouteExplorerPage.tsx')),
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
  const Page = PAGES[def.id];
  return <Page />;
}
