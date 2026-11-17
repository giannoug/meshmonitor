/**
 * Discover (boards 8-11, 8-28): today's three node discoveries (Nearby,
 * Repeaters, Sensors) as one segmented control with its Sends line. One
 * `POST …/discover {mode}` per press, no retry, none while one runs; today's
 * gate (shown only for a connected Companion, off in receive-only). The
 * answer shows as a line under it, in today's words, and which rows are new.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { DiscoveredNode } from '../../components/MeshCore/hooks/useMeshCore';
import { useSettings } from '../../contexts/SettingsContext';
import { formatTimeOrDate } from '../../utils/datetime';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './MeshCoreNodesTable.module.css';

export type DiscoverMode = 'nearby' | 'repeaters' | 'sensors';

const MODES: Array<[DiscoverMode, string, string]> = [
  ['nearby', 'meshcore.discover.nearby', 'Discover Nearby Nodes'],
  ['repeaters', 'meshcore.discover.repeaters', 'Discover Repeaters'],
  ['sensors', 'meshcore.discover.sensors', 'Discover Sensors'],
];

export interface DiscoverMenuProps {
  onDiscover(mode: DiscoverMode): Promise<{ returned: number; newCount: number; nodes: DiscoveredNode[] } | null>;
  /** Today's receive-only reason, else undefined. */
  reason?: string;
  /** The keys the last discovery found for the first time (the rows' New tag). */
  onNew(keys: Set<string>): void;
}

type Outcome = { mode: DiscoverMode; ok: true; returned: number; newCount: number; at: number } | { mode: DiscoverMode; ok: false };

export default function DiscoverMenu({ onDiscover, reason, onNew }: DiscoverMenuProps) {
  const { t } = useTranslation();
  const { timeFormat, dateFormat } = useSettings();
  const isPhone = useIsPhone();
  const [running, setRunning] = useState<DiscoverMode | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const label = (mode: DiscoverMode) => {
    const m = MODES.find(([k]) => k === mode)!;
    return t(m[1], m[2]);
  };

  const run = async (mode: DiscoverMode) => {
    if (running || reason) return;
    setRunning(mode);
    try {
      const result = await onDiscover(mode);
      if (result) {
        setOutcome({ mode, ok: true, returned: result.returned, newCount: result.newCount, at: Date.now() });
        onNew(new Set(result.nodes.filter((n) => n.isNew).map((n) => n.publicKey.toLowerCase())));
      } else {
        setOutcome({ mode, ok: false });
      }
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className={styles.discover} data-phone={isPhone || undefined}>
      <div className={styles.discoverRow}>
        <span className={styles.discoverLabel}>{t('meshcore.discover.button', 'Discover')}</span>
        <span className={styles.segments} role="group" aria-label={t('meshcore.discover.title', 'Discover nodes')}>
          {MODES.map(([mode]) => (
            <button
              key={mode}
              type="button"
              className={styles.segment}
              aria-pressed={(running ?? outcome?.mode) === mode}
              aria-busy={running === mode || undefined}
              disabled={!!reason || running !== null}
              title={reason}
              onClick={() => void run(mode)}
            >
              <UiIcon name="radioSignal" size={14} />
              {running === mode ? t('meshcore.discover.running', 'Discovering…') : label(mode)}
            </button>
          ))}
        </span>
        {reason ? <p className={styles.reason}>{reason}</p> : <SendsLine>{t('workspace.meshcore.sends_discover_nodes')}</SendsLine>}
      </div>
      {outcome && (
        <p className={styles.outcome} data-ok={outcome.ok || undefined} role="status">
          <UiIcon name={outcome.ok ? 'check' : 'alert'} size={16} />
          {outcome.ok
            ? t('workspace.meshcore.discover_result', {
                mode: label(outcome.mode),
                result: t('meshcore.discover.result', '{{returned}} contacts returned ({{new}} new)', { returned: outcome.returned, new: outcome.newCount }),
                time: formatTimeOrDate(new Date(outcome.at), timeFormat, dateFormat),
              })
            : t('meshcore.discover.failed', 'Discovery failed')}
        </p>
      )}
    </div>
  );
}
