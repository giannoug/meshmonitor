/**
 * Server › Background jobs (boards 13-10 desktop, 13-26 phone). settings:write
 * opens it (s13n2). The settings here are install-wide keys the server keeps
 * for admins (GLOBAL_ONLY_SETTINGS_KEYS drop them from anyone else's save), so
 * the rows are view only for a non-admin and say why; today's page let such a
 * user type and silently dropped the save. Server gates are unchanged.
 *
 * - Position estimation, Auto-enrichment, Mesh issues: today's sections. Each
 *   field saves as you go as today's key (`POST /api/settings`) and the status
 *   is read again; status is read once on open, after a save and after a run.
 *   Recalculate now and auto-enrichment's Run now are admins only, as today;
 *   Run analysis now keeps today's settings:write.
 * - Coverage Report retention and Solar Monitoring: today's rows, saved as you
 *   go; Fetch Estimates Now asks once. On phone Solar is a page of its own
 *   (s13n7).
 *
 * Mesh impact: "Also push corrections to the device NodeDB" is the one control
 * that transmits: one NodeInfo request per enriched node, at most 25 a run,
 * 30 s apart, the rest waiting for the next run (today's caps, unchanged). Its
 * Sends line says so. Position estimation and mesh issues read stored data
 * only. A save writes settings keys only: no run starts, and each scheduler
 * keeps its last run in the database, so a save never re-arms it.
 * Timers: auto-enrichment's status is read every 10 s while a run is in
 * progress, today's poll, moved verbatim; nothing else polls.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { buildRuleMuteSettingsPatch, ISSUE_TYPE_LABELS, ruleIdsByTier, ruleShortId } from '../../components/Analysis/meshIssueRuleIds';
import { useSettings } from '../../contexts/SettingsContext';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { appBasename } from '../../init';
import apiService from '../../services/api';
import { clampCoverageRetentionDays } from '../../utils/coverage';
import { logger } from '../../utils/logger';
import SendsLine from '../patterns/SendsLine';
import StateView from '../patterns/StateView';
import SettingGroup from '../settings/kit/SettingGroup';
import { useReadOnly } from '../settings/kit/useFieldRegistry';
import { AutoNumber, AutoToggle, SavedLine } from '../settings/categories/autosave';
import { useIsPhone } from '../shell/useIsPhone';
import ServerFrame from './ServerFrame';
import { useServerAccess } from './serverEntries';
import { StatusNumber, StatusSelect, StatusText, StatusToggle } from './statusRows';
import { useStatusSetting } from './useStatusSetting';
import pages from '../settings/categories/SettingsPages.module.css';
import prefs from '../you/preferences/Preferences.module.css';
import styles from './Server.module.css';

const PE_KEY = ['workspace', 'positionEstimation', 'status'];
const AE_KEY = ['workspace', 'autoEnrichment', 'status'];
const MI_KEY = ['workspace', 'meshIssues', 'status'];
const ONCE = { staleTime: Infinity, refetchOnWindowFocus: false, retry: false } as const;

/** Today's options (PositionEstimationSection, AutoEnrichmentSection, MeshIssuesSection). */
const PE_FREQUENCY = [3, 6, 12, 24];
const LOOKBACK = [24, 72, 168, 336, 720];
const AE_INTERVAL_HOURS = [1, 2, 3, 6, 12, 24, 48, 168];
const AE_DEFAULT_CRON = '0 */6 * * *';
const MI_FREQUENCY = [6, 12, 24, 48, 168];
const MI_PAIR_BUCKET = [1, 3, 6, 12, 24];
/** How often today's section reads the status while a run is in progress. */
const STATUS_POLL_MS = 10_000;

interface PeStatus {
  inProgress: boolean;
  enabled: boolean;
  frequencyHours: number;
  lookbackHours: number;
  maxUncertaintyKm: number;
  lastRunTime: number | null;
  lastRunResult: { estimatedNodeCount: number; observationCount: number; anchorCount: number; rejectedNodeCount?: number } | null;
}

interface AeStatus {
  enabled: boolean;
  scheduleType: 'interval' | 'cron';
  intervalMinutes: number;
  cron: string;
  pushToNodeDb: boolean;
  inProgress: boolean;
  lastRunAt: number | null;
  lastRunSummary: { nodesFilled: number; fieldsCopied: number; pushesSent: number } | null;
  pendingPushes: number;
  limits: { pushCapPerRun: number; pushSpacingMs: number };
}

