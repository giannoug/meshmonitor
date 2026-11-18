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
  /** Every node the device knows, from its status. */
  nodeCount?: number;
  /** A node's hops, as the Nodes view the Direct tile opens counts them. */
  hopsOf(node: HealthNode): number | undefined;
  /** The source's nodes carry its favourite flag (Meshtastic); MeshCore's dashboard read does not. */
  reportsFavorites: boolean;
  now?: number;
}

export interface HealthValues {
  online: number;
  total: number;
  channelUtil: number | null;
  airtimeTx: number | null;
  /** null: no node reports a battery level. */
  lowBattery: HealthNode[] | null;
  newToday: number | null;
  direct: number;
  favorites: number | null;
  battery: number | null;
  uptime: number | null;
}

/**
 * The tiles' values over every node, the device's own included, with the
 * predicates the views they open use (Nodes: `isHeardRecently`, its hops, its
 * favourite flag), so a tile's count is the length of the list it opens.
 */
export function healthValues({ nodes, localId, nodeCount, hopsOf, reportsFavorites, now = Date.now() }: HealthInput): HealthValues {
  const local = localId ? nodes.find((n) => n.user?.id === localId) : undefined;
  const m = local?.deviceMetrics;
  return {
    online: nodes.filter((n) => isHeardRecently(n.lastHeard, now)).length,
    total: nodeCount ?? nodes.length,
    channelUtil: m?.channelUtilization ?? null,
    airtimeTx: m?.airUtilTx ?? null,
    // A source whose nodes carry no battery level (MeshCore reports volts) has no answer.
    lowBattery: nodes.some((n) => n.deviceMetrics?.batteryLevel !== undefined) ? nodes.filter(isLowBattery) : null,
    // Likewise for a first-heard time.
    newToday: nodes.some((n) => n.firstHeard !== undefined) ? nodes.filter((n) => isNewToday(n, now)).length : null,
    direct: nodes.filter((n) => hopsOf(n) === 0).length,
    favorites: reportsFavorites ? nodes.filter((n) => n.isFavorite).length : null,
    battery: m?.batteryLevel ?? null,
    uptime: m?.uptimeSeconds ?? null,
  };
}
