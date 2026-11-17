/**
 * @vitest-environment jsdom
 *
 * Board g6-meshcore (phone): Lycabettus Repeater's node page. A repeater keeps
 * Log in first (today's console for this node, where the login and the saved
 * password live), then Ask the node, Organise and Data; the tabs Overview,
 * Telemetry, Neighbours and the Console shortcut. Overview: the Path card with
 * Discover path and Reset and their lines, and the Repeater facts (Admin login
 * not logged in). Ping lives in Ask the node (note s8n0).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/node/${MC.lycabettus}`;
const consoleUrl = `${HELTEC}/settings/console?node=${MC.lycabettus}`;

describe('g6-meshcore', () => {
  it('g6-meshcore shows the board', async () => {
    const { container } = renderMeshCore(route, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Lycabettus Repeater' });
    await screen.findByText('Not logged in');
    expectBoard('g6-meshcore', container);
  });

  it('Log in and Console open today\'s console for this node; the link carries no credential', async () => {
    renderMeshCore(route, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Lycabettus Repeater' });
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', consoleUrl);
    expect(screen.getByRole('link', { name: 'Console' })).toHaveAttribute('href', consoleUrl);
    expect(consoleUrl).not.toMatch(/pass|secret|token/i);
  });

  it('without remote_admin:write Log in stays listed, off, with the reason', async () => {
    renderMeshCore(route, {
      phone: true,
      permissions: { bySource: { 'src-heltec': { connection: { read: true, write: false }, nodes: { read: true, write: true } } } },
    });
    await screen.findByRole('heading', { level: 1, name: 'Lycabettus Repeater' });
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(screen.getByText('Log in').closest('[aria-disabled]')).toHaveAttribute('title', 'Needs remote_admin:write');
  });

  it('Ask the node holds Ping, Trace path and Discover path, each with its line; Trace sends once', async () => {
    const { log } = renderMeshCore(route, { phone: true });
    await screen.findByRole('heading', { level: 1, name: 'Lycabettus Repeater' });
    fireEvent.click(screen.getByRole('button', { name: 'Ask the node' }));
    const panel = await screen.findByRole('tabpanel');
    expect(panel).toHaveTextContent('Sends 1 zero-hop ping; only in direct range');
    expect(panel).toHaveTextContent(/Sends 1 trace along the path/);
    expect(panel).toHaveTextContent('Sends 1 path request flood; the reply sets the path');
    fireEvent.click(within(panel).getByRole('button', { name: 'Trace path' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/trace-path'))).toHaveLength(1));
  });

  it('the Neighbours tab reads the stored table and sends nothing until asked', async () => {
    const { log } = renderMeshCore(`${route}/neighbours`, { phone: true });
    expect(await screen.findByText('No neighbours reported.')).toBeInTheDocument();
    expect(screen.getByText('Sends 1 request to the repeater per page, up to 5 pages, one a minute')).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
  });
});