interface MiThresholds {
  tierAEnabled: boolean;
  tierBEnabled: boolean;
  tierCEnabled: boolean;
  disabledRules?: string[];
  airUtilTxPct: number;
  channelUtilPct: number;
  mobileSpanMeters: number;
  snrAsymmetryDb: number;
  overBroadcastSeconds: number;
  autoCloseCleanRuns?: number;
  routerClusterMaxLinkKm?: number;
  staleHoursMeshtastic?: number;
  staleHoursMeshcore?: number;
  lowBatteryPct?: number;
  lowBatteryMv?: number;
}

interface MiStatus {
  inProgress: boolean;
  enabled: boolean;
  frequencyHours: number;
  lookbackHours: number;
  pairBucketHours: number;
  lastRunTime: number | null;
  lastRunResult: { findingCount: number } | null;
  lastRunResultFromStorage: boolean;
  thresholds: MiThresholds;
}

const when = (ms: number) => new Date(ms).toLocaleString();
const bool = (key: string) => (v: boolean) => ({ [key]: String(v) });
const num = (key: string) => (v: number | string) => ({ [key]: String(v) });

export default function BackgroundJobsPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { isAdmin } = useServerAccess();
  return (
    <ServerFrame
      categoryId="background-jobs"
      title={t('workspace.server.nav.background_jobs')}
      scope={t('workspace.server.jobs_scope')}
      icon="time"
      gate="write"
      readOnly={!isAdmin}
    >
      {!isAdmin && (
        <p className={styles.pageNote}>
          <UiIcon name="info" size={16} />
          <span>{t('workspace.server.jobs_admin_note')}</span>
        </p>
      )}
      {isPhone ? (
        <>
          <AutoEnrichmentGroup />
          <PositionEstimationGroup />
          <MeshIssuesGroup />
          <CoverageGroup />
          <SolarLink />
        </>
      ) : (
        // Two columns: today's rows and their help need the width a third column would take (13-10 draws three).
        <div className={prefs.columns}>
          <div className={prefs.column}>
            <PositionEstimationGroup />
            <CoverageGroup />
            <SettingGroup title={t('settings.solar_monitoring')}>
              <SolarRows />
            </SettingGroup>
          </div>
          <div className={prefs.column}>
            <AutoEnrichmentGroup />
            <MeshIssuesGroup />
          </div>
        </div>
      )}
    </ServerFrame>
  );
}

/** A job's last run and its run button, today's words. */
function RunRow({ lines, label, busy, busyLabel, onRun, adminOnly }: { lines: string[]; label: string; busy: boolean; busyLabel: string; onRun(): void; adminOnly?: boolean }) {
  const { t } = useTranslation();
  const { isAdmin } = useServerAccess();
  const blocked = adminOnly && !isAdmin;
  return (
    <div className={pages.infoRow}>
      <span className={pages.infoText}>
        {lines.map((l) => (
          <span key={l} className={pages.infoHelp}>
            {l}
          </span>
        ))}
      </span>
      <button
        type="button"
        className={pages.button}
        disabled={busy || blocked}
        title={blocked ? t('automation.run_now_admin_only', 'Only an administrator can run this job. It works on every source.') : undefined}
        onClick={onRun}
      >
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}

function useRun(url: string, done: () => void, messages: { ok(body: unknown): string; busy: string; failed: string }) {
  const { showToast } = useToast();
  const csrfFetch = useCsrfFetch();
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      const response = await csrfFetch(`${appBasename}${url}`, { method: 'POST' });
      if (response.ok) {
        showToast(messages.ok(await response.json()), 'success');
        done();
      } else if (response.status === 409) {
        showToast(messages.busy, 'warning');
      } else {
        showToast(messages.failed, 'error');
      }
    } catch {
      showToast(messages.failed, 'error');
    } finally {
      setRunning(false);
    }
  };
  return { running, run };
}

