/**
 * @vitest-environment jsdom
 *
 * Tools own-issues (W8): the MeshCore pop-out adds no provider of its own
 * (O5d), and the 16-05 digest toggles are the kit's switch (O9b).
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS as S } from '../../__fixtures__/athens';
import { captureOn } from '../../__fixtures__/packets';
import PacketsPopout from '../PacketsPopout';
import { fetched, G2, renderTools } from './renderTools';

vi.mock('../../../pages/PacketMonitorPage', () => ({ default: () => <div data-testid="classic-popout" /> }));
vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

describe('Tools (W8)', () => {
  it('MeshCore pop-out fetches auth status once', async () => {
    // renderWorkspace supplies the one AuthProvider (Classic's page brings its own in the app); the pop-out adds none.
    renderWorkspace(<PacketsPopout />, { route: `/packet-monitor?sourceId=${S.heltec}`, fixtures: captureOn });
    await screen.findByTestId('classic-popout');
    expect(fetched().filter((r) => r.startsWith('GET /api/auth/status'))).toHaveLength(1);
  });

  it('16-05 security toggles use the kit switch class', async () => {
    renderTools(`${G2}/security`, { phone: true });
    await screen.findByText('Shared public key');
    await waitFor(() => expect(screen.getByDisplayValue('discord://1187/Xk9f')).toBeInTheDocument());
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(2);
    for (const s of switches) expect(s.className).toMatch(/switch/);
  });
});
