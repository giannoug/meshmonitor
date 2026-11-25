/**
 * @vitest-environment jsdom
 *
 * The Direct tile counts what the Nodes view it opens lists (#6365 O7):
 * on MeshCore, pathLen 0 over the rows the table keeps (age window, ignore
 * list); on Meshtastic with the traceroute hop mode, the cached traceroutes.
 * Both are read from the query cache: the Dashboard adds no request or timer.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { meshcoreFixtures, MC } from '../../__fixtures__/meshcore';
import { dashboardNodes } from '../../__fixtures__/dashboard';
import { meshcoreIgnoredNodesQueryKey } from '../../../hooks/useMeshCoreFilters';
import { nodeDisplaySettingsQueryKey } from '../../../hooks/useNodeDisplaySettings';
import { sourcePollQueryKey } from '../../../hooks/pollQueryKey';
import { boardLoaded, renderDashboard } from './renderDashboard';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const NOW = Date.now();
const mcNode = (publicKey: string, name: string, extra: object) => ({ publicKey, name, advType: 1, lastHeard: NOW - 60_000, pathLen: 0, ...extra });
const directTile = async () => {
  const strip = await screen.findByRole('list', { name: 'Mesh health' });
  return within(strip).getAllByRole('listitem').find((li) => li.textContent?.startsWith('Direct'))!;
};

describe('Direct tile (O7)', () => {
  it('MeshCore Direct tile counts pathLen 0 and skips ignored/aged nodes, matching the table', async () => {
    const nodes = [
      mcNode(MC.penteli, 'Kept direct', {}),
      mcNode(MC.parnitha, 'Ignored direct', {}),
      mcNode(MC.nikos, 'Aged direct', { lastHeard: NOW - 100 * 3_600_000 }),
      mcNode(MC.marousi, 'Relayed', { pathLen: 2 }),
    ];
    const { queryClient } = renderDashboard('/source/src-heltec/telemetry', {
      fixtures: { ...meshcoreFixtures(), 'GET /api/sources/:id/meshcore/nodes': () => ({ success: true, data: nodes }) },
    });
    await waitFor(async () => expect(await directTile()).toHaveTextContent(/Direct3/));
    // What the MeshCore table has already read for this device: its ignore list and its age window.
    act(() => {
      queryClient.setQueryData(meshcoreIgnoredNodesQueryKey('src-heltec'), [{ sourceId: 'src-heltec', publicKey: MC.parnitha }]);
      queryClient.setQueryData(nodeDisplaySettingsQueryKey('src-heltec'), { maxNodeAgeHours: '24', maxInfraNodeAgeHours: '0' });
    });
    await waitFor(async () => expect(await directTile()).toHaveTextContent(/Direct1/));
  });

  it('traceroute hop mode: Direct tile matches the Nodes view', async () => {
    localStorage.setItem('nodeDisplay:src-g2:nodeHopsCalculation', 'traceroute');
    const { queryClient } = renderDashboard();
    await boardLoaded();
    const before = Number(/Direct(\d+)/.exec((await directTile()).textContent ?? '')?.[1]);
    const far = dashboardNodes.find((n) => (n.hopsAway ?? 0) > 0 && n.nodeNum !== 0xa1b2c300)!;
    // The cached poll knows a zero-hop traceroute to a node the nodeinfo hops put further out.
    act(() => {
      queryClient.setQueryData(sourcePollQueryKey('src-g2'), {
        ...(queryClient.getQueryData(sourcePollQueryKey('src-g2')) as object),
        traceroutes: [{ fromNodeNum: 0xa1b2c300, toNodeNum: far.nodeNum, route: '[]', routeBack: '[]' }],
      });
    });
    await waitFor(async () => expect(await directTile()).toHaveTextContent(`Direct${before + 1}`));
  });
});
