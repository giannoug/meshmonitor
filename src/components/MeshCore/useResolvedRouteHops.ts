/**
 * Shared route-hop resolution for the MeshCore Message Route and Packet Decode
 * modals (#6190). Both take a list of relay-hash hops and turn them into named
 * rows: own contacts first, then a best guess from cross-source candidates the
 * server returns for hops this source cannot name (#5909).
 *
 * The React components that render these rows live in the sibling
 * `MeshCoreRouteHops.tsx`; this file keeps the hooks and pure helpers so that
 * file exports components only (react-refresh ratchet).
 */
import { useEffect, useMemo, useState } from 'react';
import type { MeshCoreContact } from '../../utils/meshcoreHelpers';
import type { RouteFlowPoint } from '../map/RouteFlowMap';
import { uniquePrefixMatch } from '../../utils/meshcoreKeyMatch';
import {
  pathHashBytesOf,
  resolveRoute,
  resolveRouteWithFallback,
  type CrossSourceHopPool,
  type PathHop,
  type ResolvedRouteHopWithFallback,
} from '../../utils/meshcorePath';
import apiService from '../../services/api';

interface HopCandidatesResponse {
  success?: boolean;
  data?: { enabled?: boolean; candidates?: CrossSourceHopPool };
}

/**
 * Fetch other-source candidates for the hops own contacts left unknown. Skips
 * the call when every hop resolved, so a fully-known route costs nothing.
 */
export function useCrossSourceHopPool(
  sourceId: string | undefined,
  unknownHops: string[],
): CrossSourceHopPool | null {
  const [pool, setPool] = useState<CrossSourceHopPool | null>(null);
  const key = unknownHops.join(',');
  useEffect(() => {
    setPool(null);
    if (!sourceId || key === '') return;
    let cancelled = false;
    apiService
      .get<HopCandidatesResponse>(
        `/api/sources/${encodeURIComponent(sourceId)}/meshcore/hop-candidates?prefixes=${encodeURIComponent(key)}`,
      )
      .then((res) => {
        if (cancelled || !res?.data?.enabled) return;
        setPool(res.data.candidates ?? {});
      })
      .catch(() => {
        // Best effort: the route still shows the hashes it could not name.
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId, key]);
  return pool;
}

/** A usable contact position: finite coords, excluding null island. */
export function contactPosition(c: MeshCoreContact | undefined): { lat: number; lon: number } | null {
  if (!c) return null;
  const { latitude: lat, longitude: lon } = c;
  if (typeof lat !== 'number' || !isFinite(lat)) return null;
  if (typeof lon !== 'number' || !isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

/**
 * Resolve a route's hop hashes to named rows: own contacts first, then the
 * cross-source candidate pool for whatever those leave unknown (#5909). Returns
 * the resolved `rows` (callers also use them for the flow map) and the inferred
 * hash `width` in bytes.
 */
export function useResolvedRouteHops(
  hops: PathHop[],
  sourceId: string | undefined,
  contacts: MeshCoreContact[],
): { rows: ResolvedRouteHopWithFallback[]; width: 1 | 2 | 3 } {
  const width = pathHashBytesOf(hops);
  const ownRows = useMemo(() => resolveRoute(hops, contacts), [hops, contacts]);
  const unknownHops = useMemo(
    () => [...new Set(ownRows.filter((r) => r.matchCount === 0).map((r) => r.byte))],
    [ownRows],
  );
  const pool = useCrossSourceHopPool(sourceId, unknownHops);
  const receiverPos = useMemo(() => contactPosition(contacts.find((c) => c.isLocal === true)), [contacts]);
  const rows = useMemo(
    () => resolveRouteWithFallback(hops, contacts, pool, receiverPos),
    [hops, contacts, pool, receiverPos],
  );
  return { rows, width };
}

/** Plain-text label for map tooltips: the resolved name, "name?" for a guess. */
export function hopText(r: ResolvedRouteHopWithFallback): string {
  if (!r.name) return r.byte;
  if (r.tentative) return `${r.name}?`;
  return r.name;
}

/** Hover text listing every candidate for a shared hash. */
export function candidatesTitle(r: ResolvedRouteHopWithFallback): string | undefined {
  if (r.origin !== 'other' || r.candidates.length < 2) return undefined;
  return r.candidates.map((c) => `${c.name} (${c.sourceName})`).join('\n');
}

/**
 * The geospatial flow line of a received message's route (the Message Route
 * modal, and the Workspace's route details, #6365): shown only when EVERY
 * relay hop resolved to a positioned contact (a partial line would
 * misrepresent the path). The sender (matched by a unique pubkey prefix;
 * channel senders have synthetic 'channel-*' keys and never match) and the
 * local node (`isLocal`, #4438) are prepended/appended when positioned.
 */
export function routeFlowPoints(
  rows: ResolvedRouteHopWithFallback[],
  contacts: MeshCoreContact[],
  fromPublicKey: string,
  fromLabel: string,
  youLabel: string,
): RouteFlowPoint[] | null {
  if (rows.length === 0) return null;
  const hopPoints: RouteFlowPoint[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.position || !r.name) return null;
    const viaLabel = r.via ? ` (${r.via.sourceName})` : '';
    hopPoints.push({ key: `hop-${i}`, label: `#${i + 1} ${r.name}${viaLabel}`, lat: r.position.lat, lon: r.position.lon, kind: 'hop' });
  }
  const points: RouteFlowPoint[] = [];
  // Guard the prefix match: startsWith('') is true for EVERY key, so an
  // empty fromPublicKey must not adopt an arbitrary contact as the sender.
  // uniquePrefixMatch also refuses an ambiguous prefix (#5349).
  const senderPos = contactPosition(uniquePrefixMatch(contacts, fromPublicKey));
  if (senderPos) points.push({ key: 'sender', label: fromLabel, lat: senderPos.lat, lon: senderPos.lon, kind: 'endpoint' });
  points.push(...hopPoints);
  const localPos = contactPosition(contacts.find((c) => c.isLocal === true));
  if (localPos) points.push({ key: 'local', label: youLabel, lat: localPos.lat, lon: localPos.lon, kind: 'endpoint' });
  return points;
}
