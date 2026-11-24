/**
 * The node's own neighbour report (boards 15-04, 15-17, g5-links): who it
 * says it hears, with SNR and distance, and today's Purge. As today (s15n4,
 * spec non-goal) Purge has no gate in the UI, the same plain confirm words and
 * the same request; the server refuses it without nodes:write. The report is
 * read once from the device's neighbour list (the device map's query, no
 * refresh timer, Ruling N); Purge deletes it from MeshMonitor and sends
 * nothing on the mesh. Hidden when the node has reported no neighbours.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import type { EnrichedNeighborInfo } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useNodes } from '../../hooks/useServerData';
import api from '../../services/api';
import type { DeviceInfo } from '../../types/device';
import { formatRelativeTime } from '../../utils/datetime';
import { calculateDistance, formatDistance } from '../../utils/distance';
import { avatarStyle, nodeIdOf, shortLabel } from '../nodes/nodeColumns';
import ConfirmSheet from '../patterns/ConfirmSheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './Neighbours.module.css';

/** Old rows carry seconds, new ones milliseconds (MessagesTab's rule). */
const ms = (ts: number) => (ts < 10_000_000_000 ? ts * 1000 : ts);

export default function Neighbours({ sourceId, node }: { sourceId: string; node: DeviceInfo }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { nodes } = useNodes();
  const { distanceUnit, timeFormat, dateFormat } = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const isPhone = useIsPhone();
  const queryKey = ['workspace', 'neighbor-info', sourceId];
  const { data } = useQuery({
    queryKey,
    queryFn: () => api.get<EnrichedNeighborInfo[]>(`/api/sources/${encodeURIComponent(sourceId)}/neighbor-info`),
  });
  const rows = (data ?? []).filter((n) => n.nodeNum === node.nodeNum);
  if (rows.length === 0) return null;

  const title = t('messages.neighbor_info_title', 'Neighbor Info');
  const newest = Math.max(...rows.map((n) => ms(n.timestamp)));
  const purge = async () => {
    setBusy(true);
    try {
      // MessagesTab's handlePurgeNeighbors: the same request, then drop the rows here.
      await api.purgeNeighborInfo(nodeIdOf(node));
      queryClient.setQueryData<EnrichedNeighborInfo[]>(queryKey, (prev) => prev?.filter((n) => n.nodeNum !== node.nodeNum));
      showToast(t('messages.neighbor_info_purged', 'Neighbor info purged successfully'), 'success');
      setConfirming(false);
    } catch {
      throw new Error(t('messages.neighbor_info_purge_failed', 'Failed to purge neighbor info'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.card} aria-label={title} data-phone={isPhone || undefined}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          {title}
          <span className={styles.age}>{formatRelativeTime(newest, timeFormat, dateFormat)}</span>
        </h2>
        <button type="button" className={styles.purge} onClick={() => setConfirming(true)} title={t('messages.purge_neighbors_tooltip', 'Delete neighbor info for this node')}>
          <UiIcon name="delete" size={16} />
          {t('messages.purge_neighbors', 'Purge')}
        </button>
      </div>
      <ul className={styles.list}>
        {rows.map((n) => {
          const peer = nodes.find((p) => p.nodeNum === n.neighborNodeNum);
          const name = n.neighborName || n.neighborNodeId || `!${n.neighborNodeNum.toString(16)}`;
          const dist = n.nodeLatitude != null && n.nodeLongitude != null && n.neighborLatitude != null && n.neighborLongitude != null
            ? formatDistance(calculateDistance(n.nodeLatitude, n.nodeLongitude, n.neighborLatitude, n.neighborLongitude), distanceUnit)
            : null;
          const line = [n.snr != null ? `SNR ${n.snr.toFixed(1)} dB` : null, dist].filter(Boolean).join(' · ');
          return (
            <li key={n.neighborNodeNum} className={styles.row} data-neighbour="">
              <span className={styles.avatar} style={peer ? avatarStyle(peer) : undefined} aria-hidden="true">
                {peer ? shortLabel(peer) : name.slice(-4)}
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{name}</span>
                {line && <span className={styles.line}>{line}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <ConfirmSheet
        submitOnEnter={false}
        open={confirming}
        title={t('messages.purge_neighbors', 'Purge')}
        body={<p>{t('messages.confirm_purge_neighbors', 'Are you sure you want to delete all neighbor info for this node?')}</p>}
        confirmLabel={t('messages.purge_neighbors', 'Purge')}
        danger
        busy={busy}
        onConfirm={purge}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
