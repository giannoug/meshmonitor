/**
 * @vitest-environment jsdom
 *
 * Board 8-05 (desktop): Glyfada Beach, a companion contact, on the node page.
 * Header (Message, Ask the node, Organise, Data; Overview, Telemetry, Links,
 * Position, Admin), the Path card with the inline path editor, Discover path
 * and Reset path; Ping and Trace path with their results; the facts; Not in
 * the radio with Add to radio; Allow CLI; Share contact and Export; Link
 * history and Trace SNR. Every send is one request per press; opening sends
 * nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/node/${MC.glyfada}`;
const sends = (log: { writes: Array<{ path: string }> }, end: string) => log.writes.filter((w) => w.path.endsWith(end)).length;

describe('8-05-companion-contact', () => {
  it('8-05-companion-contact shows the board', async () => {
    const { container, log } = renderMeshCore(route);
    expect(await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' })).toBeInTheDocument();
    await screen.findByText('Trace SNR history');
    fireEvent.click(screen.getByRole('button', { name: 'Ping' }));
    await screen.findByText(/RTT 412 ms/);
    fireEvent.click(screen.getByRole('button', { name: 'Trace path' }));
    await screen.findByText(/per-hop SNR/);
    expectBoard('8-05-companion-contact', container);
    expect(sends(log, '/ping')).toBe(1);
    expect(sends(log, '/trace-path')).toBe(1);
  });

  it('opening the page and re-rendering the whole tree send nothing', async () => {
    const { log, rerenderWorkspace } = renderMeshCore(route);
    await screen.findByText('Trace SNR history');
    const before = vi.mocked(fetch).mock.calls.length;
    rerenderWorkspace();
    rerenderWorkspace();
    await new Promise((r) => setTimeout(r, 100));
    expect(log.writes).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.slice(before).filter(([, i]) => (i?.method ?? 'GET') !== 'GET')).toHaveLength(0);
  });

  it('each transmitting control shows its Sends line', async () => {
    renderMeshCore(route);
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    for (const line of [
      'Sends 1 path request flood; the reply sets the path',
      'Sends nothing; next message floods',
      'Sends 1 zero-hop ping; only in direct range',
      'Sends nothing on the mesh; writes the path to the radio',
    ]) {
      expect(screen.getAllByText(line).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(/^Sends 1 trace along the path/).length).toBeGreaterThan(0);
  });

  it('Discover path sends one request per press and counts down, with no retry', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    const card = screen.getByRole('region', { name: 'Path' });
    fireEvent.click(within(card).getByRole('button', { name: 'Discover Path' }));
    expect(await within(card).findByRole('button', { name: /Discovering… \d+s/ })).toBeDisabled();
    await new Promise((r) => setTimeout(r, 200));
    expect(sends(log, '/discover-path')).toBe(1);
  });

  it('Reset path asks first with today\'s words; Enter sends nothing; the button sends one', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    fireEvent.click(within(screen.getByRole('region', { name: 'Path' })).getByRole('button', { name: 'Reset path' }));
    const sheet = await screen.findByRole('dialog', { name: 'Reset path' });
    expect(sheet).toHaveTextContent('Clear the cached route to Glyfada Beach? The next send to this contact will rediscover the path via flooding.');
    expect(sheet).toHaveTextContent('Sends nothing; next message floods');
    fireEvent.keyDown(sheet, { key: 'Enter' });
    fireEvent.submit(sheet.querySelector('form')!);
    await new Promise((r) => setTimeout(r, 100));
    expect(sends(log, '/reset-path')).toBe(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reset path' }));
    await waitFor(() => expect(sends(log, '/reset-path')).toBe(1));
  });

  it('the inline editor saves the edited path once, with its hash width', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    const card = screen.getByRole('region', { name: 'Path' });
    // Today's hops, by name; drop the second, then save.
    expect(within(card).getByText('Penteli Repeater')).toBeInTheDocument();
    const remove = within(card).getAllByRole('button', { name: 'Remove hop' });
    fireEvent.click(remove[1]);
    fireEvent.click(within(card).getByRole('button', { name: 'Save path' }));
    await waitFor(() => expect(sends(log, '/out-path')).toBe(1));
    expect(log.writes.find((w) => w.path.endsWith('/out-path'))!.body).toEqual({ outPath: 'a7f1', hashBytes: 2 });
  });

  it('Share contact asks first and sends one advert; Add to radio writes the radio once', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    fireEvent.click(screen.getByRole('button', { name: 'Share contact' }));
    const sheet = await screen.findByRole('dialog', { name: 'Share contact' });
    expect(sheet).toHaveTextContent("Broadcast Glyfada Beach's contact info to nearby nodes?");
    expect(sends(log, '/share')).toBe(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Share contact' }));
    await waitFor(() => expect(sends(log, '/share')).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: /Add to radio/ }));
    await waitFor(() => expect(sends(log, '/add-to-device')).toBe(1));
  });

  it('Ask the node lists Ping, Trace path and Discover path, each with its Sends line', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    fireEvent.click(screen.getByRole('button', { name: /Ask the node/ }));
    const menu = await screen.findByRole('group', { name: 'Ask the node' });
    expect(menu).toHaveTextContent('Sends 1 zero-hop ping; only in direct range');
    expect(menu).toHaveTextContent('Sends 1 path request flood; the reply sets the path');
    fireEvent.click(within(menu).getByRole('button', { name: 'Ping' }));
    await waitFor(() => expect(sends(log, '/ping')).toBe(1));
    expect(await screen.findByText(/RTT 412 ms/)).toBeInTheDocument();
  });

  it('without nodes:write the sends are listed, off, with the reason', async () => {
    const { log } = renderMeshCore(route, {
      permissions: { bySource: { 'src-heltec': { connection: { read: true, write: false }, nodes: { read: true, write: false }, messages: { read: true, write: false } } } },
    });
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    expect(screen.getByRole('button', { name: 'Ping' })).toBeDisabled();
    expect(within(screen.getByRole('region', { name: 'Path' })).getByRole('button', { name: 'Discover Path' })).toBeDisabled();
    expect(screen.getAllByText('Needs nodes:write').length).toBeGreaterThan(0);
    expect(log.writes).toHaveLength(0);
  });

  it('receive-only turns the sends off with today\'s reason', async () => {
    renderMeshCore(route, {
      fixtures: { 'GET /api/device/tx-status': () => ({ txEnabled: false, canTransmit: false }) },
    });
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ping' })).toBeDisabled());
    expect(screen.getAllByText(/Receive-only mode is on for this MeshCore source/).length).toBeGreaterThan(0);
  });
});
