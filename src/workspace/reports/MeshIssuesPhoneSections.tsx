/**
 * Mesh Issues By issue on the phone (board 6-09, s6n3): one section per
 * issue type, as today's ByIssueView (tile narrowing, critical types open by
 * default, open state kept in the view state), but each finding is a row of
 * at least 52 px (severity bar, subject, "type · time", state) instead of
 * today's wide table. A row opens a bottom sheet with today's FindingDetail,
 * Dismiss or Restore, and Mute rule; Mute rule opens today's dialog in the
 * sheet's place (one at a time). Findings load with today's query key and
 * fetcher, only for open sections, so the cache is shared with Classic's
 * sections. Every action is gated on `canAct`, as today.
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import {
  ISSUE_TYPE_LABELS,
  formatSourceIds,
  ruleShortId,
  type MeshIssueRow,
  type MeshIssueTypeSummary,
  type MeshIssuesResponse,
} from '../../components/Analysis/meshIssueTypes';
import { fetchIssuesForType, typeIssuesKey } from '../../components/Analysis/meshIssues/meshIssuesApi';
import { renderSubject } from '../../components/Analysis/meshIssues/IssueTable';
import FindingDetail from '../../components/Analysis/meshIssues/FindingDetail';
import BulkActionMenu from '../../components/Analysis/meshIssues/BulkActionMenu';
import MuteRuleDialog from '../../components/Analysis/meshIssues/MuteRuleDialog';
import { SEVERITY_LABEL, SEVERITY_RANK } from '../../components/Analysis/meshIssues/severityUi';
import type { useMeshIssuesReport } from '../../components/Analysis/meshIssues/useMeshIssuesReport';
import Sheet from '../patterns/Sheet';
import styles from './MeshIssuesPhoneSections.module.css';

type Report = ReturnType<typeof useMeshIssuesReport>;

const typeLabel = (issueType: string) => `${ruleShortId(issueType)} ${ISSUE_TYPE_LABELS[issueType] ?? issueType}`;

/** Worst first, then most recently detected. */
const byWorst = (a: MeshIssueRow, b: MeshIssueRow) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.lastDetected - a.lastDetected;

