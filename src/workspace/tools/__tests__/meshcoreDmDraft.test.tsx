/**
 * @vitest-environment jsdom
 *
 * Task 8.5 fix round 1 (review M4): with today's real MeshCore page, a
 * Security "Send a DM" opens the contact's DM with today's notice in the
 * composer (the optional `dmDraft` hand-off) and sends nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { HELTEC, renderMeshCore } from '../../meshcore/__tests__/renderMeshCore';
import { MC } from '../../__fixtures__/meshcoreKeys';
import { securityNotificationText } from '../../../utils/securityNotificationText';
import { nonGets } from './renderTools';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const security = {
  'GET /api/security/issues': () => ({
    protocol: 'meshcore', total: 1, lowEntropyCount: 0, duplicateKeyCount: 0, excessivePacketsCount: 1, timeOffsetCount: 0, packetLogEnabled: true,
    thresholds: { packetsPerHour: 60, timeOffsetMinutes: 5 },
    nodes: [{ nodeKey: `mc:${MC.glyfada}`, protocol: 'meshcore', nodeNum: 0, longName: 'Glyfada Beach', shortName: 'GLY', lastHeard: Math.floor(Date.now() / 1000),
      keyIsLowEntropy: false, duplicateKeyDetected: false, isExcessivePackets: true, packetRatePerHour: 90, advType: 1, onDevice: true, hasKnownPath: true }],
    topBroadcasters: [],
  }),
  'GET /api/security/scanner/status': () => ({ running: true, scanningNow: false, intervalHours: 6, lastScanTime: null }),
  'GET /api/security/dead-nodes': () => ({ nodes: [], count: 0, thresholdDays: 14 }),
  'GET /api/security/meshcore/findings': () => ({
    success: true,
    data: {
      pathHashCollisions: { width: 1, countsByWidth: { 1: 0, 2: 0, 3: 0 }, groups: [] }, signatureFailures: [], nameReuse: [],
      ownKey: { currentKey: MC.self, previousKey: null, detectedAt: null, pkiKeyMismatch: false },
    },
  }),
};

describe('MeshCore DM draft', () => {
  it("today's MeshCore DM view opens on the contact with the notice in its composer and sends nothing", async () => {
    renderMeshCore(`${HELTEC}/security`, { fixtures: security });
    fireEvent.click(await screen.findByRole('button', { name: 'Send a DM' }));
    const notice = securityNotificationText('excessivePackets', { packetsPerHour: 90 });
    await waitFor(() => expect(screen.getByDisplayValue(notice)).toBeInTheDocument(), { timeout: 8000 });
    // The only write is today's read-state mark on entering the DM view; nothing is sent.
    expect(nonGets()).toEqual(['POST /api/read-state']);
  });
});
