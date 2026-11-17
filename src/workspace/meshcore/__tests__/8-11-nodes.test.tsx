/**
 * @vitest-environment jsdom
 *
 * Board 8-11 (desktop): Heltec MeshCore's Nodes. Title and counts, search,
 * Sort, More filters, Group by Role, Export, Import contact; Discover Nearby /
 * Repeaters / Sensors with its Sends line and the answer; the table (star,
 * node, Neighbour and NEW tags, RSSI, SNR, Voltage, Hops, Last Heard,
 * Position, Key, More details) grouped by role.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/nodes`;
const sends = (log: { writes: Array<{ path: string }> }, end: string) => log.writes.filter((w) => w.path.endsWith(end)).length;

describe('8-11-nodes', () => {
  it('8-11-nodes shows the board', async () => {
    localStorage.setItem('groupNodesByRole', 'true');
    const { container } = renderMeshCore(route);
    await screen.findByRole('link', { name: 'Lycabettus Repeater' });
    fireEvent.click(screen.getByRole('button', { name: /Discover Repeaters/ }));
    await screen.findByText(/Discover Repeaters: 4 contacts returned \(1 new\)/);
    expectBoard('8-11-nodes', container);
  });

  it('opening Nodes and re-rendering send nothing', async () => {
    const { log, rerenderWorkspace } = renderMeshCore(route);
    await screen.findByRole('link', { name: 'Lycabettus Repeater' });
    rerenderWorkspace();
    await new Promise((r) => setTimeout(r, 100));
    expect(log.writes).toHaveLength(0);
  });

  it('a discovery sends one request per press, none while it runs, and marks the new rows', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByRole('link', { name: 'Penteli Repeater' });
    expect(screen.getByText('Sends 1 zero-hop discover request; only nodes in direct range answer')).toBeInTheDocument();
    const repeaters = screen.getByRole('button', { name: /Discover Repeaters/ });
    fireEvent.click(repeaters);
    fireEvent.click(repeaters);
    await screen.findByText(/4 contacts returned/);
    expect(sends(log, '/meshcore/discover')).toBe(1);
    expect(log.writes.find((w) => w.path.endsWith('/meshcore/discover'))!.body).toEqual({ mode: 'repeaters' });
    const row = screen.getByRole('link', { name: 'Penteli Repeater' }).closest('tr')!;
    expect(within(row).getByText('NEW')).toBeInTheDocument();
  });

  it('Import contact writes the radio once and says it sends nothing on the mesh', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByRole('link', { name: 'Lycabettus Repeater' });
    fireEvent.click(screen.getByRole('button', { name: 'Import contact' }));
    const sheet = await screen.findByRole('dialog', { name: 'Import contact' });
    expect(sheet).toHaveTextContent('Sends nothing on the mesh; writes the contact to the radio');
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'meshcore://04a3b7' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(sends(log, '/contacts/import')).toBe(1));
    expect(log.writes.find((w) => w.path.endsWith('/contacts/import'))!.body).toEqual({ advertBytes: [4, 163, 183] });
  });

  it('a row\'s name and More details open its node page', async () => {
    renderMeshCore(route);
    const name = await screen.findByRole('link', { name: 'Glyfada Beach' });
    expect(name).toHaveAttribute('href', `${HELTEC}/node/${MC.glyfada}`);
    const row = name.closest('tr')!;
    expect(within(row).getByRole('link', { name: 'More details' })).toHaveAttribute('href', `${HELTEC}/node/${MC.glyfada}`);
  });

  it('receive-only turns Discover off with today\'s reason', async () => {
    renderMeshCore(route, { fixtures: { 'GET /api/device/tx-status': () => ({ txEnabled: false, canTransmit: false }) } });
    await screen.findByRole('link', { name: 'Lycabettus Repeater' });
    await waitFor(() => expect(screen.getByRole('button', { name: /Discover Repeaters/ })).toBeDisabled());
  });

  it('More filters apply as today: Favorites in Show only leaves the favourites, and the roles are MeshCore\'s', async () => {
    renderMeshCore(route);
    await screen.findByRole('link', { name: 'Penteli Repeater' });
    fireEvent.click(screen.getByRole('button', { name: /More filters/ }));
    const sheet = await screen.findByRole('dialog', { name: /More filters/ });
    expect(within(sheet).getByLabelText('Repeater')).toBeInTheDocument();
    expect(within(sheet).queryByText('Power Source')).toBeNull();
    fireEvent.click(within(sheet).getByLabelText('Favorites'));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Penteli Repeater' })).toBeNull());
    expect(screen.getByRole('link', { name: 'Lycabettus Repeater' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Glyfada Beach' })).toBeInTheDocument();
  });
});