function PositionEstimationGroup() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: PE_KEY, queryFn: () => apiService.get<PeStatus>('/api/settings/position-estimation/status'), ...ONCE });
  const { running, run } = useRun('/api/settings/position-estimation/run-now', () => void q.refetch(), {
    ok: (body) => {
      const count = (body as { estimatedNodeCount: number }).estimatedNodeCount;
      return t('automation.position_estimation.run_result', { count, defaultValue: `Estimated ${count} node position(s)` });
    },
    busy: t('automation.position_estimation.already_running', 'Estimation already running'),
    failed: t('automation.settings_save_failed', 'Failed to run'),
  });
  const lookback = (h: number) =>
    h % 24 === 0
      ? t('automation.position_estimation.lookback_days', { count: h / 24, defaultValue: `${h / 24} day(s)` })
      : t('automation.position_estimation.lookback_hours', { count: h, defaultValue: `${h} hour(s)` });
  const s = q.data;
  return (
    <SettingGroup title={t('automation.position_estimation.title', 'Position Estimation')}>
      <p className={styles.cardPara}>
        {t('automation.position_estimation.description', 'Estimate locations for nodes without GPS by pooling traceroute and neighbor data across all Meshtastic sources (including MQTT). Runs on a schedule; estimates are shared across every source.')}
      </p>
      {q.isError ? (
        <StateView kind="error" onRetry={() => void q.refetch()} />
      ) : !s ? (
        <StateView kind="loading" />
      ) : (
        <>
          <StatusToggle id="background-jobs.position_estimation_enabled" label={t('workspace.server.pe_enable')} value={s.enabled} body={bool('position_estimation_enabled')} queryKey={PE_KEY} />
          <StatusSelect
            id="background-jobs.position_estimation_frequency_hours"
            label={t('automation.position_estimation.frequency', 'Calculation frequency')}
            value={String(s.frequencyHours)}
            options={PE_FREQUENCY.map((h) => ({ value: String(h), label: t('automation.position_estimation.every_hours', { count: h, defaultValue: `Every ${h} hours` }) }))}
            body={num('position_estimation_frequency_hours')}
            queryKey={PE_KEY}
            disabled={!s.enabled}
          />
          <StatusSelect
            id="background-jobs.position_estimation_lookback_hours"
            label={t('automation.position_estimation.lookback', 'Lookback window')}
            value={String(s.lookbackHours)}
            options={LOOKBACK.map((h) => ({ value: String(h), label: lookback(h) }))}
            body={num('position_estimation_lookback_hours')}
            queryKey={PE_KEY}
            disabled={!s.enabled}
          />
          <StatusNumber
            id="background-jobs.position_estimation_max_uncertainty_km"
            label={t('automation.position_estimation.max_uncertainty', 'Maximum acceptable accuracy (km)')}
            help={t('automation.position_estimation.max_uncertainty_help', 'Estimates with an uncertainty radius larger than this are discarded rather than stored, so low-confidence guesses don’t draw huge circles on the map. Set 0 for no limit.')}
            value={s.maxUncertaintyKm ?? 0}
            min={0}
            step={0.5}
            body={num('position_estimation_max_uncertainty_km')}
            queryKey={PE_KEY}
            disabled={!s.enabled}
          />
          <RunRow
            adminOnly
            lines={[
              `${t('automation.position_estimation.last_run', 'Last run')}: ${s.lastRunTime ? when(s.lastRunTime) : t('automation.position_estimation.never', 'never')}`,
              ...(s.lastRunResult
                ? [
                    t('automation.position_estimation.last_result', {
                      estimated: s.lastRunResult.estimatedNodeCount,
                      observations: s.lastRunResult.observationCount,
                      anchors: s.lastRunResult.anchorCount,
                      defaultValue: `${s.lastRunResult.estimatedNodeCount} node(s) estimated from ${s.lastRunResult.observationCount} observation(s), ${s.lastRunResult.anchorCount} anchor(s)`,
                    }) +
                      (s.lastRunResult.rejectedNodeCount
                        ? ` ${t('automation.position_estimation.last_rejected', { count: s.lastRunResult.rejectedNodeCount, defaultValue: `(${s.lastRunResult.rejectedNodeCount} discarded over max accuracy)` })}`
                        : ''),
                  ]
                : []),
            ]}
            label={t('automation.position_estimation.run_now', 'Recalculate now')}
            busy={running || s.inProgress}
            busyLabel={t('automation.position_estimation.running', 'Running…')}
            onRun={() => void run()}
          />
        </>
      )}
    </SettingGroup>
  );
}

