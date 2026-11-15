/**
 * Overview › Audit log (o5, 16-03, 16-08; s16n0, s16n1, s16n3): install-wide,
 * on today's endpoints through today's hook (`useAuditLog`, extracted from
 * AuditLogTab): `/api/audit`, `/api/audit/stats/summary`, `/api/users`.
 * Today's 30-day stats above the list, today's filters (search, user, source,
 * action, resource, dates) plus time presets (a window ending now), today's
 * table with the expanding row, Per Page and Previous / Next at the end,
 * Export CSV in the header, and today's MeshCore CLI activity view. Phone:
 * two-line rows, a Filters sheet and an entry sheet. Needs audit:read (the
 * server's gate; admins pass). Reads only; nothing transmits.
 */
import { useId, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { UiIcon } from '../../../components/icons';
import { MeshCoreCliActivity } from '../../../components/MeshCore/MeshCoreCliActivity';
import { useAuditLog, type AuditLogEntry } from '../../../components/useAuditLog';
import { useIsPhone } from '../../shell/useIsPhone';
import Sheet from '../../patterns/Sheet';
import StateView from '../../patterns/StateView';
import TwoLineRow from '../../patterns/TwoLineRow';
import AuditEntrySheet, { EntryDetails } from './AuditEntrySheet';
import styles from './AuditPage.module.css';

const HOUR = 3_600_000;
const PRESETS = [
  { ms: HOUR, key: 'workspace.audit.last_1h' },
  { ms: 24 * HOUR, key: 'workspace.audit.last_24h' },
  { ms: 7 * 24 * HOUR, key: 'workspace.audit.last_7d' },
] as const;

export default function AuditPage() {
  const { t } = useTranslation();
  const { hasPermission, loading } = useAuth();
  if (loading) return <StateView kind="loading" />;
  if (!hasPermission('audit', 'read')) {
    return <div className={styles.page}><StateView kind="noPermission" title={t('audit.no_permission')} /></div>;
  }
  return <AuditLog />;
}

type Audit = ReturnType<typeof useAuditLog>;

function AuditLog() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const a = useAuditLog();
  const ids = useId();
  const [view, setView] = useState<'events' | 'cli'>('events');
  const [datesOpen, setDatesOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [entry, setEntry] = useState<AuditLogEntry | null>(null);
  const f = a.filters;
  const dates = datesOpen || !!f.startDate || !!f.endDate;

  const preset = (ms: number) => {
    a.handleFilterChange('startDate', '');
    a.handleFilterChange('endDate', '');
    a.handleFilterChange('sinceMs', ms);
    setDatesOpen(false);
  };
  const openDates = () => {
    a.handleFilterChange('sinceMs', 0);
    setDatesOpen(true);
  };
  const clear = () => {
    a.handleClearFilters();
    setDatesOpen(false);
  };
  const active = [f.userId, f.source, f.action, f.resource, f.sinceMs || dates].filter(Boolean).length;

  const select = (key: 'userId' | 'action' | 'resource', label: string, all: string, options: [string, string][]) => (
    <span className={styles.selectField}>
      <label htmlFor={`${ids}-${key}`}>{label}</label>
      <select id={`${ids}-${key}`} className={styles.select} value={f[key]} onChange={(e) => a.handleFilterChange(key, e.target.value)}>
        <option value="">{all}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </span>
  );
  const userSelect = select('userId', t('audit.user'), t('audit.all_users'), a.users.map((u) => [String(u.id), u.username]));
  const actionSelect = select('action', t('audit.action'), t('audit.all_actions'), a.uniqueActions.map((x) => [x, x]));
  const resourceSelect = select('resource', t('audit.resource'), t('audit.all_resources'), a.uniqueResources.map((x) => [x, x]));
  const dateFields = dates && (
    <span className={styles.dates}>
      {(['startDate', 'endDate'] as const).map((k) => (
        <span key={k} className={styles.selectField}>
          <label htmlFor={`${ids}-${k}`}>{t(k === 'startDate' ? 'audit.start_date' : 'audit.end_date')}</label>
          <input id={`${ids}-${k}`} type="date" className={styles.select} value={f[k]} onChange={(e) => a.handleFilterChange(k, e.target.value)} />
        </span>
      ))}
    </span>
  );
  const last24 = (
    <button type="button" className={styles.chip} aria-pressed={f.sinceMs === 24 * HOUR} onClick={() => preset(f.sinceMs === 24 * HOUR ? 0 : 24 * HOUR)}>
      {t('workspace.audit.last_24h')}
    </button>
  );
  const cliChip = (
    <button type="button" className={styles.chip} aria-pressed={view === 'cli'} onClick={() => setView((v) => (v === 'cli' ? 'events' : 'cli'))}>
      {t('audit.view_meshcore_cli', 'MeshCore CLI activity')}
    </button>
  );
  const exportCsv = () => a.handleExportCSV();

  const stats = a.stats && (
    <div className={styles.stats}>
      <div className={styles.stat}>
        <h3>{t('audit.total_events_30_days')}</h3>
        <p className={styles.statValue}>{a.stats.totalEvents}</p>
      </div>
      <div className={styles.stat}>
        <h3>{t('audit.top_action')}</h3>
        <p>{a.stats.actionStats[0]?.action || t('audit.na')} ({a.stats.actionStats[0]?.count || 0})</p>
      </div>
      <div className={styles.stat}>
        <h3>{t('audit.most_active_user')}</h3>
        <p>{a.stats.userStats[0]?.username || t('audit.na')} ({a.stats.userStats[0]?.count || 0})</p>
      </div>
    </div>
  );

  const state = a.loading ? (
    <StateView kind="loading" title={t('audit.loading')} />
  ) : a.error ? (
    <StateView kind="error" title={a.error} />
  ) : a.logs.length === 0 ? (
    <StateView kind="empty" title={t('audit.no_entries')} />
  ) : null;

  const pager = (
    <div className={styles.pager}>
      {a.totalPages > 1 && (
        <>
          <span className={styles.muted}>
            {t('audit.showing', { start: f.offset + 1, end: Math.min(f.offset + a.itemsPerPage, a.total), total: a.total })}
          </span>
          <button type="button" className={styles.button} onClick={() => a.handlePageChange(a.currentPage - 1)} disabled={a.currentPage === 1}>
            {t('audit.previous')}
          </button>
          <span>{t('audit.page', { current: a.currentPage, total: a.totalPages })}</span>
          <button type="button" className={styles.button} onClick={() => a.handlePageChange(a.currentPage + 1)} disabled={a.currentPage === a.totalPages}>
            {t('audit.next')}
          </button>
        </>
      )}
      <span className={styles.selectField}>
        <label htmlFor={`${ids}-limit`}>{t('audit.per_page')}</label>
        <select id={`${ids}-limit`} className={styles.select} value={f.limit} onChange={(e) => a.handleFilterChange('limit', parseInt(e.target.value))}>
          {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </span>
    </div>
  );

  if (isPhone) {
    return (
      <div className={styles.page} data-phone="">
        <header className={styles.phoneHead}>
          <Link to="/overview" className={styles.back}>
            <UiIcon name="back" size={20} />
            {t('workspace.shell.overview')}
          </Link>
          <h1 className={styles.phoneTitle}>{t('audit.title')}</h1>
          <button type="button" className={styles.iconButton} aria-label={t('audit.export_csv')} onClick={exportCsv} disabled={a.logs.length === 0}>
            <UiIcon name="download" size={22} />
          </button>
        </header>
        <p className={styles.scope}>
          <UiIcon name="reports" size={18} />
          {t('workspace.audit.scope')}
        </p>
        <div className={styles.phoneBar}>
          <input
            type="search"
            className={styles.search}
            aria-label={t('audit.search')}
            placeholder={t('audit.search_placeholder')}
            value={f.search}
            onChange={(e) => a.handleFilterChange('search', e.target.value)}
          />
          <button type="button" className={styles.button} onClick={() => setFiltersOpen(true)}>
            <UiIcon name="filter" size={18} />
            {t('audit.filters')}
            {active > 0 && <span className={styles.badge}>{active}</span>}
          </button>
        </div>
        <div className={styles.chips}>
          {last24}
          {cliChip}
        </div>
        {view === 'cli' ? (
          <MeshCoreCliActivity />
        ) : (
          <>
            {stats}
            {state ?? (
              <div className={styles.rows}>
                {a.logs.map((log) => (
                  <TwoLineRow
                    key={log.id}
                    data-testid="audit-row"
                    leading={<span className={styles.time}>{shortTime(log.timestamp)}</span>}
                    title={log.action}
                    subtitle={[log.username || t('audit.system'), log.resource].filter(Boolean).join(' · ')}
                    onClick={() => setEntry(log)}
                  />
                ))}
              </div>
            )}
            {pager}
          </>
        )}
        <Sheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title={t('audit.filters')}
          actions={<button type="button" className={styles.textButton} onClick={clear}>{t('audit.clear_filters')}</button>}
          footer={
            <button type="button" className={styles.primary} onClick={() => setFiltersOpen(false)}>
              {t('workspace.audit.show_entries', { count: a.total })}
            </button>
          }
        >
          <div className={styles.sheetBody}>
            <span className={styles.selectField}>
              <label htmlFor={`${ids}-sheet-search`}>{t('audit.search')}</label>
              <input id={`${ids}-sheet-search`} type="search" className={styles.select} placeholder={t('audit.search_placeholder')}
                value={f.search} onChange={(e) => a.handleFilterChange('search', e.target.value)} />
            </span>
            {userSelect}
            {actionSelect}
            {resourceSelect}
            <SourceSegments a={a} />
            <div className={styles.segmentField}>
              <span className={styles.segmentLabel}>{t('workspace.overview.time')}</span>
              <div role="group" aria-label={t('workspace.overview.time')} className={styles.segments}>
                <button type="button" aria-pressed={!f.sinceMs && !dates} onClick={() => preset(0)}>{t('workspace.audit.any_time')}</button>
                {PRESETS.map((p) => (
                  <button key={p.ms} type="button" aria-pressed={f.sinceMs === p.ms} onClick={() => preset(p.ms)}>{t(p.key)}</button>
                ))}
                <button type="button" aria-pressed={dates} onClick={openDates}>{t('workspace.audit.dates')}</button>
              </div>
            </div>
            {dateFields}
          </div>
        </Sheet>
        <AuditEntrySheet log={entry} when={entry ? a.formatTimestamp(entry.timestamp) : ''} onClose={() => setEntry(null)} />
      </div>
    );
  }

  const toggle = (id: number) => setExpanded((cur) => (cur === id ? null : id));
  const onRowKey = (e: KeyboardEvent, id: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(id);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{t('audit.title')}</h1>
          <p className={styles.subtitle}>{t('workspace.audit.subtitle')}</p>
        </div>
        <button type="button" className={styles.button} onClick={exportCsv} disabled={a.logs.length === 0}>
          <UiIcon name="download" size={18} />
          {t('audit.export_csv')}
        </button>
      </div>
      <div className={styles.filters}>
        <input
          type="search"
          className={styles.search}
          aria-label={t('audit.search')}
          placeholder={t('audit.search_placeholder')}
          value={f.search}
          onChange={(e) => a.handleFilterChange('search', e.target.value)}
        />
        {userSelect}
        <span className={styles.selectField}>
          <label htmlFor={`${ids}-source`}>{t('audit.source')}</label>
          <select id={`${ids}-source`} className={styles.select} value={f.source} onChange={(e) => a.handleFilterChange('source', e.target.value)}>
            <option value="">{t('audit.all_sources')}</option>
            <option value="ui">{t('audit.ui_only')}</option>
            <option value="api">{t('audit.api_only')}</option>
          </select>
        </span>
        {actionSelect}
        {resourceSelect}
        {last24}
        <button type="button" className={styles.chip} aria-pressed={dates} onClick={() => (dates ? clearDates(a, setDatesOpen) : openDates())}>
          {t('workspace.audit.dates')}
        </button>
        {dateFields}
        {cliChip}
        <button type="button" className={styles.button} onClick={clear}>{t('audit.clear_filters')}</button>
      </div>
      {view === 'cli' ? (
        <MeshCoreCliActivity />
      ) : (
        <>
          {stats}
          {state ?? (
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-label={t('audit.title')}>
                <thead>
                  <tr>
                    <th>{t('audit.timestamp')}</th>
                    <th>{t('audit.user')}</th>
                    <th>{t('audit.action')}</th>
                    <th>{t('audit.resource')}</th>
                    <th>{t('audit.ip_address')}</th>
                    <th>{t('audit.details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.logs.map((log) => (
                    <Row key={log.id} log={log} a={a} open={expanded === log.id} onToggle={() => toggle(log.id)} onKey={(e) => onRowKey(e, log.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pager}
        </>
      )}
    </div>
  );
}

function clearDates(a: Audit, setDatesOpen: (v: boolean) => void) {
  a.handleFilterChange('startDate', '');
  a.handleFilterChange('endDate', '');
  setDatesOpen(false);
}

function SourceSegments({ a }: { a: Audit }) {
  const { t } = useTranslation();
  const options: [string, string][] = [['', t('audit.all_sources')], ['ui', t('audit.ui_only')], ['api', t('audit.api_only')]];
  return (
    <div className={styles.segmentField}>
      <span className={styles.segmentLabel}>{t('audit.source')}</span>
      <div role="group" aria-label={t('audit.source')} className={styles.segments}>
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={a.filters.source === v} onClick={() => a.handleFilterChange('source', v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

const TONE: Record<string, string> = { 'action-error': 'error', 'action-warning': 'warning', 'action-success': 'success' };

function Row({ log, a, open, onToggle, onKey }: { log: AuditLogEntry; a: Audit; open: boolean; onToggle(): void; onKey(e: KeyboardEvent): void }) {
  const { t } = useTranslation();
  return (
    <>
      <tr className={styles.row} tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={onKey}>
        <td className={styles.nowrap}>{a.formatTimestamp(log.timestamp)}</td>
        <td>{log.username || <span className={styles.muted}>{t('audit.system')}</span>}</td>
        <td data-tone={TONE[a.getActionColor(log.action)]} className={styles.action}>{log.action}</td>
        <td>{log.resource || '-'}</td>
        <td>{log.ipAddress || '-'}</td>
        <td><div className={styles.detailsCell}>{log.details || '-'}</div></td>
      </tr>
      {open && (
        <tr className={styles.expanded}>
          <td colSpan={6}><EntryDetails log={log} /></td>
        </tr>
      )}
    </>
  );
}

/** Today's time on the phone row: the clock for today, else the date. */
function shortTime(ts: number | string): string {
  const d = new Date(typeof ts === 'string' ? parseInt(ts, 10) : ts);
  if (isNaN(d.getTime())) return '';
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString();
}
