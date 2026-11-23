/**
 * @vitest-environment jsdom
 *
 * Boards o3-security (desktop), 16-02-security and 16-05-security-digest
 * (phone; s16n0–s16n3): Station G2's Security on today's SecurityTab reads
 * and actions. Scan now and Export run on the server and send nothing; each
 * "Send a DM" opens the DM to that one node with today's notice and sends
 * nothing itself; the digest's Send now posts to Apprise from the server.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { securityNotificationText } from '../../../utils/securityNotificationText';
import { fetched, G2, nonGets, renderTools } from './renderTools';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const ROUTE = `${G2}/security`;
const loaded = () => screen.findByText('Shared public key');

describe('o3-security', () => {
  it('o3-security shows the board', async () => {
    const { container } = renderTools(ROUTE);
    await loaded();
    expectBoard('o3-security', container);
    // Today's counts on the four tiles.
    const tile = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
    expect(tile('Key problems')).toHaveTextContent('3');
    expect(tile('Key problems')).toHaveTextContent('1 weak, 2 shared');
    expect(tile('Noisy senders')).toHaveTextContent('over 60 packets / h');
    expect(tile('Clock off')).toHaveTextContent('more than 5 min');
    expect(tile('Quiet nodes')).toHaveTextContent('9');
  });

  it('16-02-security shows the board', async () => {
    const { container } = renderTools(ROUTE, { phone: true });
    await loaded();
    expectBoard('16-02-security', container);
  });

  it('16-05-security-digest shows the board', async () => {
    const { container } = renderTools(ROUTE, { phone: true });
    await loaded();
    await waitFor(() => expect(screen.getByDisplayValue('discord://1187/Xk9f')).toBeInTheDocument());
    expectBoard('16-05-security-digest', container);
  });

  it('opening Security reads today\'s calls and sends nothing', async () => {
    renderTools(ROUTE);
    await loaded();
    for (const path of ['/api/security/issues', '/api/security/scanner/status', '/api/security/dead-nodes', '/api/security/key-mismatches']) {
      expect(fetched().some((r) => r.startsWith(`GET ${path}?sourceId=src-g2`)), path).toBe(true);
    }
    expect(nonGets()).toEqual([]);
  });

  it('Send a DM opens that node\'s DM with today\'s notice in the draft and sends nothing', async () => {
    renderTools(ROUTE);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Send a DM to Glyfada Beach' }));
    const box = await screen.findByPlaceholderText(/Glyfada Beach/, {}, { timeout: 8000 });
    await waitFor(() => expect(box).toHaveValue(securityNotificationText('duplicateKey', { duplicateCount: 1 })));
    expect(nonGets().filter((r) => !r.startsWith('POST /api/messages/mark-read'))).toEqual([]);
  });

  it('each DM button says what Send will send, one node each', async () => {
    renderTools(ROUTE, { phone: true });
    await loaded();
    expect(screen.getByText('Opens a DM with the notice; Send sends 1 DM to Glyfada Beach')).toBeInTheDocument();
    expect(screen.getByText('Opens a DM with the notice; Send sends 1 DM to Lycabettus Hiker')).toBeInTheDocument();
  });

  it('without messages:write the DM button is off with today\'s reason', async () => {
    renderTools(ROUTE, {
      permissions: { bySource: { 'src-g2': { security: { read: true, write: false }, nodes: { read: true, write: false } } } },
    });
    await loaded();
    const button = screen.getByRole('button', { name: 'Send a DM to Glyfada Beach' });
    expect(button).toBeDisabled();
    expect(screen.getAllByText('You need messages:write permission to send notifications').length).toBeGreaterThan(0);
    // Without security:write there is no Scan now and no digest.
    expect(screen.queryByRole('button', { name: 'Scan now' })).toBeNull();
    expect(screen.queryByText('Security Digest')).toBeNull();
  });

  it('Scan now sends one scan request to the server and shows no Sends line', async () => {
    renderTools(ROUTE);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Scan now' }));
    await waitFor(() => expect(nonGets().filter((r) => r === 'POST /api/security/scanner/scan')).toHaveLength(1));
    expect(nonGets()).toEqual(['POST /api/security/scanner/scan']);
  });

  it('Export offers CSV or JSON and only reads', async () => {
    renderTools(ROUTE);
    await loaded();
    URL.createObjectURL ??= () => 'blob:x';
    URL.revokeObjectURL ??= () => {};
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export as JSON' }));
    await waitFor(() => expect(fetched().some((r) => r.startsWith('GET /api/security/export?format=json&sourceId=src-g2'))).toBe(true));
    expect(nonGets()).toEqual([]);
  });

  it('a tile opens its list in a sheet: Key problems has today\'s details and recommendations', async () => {
    renderTools(ROUTE);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: /^Key problems/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Key problems' });
    expect(sheet).toHaveTextContent('Low-Entropy Keys (1)');
    expect(sheet).toHaveTextContent('Duplicate Keys (2 nodes affected)');
    expect(sheet).toHaveTextContent('This node is using a known weak encryption key');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Key problems' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /^Noisy senders/ }));
    expect(await screen.findByRole('dialog', { name: 'Noisy senders' })).toHaveTextContent('Top Broadcasters (Last Hour)');
  });

  it('the key mismatch log is today\'s table', async () => {
    renderTools(ROUTE);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: /Key mismatch log/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Key Mismatch Events' });
    expect(within(sheet).getByRole('table')).toHaveTextContent('Kifisia Rooftop');
    expect(within(sheet).getByRole('table')).toHaveTextContent('Fixed');
  });

  it('the digest saves with today\'s two writes; Send now posts once to the digest route', async () => {
    const { log } = renderTools(ROUTE);
    await loaded();
    await waitFor(() => expect(screen.getByDisplayValue('discord://1187/Xk9f')).toBeInTheDocument());
    expect(screen.getByText('Send now posts it to the Apprise URL; nothing goes on the mesh')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/settings')).toHaveLength(2));
    const sendNow = screen.getByRole('button', { name: /Send Now/ });
    await act(async () => fireEvent.click(sendNow));
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/security/digest/send')).toHaveLength(1));
  });

  it('`#security` on the bare device URL opens the page', async () => {
    renderTools(`${G2}#security`);
    expect(await loaded()).toBeInTheDocument();
  });
});
