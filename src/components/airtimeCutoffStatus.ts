/**
 * The airtime cutoff's live status as words (AirtimeCutoffSection), moved as
 * is (Task 8.3, Rule X) so Classic and the Workspace page say the same thing:
 * the status line, the neighbours suffix, how the gap was filled, who was
 * skipped and who is in the average. Display only.
 */
import type { TFunction } from 'i18next';

export type AirtimeSource = 'local' | 'neighbors';
export type NeighborMode = 'auto' | 'manual';
export type SkipReason = 'not_found' | 'mqtt' | 'not_infrastructure' | 'stale';

export interface SkippedNode {
  nodeNum: number;
  nodeId: string | null;
  longName: string | null;
  shortName: string | null;
  reason: SkipReason;
}

export interface AirtimeContributor {
  nodeNum: number | null;
  nodeId: string | null;
  longName: string | null;
  shortName: string | null;
  rssi: number | null;
  channelUtilization: number;
}

export interface AirtimeStatus {
  threshold: number;
  source: AirtimeSource;
  neighborMaxHops?: number;
  channelUtilization: number | null;
  sampleCount: number;
  contributors?: AirtimeContributor[];
  gated: boolean;
  // Issue #6007 (neighbours mode only)
  neighborMode?: NeighborMode;
  targetCount?: number;
  neighborAverage?: number | null;
  localChannelUtilization?: number | null;
  localUsed?: 'no_neighbors' | 'higher_than_neighbors' | null;
  skipped?: SkippedNode[];
}

/** Trim a percentage to at most 2 decimal places (drops trailing zeros). */
export const formatPercent = (value: number): number => parseFloat(value.toFixed(2));

export const nodeLabel = (n: { longName: string | null; shortName: string | null; nodeId: string | null; nodeNum: number | null }): string =>
  n.longName || n.shortName || n.nodeId || (n.nodeNum != null ? `!${n.nodeNum.toString(16).padStart(8, '0')}` : '?');

export interface AirtimeStatusView {
  disabled: boolean;
  gated: boolean;
  /** The banner's main line. */
  line: string;
  /** "(averaged from N infrastructure node(s))", or null. */
  suffix: string | null;
  fillLine: string | null;
  skippedLine: string | null;
  /** The nodes in the neighbour average (empty unless shown). */
  contributors: Array<{ key: string | number; name: string; detail: string }>;
}

/**
 * `local` is the form's draft: the threshold decides "disabled" and stands in
 * for the server's threshold, source and max hops until the status says.
 */
