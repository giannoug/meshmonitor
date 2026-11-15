/**
 * Overview › Messages keeps to the devices the viewer can read (Review Focus 2):
 * the shell's device list holds only those. The server already scopes the
 * unified replies; this keeps a reception, a channel's source or an export
 * source from naming any other device, even if a reply ever did.
 */
import { useMemo } from 'react';
import { useShellDevices } from '../shell/shellDevices';
import type { UnifiedChannel, UnifiedMessage } from '../../pages/useUnifiedMessagesFeed';

export function useReadableSourceIds(): Set<string> {
  const { sources } = useShellDevices();
  return useMemo(() => new Set(sources.map((s) => s.id)), [sources]);
}

/** The message with only readable receptions, or null when none is left. */
export function readableMessage(m: UnifiedMessage, readable: Set<string>): UnifiedMessage | null {
  const receptions = m.receptions.filter((r) => readable.has(r.sourceId));
  if (receptions.length === 0) return null;
  return receptions.length === m.receptions.length ? m : { ...m, receptions };
}

/** Channels with only readable sources; a channel with none is left out. */
export function readableChannels(channels: UnifiedChannel[], readable: Set<string>): UnifiedChannel[] {
  return channels.flatMap((c) => {
    const sources = c.sources.filter((s) => readable.has(s.sourceId));
    return sources.length ? [{ ...c, sources }] : [];
  });
}
