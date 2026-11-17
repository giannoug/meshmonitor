/**
 * @vitest-environment jsdom
 *
 * Board 8-16 (phone): Heltec MeshCore's Home. Its header ⋯ holds Advert
 * nearby, Flood advert and Disconnect, each with its line; the tools, then
 * Channels, Rooms and Direct messages.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

describe('8-16-meshcore-home', () => {
  it('8-16-meshcore-home shows the board', async () => {
    const { container } = renderMeshCore(HELTEC, { phone: true });
    await screen.findByText('Kifisia BBS');
    await screen.findByText('Glyfada Beach');
    fireEvent.click(screen.getByRole('button', { name: 'Device actions' }));
    const menu = await screen.findByRole('menu', { name: 'Device actions' });
    expectBoard('8-16-meshcore-home', joined(container, menu));
  });

  it('Disconnect sends one request; the adverts keep their lines', async () => {
    const { log } = renderMeshCore(HELTEC, { phone: true });
    await screen.findByText('Kifisia BBS');
    fireEvent.click(screen.getByRole('button', { name: 'Device actions' }));
    const menu = await screen.findByRole('menu', { name: 'Device actions' });
    expect(menu).toHaveTextContent('Sends 1 advert that every repeater forwards · asks first');
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Disconnect/ }));
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/disconnect'))).toHaveLength(1));
  });
});
