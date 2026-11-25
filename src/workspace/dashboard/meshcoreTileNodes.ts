import type { HealthNode } from './healthTiles';
import { filterMeshCoreRowsByAge, type MeshCoreNodeRow } from '../../utils/meshcoreNodeRows';
import type { NodeDisplaySettings } from '../../hooks/useNodeDisplaySettings';
import type { NodeQuickAgeHours } from '../../utils/nodeQuickAgeFilter';

/**
 * The nodes MeshCore's Nodes table keeps (not on the ignore list, inside its age window), which the tiles
 * count, so a tile's number is the length of the list it opens. A setting the table has not loaded yet
 * (`undefined`) is no limit: the tile keeps its count until the table's own reads reach the cache.
 */
export function meshcoreTileNodes(
  nodes: HealthNode[],
  opts: { localId: string | null; ignoredKeys: readonly string[] | undefined; quickAgeHours: NodeQuickAgeHours; display: Partial<NodeDisplaySettings> | undefined },
): HealthNode[] {
  const hidden = new Set((opts.ignoredKeys ?? []).map((k) => k.toLowerCase()));
  const listed = nodes.filter((n) => !hidden.has((n.user?.id ?? '').toLowerCase()));
  const rows = listed.map((n) => ({
    name: n.user?.longName ?? '',
    hasName: !!n.user?.longName,
    advType: typeof n.user?.role === 'number' ? n.user.role : undefined,
    lastHeard: n.lastHeard ? n.lastHeard * 1000 : undefined,
    isFavorite: false,
    isLocal: n.user?.id === opts.localId,
  }) as MeshCoreNodeRow);
  const kept = new Set(
    filterMeshCoreRowsByAge(rows, {
      companionAgeHours: opts.quickAgeHours ?? opts.display?.maxNodeAgeHours ?? 0,
      infraAgeHours: opts.quickAgeHours ?? opts.display?.maxInfraNodeAgeHours ?? 0,
      hideIncompleteNodes: opts.display?.hideIncompleteNodes ?? false,
    }),
  );
  return listed.filter((_, i) => kept.has(rows[i]));
}
