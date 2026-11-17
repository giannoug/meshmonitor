/**
 * @vitest-environment jsdom
 *
 * Review fixes M1 and M6: a message's ⋯ keeps today's sender link (Node Details,
 * opening today's DM view on that contact), and a room row keeps today's
 * distance while the rooms are sorted by Distance.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));
vi.mock('../../../pages/MeshCoreSourcePage', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('meshcore') }));

describe('MeshCore rows', () => {
  it('a channel message\'s ⋯ Node Details opens today\'s DM view on the sender', async () => {
    renderMeshCore(`${HELTEC}/channel/1`);
    const row = (await screen.findByText('Morning, anyone on the coast road? Testing a new antenna.')).closest('[data-message-id]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'More actions' }));
    fireEvent.click(within(row).getByRole('button', { name: /^Node Details/ }));
    expect(await screen.findByTestId('page-meshcore')).toBeInTheDocument();
    expect(screen.getByTestId('view')).toHaveTextContent('dms');
    expect(screen.getByTestId('dm-contact')).toHaveTextContent(MC.glyfada);
  });

  it('our own message has no Node Details', async () => {
    renderMeshCore(`${HELTEC}/channel/1`);
    const own = (await screen.findByText('Heading to Glyfada, will report back on the coast road')).closest('[data-message-id]') as HTMLElement;
    fireEvent.click(within(own).getByRole('button', { name: 'More actions' }));
    expect(within(own).queryByRole('button', { name: /^Node Details/ })).toBeNull();
  });

  it('room rows show today\'s distance while sorted by Distance, not otherwise', async () => {
    localStorage.setItem(`meshmonitor-meshcore-room-sort-mode-src-heltec`, 'distance');
    renderMeshCore(`${HELTEC}/channel/1`);
    const side = await screen.findByRole('complementary', { name: 'Heltec MeshCore' });
    const athens = await within(side).findByRole('link', { name: /Athens Room/ });
    expect(athens).toHaveTextContent(/Athens Room\s*0\.\d km/);
    fireEvent.click(within(side).getByRole('button', { name: 'Sort rooms by' }));
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Room name' }));
    expect(within(side).getByRole('link', { name: /Athens Room/ })).not.toHaveTextContent(/km/);
  });
});
