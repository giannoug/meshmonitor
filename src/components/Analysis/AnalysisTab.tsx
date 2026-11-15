/**
 * AnalysisTab — landing page for analytical reports.
 *
 * Mirrors the MeshManager AnalysisPage card grid: each report is selectable
 * from the grid and rendered full-screen when active.
 *
 * Coverage deep link (#5277 P4a WP4, spec §2a.7): `/reports?report=coverage&
 * sender=…&range=…` opens straight to the Coverage Report, pre-filtered.
 * `parseCoverageDeepLink` (WP1) is the only thing that reads the params — it
 * returns `null` unless `report=coverage`, so every other report's URL
 * (today none use query params) is untouched. The initial `selected` is
 * seeded from the link ONCE via a lazy `useState` initializer; the router's
 * `useSearchParams` value is otherwise only consulted to build the prop
 * `CoverageReport` reads at ITS OWN mount, never re-applied to `selected` on
 * a later params change — same query-stability rule CoverageReport's
 * `timeWindow` already documents.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import SolarMonitoringReport from './SolarMonitoringReport';
import NodeInfoEnrichmentReport from './NodeInfoEnrichmentReport';
import MqttViolationsReport from './MqttViolationsReport';
import MeshIssuesReport from './MeshIssuesReport';
import CoverageReport from './CoverageReport';
import TracerouteExplorerReport from './tracerouteExplorer/TracerouteExplorerReport';
import { parseCoverageDeepLink } from '../../utils/coverageDeepLink';
import { ANALYSIS_REPORTS, type AnalysisReportId } from './analysisReports';
import { UiIcon, type UiIconName } from '../icons';

type AnalysisType = AnalysisReportId | null;

interface AnalysisCard {
  id: AnalysisReportId;
  title: string;
  description: string;
  icon: UiIconName;
}

const AnalysisTab: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Recomputed only when the URL's search params actually change (react-router
  // hands back a new URLSearchParams instance on navigation) — not on every
  // render, and NOT stored back into a query key anywhere, so this has none
  // of the render-loop shape the #5277 query-stability fix guards against.
  const coverageLink = useMemo(() => parseCoverageDeepLink(searchParams), [searchParams]);
  const [selected, setSelected] = useState<AnalysisType>(() => (coverageLink ? 'coverage' : null));

  const reports: AnalysisCard[] = ANALYSIS_REPORTS.map((r) => ({
    id: r.id,
    title: t(r.titleKey, r.title),
    description: t(r.descriptionKey, r.description),
    icon: r.icon,
  }));

  if (selected === 'solar-monitoring') {
    return (
      <div className="reports-section">
        <button
          type="button"
          className="reports-section__back"
          onClick={() => setSelected(null)}
        >
          <UiIcon name="back" size={16} /> {t('analysis.back_to_reports', 'Back to reports')}
        </button>
        <SolarMonitoringReport />
      </div>
    );
  }

  if (selected === 'nodeinfo-enrichment') {
    return (
      <div className="reports-section">
        <button
          type="button"
          className="reports-section__back"
          onClick={() => setSelected(null)}
        >
          <UiIcon name="back" size={16} /> {t('analysis.back_to_reports', 'Back to reports')}
        </button>
        <NodeInfoEnrichmentReport />
      </div>
    );
  }

  if (selected === 'mqtt-oktomqtt-violations') {
    return (
      <div className="reports-section">
        <button
          type="button"
          className="reports-section__back"
          onClick={() => setSelected(null)}
        >
          <UiIcon name="back" size={16} /> {t('analysis.back_to_reports', 'Back to reports')}
        </button>
        <MqttViolationsReport />
      </div>
    );
  }

  if (selected === 'mesh-issues') {
    return (
      <div className="reports-section">
        <button
          type="button"
          className="reports-section__back"
          onClick={() => setSelected(null)}
        >
          <UiIcon name="back" size={16} /> {t('analysis.back_to_reports', 'Back to reports')}
        </button>
        <MeshIssuesReport />
      </div>
    );
  }

  if (selected === 'traceroute-explorer') {
    return (
      <div className="reports-section">
        <button
          type="button"
          className="reports-section__back"
          onClick={() => setSelected(null)}
        >
          <UiIcon name="back" size={16} /> {t('analysis.back_to_reports', 'Back to reports')}
        </button>
        <TracerouteExplorerReport />
      </div>
    );
  }

  if (selected === 'coverage') {
    return (
      <div className="reports-section">
        <button
          type="button"
          className="reports-section__back"
          onClick={() => {
            // Clears report=/sender=/range= so Back does not reopen the
            // report on the next render (spec §2a.7) — without this, the
            // deep link that opened the report would still be in the URL
            // and `coverageLink` would still be truthy.
            setSearchParams({}, { replace: true });
            setSelected(null);
          }}
        >
          <UiIcon name="back" size={16} /> {t('analysis.back_to_reports', 'Back to reports')}
        </button>
        <CoverageReport initialLink={coverageLink ?? undefined} />
      </div>
    );
  }

  return (
    <>
      <p className="reports-grid__intro">
        {t(
          'analysis.subtitle',
          'Cross-network analytical reports built from collected telemetry and routing data. Choose a report to run.',
        )}
      </p>
      <div className="reports-grid">
        {reports.map((r) => (
          <button
            key={r.id}
            type="button"
            className="reports-card"
            onClick={() => setSelected(r.id)}
          >
            <div className="reports-card__icon"><UiIcon name={r.icon} size={28} /></div>
            <h3 className="reports-card__title">{r.title}</h3>
            <p className="reports-card__desc">{r.description}</p>
          </button>
        ))}
      </div>
    </>
  );
};

export default AnalysisTab;