function TypeSection({ m, typeSummary, onOpen, onMute }: {
  m: Report;
  typeSummary: MeshIssueTypeSummary;
  onOpen(row: MeshIssueRow): void;
  onMute(issueType: string): void;
}) {
  const { t } = useTranslation();
  const { issueType, total, dismissed } = typeSummary;
  const expanded = m.viewState.expandedTypes.includes(issueType);
  const label = typeLabel(issueType);
  const query = useQuery<MeshIssuesResponse>({
    queryKey: typeIssuesKey(issueType, m.filters),
    queryFn: () => fetchIssuesForType(issueType, m.filters),
    enabled: expanded,
    retry: false,
  });
  const newCount = m.lastRunResult?.newByType?.[issueType] ?? 0;
  const reopenedCount = m.lastRunResult?.reopenedByType?.[issueType] ?? 0;
  const toggle = () =>
    m.setViewState((vs) => ({
      ...vs,
      expandedTypes: vs.expandedTypes.includes(issueType)
        ? vs.expandedTypes.filter((x) => x !== issueType)
        : [...vs.expandedTypes, issueType],
    }));
  // A tap on the row opens it; a tap on a link or button inside (a subject's node link) does not.
  const rowClick = (row: MeshIssueRow) => (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('a, button')) onOpen(row);
  };

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <button type="button" className={styles.toggle} aria-expanded={expanded} onClick={toggle}>
          <UiIcon name={expanded ? 'chevronUp' : 'chevronDown'} size={16} />
          <span className={styles.label}>{label}</span>
          <span className={styles.count}>{total}</span>
          {newCount > 0 && <span className={styles.chip}>{t('analysis.mesh_issues.section.new', '{{count}} new', { count: newCount })}</span>}
          {reopenedCount > 0 && (
            <span className={styles.chip}>{t('analysis.mesh_issues.section.reopened', '{{count}} reopened', { count: reopenedCount })}</span>
          )}
        </button>
        <BulkActionMenu
          canAct={m.canAct}
          subjectLabel={label}
          openCount={total - dismissed}
          dismissedCount={dismissed}
          onDismissAll={() => m.handleBulkDismiss({ scope: 'issueType', issueType })}
          onRestoreAll={() => m.handleBulkRestore({ scope: 'issueType', issueType })}
          bulkPending={m.bulkPending}
          mute={{ muted: m.disabledRules.includes(issueType), onMute: () => onMute(issueType) }}
        />
      </div>
      {expanded && query.isLoading && <p className={styles.note}>{t('analysis.mesh_issues.section.loading', 'Loading findings…')}</p>}
      {expanded && query.error && (
        <p className={styles.error} role="alert">
          {query.error instanceof Error ? query.error.message : t('analysis.mesh_issues.section.error', 'Error loading findings')}
        </p>
      )}
      {expanded && query.data && (
        <ul className={styles.rows} aria-label={label}>
          {[...query.data.issues].sort(byWorst).map((row) => {
            const isNew = m.lastRunTime != null && row.firstDetected >= m.lastRunTime;
            return (
              <li key={row.id} className={styles.row} onClick={rowClick(row)}>
                <span className={styles.bar} data-severity={row.severity} aria-hidden="true" />
                <span className={styles.text}>
                  <span className={styles.subject}>{renderSubject(row)}</span>
                  <span className={styles.meta}>
                    {`${ISSUE_TYPE_LABELS[row.issueType] ?? row.issueType} · ${new Date(row.lastDetected).toLocaleString()}`}
                  </span>
                </span>
                {row.dismissed ? (
                  <span className={styles.state}>{t('analysis.mesh_issues.dismissed_badge', 'Dismissed')}</span>
                ) : (
                  isNew && <span className={styles.state} data-new="">{t('analysis.mesh_issues.table.new', 'New')}</span>
                )}
                <button type="button" className={styles.open} aria-label={t('analysis.mesh_issues.table.expand', 'Show details')} onClick={() => onOpen(row)}>
                  <UiIcon name="chevronRight" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function MeshIssuesPhoneSections({ m }: { m: Report }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<MeshIssueRow | null>(null);
  const [muteType, setMuteType] = useState<string | null>(null);
  const summary = m.summary!;
  const setViewState = m.setViewState;

  // As ByIssueView: a type with a critical finding starts open, once per type, so a later collapse sticks.
  const seededRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const toSeed = summary.byType
      .filter((s) => s.bySeverity.critical > 0 && !seededRef.current.has(s.issueType))
      .map((s) => s.issueType);
    if (toSeed.length === 0) return;
    for (const type of toSeed) seededRef.current.add(type);
    setViewState((vs) => ({ ...vs, expandedTypes: [...new Set([...vs.expandedTypes, ...toSeed])] }));
  }, [summary, setViewState]);

  const visible = m.filters.issueTypes.length > 0
    ? summary.byType.filter((s) => m.filters.issueTypes.includes(s.issueType))
    : summary.byType;
  if (visible.length === 0) {
    return <p className={styles.note}>{t('analysis.mesh_issues.by_issue.no_match', 'No mesh issue types match the active filters.')}</p>;
  }

  const act = (fn: (id: number) => void, row: MeshIssueRow) => () => {
    fn(row.id);
    setOpen(null);
  };
  const mute = (issueType: string) => {
    setOpen(null);
    setMuteType(issueType);
  };
  const muted = open ? m.disabledRules.includes(open.issueType) : false;

  return (
    <>
      {visible.map((s) => (
        <TypeSection key={s.issueType} m={m} typeSummary={s} onOpen={setOpen} onMute={mute} />
      ))}

      <Sheet
        open={open !== null}
        onClose={() => setOpen(null)}
        side="bottom"
        title={open && renderSubject(open)}
        footer={
          open && m.canAct && (
            <div className={styles.actions}>
              {open.dismissed ? (
                <button type="button" className={styles.action} onClick={act(m.handleRestore, open)}>
                  <UiIcon name="refresh" size={16} />
                  {t('analysis.mesh_issues.restore', 'Restore')}
                </button>
              ) : (
                <button type="button" className={styles.action} onClick={act(m.handleDismiss, open)}>
                  {t('analysis.mesh_issues.dismiss', 'Dismiss')}
                </button>
              )}
              {!muted && (
                <button type="button" className={styles.action} onClick={() => mute(open.issueType)}>
                  <UiIcon name="muted" size={16} />
                  {t('analysis.mesh_issues.mute.confirm', 'Mute rule')}
                </button>
              )}
            </div>
          )
        }
      >
        {open && (
          <div className={styles.detail}>
            <p className={styles.eyebrow}>{`${typeLabel(open.issueType)} · ${SEVERITY_LABEL[open.severity]}`}</p>
            <p className={styles.meta}>
              {[
                open.dismissed
                  ? t('analysis.mesh_issues.dismissed_badge', 'Dismissed')
                  : m.lastRunTime != null && open.firstDetected >= m.lastRunTime && t('analysis.mesh_issues.table.new', 'New'),
                formatSourceIds(open.sourceIds, summary.sourceNames),
              ].filter(Boolean).join(' · ')}
            </p>
            <FindingDetail issue={open} sourceNames={summary.sourceNames} />
          </div>
        )}
      </Sheet>

      {muteType && (
        <MuteRuleDialog
          issueType={muteType}
          disabledRules={m.disabledRules}
          autoCloseCleanRuns={m.autoCloseCleanRuns}
          frequencyHours={m.frequencyHours}
          onClose={() => setMuteType(null)}
          onForbidden={m.handleForbidden}
        />
      )}
    </>
  );
}
