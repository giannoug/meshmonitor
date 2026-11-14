/** The helpers Task 3.3 extracted from NodesTab and AdvancedNodeFilterPopup (#6365, Rule X). */
import { describe, it, expect } from 'vitest';
import type { DeviceInfo } from '../types/device';
import { filterNodeList, toggleInSelection } from './nodeAdvancedFilter';

describe('toggleInSelection ([] = all)', () => {
  const all = [0, 1, 2];
  it('unchecking from all keeps the rest; checking back to all returns []', () => {
    expect(toggleInSelection([], 1, false, all)).toEqual([0, 2]);
    expect(toggleInSelection([0, 2], 1, true, all)).toEqual([]);
  });
  it('checking while all are chosen changes nothing (same array)', () => {
    const none: number[] = [];
    expect(toggleInSelection(none, 1, true, all)).toBe(none);
  });
});

describe('filterNodeList', () => {
  const node = (n: number, extra: Partial<DeviceInfo> = {}): DeviceInfo =>
    ({ nodeNum: n, user: { id: `!${n}`, longName: `N${n}`, shortName: `S${n}`, hwModel: 9 }, ...extra }) as DeviceInfo;
  const base = { securityFilter: 'all' as const, channelFilter: 'all' as const, showIncompleteNodes: true, filterRemoteAdminOnly: false };
  it('applies security, channel, incomplete and remote-admin filters', () => {
    const flagged = node(1, { keyIsLowEntropy: true });
    const ch2 = node(2, { channel: 2 });
    const admin = node(3, { hasRemoteAdmin: true });
    const list = [flagged, ch2, admin];
    expect(filterNodeList(list, { ...base, securityFilter: 'hideFlagged' })).toEqual([ch2, admin]);
    expect(filterNodeList(list, { ...base, channelFilter: 2 })).toEqual([ch2]);
    expect(filterNodeList(list, { ...base, filterRemoteAdminOnly: true })).toEqual([admin]);
    expect(filterNodeList([node(4, { user: undefined })], { ...base, showIncompleteNodes: false })).toEqual([]);
  });
});
