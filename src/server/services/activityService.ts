/**
 * Per-source Activity feed (#6365 Task 2.7): replies to, reactions on and
 * mentions of the source's own node, filtered to what the caller may read.
 *
 * Read access is the `GET /api/messages` rule, reused, never re-implemented:
 * Meshtastic-family sources go through `resolveReadableMeshtasticChannels`
 * (itself `resolveMessageReadAccess`), MeshCore through
 * `resolveReadableMeshcoreScope`. Read-only: sends nothing, arms no timer.
 */
import type { User } from '../../types/auth.js';
import type { ActivityPage } from '../../db/repositories/index.js';
import databaseService from '../../services/database.js';
import { sourceManagerRegistry } from '../sourceManagerRegistry.js';
import { isMeshCoreManager, isMeshtasticManager } from '../sourceManagerTypes.js';
import { isAnyMeshCoreSourceType } from '../../utils/nodeTypeCategory.js';
import { nodeIdFromNum } from '../../utils/mentions.js';
import { getOwnNodeNums, getOwnPublicKeys } from '../utils/ownNodes.js';
import { resolveReadableMeshtasticChannels, resolveReadableMeshcoreScope } from '../utils/messageSourceAccess.js';

export type ActivityResult =
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'ok'; page: ActivityPage };

const EMPTY: ActivityResult = { status: 'ok', page: { items: [], nextBefore: null } };

export async function getSourceActivity(
  user: User | null | undefined,
  sourceId: string,
  opts: { before?: number; limit: number },
): Promise<ActivityResult> {
  const source = await databaseService.sources.getSource(sourceId);
  if (!source) return { status: 'not_found' };
  const manager = sourceManagerRegistry.getManager(sourceId);

  if (isAnyMeshCoreSourceType(source.type)) {
    const scopes = await resolveReadableMeshcoreScope(user, sourceId);
    if (scopes.channels !== 'all' && scopes.channels.length === 0 && !scopes.includeDms) return { status: 'forbidden' };
    // Not connected yet (or an ingest-only source): no own node, so nothing is ours.
    const local = manager && isMeshCoreManager(manager) ? manager.getLocalNode() : null;
    if (!local?.publicKey) return EMPTY;
    const page = await databaseService.getActivityAsync({
      protocol: 'meshcore',
      sourceId,
      ownPublicKey: local.publicKey,
      ownName: local.name ?? '',
      otherOwnPublicKeys: getOwnPublicKeys(),
      scopes,
      ...opts,
    });
    return { status: 'ok', page };
  }

  const scopes = await resolveReadableMeshtasticChannels(user, sourceId);
  if (scopes !== 'all' && scopes.length === 0) return { status: 'forbidden' };
  const local = manager && isMeshtasticManager(manager) ? manager.getLocalNodeInfo() : null;
  if (local?.nodeNum == null) return EMPTY;
  const ownNodeNum = Number(local.nodeNum);
  const page = await databaseService.getActivityAsync({
    protocol: 'meshtastic',
    sourceId,
    ownNodeNum,
    ownNodeId: nodeIdFromNum(ownNodeNum),
    otherOwnNodeNums: getOwnNodeNums(),
    scopes,
    ...opts,
  });
  return { status: 'ok', page };
}
