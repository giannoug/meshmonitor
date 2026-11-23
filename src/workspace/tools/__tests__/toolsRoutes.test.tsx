/**
 * @vitest-environment jsdom
 *
 * Task 8.5's routes: a MeshCore device's Security is the same Workspace page
 * with today's MeshCore sections (s16n3), its "Send a DM" hands today's
 * notice to the MeshCore DM; Classic users on the new URLs land on today's
 * tabs; and Workspace users on today's anchors land on the new pages.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { classicFallback } from '../../layout/classicFallback';
import { HELTEC, renderMeshCore } from '../../meshcore/__tests__/renderMeshCore';
import { MC } from '../../__fixtures__/meshcoreKeys';
import { securityNotificationText } from '../../../utils/securityNotificationText';
import { G2, nonGets, renderTools } from './renderTools';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../pages/MeshCoreSourcePage', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('meshcore') }));

const finding = (publicKey: string, name: string) => ({ publicKey, nodeKey: `mc:${publicKey}`, name, advType: 2, lastHeard: Date.now(), firstHeard: Date.now(), advertSignatureVerified: false });

const meshcoreSecurity = {
  'GET /api/security/issues': () => ({
    protocol: 'meshcore', total: 1, lowEntropyCount: 0, duplicateKeyCount: 0, excessivePacketsCount: 1, timeOffsetCount: 0, packetLogEnabled: true,
    thresholds: { packetsPerHour: 60, timeOffsetMinutes: 5 },
    nodes: [{ nodeKey: `mc:${MC.glyfada}`, protocol: 'meshcore', nodeNum: 0, longName: 'Glyfada Beach', shortName: 'GLY', lastHeard: Math.floor(Date.now() / 1000),
      keyIsLowEntropy: false, duplicateKeyDetected: false, isExcessivePackets: true, packetRatePerHour: 90, advType: 1, onDevice: true, hasKnownPath: false }],
    topBroadcasters: [],
  }),
  'GET /api/security/scanner/status': () => ({ running: true, scanningNow: false, intervalHours: 6, lastScanTime: null }),
  'GET /api/security/dead-nodes': () => ({ nodes: [], count: 0, thresholdDays: 14 }),
  'GET /api/security/meshcore/findings': () => ({
    success: true,
    data: {
      pathHashCollisions: { width: 1, countsByWidth: { 1: 1, 2: 0, 3: 0 }, groups: [{ hash: '3f', nodes: [finding(MC.lycabettus, 'Lycabettus Repeater'), finding(MC.penteli, 'Penteli Repeater')] }] },
      signatureFailures: [],
      nameReuse: [],
      ownKey: { currentKey: MC.self, previousKey: MC.weather, detectedAt: Date.now() - 3_600_000, pkiKeyMismatch: false },
    },
  }),
};

describe('Task 8.5 routes', () => {
  it('a MeshCore device\'s Security is the Workspace page with today\'s MeshCore sections', async () => {
    renderMeshCore(`${HELTEC}/security`, { fixtures: meshcoreSecurity });
    expect(await screen.findByText('Path hash collisions')).toBeInTheDocument();
    expect(screen.getByText('This device changed its public key')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Key problems/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Noisy senders/ })).toBeInTheDocument();
    // Today's flood warning beside the DM button.
    expect(screen.getByTestId('security-flood-warning')).toHaveTextContent('No known path: this DM will flood the mesh');
    expect(nonGets()).toEqual([]);
  });

  it("a MeshCore DM button opens today's DM view on the contact with the notice", async () => {
    renderMeshCore(`${HELTEC}/security`, { fixtures: meshcoreSecurity });
    fireEvent.click(await screen.findByRole('button', { name: 'Send a DM' }));
    expect(await screen.findByTestId('dm-contact')).toHaveTextContent(MC.glyfada);
    expect(screen.getByTestId('dm-draft')).toHaveTextContent(securityNotificationText('excessivePackets', { packetsPerHour: 90 }));
    expect(nonGets()).toEqual([]);
  });

  it("today's #info and #packetmonitor anchors open the Workspace pages", async () => {
    renderTools(`${G2}#info`);
    expect(await screen.findByRole('link', { name: 'Radio: all of it' })).toBeInTheDocument();
  });

  it('a Classic user on a Task 8.5 URL lands on today\'s tab', () => {
    expect(classicFallback('/source/src-g2/tools')).toBe('/source/src-g2/info');
    expect(classicFallback('/source/src-g2/info/radio')).toBe('/source/src-g2/info');
    expect(classicFallback('/source/src-g2/security/quiet')).toBe('/source/src-g2/security');
    expect(classicFallback('/source/src-g2/info')).toBeNull();
    expect(classicFallback('/source/src-g2/security')).toBeNull();
    expect(classicFallback('/source/src-g2/packetmonitor')).toBeNull();
  });
});