function AutoEnrichmentGroup() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: AE_KEY,
    queryFn: async () => (await apiService.get<{ data: AeStatus }>('/api/settings/auto-enrichment/status')).data,
    ...ONCE,
    // Today's poll, only while a run (scheduled or not) is in progress.
    refetchInterval: (query) => (query.state.data?.inProgress ? STATUS_POLL_MS : false),
  });
  const { running, run } = useRun('/api/settings/auto-enrichment/run-now', () => void q.refetch(), {
    ok: (body) => {
      const summary = (body as { data: { nodesFilled: number; fieldsCopied: number } }).data;
      return t('automation.auto_enrichment.run_result', { nodes: summary.nodesFilled, fields: summary.fieldsCopied, defaultValue: `Filled ${summary.nodesFilled} node(s), ${summary.fieldsCopied} field(s)` });
    },
    busy: t('automation.auto_enrichment.already_running', 'Auto-enrichment is already running'),
    failed: t('automation.auto_enrichment.run_failed', 'Failed to run auto-enrichment'),
  });
  const s = q.data;
  if (q.isError) return <SettingGroup title={t('automation.auto_enrichment.title', 'Auto-Enrichment')}><StateView kind="error" onRetry={() => void q.refetch()} /></SettingGroup>;
  if (!s) return <SettingGroup title={t('automation.auto_enrichment.title', 'Auto-Enrichment')}><StateView kind="loading" /></SettingGroup>;
  const cron = s.cron || AE_DEFAULT_CRON;
  const cap = s.limits?.pushCapPerRun ?? 25;
  const spacing = Math.round((s.limits?.pushSpacingMs ?? 30_000) / 1000);
  const off = !s.enabled;
  return (
    <SettingGroup title={t('automation.auto_enrichment.title', 'Auto-Enrichment')}>
      <p className={styles.cardPara}>
        {t('automation.auto_enrichment.description', 'Runs the NodeInfo Enrichment "Fix All" on a schedule: blank names, hardware and keys on one source are filled from another source that has them. Nothing is overwritten.')}
      </p>
      <StatusToggle id="background-jobs.autoEnrichmentEnabled" label={t('automation.auto_enrichment.enable', 'Enable auto-enrichment')} value={s.enabled} body={bool('autoEnrichmentEnabled')} queryKey={AE_KEY} />
      <StatusSelect
        segmented
        id="background-jobs.autoEnrichmentScheduleType"
        label={t('automation.auto_enrichment.schedule_type', 'Schedule')}
        value={s.scheduleType}
        options={[
          { value: 'interval', label: t('automation.auto_enrichment.type_interval', 'Fixed interval') },
          { value: 'cron', label: t('automation.auto_enrichment.type_cron', 'Cron expression') },
        ]}
        // Today's Save sent the cron with the type; a cron schedule needs one the server accepts.
        body={(v): Record<string, string> => (v === 'cron' ? { autoEnrichmentScheduleType: v, autoEnrichmentCron: cron.trim() } : { autoEnrichmentScheduleType: v })}
        queryKey={AE_KEY}
        disabled={off}
      />
      {s.scheduleType === 'interval' ? (
        <StatusSelect
          id="background-jobs.autoEnrichmentIntervalMinutes"
          label={t('automation.auto_enrichment.interval', 'Run every')}
          value={String(Math.round(s.intervalMinutes / 60))}
          options={AE_INTERVAL_HOURS.map((h) => ({ value: String(h), label: t('automation.auto_enrichment.every_hours', { count: h, defaultValue: `Every ${h} hour(s)` }) }))}
          body={(v) => ({ autoEnrichmentIntervalMinutes: String(Number(v) * 60) })}
          queryKey={AE_KEY}
          disabled={off}
        />
      ) : (
        <StatusText
          id="background-jobs.autoEnrichmentCron"
          label={t('automation.auto_enrichment.cron', 'Cron expression')}
          help={t('automation.auto_enrichment.cron_help', 'Must fire at most once an hour. Example: 0 */6 * * * runs every six hours.')}
          placeholder={AE_DEFAULT_CRON}
          value={cron}
          body={(v) => ({ autoEnrichmentCron: v.trim() })}
          queryKey={AE_KEY}
          disabled={off}
        />
      )}
      <StatusToggle
        id="background-jobs.autoEnrichmentPushToNodeDb"
        label={t('automation.auto_enrichment.push', 'Also push corrections to the device NodeDB')}
        help={<SendsLine>{t('workspace.server.enrich_push_sends', { cap, spacing })}</SendsLine>}
        value={s.pushToNodeDb}
        body={bool('autoEnrichmentPushToNodeDb')}
        queryKey={AE_KEY}
        disabled={off}
      />
      <RunRow
        adminOnly
        lines={[
          `${t('automation.auto_enrichment.last_run', 'Last run')}: ${s.lastRunAt ? when(s.lastRunAt) : t('automation.auto_enrichment.never', 'never')}`,
          ...(s.lastRunSummary
            ? [t('automation.auto_enrichment.last_result', { nodes: s.lastRunSummary.nodesFilled, fields: s.lastRunSummary.fieldsCopied, sent: s.lastRunSummary.pushesSent, defaultValue: `${s.lastRunSummary.nodesFilled} node(s) filled, ${s.lastRunSummary.fieldsCopied} field(s); ${s.lastRunSummary.pushesSent} NodeInfo request(s) sent` })]
            : []),
          ...(s.pendingPushes > 0 ? [t('automation.auto_enrichment.pending', { count: s.pendingPushes, defaultValue: `${s.pendingPushes} push(es) waiting for the next run` })] : []),
        ]}
        label={t('automation.auto_enrichment.run_now', 'Run now')}
        busy={running || s.inProgress}
        busyLabel={t('automation.auto_enrichment.running', 'Running…')}
        onRun={() => void run()}
      />
    </SettingGroup>
  );
}

