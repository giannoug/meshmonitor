/**
 * @vitest-environment jsdom
 *
 * Boards 16-06-quiet-nodes and 16-07-delete-nodes (phone; s16n2): today's Dead
 * nodes as Quiet nodes. Dead after (days) has its own Save; Select all skips
 * never-heard rows; Delete needs security:write and nodes:write, asks plainly
 * with today's sentence (no typed word), and sends one bulk request for
 * exactly the ticked nodes. Nothing is sent on the mesh.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { G2, nonGets, renderTools } from './renderTools';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const ROUTE = `${G2}/security/quiet`;
const tick = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name }));

describe('16-06-quiet-nodes', () => {
  it('16-06-quiet-nodes shows the board', async () => {
    const { container } = renderTools(ROUTE, { phone: true });
    await screen.findByText('Penteli Hut');
    tick('Test bench T-Beam');
    tick('Lycabettus Hiker');
    expectBoard('16-06-quiet-nodes', container);
    expect(screen.getByRole('link', { name: 'Security' })).toHaveAttribute('href', `${G2}/security`);
    expect(nonGets()).toEqual([]);
  });

  it('16-07-delete-nodes shows the board: a plain confirm with today\'s sentence, naming what goes', async () => {
    const { container } = renderTools(ROUTE, { phone: true });
    await screen.findByText('Penteli Hut');
    tick('Test bench T-Beam');
    tick('Lycabettus Hiker');
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 node(s)' }));
    const sheet = await screen.findByRole('dialog');
    expectBoard('16-07-delete-nodes', joined(container, sheet));
    expect(sheet).toHaveTextContent('Test bench T-Beam, Lycabettus Hiker from MeshMonitor');
    expect(sheet).toHaveTextContent('Lycabettus Hiker from Station G2’s node list too (Test bench T-Beam is in MeshMonitor only)');
    expect(sheet).toHaveTextContent('Are you sure you want to delete 2 node(s)? This cannot be undone.');
    expect(sheet).toHaveTextContent('Sends nothing on the mesh');
    expect(within(sheet).queryByRole('textbox')).toBeNull();
    expect(nonGets()).toEqual([]);
  });

  it('Delete sends one bulk request for exactly the ticked nodes, even when pressed twice', async () => {
    const { log } = renderTools(ROUTE);
    await screen.findByText('Penteli Hut');
    tick('Test bench T-Beam');
    tick('Lycabettus Hiker');
    const del = screen.getByRole('button', { name: 'Delete 2 node(s)' });
    await waitFor(() => expect(del).toBeEnabled());
    fireEvent.click(del);
    const sheet = await screen.findByRole('dialog');
    const confirm = within(sheet).getByRole('button', { name: 'Delete 2 node(s)' });
    await act(async () => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/security/dead-nodes/bulk-delete')).toHaveLength(1));
    expect(log.writes[0].body).toEqual({ sourceId: 'src-g2', nodeKeys: [`mt:${0xa1b2c322}`, `mt:${0xa1b2c30a}`] });
  });

  it('one ticked node is one request with one key', async () => {
    const { log } = renderTools(ROUTE);
    await screen.findByText('Penteli Hut');
    tick('Penteli Hut');
    const del = screen.getByRole('button', { name: 'Delete 1 node(s)' });
    await waitFor(() => expect(del).toBeEnabled());
    fireEvent.click(del);
    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveTextContent('Penteli Hut from MeshMonitor');
    expect(sheet).not.toHaveTextContent('node list too');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete 1 node(s)' }));
    await waitFor(() => expect(log.writes).toHaveLength(1));
    expect(log.writes[0].body).toEqual({ sourceId: 'src-g2', nodeKeys: [`mt:${0xa1b2c321}`] });
    expect(nonGets()).toEqual(['POST /api/security/dead-nodes/bulk-delete']);
  });

  it('Select all ticks every heard node, never the one never heard', async () => {
    renderTools(ROUTE);
    await screen.findByText('Penteli Hut');
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(screen.getByText('8 of 9 selected · oldest first')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Kallithea Spare' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Deselect All' })).toBeInTheDocument();
  });

  it('Dead after (days) saves on its own with today\'s per-source write', async () => {
    const { log } = renderTools(ROUTE);
    await screen.findByText('Penteli Hut');
    const days = screen.getByLabelText(/Dead after \(days\)/);
    fireEvent.change(days, { target: { value: '14' } });
    fireEvent.blur(days);
    const save = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(log.writes).toHaveLength(1));
    expect(log.writes[0]).toMatchObject({ path: '/api/settings', body: { securityDeadNodeDays: '14' } });
  });

  it('without nodes:write Delete is off with the reason', async () => {
    renderTools(ROUTE, {
      permissions: { bySource: { 'src-g2': { security: { read: true, write: true }, nodes: { read: true, write: false } } } },
    });
    await screen.findByText('Penteli Hut');
    tick('Penteli Hut');
    expect(screen.getByRole('button', { name: 'Delete 1 node(s)' })).toBeDisabled();
    expect(screen.getByText('Deleting needs security:write and nodes:write on this device.')).toBeInTheDocument();
  });

  it('the Quiet nodes tile and row open the page', async () => {
    renderTools(`${G2}/security`);
    fireEvent.click(await screen.findByRole('button', { name: /^Quiet nodes/ }));
    expect(await screen.findByText('Penteli Hut')).toBeInTheDocument();
  });
});
