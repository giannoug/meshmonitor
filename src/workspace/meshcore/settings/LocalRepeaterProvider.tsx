/** Holds a local repeater's settings for its pages (localRepeater.ts): one read while the settings stay open. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RepeaterSettingsSnapshot } from '../../../components/MeshCore/hooks/useMeshCore';
import { LocalRepeaterContext } from './localRepeater';
import { useMcDevice } from './useMcDevice';

export default function LocalRepeaterProvider({ children }: { children: ReactNode }) {
  const d = useMcDevice();
  const [snapshot, setSnapshot] = useState<RepeaterSettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const actionsRef = useRef(d.actions);
  actionsRef.current = d.actions;
  // Today's gate: a connected repeater, configuration:read on this source.
  const active = d.connected && d.isRepeater && d.canReadConfig;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot((await actionsRef.current.getRepeaterSettings?.()) ?? null);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (active) void load();
    else setSnapshot(null);
  }, [active, load]);
  return <LocalRepeaterContext.Provider value={active ? { snapshot, loading, load } : null}>{children}</LocalRepeaterContext.Provider>;
}
