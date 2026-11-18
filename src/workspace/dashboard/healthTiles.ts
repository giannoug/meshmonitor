/**
 * The Mesh health tiles (board j1, note ds8), worked out from what the
 * Dashboard already reads: the device's nodes (`dataSource.fetchNodes`) and
 * its status (the shell's `/api/sources/:id/status` poll). No tile asks for
 * anything else. Packets per hour needs the packet log, which no read here
 * returns, so it is not a tile (Ruling 8.1).
 */
import type { TelemetryNodeInfo } from '../../types/device';
import { isHeardRecently } from '../chat/channelLabel';

export const HEALTH_TILES = ['nodesOnline', 'channelUtil', 'airtimeTx', 'lowBattery', 'newToday', 'direct', 'favorites', 'battery', 'uptime'] as const;
export type HealthTileId = (typeof HEALTH_TILES)[number];
/** Shown until the user picks: six of the nine. */
export const DEFAULT_TILES: readonly HealthTileId[] = ['nodesOnline', 'channelUtil', 'airtimeTx', 'lowBattery', 'newToday', 'direct'];

/** A tile's title (the strip's and the Health tiles sheet's label). */
export function tileTitle(t: (key: string) => string, id: HealthTileId): string {
  return t(`workspace.dashboard.tile.${id}`);
}

/** Channel utilisation turns amber above this (board j1, ds8). */
export const CHANNEL_UTIL_AMBER = 25;
/** Today's default low-battery threshold (the low-battery notification's, %). */
export const LOW_BATTERY_PCT = 20;

type Metrics = { batteryLevel?: number; channelUtilization?: number; airUtilTx?: number; uptimeSeconds?: number };
export type HealthNode = TelemetryNodeInfo & { deviceMetrics?: Metrics; firstHeard?: number; isFavorite?: boolean };

/** Reporting a level from 1 to the threshold; 0 is unknown and 101 is external power. */
export function isLowBattery(node: HealthNode): boolean {
  const level = node.deviceMetrics?.batteryLevel;
  return level !== undefined && level > 0 && level <= LOW_BATTERY_PCT;
}

/** First heard since local midnight (`firstHeard` in seconds). */
export function isNewToday(node: HealthNode, nowMs = Date.now()): boolean {
  const midnight = new Date(nowMs).setHours(0, 0, 0, 0) / 1000;
  return (node.firstHeard ?? 0) >= midnight;
}

export interface HealthInput {
  nodes: HealthNode[];
  /** This device's own node id (`!xxxxxxxx`, or a MeshCore key), when known. */
  localId: string | null;
  /** From the device's status: nodes heard lately, and every node it knows. */
  activeNodeCount?: number;
  nodeCount?: number;
  now?: number;
}

export interface HealthValues {
  online: number;
  total: number;
  channelUtil: number | null;
  airtimeTx: number | null;
  lowBattery: HealthNode[];
  newToday: number | null;
  direct: number;
  favorites: number;
  battery: number | null;
  uptime: number | null;
}

export function healthValues({ nodes, localId, activeNodeCount, nodeCount, now = Date.now() }: HealthInput): HealthValues {
  const local = localId ? nodes.find((n) => n.user?.id === localId) : undefined;
  const others = nodes.filter((n) => n !== local);
  const m = local?.deviceMetrics;
  return {
    online: activeNodeCount ?? nodes.filter((n) => isHeardRecently(n.lastHeard, now)).length,
    total: nodeCount ?? nodes.length,
    channelUtil: m?.channelUtilization ?? null,
    airtimeTx: m?.airUtilTx ?? null,
    lowBattery: others.filter(isLowBattery),
    // A source whose nodes carry no first-heard time (MeshCore) has no answer.
    newToday: nodes.some((n) => n.firstHeard !== undefined) ? others.filter((n) => isNewToday(n, now)).length : null,
    direct: others.filter((n) => n.hopsAway === 0).length,
    favorites: others.filter((n) => n.isFavorite).length,
    battery: m?.batteryLevel ?? null,
    uptime: m?.uptimeSeconds ?? null,
  };
}
