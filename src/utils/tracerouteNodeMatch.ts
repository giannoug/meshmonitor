/**
 * Auto-traceroute's preview: the nodes the current filters match. Moved as is
 * from AutoTracerouteSection (Task 8.3, Rule X) so the Workspace page shows the
 * same count; Classic calls it with the same state.
 */

export type TracerouteFilterMode = 'or' | 'and';

export interface TracerouteMatchNode {
  nodeNum: number;
  nodeId?: string;
  longName?: string;
  shortName?: string;
  lastHeard?: number;
  hopsAway?: number;
  role?: number;
  hwModel?: number;
  channel?: number;
  user?: { id?: string; longName?: string; shortName?: string; role?: string | number; hwModel?: number };
}

export interface TracerouteMatchFilter {
  filterEnabled: boolean;
  selectedNodeNums: number[];
  filterChannels: number[];
  filterRoles: number[];
  filterHwModels: number[];
  filterNameRegex: string;
  filterNodesEnabled: boolean;
  filterChannelsEnabled: boolean;
  filterRolesEnabled: boolean;
  filterHwModelsEnabled: boolean;
  filterRegexEnabled: boolean;
  filterNodesMode: TracerouteFilterMode;
  filterChannelsMode: TracerouteFilterMode;
  filterRolesMode: TracerouteFilterMode;
  filterHwModelsMode: TracerouteFilterMode;
  filterRegexMode: TracerouteFilterMode;
  filterLastHeardEnabled: boolean;
  filterLastHeardHours: number;
  filterHopsEnabled: boolean;
  filterHopsMin: number;
  filterHopsMax: number;
}

// Helper to get role from node (could be at top level or in user object)
const getNodeRole = (node: TracerouteMatchNode): number | undefined => {
  if (node.role !== undefined && node.role !== null) return node.role;
  if (node.user?.role !== undefined && node.user?.role !== null) {
    // user.role might be a string like "0" or "1"
    return typeof node.user.role === 'string' ? parseInt(node.user.role) : undefined;
  }
  return undefined;
};

// Helper to get hwModel from node (could be at top level or in user object)
const getNodeHwModel = (node: TracerouteMatchNode): number | undefined => {
  if (node.hwModel !== undefined && node.hwModel !== null) return node.hwModel;
  // hwModel is in user object in the API response
  const userAny = node.user as { hwModel?: number } | undefined;
  if (userAny?.hwModel !== undefined && userAny?.hwModel !== null) return userAny.hwModel;
  return undefined;
};

export function matchTracerouteNodes<N extends TracerouteMatchNode>(availableNodes: N[], f: TracerouteMatchFilter): N[] {
  const {
    filterEnabled, selectedNodeNums, filterChannels, filterRoles, filterHwModels, filterNameRegex,
    filterNodesEnabled, filterChannelsEnabled, filterRolesEnabled, filterHwModelsEnabled, filterRegexEnabled,
    filterNodesMode, filterChannelsMode, filterRolesMode, filterHwModelsMode, filterRegexMode,
    filterLastHeardEnabled, filterLastHeardHours, filterHopsEnabled, filterHopsMin, filterHopsMax,
  } = f;
  if (!filterEnabled) return availableNodes;

  // Apply AND pre-filters (last heard, hop range) to narrow the candidate pool first
  let candidatePool = availableNodes;

  if (filterLastHeardEnabled) {
    const lastHeardCutoff = Math.floor(Date.now() / 1000) - (filterLastHeardHours * 3600);
    candidatePool = candidatePool.filter(n =>
      n.lastHeard != null && n.lastHeard >= lastHeardCutoff
    );
  }

  if (filterHopsEnabled) {
    candidatePool = candidatePool.filter(n => {
      const hops = n.hopsAway ?? 1;
      return hops >= filterHopsMin && hops <= filterHopsMax;
    });
  }

  /**
   * Mirror of the backend's per-filter combine logic (#5230), so the preview
   * count below shows what auto-traceroute will actually do. If these two
   * drift, the preview becomes a confident lie — which is worse than no
   * preview, because the user tunes against it.
   *
   * A filter participates only when enabled AND configured: an 'and' filter
   * with nothing selected is one the user has not filled in, not a scope that
   * excludes everything.
   */
  let regexMatcherForCheck: RegExp | null = null;
  if (filterRegexEnabled && filterNameRegex && filterNameRegex !== '.*') {
    try { regexMatcherForCheck = new RegExp(filterNameRegex, 'i'); } catch { /* invalid */ }
  }

  const nodeName = (n: TracerouteMatchNode) => n.longName || n.user?.longName || n.shortName || n.user?.shortName || n.nodeId || '';

  const active: Array<{ mode: TracerouteFilterMode; matches: (n: TracerouteMatchNode) => boolean }> = [];
  if (filterNodesEnabled && selectedNodeNums.length > 0) {
    active.push({ mode: filterNodesMode, matches: (n) => selectedNodeNums.includes(n.nodeNum) });
  }
  if (filterChannelsEnabled && filterChannels.length > 0) {
    active.push({
      mode: filterChannelsMode,
      matches: (n) => n.channel != null && filterChannels.includes(n.channel),
    });
  }
  if (filterRolesEnabled && filterRoles.length > 0) {
    active.push({
      mode: filterRolesMode,
      matches: (n) => { const r = getNodeRole(n); return r !== undefined && filterRoles.includes(r); },
    });
  }
  if (filterHwModelsEnabled && filterHwModels.length > 0) {
    active.push({
      mode: filterHwModelsMode,
      matches: (n) => { const h = getNodeHwModel(n); return h !== undefined && filterHwModels.includes(h); },
    });
  }
  // `.*` is NOT a participating filter, matching the backend, which only
  // compiles a matcher when the pattern is non-default. The old preview
  // treated it as a match-all OR member — and since the regex filter is
  // enabled with `.*` by DEFAULT, that silently neutralised every other OR
  // filter: picking a channel showed the whole mesh as matching while the
  // scheduler traced only the channel. The preview now says what will happen.
  if (filterRegexEnabled && regexMatcherForCheck !== null) {
    const re = regexMatcherForCheck;
    active.push({ mode: filterRegexMode, matches: (n) => re.test(nodeName(n)) });
  }

  if (active.length === 0) {
    // Only the always-AND filters are doing anything.
    return candidatePool;
  }

  const andFilters = active.filter(f => f.mode === 'and');
  const orFilters = active.filter(f => f.mode === 'or');

  return candidatePool.filter(n => {
    if (!andFilters.every(f => f.matches(n))) return false;
    if (orFilters.length > 0 && !orFilters.some(f => f.matches(n))) return false;
    return true;
  });
}
