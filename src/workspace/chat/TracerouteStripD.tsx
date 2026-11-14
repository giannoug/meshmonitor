/**
 * The traceroute strip above a DM (board 10-01; note s10n4): today's strip,
 * participation picker (Latest / Statistical / a stored run) and copy links,
 * with History opening today's TracerouteHistoryModal. Display only: the
 * Traceroute request is Ask the node's, with its Sends line.
 *
 * The row rules are MessagesTab's (#4381, SR_PHASE2_SPEC.md D13/D14): an
 * explicit pick wins, else the newer of the poll's run (last 7 days, App's
 * getRecentTraceroute) and the newest stored one; a new poll run clears the pick.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TracerouteHistoryModal from '../../components/TracerouteHistoryModal';
import { UiIcon } from '../../components/icons';
import { TracerouteCopyLinks } from '../../components/traceroute/TracerouteCopyLinks';
import { TracerouteParticipationPicker } from '../../components/traceroute/TracerouteParticipationPicker';
import { TracerouteStrip } from '../../components/traceroute/TracerouteStrip';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useNodeTraceroutes } from '../../hooks/useNodeTraceroutes';
import { useTraceroutePairHistory } from '../../hooks/useTraceroutePairHistory';
import { useTraceroutes } from '../../hooks/useTraceroutes';
import type { DeviceInfo } from '../../types/device';
import { buildTracerouteStripGraph, type TracerouteStripInput } from '../../utils/tracerouteStrip';
import { buildStripNodeMeta } from '../../utils/tracerouteStripMeta';
import { buildStatisticalStrip } from '../../utils/tracerouteUnionLayout';
import styles from './TracerouteStripD.module.css';

type Displayed = TracerouteStripInput & { id?: number; timestamp: number };
type Pick = { kind: 'entry'; id: number } | { kind: 'statistical' };

const DISPLAY_MS = 7 * 24 * 3_600_000;

export interface TracerouteStripDProps {
  sourceId: string;
  localNodeNum: number | null;
  nodeNum: number;
  localName: string;
  nodeName: string;
  nodes: DeviceInfo[];
  /** A hop on the strip was opened: the caller opens that node's DM. */
  onOpenNode(nodeId: string): void;
}

