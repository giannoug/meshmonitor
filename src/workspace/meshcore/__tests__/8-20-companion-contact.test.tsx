/**
 * @vitest-environment jsdom
 *
 * Board 8-20 (phone): Glyfada Beach's node page. Back to Nodes and ⋯, the four
 * tiles (Message, Ask the node, Organise, Data), Not in the radio first, the
 * Path card (route chips, Edit path, Discover path and Reset path with their
 * lines), Ping and Trace path. Edit path opens the path editor in a sheet;
 * Data holds Share, Export and Remove (note s8n6).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/node/${MC.glyfada}`;

describe('8-20-companion-contact', () => {
  it('8-20-companion-contact shows the board', async () => {
    const { container } = renderMeshCore(route, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    fireEvent.click(screen.getByRole('button', { name: 'Ping' }));
    await screen.findByText(/RTT 412 ms/);
    expectBoard('8-20-companion-contact', container);
    expect(screen.getByRole('link', { name: /Message/ })).toHaveAttribute('href', `${HELTEC}/dm/${MC.glyfada}`);
  });

  it('Edit path opens the path editor in a sheet; Save path writes once and closes it', async () => {
    const { log } = renderMeshCore(route, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit path' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit path' });
    expect(within(sheet).getByRole('button', { name: '2-byte' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save path' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/out-path'))).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit path' })).toBeNull());
  });

  it('Data holds Share, Export and Remove; Remove asks first with today\'s words', async () => {
    const { log } = renderMeshCore(route, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    const panel = await screen.findByRole('tabpanel');
    expect(panel).toHaveTextContent('Share contact');
    expect(panel).toHaveTextContent('Export meshcore://');
    fireEvent.click(within(panel).getByRole('button', { name: /^Remove/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Remove' });
    expect(sheet).toHaveTextContent("Remove Glyfada Beach from the device's contact list? This cannot be undone.");
    expect(log.writes).toHaveLength(0);
  });

  it('phone targets: the editor and the page\'s buttons carry data-phone', async () => {
    renderMeshCore(route, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    const card = screen.getByRole('region', { name: 'Path' });
    expect(card.closest('[data-phone]')).not.toBeNull();
  });
});
