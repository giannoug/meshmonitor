/**
 * @vitest-environment jsdom
 *
 * Board 8-17 (phone): Kifisia BBS's login, waiting on attempt 2 of 3, with
 * Auto-sync under it.
 */
import { describe, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

describe('8-17-room-login', () => {
  it('8-17-room-login shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/room/${MC.kifisia}`, { phone: true, meshcore: { login: 'hang' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Log in with saved password' }));
    await screen.findByText(/Attempt 2 of 3/, undefined, { timeout: 3000 });
    expectBoard('8-17-room-login', container);
  });
});