export function airtimeStatusView(
  t: TFunction,
  status: AirtimeStatus | null,
  local: { threshold: number; source: AirtimeSource; maxHops: number },
): AirtimeStatusView {
  const localThreshold = local.threshold;
  const localSource = local.source;
  const localMaxHops = local.maxHops;

  const disabled = localThreshold === 0;
  const util = status?.channelUtilization;
  const utilDisplay = util == null ? util : formatPercent(util);
  const gated = status?.gated ?? false;
  const statusSource: AirtimeSource = status?.source ?? localSource;
  const sampleCount = status?.sampleCount ?? 0;
  const contributors = status?.contributors ?? [];
  const localUsed = statusSource === 'neighbors' ? (status?.localUsed ?? null) : null;
  const skipped = statusSource === 'neighbors' ? (status?.skipped ?? []) : [];
  const targetCount = status?.targetCount ?? sampleCount;
  const sourceLabel = statusSource === 'neighbors' && !localUsed
    ? t('automation.airtime_cutoff.source_neighbors_label', 'neighbour-averaged')
    : t('automation.airtime_cutoff.source_local_label', 'local');

  const skipReasonLabel = (reason: SkipReason): string => {
    switch (reason) {
      case 'mqtt': return t('automation.airtime_cutoff.skip_mqtt', 'heard over MQTT');
      case 'not_infrastructure': return t('automation.airtime_cutoff.skip_not_infrastructure', 'no longer an infrastructure role');
      case 'not_found': return t('automation.airtime_cutoff.skip_not_found', 'not heard in the last day');
      default: return t('automation.airtime_cutoff.skip_stale', 'no fresh Channel Utilization');
    }
  };

  // Issue #6007: say when the local ChUtil filled the gap, and why.
  let fillLine: string | null = null;
  if (!disabled && statusSource === 'neighbors' && status) {
    const local = status.localChannelUtilization;
    const avg = status.neighborAverage;
    if (localUsed === 'no_neighbors' && local != null) {
      fillLine = t(
        'automation.airtime_cutoff.fill_no_neighbors',
        '0 of {{target}} infrastructure nodes qualify; using local {{local}}%.',
        { target: targetCount, local: formatPercent(local) },
      );
    } else if (localUsed === 'higher_than_neighbors' && local != null && avg != null) {
      fillLine = t(
        'automation.airtime_cutoff.fill_local_higher',
        '{{count}} of {{target}} infrastructure nodes qualify; using local {{local}}% (higher than their average {{avg}}%).',
        { count: sampleCount, target: targetCount, local: formatPercent(local), avg: formatPercent(avg) },
      );
    } else if (sampleCount > 0 && sampleCount < targetCount && avg != null) {
      fillLine = local != null
        ? t(
            'automation.airtime_cutoff.fill_local_lower',
            '{{count}} of {{target}} infrastructure nodes qualify; local {{local}}% is lower, so their average {{avg}}% is used.',
            { count: sampleCount, target: targetCount, local: formatPercent(local), avg: formatPercent(avg) },
          )
        : t(
            'automation.airtime_cutoff.fill_local_unknown',
            '{{count}} of {{target}} infrastructure nodes qualify; local Channel Utilization is not known yet.',
            { count: sampleCount, target: targetCount },
          );
    }
  }

  const line = disabled
    ? t('automation.airtime_cutoff.status_disabled', 'Airtime cutoff is disabled (threshold 0).')
    : util == null
      ? (statusSource === 'neighbors'
          ? ((status?.neighborMaxHops ?? localMaxHops) > 0
              ? t(
                  'automation.airtime_cutoff.status_unknown_neighbors_hops',
                  'Waiting for infrastructure (router) neighbours within {{hops}} hop(s) to report Channel Utilization…',
                  { hops: status?.neighborMaxHops ?? localMaxHops },
                )
              : t(
                  'automation.airtime_cutoff.status_unknown_neighbors',
                  'Waiting for 0-hop infrastructure (router) neighbours to report Channel Utilization…',
                ))
          : t('automation.airtime_cutoff.status_unknown', 'Waiting for the connected node to report Channel Utilization…'))
      : gated
        ? t('automation.airtime_cutoff.status_paused', 'Automations paused — {{source}} Channel Utilization {{util}}% exceeds {{threshold}}%.', { source: sourceLabel, util: utilDisplay, threshold: status?.threshold ?? localThreshold })
        : t('automation.airtime_cutoff.status_active', 'Automations active — {{source}} Channel Utilization {{util}}% is under {{threshold}}%.', { source: sourceLabel, util: utilDisplay, threshold: status?.threshold ?? localThreshold });

  const suffix = !disabled && util != null && statusSource === 'neighbors' && !localUsed
    ? t('automation.airtime_cutoff.status_neighbors_suffix', '(averaged from {{count}} infrastructure node(s))', { count: sampleCount })
    : null;

  const skippedLine = !disabled && skipped.length > 0
    ? t('automation.airtime_cutoff.skipped_line', 'Skipped: {{list}}', {
        list: skipped.map((n) => `${nodeLabel(n)} (${skipReasonLabel(n.reason)})`).join(', '),
      })
    : null;

  const shown = !disabled && statusSource === 'neighbors' ? contributors : [];
  return {
    disabled,
    gated,
    line,
    suffix,
    fillLine,
    skippedLine,
    contributors: shown.map((node, i) => ({
      key: node.nodeId ?? node.nodeNum ?? i,
      name: node.longName || node.shortName || node.nodeId || (node.nodeNum != null ? `!${node.nodeNum.toString(16)}` : t('automation.airtime_cutoff.contributor_unknown', 'Unknown node')),
      detail: node.rssi != null
        ? t('automation.airtime_cutoff.contributor_detail', '{{util}}% · {{rssi}} dBm', { util: formatPercent(node.channelUtilization), rssi: node.rssi })
        : t('automation.airtime_cutoff.contributor_detail_no_rssi', '{{util}}%', { util: formatPercent(node.channelUtilization) }),
    })),
  };
}
