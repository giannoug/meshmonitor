/**
 * Which node a device's settings configure (Task 5.9): `?node=!xxxxxxxx`
 * (today's Admin Commands deep link, parseAdminDeepLink), else the node
 * picked earlier while these settings stayed open, else this radio. Links
 * inside the settings drop the query, so the frame puts it back (`fix`).
 *
 * The node list is today's (nodeOptionsUtils): the local node first, then
 * nodes with remote admin, then A–Z. A node id that is not in it, or a viewer
 * who may not use remote admin (admins, on a Meshtastic radio, as today's
 * admin routes), falls back to this radio, as Admin Commands does.
 */
import { useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildNodeOptions, sortNodeOptionsForRemoteAdmin } from '../../../components/admin-commands/nodeOptionsUtils';
import { usePoll } from '../../../hooks/usePoll';
import { parseAdminDeepLink } from '../../../utils/adminDeepLink';
import { clearRemote, updateRemote, useRemoteEntry, type RemoteNode } from './remoteTargetStore';

export interface TargetNode {
  /** The node list has not loaded yet, so a `?node=` cannot be resolved. */
  pending: boolean;
  node: RemoteNode | null;
  /** The remote nodes the picker offers, in today's order. */
  nodes: RemoteNode[];
  local: RemoteNode | null;
  /** Where the URL should be instead (the query added or dropped), or null. */
  fix: string | null;
}

export function useTargetNode(sourceId: string, allowed: boolean): TargetNode {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const { pathname, hash } = useLocation();
  const entry = useRemoteEntry(sourceId);
  const asked = params.has('node');
  const wanted = asked ? parseAdminDeepLink(params)?.node ?? null : entry.node?.nodeId ?? null;
  // Today's node list, read only while a node is wanted or the picker is open: this radio's pages poll as before.
  const { data } = usePoll({ enabled: allowed && (!!wanted || entry.pickerOpen) });

  const { nodes, local } = useMemo(() => {
    const raw = (data?.nodes ?? []) as Array<{ nodeNum?: number; hopsAway?: number | null }>;
    const localId = (data?.config?.localNodeInfo as { nodeId?: string } | undefined)?.nodeId ?? '';
    const hops = new Map(raw.map((n) => [n.nodeNum, n.hopsAway ?? null]));
    const options = sortNodeOptionsForRemoteAdmin(buildNodeOptions(raw, localId, t)).map((o) => ({
      nodeNum: o.nodeNum,
      nodeId: o.nodeId.toLowerCase(),
      longName: o.longName,
      shortName: o.shortName,
      hopsAway: hops.get(o.nodeNum) ?? null,
      isLocal: o.isLocal,
    }));
    return { nodes: options.filter((o) => !o.isLocal), local: options.find((o) => o.isLocal) ?? null };
  }, [data, t]);

  const pending = allowed && !!wanted && !data;
  const node = allowed && wanted ? nodes.find((n) => n.nodeId === wanted) ?? null : null;
  let fix: string | null = null;
  if (!pending && asked && wanted && !node) fix = pathname + hash;
  else if (node && !asked) fix = `${pathname}?node=${node.nodeId}${hash}`;

  // The sidebar's list and search read the target from the store.
  useEffect(() => {
    if (pending || entry.node?.nodeNum === node?.nodeNum) return;
    updateRemote(sourceId, { node, passkey: null, lastRead: {}, sent: {} });
  }, [pending, sourceId, node, entry.node?.nodeNum]);
  // Closing the device's settings forgets the target.
  useEffect(() => () => clearRemote(sourceId), [sourceId]);

  return { pending, node, nodes, local, fix };
}
