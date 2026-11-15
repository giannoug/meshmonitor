/**
 * Overview › Reports (boards 6-01-reports-list, 6-08-reports-list; note
 * s6n0): one row per report in the AnalysisTab registry, with its last run,
 * status and a one-line result, read from data the reports already load.
 * Mesh Issues is the only report with a stored last run (`/status`, through
 * the report's own hook, so Run keeps today's gates: shown once `/status`
 * answers, hidden after a 401/403). The others read stored data when opened
 * (Live) or when run (Not run yet; their run is not stored). Titles and
 * descriptions are today's (D9b). The Run is a server-side analysis: it
 * sends nothing on the mesh.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { ANALYSIS_REPORTS, type AnalysisReportId } from '../../components/Analysis/analysisReports';
import { useMeshIssuesReport } from '../../components/Analysis/meshIssues/useMeshIssuesReport';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import ReportFrame from './ReportFrame';
import { useReportsBase } from './reportsPaths';
import styles from './ReportsList.module.css';

/** How a report gets its data (s6n0). Typed by the registry, so a new report needs an entry. */
const MODE: Record<AnalysisReportId, 'scheduled' | 'run' | 'live'> = {
  'mesh-issues': 'scheduled',
  'solar-monitoring': 'run',
  'mqtt-oktomqtt-violations': 'run',
  coverage: 'live',
  'traceroute-explorer': 'live',
  'nodeinfo-enrichment': 'live',
};

type Tone = 'warn' | 'ok' | 'neutral';

interface RowState {
  lastRun: string;
  lastRunNote?: string;
  status: string | null;
  tone: Tone;
  result: string;
}

export default function ReportsList() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const base = useReportsBase();
  const mesh = useMeshIssuesReport();

  const state = (id: AnalysisReportId): RowState => {
    const mode = MODE[id];
    if (mode === 'live') {
      return { lastRun: t('workspace.reports.on_open'), status: t('workspace.reports.status_live'), tone: 'neutral',
        result: t('workspace.reports.result_live') };
    }
    if (mode === 'run') {
      return { lastRun: '—', status: t('workspace.reports.status_not_run'), tone: 'neutral', result: t('workspace.reports.result_run') };
    }
    const status = mesh.statusQuery.data;
    if (!status) return { lastRun: '—', status: null, tone: 'neutral', result: '—' };
    const run = status.lastRunResult;
    if (status.lastRunTime == null || !run) {
      return { lastRun: '—', status: t('workspace.reports.status_not_run'), tone: 'neutral', result: '—' };
    }
    const needsLook = run.newCount + run.reopenedCount > 0;
    return {
      lastRun: new Date(status.lastRunTime).toLocaleString(),
      lastRunNote: t('workspace.reports.from_storage'),
      status: mesh.running
        ? t('analysis.mesh_issues.running', 'Running…')
        : needsLook ? t('workspace.reports.status_needs_look') : t('workspace.reports.status_ok'),
      tone: mesh.running ? 'neutral' : needsLook ? 'warn' : 'ok',
      result: t('workspace.reports.result_mesh', { new: run.newCount, reopened: run.reopenedCount, count: run.findingCount }),
    };
  };

  const runButton = (
    <button type="button" className={styles.run} onClick={mesh.handleRunNow} disabled={mesh.running}>
      <UiIcon name="play" size={16} />
      {mesh.running ? t('analysis.mesh_issues.running', 'Running…') : t('analysis.mesh_issues.run_now', 'Run analysis now')}
    </button>
  );
  const chip = (s: RowState) => s.status && <span className={styles.chip} data-tone={s.tone}>{s.status}</span>;
  const pageTitle = t('analysis.title', 'Analysis & Reports');

  const rows = ANALYSIS_REPORTS.map((r) => ({ r, s: state(r.id), to: `${base}/${r.slug}`, title: t(r.titleKey, r.title) }));

  return (
    <ReportFrame
      back="overview"
      title={pageTitle}
      subtitle={t(
        'analysis.subtitle',
        'Cross-network analytical reports built from collected telemetry and routing data. Choose a report to run.',
      )}
    >
      {isPhone ? (
        <ul className={styles.list} aria-label={pageTitle}>
          {rows.map(({ r, s, to, title }) => (
            <li key={r.id} className={styles.item} data-testid={`report-row-${r.id}`}>
              <Link to={to} className={styles.itemLink}>
                <span className={styles.icon}><UiIcon name={r.icon} size={22} /></span>
                <span className={styles.itemText}>
                  <span className={styles.name}>{title}</span>
                  <span className={styles.result}>{s.result}</span>
                  <span className={styles.meta}>
                    {chip(s)}
                    <span>{[s.lastRun !== '—' && s.lastRun, s.lastRunNote].filter(Boolean).join(' · ')}</span>
                  </span>
                </span>
                {!(r.id === 'mesh-issues' && mesh.canRunNow) && <UiIcon name="chevronRight" size={18} />}
              </Link>
              {r.id === 'mesh-issues' && mesh.canRunNow && runButton}
            </li>
          ))}
        </ul>
      ) : (
        <table className={styles.table} aria-label={pageTitle}>
          <thead>
            <tr>
              <th scope="col">{t('workspace.reports.col_report')}</th>
              <th scope="col">{t('workspace.reports.col_last_run')}</th>
              <th scope="col">{t('workspace.reports.col_status')}</th>
              <th scope="col">{t('workspace.reports.col_result')}</th>
              <th scope="col"><span className={styles.srOnly}>{t('workspace.reports.col_action')}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, s, to, title }) => (
              <tr key={r.id} data-testid={`report-row-${r.id}`}>
                <td>
                  <div className={styles.report}>
                    <span className={styles.icon}><UiIcon name={r.icon} size={22} /></span>
                    <span className={styles.itemText}>
                      <Link to={to} className={styles.name}>{title}</Link>
                      <span className={styles.description}>{t(r.descriptionKey, r.description)}</span>
                    </span>
                  </div>
                </td>
                <td>
                  <span className={styles.lastRun}>{s.lastRun}</span>
                  {s.lastRunNote && <span className={styles.note}>{s.lastRunNote}</span>}
                </td>
                <td>{chip(s) ?? '—'}</td>
                <td className={styles.resultCell}>{s.result}</td>
                <td className={styles.actionCell}>
                  {r.id === 'mesh-issues' ? (
                    mesh.canRunNow && runButton
                  ) : (
                    <Link to={to} className={styles.open}>
                      <UiIcon name="chevronRight" size={16} />
                      {t('workspace.reports.open')}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {mesh.runError && <p className={styles.error} role="alert">{mesh.runError}</p>}
      <p className={styles.footnote}>
        <UiIcon name="info" size={14} />
        <span>{t('workspace.reports.footnote_run')}</span>
      </p>
      <SendsLine>{t('workspace.reports.footnote_sends')}</SendsLine>
    </ReportFrame>
  );
}