export default function TracerouteStripD({ sourceId, localNodeNum, nodeNum, localName, nodeName, nodes, onOpenNode }: TracerouteStripDProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { timeFormat, dateFormat, distanceUnit, nodeHopsCalculation } = useSettings();
  const { traceroutes } = useTraceroutes();
  const [pick, setPick] = useState<Pick | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canRead = hasPermission('traceroute', 'read', { sourceId }) || hasPermission('traceroute', 'write', { sourceId });

  const recent = useMemo(() => {
    const cutoff = Date.now() - DISPLAY_MS;
    return (
      traceroutes
        .filter((tr) => tr.timestamp >= cutoff &&
          ((tr.fromNodeNum === localNodeNum && tr.toNodeNum === nodeNum) || (tr.fromNodeNum === nodeNum && tr.toNodeNum === localNodeNum)))
        .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
    );
  }, [traceroutes, localNodeNum, nodeNum]);

  const { data: entries = [], refetch } = useNodeTraceroutes(nodeNum, { enabled: canRead });
  const { rows: pairHistory } = useTraceroutePairHistory(localNodeNum, nodeNum, {
    enabled: hasPermission('traceroute', 'read', { sourceId }) && localNodeNum != null && localNodeNum !== nodeNum,
  });

  useEffect(() => setPick(null), [nodeNum]);
  useEffect(() => {
    if (recent?.timestamp == null) return;
    setPick(null);
    void refetch();
  }, [recent?.timestamp, refetch]);

  const picked = pick?.kind === 'entry' ? entries.find((e) => e.id === pick.id) ?? null : null;
  const newest: Displayed | null = !recent ? entries[0] ?? null : !entries[0] ? recent : entries[0].timestamp >= recent.timestamp ? entries[0] : recent;
  const shown: Displayed | null = picked ?? newest;

  const strip = useMemo(() => {
    if (!shown) return null;
    const graph = buildTracerouteStripGraph(shown);
    return { graph, meta: buildStripNodeMeta(graph, nodes, { hopsCalculation: nodeHopsCalculation, traceroutes, currentNodeNum: localNodeNum }) };
  }, [shown, nodes, nodeHopsCalculation, traceroutes, localNodeNum]);

  const statistical = useMemo(() => {
    if (localNodeNum == null || !pairHistory?.length) return null;
    const { union, graph } = buildStatisticalStrip(pairHistory, localNodeNum, nodeNum);
    if (union.totalRoutes < 2 || graph.isEmpty) return null;
    const meta = buildStripNodeMeta(graph, nodes, { hopsCalculation: nodeHopsCalculation, traceroutes, currentNodeNum: localNodeNum });
    return { graph, meta, totalRoutes: union.totalRoutes };
  }, [pairHistory, localNodeNum, nodeNum, nodes, nodeHopsCalculation, traceroutes]);
  const showStatistical = pick?.kind === 'statistical' && statistical != null;

  if (!canRead || !shown) return null;

  const age = Math.max(0, Math.floor((Date.now() - shown.timestamp) / 60_000));
  const ageStr = age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`;
  const noData = (!shown.route || shown.route === 'null') && (!shown.routeBack || shown.routeBack === 'null');
  const pending = noData && age < 1;
  const stripProps = { timeFormat, dateFormat, distanceUnit, onOpenNodeDetails: onOpenNode };

  return (
    <section className={styles.strip} aria-label={t('messages.traceroute_button')}>
      <div className={styles.head}>
        <span className={styles.title}>
          <UiIcon name="route" size={18} /> {t('messages.traceroute_button')}
        </span>
        <TracerouteParticipationPicker
          entries={entries}
          selectedId={showStatistical ? null : (shown.id ?? null)}
          onSelect={(id) => setPick({ kind: 'entry', id })}
          nodes={nodes}
          timeFormat={timeFormat}
          dateFormat={dateFormat}
          statistical={statistical ? { totalRoutes: statistical.totalRoutes } : undefined}
          statisticalSelected={showStatistical}
          onSelectStatistical={() => setPick({ kind: 'statistical' })}
        />
        {!showStatistical && (
          <span className={styles.age}>
            {t('messages.last_traced', { time: ageStr })}
            {pending && ` (${t('messages.traceroute_pending', 'Pending')})`}
            {noData && !pending && ` (${t('messages.traceroute_failed')})`}
          </span>
        )}
        {localNodeNum != null && (
          <button type="button" className={styles.button} onClick={() => setHistoryOpen(true)}>
            <UiIcon name="time" size={16} /> {t('messages.history_button')}
          </button>
        )}
      </div>
      {showStatistical ? (
        <TracerouteStrip graph={statistical.graph} meta={statistical.meta} {...stripProps} />
      ) : strip && !strip.graph.isEmpty ? (
        <TracerouteStrip graph={strip.graph} meta={strip.meta} {...stripProps} />
      ) : (
        <p className={styles.note}>{t('messages.traceroute_no_response', 'No response received')}</p>
      )}
      {!showStatistical && strip && !strip.graph.isEmpty && !strip.graph.hasReturn && (
        <p className={styles.note}>{t('messages.traceroute_no_return_path', 'No return path data')}</p>
      )}
      {!showStatistical && (
        <TracerouteCopyLinks
          route={shown.route}
          routeBack={shown.routeBack}
          snrTowards={shown.snrTowards}
          snrBack={shown.snrBack}
          fromNodeNum={Number(shown.fromNodeNum)}
          toNodeNum={Number(shown.toNodeNum)}
          nodes={nodes}
        />
      )}
      {historyOpen && localNodeNum != null && (
        <TracerouteHistoryModal
          fromNodeNum={localNodeNum}
          toNodeNum={nodeNum}
          fromNodeName={localName}
          toNodeName={nodeName}
          nodes={nodes}
          sourceId={sourceId}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </section>
  );
}