/** Today's eleven thresholds (MeshIssuesSection): key, status field, label, help, range, step, badge, today's fallback. */
const THRESHOLDS: Array<{ key: string; field: keyof MiThresholds; label: [string, string]; help: [string, string]; min: number; max: number; step: number; official?: boolean; fallback: number }> = [
  { key: 'mesh_issues_air_util_tx_pct', field: 'airUtilTxPct', label: ['automation.mesh_issues.air_util_tx', 'Airtime TX ceiling (%)'], help: ['automation.mesh_issues.air_util_tx_help', 'Official Meshtastic guidance: above 8% a node is using too much of the channel.'], min: 1, max: 50, step: 1, official: true, fallback: 8 },
  { key: 'mesh_issues_channel_util_pct', field: 'channelUtilPct', label: ['automation.mesh_issues.channel_util', 'Channel utilization ceiling (%)'], help: ['automation.mesh_issues.channel_util_help', 'Official Meshtastic guidance: above 25% the local RF area is congested.'], min: 5, max: 100, step: 1, official: true, fallback: 25 },
  { key: 'mesh_issues_mobile_span_meters', field: 'mobileSpanMeters', label: ['automation.mesh_issues.mobile_span', 'Mobile span (metres)'], help: ['automation.mesh_issues.mobile_span_help', 'How far an infrastructure node may move before it is flagged. Not an official Meshtastic figure.'], min: 50, max: 50000, step: 10, fallback: 500 },
  { key: 'mesh_issues_snr_asymmetry_db', field: 'snrAsymmetryDb', label: ['automation.mesh_issues.snr_asymmetry', 'Link SNR asymmetry (dB)'], help: ['automation.mesh_issues.snr_asymmetry_help', "Directional mean-SNR delta above which a link is flagged as asymmetric. MeshMonitor's own judgement, not an official figure."], min: 1, max: 30, step: 1, fallback: 6 },
  { key: 'mesh_issues_over_broadcast_seconds', field: 'overBroadcastSeconds', label: ['automation.mesh_issues.over_broadcast', 'Broadcast interval floor (seconds)'], help: ['automation.mesh_issues.over_broadcast_help', "Median position/telemetry inter-arrival below which a non-tracker node counts as over-broadcasting. MeshMonitor's own judgement, not an official figure."], min: 30, max: 3600, step: 10, fallback: 300 },
  { key: 'mesh_issues_auto_close_runs', field: 'autoCloseCleanRuns', label: ['automation.mesh_issues.auto_close_runs', 'Auto-close after'], help: ['automation.mesh_issues.auto_close_runs_help', 'Runs without re-detection before an issue auto-closes.'], min: 1, max: 20, step: 1, fallback: 3 },
  { key: 'mesh_issues_router_cluster_max_link_km', field: 'routerClusterMaxLinkKm', label: ['automation.mesh_issues.cluster_max_link_km', 'Router cluster max link (km)'], help: ['automation.mesh_issues.cluster_max_link_km_help', 'Positioned routers farther apart than this never count as one Router Cluster or as redundant coverage. Filters MQTT-bridged "hops" that never happened over RF.'], min: 1, max: 500, step: 1, fallback: 30 },
  { key: 'mesh_issues_stale_hours_meshtastic', field: 'staleHoursMeshtastic', label: ['automation.mesh_issues.stale_hours_meshtastic', 'Stale after, Meshtastic (hours)'], help: ['automation.mesh_issues.stale_hours_meshtastic_help', 'Hours without a sign of life before a Meshtastic infrastructure node is flagged as stale. Nodes unheard for over 30 days count as retired and are not flagged.'], min: 2, max: 720, step: 1, fallback: 24 },
  { key: 'mesh_issues_stale_hours_meshcore', field: 'staleHoursMeshcore', label: ['automation.mesh_issues.stale_hours_meshcore', 'Stale after, MeshCore (hours)'], help: ['automation.mesh_issues.stale_hours_meshcore_help', 'Same for MeshCore repeaters and room servers. Far repeaters only refresh when they send a flood advert (47 h by default), so keep this above that interval.'], min: 12, max: 720, step: 1, fallback: 96 },
  { key: 'mesh_issues_low_battery_pct', field: 'lowBatteryPct', label: ['automation.mesh_issues.low_battery_pct', 'Low battery, Meshtastic (%)'], help: ['automation.mesh_issues.low_battery_pct_help', 'Battery percent below which an infrastructure node is flagged. Also sets the deep-discharge line for the power rule.'], min: 1, max: 80, step: 1, fallback: 20 },
  { key: 'mesh_issues_low_battery_mv', field: 'lowBatteryMv', label: ['automation.mesh_issues.low_battery_mv', 'Low battery, MeshCore (mV)'], help: ['automation.mesh_issues.low_battery_mv_help', 'Battery millivolts below which a MeshCore repeater or room server is flagged. LiFePO4 packs rest near 3.2 to 3.3 V, so a 3300 mV line can fire on a healthy LiFePO4 pack; lower it for those.'], min: 2500, max: 4100, step: 50, fallback: 3300 },
];

