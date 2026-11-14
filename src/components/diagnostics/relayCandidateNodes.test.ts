import { describe, it, expect } from 'vitest';
import { toRelayCandidateNodes } from './relayCandidateNodes';
import type { DeviceInfo } from '../../types/device';

describe('toRelayCandidateNodes', () => {
  it('maps nodes as the Message Details relay list expects, with direct-neighbour stats', () => {
    const nodes = [
      { nodeNum: 0xa1b2c301, user: { id: '!a1b2c301', longName: 'Kifisia Rooftop', shortName: 'KFR', role: '2' }, hopsAway: 2 },
      { nodeNum: 0x0000beef },
    ] as unknown as DeviceInfo[];
    expect(toRelayCandidateNodes(nodes, { [0xa1b2c301]: { avgRssi: -101, packetCount: 4, lastHeard: 1 } })).toEqual([
      { nodeNum: 0xa1b2c301, nodeId: '!a1b2c301', longName: 'Kifisia Rooftop', shortName: 'KFR', hopsAway: 2, role: 2, avgDirectRssi: -101, heardDirectly: true },
      { nodeNum: 0xbeef, nodeId: '!0000beef', longName: `Node ${0xbeef}`, shortName: 'beef', hopsAway: undefined, role: undefined, avgDirectRssi: undefined, heardDirectly: false },
    ]);
  });
});