const TIERS = [
  { key: 'mesh_issues_tier_a_enabled', field: 'tierAEnabled', label: ['automation.mesh_issues.tier_a', 'Tier A — Node health'], help: ['automation.mesh_issues.tier_a_help', 'Battery, uptime, airtime/channel utilization, and mobility of infrastructure-role nodes.'] },
  { key: 'mesh_issues_tier_b_enabled', field: 'tierBEnabled', label: ['automation.mesh_issues.tier_b', 'Tier B — RF adjacency graph'], help: ['automation.mesh_issues.tier_b_help', 'Router clustering, redundancy, SNR asymmetry, idle/load-bearing routers, hop horizon, and coverage shadow, built from traceroutes, NeighborInfo, and packet-log evidence.'] },
  { key: 'mesh_issues_tier_c_enabled', field: 'tierCEnabled', label: ['automation.mesh_issues.tier_c', 'Tier C — Node flags'], help: ['automation.mesh_issues.tier_c_help', 'Excessive packet rate, key security (low-entropy/duplicate/mismatched keys), clock offset, and over-broadcasting — folded in from flags other services already compute.'] },
] as const;

function MeshIssuesGroup() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: MI_KEY,
    queryFn: async () => (await apiService.get<{ data: MiStatus }>('/api/analysis/mesh-issues/status')).data,
    ...ONCE,
  });
  const { running, run } = useRun('/api/analysis/mesh-issues/run-now', () => void q.refetch(), {
    ok: (body) => {
      const count = (body as { data?: { findingCount: number } }).data?.findingCount ?? 0;
      return t('automation.mesh_issues.run_result', { count, defaultValue: `Analysis complete: ${count} finding(s)` });
    },
    busy: t('automation.mesh_issues.already_running', 'Mesh issues analysis already running'),
    failed: t('automation.settings_save_failed', 'Failed to run'),
  });
  const title = t('automation.mesh_issues.title', 'Mesh Issues Analysis');
  const s = q.data;
  if (q.isError) return <SettingGroup title={title}><StateView kind="error" onRetry={() => void q.refetch()} /></SettingGroup>;
  if (!s) return <SettingGroup title={title}><StateView kind="loading" /></SettingGroup>;
  const off = !s.enabled;
  const hours = (h: number) => t('automation.mesh_issues.every_hours', { count: h, defaultValue: `Every ${h} hours` });
  const lookback = (h: number) =>
    h % 24 === 0
      ? t('automation.position_estimation.lookback_days', { count: h / 24, defaultValue: `${h / 24} day(s)` })
      : t('automation.position_estimation.lookback_hours', { count: h, defaultValue: `${h} hour(s)` });
  const badge = (official?: boolean) => (
    <span className={styles.tag} data-tone={official ? 'official' : undefined}>
      {(official ? t('automation.mesh_issues.badge_official', '[official]') : t('automation.mesh_issues.badge_meshmonitor', '[MeshMonitor]')).replace(/^\[|\]$/g, '')}
    </span>
  );
  return (
    <>
      <SettingGroup title={title}>
        <p className={styles.cardPara}>
          {t('automation.mesh_issues.description', 'Scheduled health report over routing, RF adjacency, and node-flag data your sources have already collected. Sends zero packets — it never generates a traceroute, polls a node, or sends a message. "Run analysis now" is also passive.')}
        </p>
        <StatusToggle id="background-jobs.mesh_issues_enabled" label={t('workspace.server.mi_enable')} value={s.enabled} body={bool('mesh_issues_enabled')} queryKey={MI_KEY} />
        <StatusSelect id="background-jobs.mesh_issues_frequency_hours" label={t('automation.mesh_issues.frequency', 'Analysis frequency')} value={String(s.frequencyHours)} options={MI_FREQUENCY.map((h) => ({ value: String(h), label: hours(h) }))} body={num('mesh_issues_frequency_hours')} queryKey={MI_KEY} disabled={off} />
        <StatusSelect id="background-jobs.mesh_issues_lookback_hours" label={t('automation.mesh_issues.lookback', 'Lookback window')} value={String(s.lookbackHours)} options={LOOKBACK.map((h) => ({ value: String(h), label: lookback(h) }))} body={num('mesh_issues_lookback_hours')} queryKey={MI_KEY} disabled={off} />
        <StatusSelect
          id="background-jobs.mesh_issues_pair_bucket_hours"
          label={t('automation.mesh_issues.pair_bucket', 'Traceroute pair bucket')}
          help={t('automation.mesh_issues.pair_bucket_help', 'How the traceroute corpus dedupes repeated observations of the same node pair before sampling.')}
          value={String(s.pairBucketHours)}
          options={MI_PAIR_BUCKET.map((h) => ({ value: String(h), label: hours(h) }))}
          body={num('mesh_issues_pair_bucket_hours')}
          queryKey={MI_KEY}
          disabled={off}
        />
        <RunRow
          lines={[
            `${t('automation.mesh_issues.last_run', 'Last run')}: ${s.lastRunTime ? when(s.lastRunTime) : t('automation.mesh_issues.never', 'never')}`,
            ...(s.lastRunResult
              ? [
                  t('automation.mesh_issues.last_result', { count: s.lastRunResult.findingCount, defaultValue: `${s.lastRunResult.findingCount} finding(s)` }) +
                    (s.lastRunResultFromStorage ? ` ${t('automation.mesh_issues.from_storage', '(from the last completed run before restart)')}` : ''),
                ]
              : []),
          ]}
          label={t('automation.mesh_issues.run_now', 'Run analysis now')}
          busy={running || s.inProgress}
          busyLabel={t('automation.mesh_issues.running', 'Running…')}
          onRun={() => void run()}
        />
      </SettingGroup>
      <SettingGroup title={t('automation.mesh_issues.rules_heading', 'Rules')}>
        {TIERS.map((tier) => (
          <StatusToggle
            key={tier.key}
            id={`background-jobs.${tier.key}`}
            label={t(tier.label[0], tier.label[1])}
            help={t(tier.help[0], tier.help[1])}
            value={s.thresholds[tier.field]}
            body={bool(tier.key)}
            queryKey={MI_KEY}
            disabled={off}
          />
        ))}
        <RuleMutes muted={s.thresholds.disabledRules ?? []} autoCloseRuns={s.thresholds.autoCloseCleanRuns ?? 3} disabled={off} />
      </SettingGroup>
      <SettingGroup title={t('automation.mesh_issues.thresholds_heading', 'Thresholds')}>
        {THRESHOLDS.map((f) => (
          <StatusNumber
            key={f.key}
            id={`background-jobs.${f.key}`}
            label={t(f.label[0], f.label[1])}
            help={t(f.help[0], f.help[1])}
            tag={badge(f.official)}
            value={(s.thresholds[f.field] as number | undefined) ?? f.fallback}
            min={f.min}
            max={f.max}
            step={f.step}
            body={num(f.key)}
            queryKey={MI_KEY}
            disabled={off}
          />
        ))}
        <p className={styles.cardPara}>
          {t('automation.mesh_issues.other_thresholds', 'Other thresholds are fixed in code. See the Mesh Issues documentation for the full list and where each number comes from.')}
        </p>
      </SettingGroup>
    </>
  );
}

/** Today's per-rule mutes: one write per change, the CSV and the legacy B7 key together (buildRuleMuteSettingsPatch). */
function RuleMutes({ muted, autoCloseRuns, disabled }: { muted: string[]; autoCloseRuns: number; disabled: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const readOnly = useReadOnly(disabled || undefined);
  const [list, set, status] = useStatusSetting<string[]>({ value: muted, body: buildRuleMuteSettingsPatch, queryKey: MI_KEY }, 'change');
  const groups = ruleIdsByTier();
  return (
    <>
      <p className={styles.cardPara}>
        <strong>{t('automation.mesh_issues.rule_mute_heading', 'Individual rules')}</strong>{' '}
        {t('automation.mesh_issues.rule_mute_help', 'Uncheck a rule to stop detecting it. Muting does not delete anything: its existing open findings stay as they are and auto-close on their own after {{runs}} analysis run(s) in a row with nothing re-detected — the same way a disabled tier already behaves.', { runs: autoCloseRuns })}
      </p>
      <div className={styles.ruleGrid} data-phone={isPhone || undefined}>
        {(['A', 'B', 'C'] as const).map((tier) => (
          <div key={tier}>
            <p className={styles.ruleTier}>{t(`automation.mesh_issues.tier_${tier.toLowerCase()}_short`, `Tier ${tier}`)}</p>
            {groups[tier].map((ruleId) => (
              <label key={ruleId} className={styles.ruleCheck}>
                <input
                  type="checkbox"
                  checked={!list.includes(ruleId)}
                  disabled={readOnly}
                  onChange={(e) => set(e.target.checked ? list.filter((id) => id !== ruleId) : [...new Set([...list, ruleId])])}
                />
                <span className={styles.ruleId}>{ruleShortId(ruleId)}</span>{' '}
                <span>{ISSUE_TYPE_LABELS[ruleId] ?? ruleId}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <p className={styles.cardPara}>
        <SavedLine status={status} />
      </p>
    </>
  );
}

function CoverageGroup() {
  const { t } = useTranslation();
  return (
    <SettingGroup title={t('settings.coverage_section', 'Coverage Report')}>
      <AutoNumber
        k="coverage_retention_days"
        id="background-jobs.coverage_retention_days"
        label={t('settings.coverage_retention_days', 'RF reception retention (days)')}
        help={t('settings.coverage_retention_help')}
        min={1}
        max={90}
        parse={(raw) => clampCoverageRetentionDays(raw)}
      />
    </SettingGroup>
  );
}

/** Phone (s13n7): Solar is a row that opens its own page. */
function SolarLink() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <SettingGroup>
      <Link to="/server/background-jobs/solar" className={pages.linkRow}>
        <span className={pages.infoText}>
          <span className={pages.infoLabel}>{t('settings.solar_monitoring')}</span>
        </span>
        <span className={pages.infoHelp}>
          {s.solarMonitoringEnabled ? t('workspace.server.on') : t('workspace.server.off')}
        </span>
        <UiIcon name="chevronRight" size={18} />
      </Link>
    </SettingGroup>
  );
}

const float = (fallback: number) => (raw?: string) => {
  const n = raw === undefined ? NaN : parseFloat(raw);
  return Number.isNaN(n) ? fallback : n;
};
const whole = (fallback: number) => (raw?: string) => {
  const n = raw === undefined ? NaN : parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
};

/**
 * Today's Solar Monitoring rows (SettingsTab), saved as you go with today's
 * stored format, fanned out to SettingsContext as today's Save did; Fetch
 * Estimates Now is today's one `POST /api/solar/trigger`.
 */
export function SolarRows() {
  const { t } = useTranslation();
  const s = useSettings();
  const csrfFetch = useCsrfFetch();
  const { showToast } = useToast();
  const [fetching, setFetching] = useState(false);
  const fetchNow = async () => {
    setFetching(true);
    try {
      const response = await csrfFetch(`${appBasename}/api/solar/trigger`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error('Failed to trigger solar estimate fetch');
      showToast(t('settings.solar_fetch_success'), 'success');
    } catch (error) {
      logger.error('Error triggering solar estimate fetch:', error);
      showToast(t('settings.solar_fetch_failed'), 'error');
    } finally {
      setFetching(false);
    }
  };
  return (
    <AutoToggle
        k="solarMonitoringEnabled"
        id="background-jobs.solarMonitoringEnabled"
        label={t('settings.solar_monitoring')}
        help={
          <>
            {t('settings.solar_monitoring_description', { link: '' })}
            <a className={pages.link} href="https://forecast.solar/" target="_blank" rel="noopener noreferrer">
              Forecast.Solar
            </a>
          </>
        }
        parse={(raw) => raw === '1' || raw === 'true'}
        serialize={(v) => (v ? '1' : '0')}
        onSaved={s.setSolarMonitoringEnabled}
        render={(on) =>
          on && (
            <>
              <AutoNumber k="solarMonitoringLatitude" id="background-jobs.solarMonitoringLatitude" label={t('settings.solar_latitude')} help={t('settings.solar_latitude_description')} min={-90} max={90} step={0.0001} parse={float(0)} onSaved={s.setSolarMonitoringLatitude} />
              <AutoNumber k="solarMonitoringLongitude" id="background-jobs.solarMonitoringLongitude" label={t('settings.solar_longitude')} help={t('settings.solar_longitude_description')} min={-180} max={180} step={0.0001} parse={float(0)} onSaved={s.setSolarMonitoringLongitude} />
              <AutoNumber k="solarMonitoringAzimuth" id="background-jobs.solarMonitoringAzimuth" label={t('settings.solar_azimuth')} help={t('settings.solar_azimuth_description')} min={-180} max={180} step={1} parse={whole(0)} onSaved={s.setSolarMonitoringAzimuth} />
              <AutoNumber k="solarMonitoringDeclination" id="background-jobs.solarMonitoringDeclination" label={t('settings.solar_declination')} help={t('settings.solar_declination_description')} min={0} max={90} step={1} parse={whole(30)} onSaved={s.setSolarMonitoringDeclination} />
              <div className={pages.infoRow}>
                <span className={pages.infoText}>
                  <span className={pages.infoHelp}>{t('settings.solar_fetch_description')}</span>
                </span>
                <button type="button" className={pages.button} disabled={fetching} onClick={() => void fetchNow()}>
                  {fetching ? t('settings.solar_fetching') : t('settings.solar_fetch_now')}
                </button>
              </div>
            </>
          )
        }
      />
  );
}
